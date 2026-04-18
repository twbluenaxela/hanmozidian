"""
Corpus-driven zi.tools scraper.

Reads data/zitools/corpus.json, extracts all unique CJK characters across
ALL pieces into one global set, subtracts characters already scraped
(per zi_tools_scrapes table), then passes the remainder to scrape_chars()
from scrape_zi_tools.py.

Key guarantee: zi.tools returns every available calligrapher/work version
of a character in a single API call, so each character only needs to be
looked up once — ever. This script never sends a character to zi.tools twice.

Usage:
  # Dry run — shows unique char count and estimated time, no network calls
  python scripts/scrape_corpus.py --dry-run

  # Real run
  python scripts/scrape_corpus.py

  # Add more pieces to corpus.json then re-run — already-scraped chars skip instantly
  python scripts/scrape_corpus.py

  # Smoke test: only scrape first 5 unscraped chars
  python scripts/scrape_corpus.py --limit 5 --dry-run
"""

import argparse
import json
import sqlite3
import sys
from pathlib import Path

# Add scripts/ to sys.path so we can import from scrape_zi_tools.py
sys.path.insert(0, str(Path(__file__).parent))

from scrape_zi_tools import scrape_chars, unique_cjk_chars, _s2t_convert, _is_cjk


def load_corpus(corpus_path: Path) -> list[dict]:
    with open(corpus_path, encoding="utf-8") as f:
        data = json.load(f)
    pieces = data.get("pieces", [])
    # Filter out pieces with no text
    return [p for p in pieces if p.get("text", "").strip()]


def extract_global_chars(pieces: list[dict]) -> list[str]:
    """Extract all unique CJK chars across all pieces in first-seen order.

    Characters are converted to traditional Chinese (s2t) to match what
    zi.tools uses, so e.g. 爱 and 愛 are treated as the same lookup target.
    A single character that appears in 10 different pieces results in
    exactly ONE entry in the returned list.
    """
    seen: set[str] = set()
    out: list[str] = []
    for piece in pieces:
        for ch in piece.get("text", ""):
            if not _is_cjk(ch):
                continue
            trad = _s2t_convert(ch)
            # _s2t_convert may expand one char to multiple; take first CJK
            if len(trad) != 1 or not _is_cjk(trad):
                trad = next((c for c in trad if _is_cjk(c)), ch)
            if trad not in seen:
                seen.add(trad)
                out.append(trad)
    return out


def already_scraped(chars: list[str], db_path: str) -> set[str]:
    try:
        conn = sqlite3.connect(db_path)
        conn.execute("CREATE TABLE IF NOT EXISTS zi_tools_scrapes (character TEXT PRIMARY KEY, scraped_at TEXT NOT NULL)")
        rows = conn.execute("SELECT character FROM zi_tools_scrapes").fetchall()
        conn.close()
        return {r[0] for r in rows}
    except Exception as e:
        print(f"warning: could not read zi_tools_scrapes ({e}); assuming none scraped", file=sys.stderr)
        return set()


def main() -> int:
    parser = argparse.ArgumentParser(
        description="Corpus-driven zi.tools scraper — reads corpus.json and scrapes new chars only"
    )
    parser.add_argument(
        "--corpus",
        default="data/zitools/corpus.json",
        help="Path to corpus JSON file (default: data/zitools/corpus.json)",
    )
    parser.add_argument(
        "--db",
        default="data/shufazidian.db",
        help="SQLite database path (default: data/shufazidian.db)",
    )
    parser.add_argument(
        "--output-dir",
        default="public/images",
        help="Output directory for WebP images (default: public/images)",
    )
    parser.add_argument(
        "--rate",
        type=float,
        default=2.0,
        help="Seconds between API calls (default: 2.0)",
    )
    parser.add_argument(
        "--limit",
        type=int,
        default=None,
        help="Only scrape first N unscraped characters (for smoke tests)",
    )
    parser.add_argument(
        "--dry-run",
        action="store_true",
        help="Show stats and exit without scraping or writing anything",
    )
    parser.add_argument(
        "--errors-log",
        default="data/zi_tools_errors.log",
    )
    args = parser.parse_args()

    corpus_path = Path(args.corpus)
    if not corpus_path.exists():
        print(f"error: corpus file not found: {corpus_path}", file=sys.stderr)
        return 1

    pieces = load_corpus(corpus_path)
    if not pieces:
        print("error: no pieces with text found in corpus", file=sys.stderr)
        return 1

    print(f"corpus: {len(pieces)} pieces with text")

    all_chars = extract_global_chars(pieces)
    print(f"unique CJK characters across all pieces: {len(all_chars)}")

    done = already_scraped(all_chars, args.db)
    remaining = [c for c in all_chars if c not in done]

    print(f"already scraped: {len(done & set(all_chars))}")
    print(f"to scrape:       {len(remaining)}")
    est_seconds = len(remaining) * args.rate
    est_minutes = est_seconds / 60
    print(f"estimated time:  {est_minutes:.0f} min at {args.rate}s/char")

    if args.dry_run:
        print("\n[dry run] no scraping performed")
        return 0

    if not remaining:
        print("nothing to scrape — all corpus characters already in zi_tools_scrapes")
        return 0

    scrape_chars(
        chars=remaining,
        db_path=args.db,
        output_dir=args.output_dir,
        delay=args.rate,
        limit=args.limit,
        dry_run=False,
        errors_log_path=args.errors_log,
    )
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
