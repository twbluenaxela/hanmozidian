"""
ingest.py — Fetch NPM calligraphy works metadata and images.

Usage:
  # Fetch a single work by identifier:
  python ingest.py --id 故書000001N000000000

  # Bulk fetch all works from one or more API endpoints:
  python ingest.py --bulk

  # List all locally indexed works and their status:
  python ingest.py --list
"""

import argparse
import json
import os
import sys
import time
from datetime import datetime
from pathlib import Path

import requests

BASE_DIR = Path(__file__).parent
DATA_DIR = BASE_DIR / "data"
RAW_DIR = DATA_DIR / "raw"
INDEX_FILE = DATA_DIR / "works_index.json"

RAW_DIR.mkdir(parents=True, exist_ok=True)

API_ENDPOINTS = {
    "法書": "https://odapi.npm.gov.tw/data/open/api/v1/digitalCollection/calligraphicWorks.json",
    "法帖": "https://odapi.npm.gov.tw/data/open/api/v1/digitalCollection/calligraphicModelBooks.json",
    "拓片": "https://odapi.npm.gov.tw/data/open/api/v1/digitalCollection/rubbings.json",
}

HEADERS = {"User-Agent": "ShufazidianResearch/1.0 (educational calligraphy dictionary)"}


def safe_filename(identifier: str) -> str:
    """Encode Chinese characters so the filename is ASCII-safe on all filesystems."""
    from urllib.parse import quote
    return quote(identifier, safe="").replace("%", "_")


# ── Index helpers ─────────────────────────────────────────────────────────────

def load_index() -> dict:
    if INDEX_FILE.exists():
        return json.loads(INDEX_FILE.read_text(encoding="utf-8"))
    return {}


def save_index(index: dict):
    INDEX_FILE.write_text(json.dumps(index, ensure_ascii=False, indent=2), encoding="utf-8")


def now_ts() -> str:
    return datetime.now().isoformat(timespec="seconds")


# ── API fetch ─────────────────────────────────────────────────────────────────

def fetch_api(url: str) -> list[dict]:
    print(f"Fetching {url} ...")
    r = requests.get(url, headers=HEADERS, timeout=30)
    r.raise_for_status()
    return r.json()


def download_image(image_url: str, dest: Path) -> bool:
    if dest.exists():
        return True
    try:
        r = requests.get(image_url, headers=HEADERS, timeout=30, stream=True)
        r.raise_for_status()
        dest.write_bytes(r.content)
        time.sleep(0.5)  # be polite
        return True
    except Exception as e:
        print(f"  Image download failed: {e}")
        return False


# ── Single work fetch ─────────────────────────────────────────────────────────

def fetch_single(identifier: str, shiwen: str | None = None):
    index = load_index()

    # Check if already indexed from a bulk fetch
    entry = index.get(identifier)
    if not entry:
        # Try to find it across all API endpoints
        print(f"Searching for {identifier} across all endpoints...")
        for category, url in API_ENDPOINTS.items():
            try:
                records = fetch_api(url)
                for rec in records:
                    if rec.get("identifier") == identifier:
                        entry = _make_entry(rec)
                        index[identifier] = entry
                        save_index(index)
                        print(f"  Found in {category}")
                        break
                if entry:
                    break
            except Exception as e:
                print(f"  Error fetching {category}: {e}")

    if not entry:
        print(f"ERROR: identifier {identifier} not found in any API endpoint.")
        sys.exit(1)

    # Download image
    img_path = RAW_DIR / f"{safe_filename(identifier)}.jpg"
    if entry.get("imageUrl"):
        ok = download_image(entry["imageUrl"], img_path)
        if ok:
            entry["localImagePath"] = str(img_path.relative_to(BASE_DIR))

    # Set 釋文 if provided
    if shiwen:
        entry["shiwen"] = shiwen
        print(f"  釋文 set ({len(shiwen)} chars)")

    entry["updatedAt"] = now_ts()
    index[identifier] = entry
    save_index(index)

    print(f"\n✓ {entry['name']}")
    print(f"  identifier : {identifier}")
    print(f"  category   : {entry['category']}")
    print(f"  era        : {entry.get('era', '—')}")
    print(f"  calligrapher: {entry.get('calligrapher', '—')}")
    print(f"  釋文       : {'✓ set' if entry.get('shiwen') else '✗ missing — use --shiwen to add'}")
    print(f"  image      : {entry.get('localImagePath', '✗ not downloaded')}")
    print(f"  status     : {entry['status']}")


# ── Bulk fetch ────────────────────────────────────────────────────────────────

def fetch_bulk():
    index = load_index()
    new_count = 0

    for category, url in API_ENDPOINTS.items():
        try:
            records = fetch_api(url)
            print(f"  {category}: {len(records)} records")
            for rec in records:
                ident = rec.get("identifier")
                if not ident:
                    continue
                if ident not in index:
                    index[ident] = _make_entry(rec)
                    new_count += 1
        except Exception as e:
            print(f"  ERROR fetching {category}: {e}")

    save_index(index)
    print(f"\n✓ Bulk fetch complete. {new_count} new works indexed. Total: {len(index)}")


# ── List ──────────────────────────────────────────────────────────────────────

def list_works(status_filter: str | None = None):
    index = load_index()
    works = list(index.values())
    if status_filter:
        works = [w for w in works if w["status"] == status_filter]

    status_counts: dict[str, int] = {}
    for w in index.values():
        s = w["status"]
        status_counts[s] = status_counts.get(s, 0) + 1

    print(f"Total: {len(index)} works indexed")
    for s, count in sorted(status_counts.items()):
        print(f"  {s:12s} {count}")

    if status_filter:
        print(f"\n── {status_filter} ──")
        for w in works[:50]:
            shiwen_mark = "✓" if w.get("shiwen") else "✗"
            print(f"  [{shiwen_mark}釋文] {w['identifier']}  {w['name']}")
        if len(works) > 50:
            print(f"  ... and {len(works) - 50} more")


# ── Entry builder ─────────────────────────────────────────────────────────────

def _make_entry(rec: dict) -> dict:
    return {
        "identifier": rec["identifier"],
        "name": rec.get("name", ""),
        "category": rec.get("category", ""),
        "calligrapher": None,
        "era": rec.get("era", ""),
        "styleSlug": None,
        "shiwen": None,
        "desc": rec.get("desc", ""),
        "sourceUrl": rec.get("url", ""),
        "imageUrl": rec.get("imageUrl_m", ""),
        "localImagePath": None,
        "status": "pending",
        "annotationDraft": None,
        "createdAt": now_ts(),
        "updatedAt": now_ts(),
    }


# ── CLI ───────────────────────────────────────────────────────────────────────

def main():
    parser = argparse.ArgumentParser(description="NPM calligraphy ingest tool")
    group = parser.add_mutually_exclusive_group(required=True)
    group.add_argument("--id", metavar="IDENTIFIER", help="Fetch single work by 文物統一編號")
    group.add_argument("--bulk", action="store_true", help="Bulk fetch all API endpoints")
    group.add_argument("--list", action="store_true", help="List indexed works")

    parser.add_argument("--shiwen", metavar="TEXT", help="Set 釋文 for a work (use with --id)")
    parser.add_argument("--status", metavar="STATUS", help="Filter --list by status")

    args = parser.parse_args()

    if args.id:
        fetch_single(args.id, shiwen=args.shiwen)
    elif args.bulk:
        fetch_bulk()
    elif args.list:
        list_works(status_filter=args.status)


if __name__ == "__main__":
    main()
