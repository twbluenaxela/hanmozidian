"""
Targeted R2 upload for a single annotated work.

Uploads (with overwrite) only the files belonging to the given identifier,
without needing to list the entire R2 bucket first.

Usage:
  python pipeline/upload_work.py --id <identifier>
"""

import argparse
import json
import os
import sys
from pathlib import Path

try:
    import boto3
    from botocore.config import Config
    from botocore.exceptions import ClientError
    from dotenv import load_dotenv
except ImportError as e:
    missing = getattr(e, "name", str(e))
    print(f"Missing dependency: {missing}. Install: pip install boto3 python-dotenv")
    sys.exit(1)

ROOT = Path(__file__).parent.parent
ENV_PATH = ROOT / ".env.local"
load_dotenv(ENV_PATH)
INDEX_FILE = ROOT / "pipeline" / "data" / "works_index.json"

R2_ENDPOINT = os.environ.get("R2_ENDPOINT")
R2_ACCESS_KEY_ID = os.environ.get("R2_ACCESS_KEY_ID")
R2_SECRET_ACCESS_KEY = os.environ.get("R2_SECRET_ACCESS_KEY")
R2_BUCKET_NAME = os.environ.get("R2_BUCKET_NAME")
R2_PUBLIC_URL = os.environ.get("R2_PUBLIC_URL", "")


def main():
    parser = argparse.ArgumentParser(description="Upload a single work's images to R2")
    parser.add_argument("--id", required=True, dest="identifier", help="Work identifier")
    args = parser.parse_args()

    with open(INDEX_FILE) as f:
        index = json.load(f)

    work = index.get(args.identifier)
    if not work:
        print(f"Error: work '{args.identifier}' not found in index")
        sys.exit(1)

    style_slug = work.get("styleSlug")
    if not style_slug:
        print(f"Error: work has no styleSlug")
        sys.exit(1)

    images_dir = ROOT / "public" / "images" / style_slug
    if not images_dir.exists():
        print(f"No images directory found at {images_dir}")
        sys.exit(0)

    marker = f"_{args.identifier}_"
    files = sorted(f for f in images_dir.iterdir() if marker in f.name and f.suffix == ".webp")

    if not files:
        print(f"No files found for '{args.identifier}' in {images_dir}")
        sys.exit(0)

    print(f"Found {len(files)} file(s) for '{args.identifier}' ({style_slug})")

    if not all([R2_ENDPOINT, R2_ACCESS_KEY_ID, R2_SECRET_ACCESS_KEY, R2_BUCKET_NAME]):
        print("Error: R2 credentials missing in .env.local")
        sys.exit(1)

    client = boto3.client(
        "s3",
        endpoint_url=R2_ENDPOINT,
        aws_access_key_id=R2_ACCESS_KEY_ID,
        aws_secret_access_key=R2_SECRET_ACCESS_KEY,
        region_name="auto",
        config=Config(signature_version="s3v4", s3={"addressing_style": "path"}),
    )

    uploaded = 0
    failed = 0
    for f in files:
        key = f"images/{style_slug}/{f.name}"
        try:
            client.upload_file(
                Filename=str(f),
                Bucket=R2_BUCKET_NAME,
                Key=key,
                ExtraArgs={
                    "ContentType": "image/webp",
                    "CacheControl": "public, max-age=3600, stale-while-revalidate=86400",
                },
            )
            print(f"  ✓ {f.name}")
            uploaded += 1
        except ClientError as e:
            print(f"  ✗ {f.name}: {e}")
            failed += 1

    print(f"\nUploaded: {uploaded}  Failed: {failed}")
    if R2_PUBLIC_URL and uploaded > 0:
        sample_key = f"images/{style_slug}/{files[0].name}"
        print(f"Sample URL: {R2_PUBLIC_URL}/{sample_key}")


if __name__ == "__main__":
    main()
