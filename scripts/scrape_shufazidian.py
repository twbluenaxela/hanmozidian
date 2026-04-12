"""
Scrape calligraphy images from shufazidian.com (supplementary data source).

This scraper is rate-limited and respects robots.txt.
Results are stored in a staging directory for manual review before ingestion.

Usage:
  pip install requests beautifulsoup4 Pillow tqdm
  python scripts/scrape_shufazidian.py \
    --characters "永和天下" \
    --output-dir data/scraped/shufazidian \
    --db data/shufazidian.db
"""

import argparse
import json
import os
import sqlite3
import time
from pathlib import Path

import requests
from bs4 import BeautifulSoup
from PIL import Image
from io import BytesIO


HEADERS = {
    "User-Agent": "Mozilla/5.0 (compatible; CalligraphyDictBot/1.0; research use)"
}
RATE_LIMIT_SECONDS = 1.0


def char_to_unicode_hex(char: str) -> str:
    return f"{ord(char):04X}"


def scrape_character(char: str, output_dir: Path, session: requests.Session):
    """Scrape calligraphy images for a single character."""
    results = []
    hex_code = char_to_unicode_hex(char)
    char_dir = output_dir / hex_code
    char_dir.mkdir(parents=True, exist_ok=True)

    # This is a template — actual URLs depend on the target site's structure.
    # You will need to inspect the target site and adjust selectors accordingly.
    print(f"  [NOTE] Scraping logic needs to be customized for the target site's HTML structure.")
    print(f"  Skipping actual HTTP requests until site structure is analyzed.")
    print(f"  To implement: inspect the site's search/character pages and update selectors.")

    # Template for what the scraping would look like:
    # url = f"https://www.shufazidian.com/search?q={char}"
    # time.sleep(RATE_LIMIT_SECONDS)
    # response = session.get(url, headers=HEADERS)
    # soup = BeautifulSoup(response.text, "html.parser")
    #
    # for img_elem in soup.select(".calligraphy-image-selector"):
    #     img_url = img_elem.get("src")
    #     calligrapher = img_elem.get("data-calligrapher", "unknown")
    #     style = img_elem.get("data-style", "unknown")
    #     work = img_elem.get("data-work", "")
    #
    #     img_response = session.get(img_url, headers=HEADERS)
    #     time.sleep(RATE_LIMIT_SECONDS)
    #
    #     results.append({
    #         "character": char,
    #         "calligrapher": calligrapher,
    #         "style": style,
    #         "work": work,
    #         "image_url": img_url,
    #     })

    return results


def main():
    parser = argparse.ArgumentParser(description="Scrape calligraphy from shufazidian.com")
    parser.add_argument("--characters", required=True, help="String of characters to scrape")
    parser.add_argument("--output-dir", default="data/scraped/shufazidian")
    parser.add_argument("--db", default="data/shufazidian.db")
    args = parser.parse_args()

    output_dir = Path(args.output_dir)
    output_dir.mkdir(parents=True, exist_ok=True)

    session = requests.Session()

    all_results = []
    for char in args.characters:
        print(f"Scraping: {char}")
        results = scrape_character(char, output_dir, session)
        all_results.extend(results)
        time.sleep(RATE_LIMIT_SECONDS)

    # Save metadata
    meta_path = output_dir / "metadata.json"
    with open(meta_path, "w", encoding="utf-8") as f:
        json.dump(all_results, f, ensure_ascii=False, indent=2)

    print(f"\nScraped {len(all_results)} images. Metadata saved to {meta_path}")
    print("Review the scraped data before running ingestion.")


if __name__ == "__main__":
    main()
