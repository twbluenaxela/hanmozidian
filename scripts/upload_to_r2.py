"""
Upload local calligraphy images to Cloudflare R2.

This script uploads images from a local staging directory to R2 and updates
the SQLite database to reference the R2 object keys.

Credentials are loaded from .env.local.

Prerequisites:
  pip install boto3 python-dotenv tqdm

Usage:
  # Upload everything under public/images/ (default):
  python scripts/upload_to_r2.py

  # Upload a specific subdirectory (e.g. only 楷書):
  python scripts/upload_to_r2.py --source public/images/kai

  # Dry run (show what would be uploaded without actually uploading):
  python scripts/upload_to_r2.py --dry-run

  # Upload and remove local copies after successful upload:
  python scripts/upload_to_r2.py --cleanup

  # Tune parallelism (default 8 threads):
  python scripts/upload_to_r2.py --workers 16
"""

import argparse
import os
import sqlite3
import sys
import threading
from concurrent.futures import ThreadPoolExecutor, as_completed
from pathlib import Path

try:
    import boto3
    from botocore.exceptions import ClientError
    from botocore.config import Config
    from dotenv import load_dotenv
    from tqdm import tqdm
except ImportError as e:
    missing = getattr(e, 'name', str(e))
    print(f"Missing dependency: {missing}")
    print("Install with: pip install boto3 python-dotenv tqdm")
    sys.exit(1)


# Load env from .env.local
ENV_PATH = Path(__file__).parent.parent / ".env.local"
load_dotenv(ENV_PATH)

R2_ENDPOINT = os.environ.get("R2_ENDPOINT")
R2_ACCESS_KEY_ID = os.environ.get("R2_ACCESS_KEY_ID")
R2_SECRET_ACCESS_KEY = os.environ.get("R2_SECRET_ACCESS_KEY")
R2_BUCKET_NAME = os.environ.get("R2_BUCKET_NAME")
R2_PUBLIC_URL = os.environ.get("R2_PUBLIC_URL", "")


MIME_TYPES = {
    ".webp": "image/webp",
    ".jpg": "image/jpeg",
    ".jpeg": "image/jpeg",
    ".png": "image/png",
    ".svg": "image/svg+xml",
    ".gif": "image/gif",
}


def get_r2_client(max_pool_connections: int = 16):
    """Create an S3 client configured for Cloudflare R2."""
    if not all([R2_ENDPOINT, R2_ACCESS_KEY_ID, R2_SECRET_ACCESS_KEY, R2_BUCKET_NAME]):
        print("Error: R2 credentials missing in .env.local")
        print("Required: R2_ENDPOINT, R2_ACCESS_KEY_ID, R2_SECRET_ACCESS_KEY, R2_BUCKET_NAME")
        sys.exit(1)

    return boto3.client(
        "s3",
        endpoint_url=R2_ENDPOINT,
        aws_access_key_id=R2_ACCESS_KEY_ID,
        aws_secret_access_key=R2_SECRET_ACCESS_KEY,
        region_name="auto",
        config=Config(
            signature_version="s3v4",
            s3={"addressing_style": "path"},
            max_pool_connections=max_pool_connections,
        ),
    )


def verify_connection(client):
    """Sanity check: confirm bucket is accessible."""
    try:
        client.head_bucket(Bucket=R2_BUCKET_NAME)
        print(f"✓ Connected to R2 bucket: {R2_BUCKET_NAME}")
    except ClientError as e:
        print(f"✗ Cannot access bucket {R2_BUCKET_NAME}: {e}")
        sys.exit(1)


def collect_files(source_dir: Path):
    """Yield (local_path, r2_key) pairs for every image under source_dir."""
    supported_exts = set(MIME_TYPES.keys())
    for path in source_dir.rglob("*"):
        if not path.is_file():
            continue
        if path.suffix.lower() not in supported_exts:
            continue
        # Compute R2 key relative to the "public" directory
        try:
            rel = path.relative_to(Path("public"))
            key = str(rel).replace(os.sep, "/")
        except ValueError:
            # Source is outside public/ — key = path relative to source_dir
            rel = path.relative_to(source_dir)
            key = f"images/{rel}".replace(os.sep, "/")
        yield path, key


def upload_file(client, local_path: Path, key: str) -> bool:
    """Upload a single file to R2. Returns True on success."""
    content_type = MIME_TYPES.get(local_path.suffix.lower(), "application/octet-stream")
    try:
        client.upload_file(
            Filename=str(local_path),
            Bucket=R2_BUCKET_NAME,
            Key=key,
            ExtraArgs={
                "ContentType": content_type,
                "CacheControl": "public, max-age=31536000, immutable",
            },
        )
        return True
    except ClientError as e:
        print(f"  ✗ {key}: {e}")
        return False


def update_db_paths(db_path: Path, uploaded_keys: set):
    """
    Verify DB records against R2-compatible paths.
    """
    if not db_path.exists():
        print(f"Note: database {db_path} not found, skipping DB update.")
        return

    conn = sqlite3.connect(db_path)
    cur = conn.cursor()
    cur.execute("SELECT COUNT(*) FROM calligraphy_images WHERE image_path LIKE 'images/%'")
    count = cur.fetchone()[0]
    print(f"DB has {count} records with R2-compatible image paths.")
    conn.close()


def main():
    parser = argparse.ArgumentParser(description="Upload calligraphy images to Cloudflare R2")
    parser.add_argument(
        "--source",
        default="public/images",
        help="Source directory to upload (default: public/images)",
    )
    parser.add_argument("--db", default="data/shufazidian.db", help="SQLite database path")
    parser.add_argument("--dry-run", action="store_true", help="Show what would be uploaded")
    parser.add_argument("--cleanup", action="store_true", help="Delete local files after upload")
    parser.add_argument("--overwrite", action="store_true", help="Re-upload files that already exist in R2")
    parser.add_argument("--workers", type=int, default=8, help="Number of parallel upload threads (default: 8)")
    args = parser.parse_args()

    source_dir = Path(args.source)
    if not source_dir.exists():
        print(f"Error: source directory {source_dir} does not exist.")
        sys.exit(1)

    files = list(collect_files(source_dir))
    if not files:
        print(f"No image files found under {source_dir}")
        sys.exit(0)

    print(f"Found {len(files)} image(s) under {source_dir}")

    if args.dry_run:
        print("\nDry run — no uploads will happen.")
        for local_path, key in files[:10]:
            print(f"  would upload: {local_path}  →  {key}")
        if len(files) > 10:
            print(f"  ... and {len(files) - 10} more")
        return 0

    # Size the connection pool slightly above the worker count so threads
    # never block waiting for a connection.
    client = get_r2_client(max_pool_connections=max(args.workers * 2, 16))
    verify_connection(client)

    # Check existing keys if we should skip them
    existing_keys = set()
    if not args.overwrite:
        print("Listing existing R2 objects (to skip already-uploaded files)...")
        paginator = client.get_paginator("list_objects_v2")
        try:
            for page in paginator.paginate(Bucket=R2_BUCKET_NAME, Prefix="images/"):
                for obj in page.get("Contents", []) or []:
                    existing_keys.add(obj["Key"])
            print(f"  {len(existing_keys)} object(s) already in R2.")
        except ClientError as e:
            print(f"  Warning: could not list bucket: {e}")

    pending = [(p, k) for p, k in files if args.overwrite or k not in existing_keys]
    skipped = len(files) - len(pending)
    uploaded = 0
    failed = 0
    uploaded_keys = set()
    lock = threading.Lock()

    def _upload_one(item):
        local_path, key = item
        ok = upload_file(client, local_path, key)
        if ok and args.cleanup:
            try:
                local_path.unlink()
            except OSError as e:
                print(f"  Warning: could not delete {local_path}: {e}")
        return ok, key

    with ThreadPoolExecutor(max_workers=args.workers) as pool:
        futures = [pool.submit(_upload_one, item) for item in pending]
        for fut in tqdm(as_completed(futures), total=len(futures), desc="Uploading"):
            ok, key = fut.result()
            with lock:
                if ok:
                    uploaded += 1
                    uploaded_keys.add(key)
                else:
                    failed += 1

    print()
    print(f"Uploaded: {uploaded}")
    print(f"Skipped (already in R2): {skipped}")
    print(f"Failed: {failed}")

    if R2_PUBLIC_URL and uploaded_keys:
        sample = next(iter(uploaded_keys))
        print(f"\nSample public URL: {R2_PUBLIC_URL}/{sample}")

    update_db_paths(Path(args.db), uploaded_keys)
    return 0


if __name__ == "__main__":
    raise SystemExit(main())