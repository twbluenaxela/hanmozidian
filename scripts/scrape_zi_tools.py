"""
Ingest calligraphy glyphs from zi.tools into the SQLite database.

zi.tools exposes a private JSON API that returns every glyph for a
single character as a list of base64-encoded PNGs, tagged with style,
dynasty, author and (sometimes) work title. This is the only source
we have right now that covers 金文 (bronze-inscription script), and
it's the second source to populate 行/草/隸/楷 — so it both expands
the dictionary and fills in the lone style tab that zhuojg can't.

Mirrors `scripts/ingest_zhuojg.py`: single file, argparse, direct
sqlite3, OpenCC S2T for author/work names, Pillow for image
normalization. Writes to `public/images/{style_slug}/{unicode_hex}/{md5}.webp` 
so filenames are deterministic across re-runs and duplicate base64 
payloads overwrite harmlessly.

Usage:
  pip install requests Pillow opencc-python-reimplemented tqdm

  # One character, smoke test
  python scripts/scrape_zi_tools.py --chars "永"

  # Real batch run from a seed text file
  python scripts/scrape_zi_tools.py \
    --chars-file data/seed_texts/lan_ting_xu.txt \
    --output-dir public/images \
    --db data/shufazidian.db \
    --rate 2.0

  # Idempotent re-run (clears existing zi.tools rows first)
  python scripts/scrape_zi_tools.py --chars-file ... --clean-source
"""

import argparse
import base64
import hashlib
import json
import sqlite3
import sys
import time
from io import BytesIO
from pathlib import Path
from typing import TYPE_CHECKING, Callable, Optional
from urllib.parse import quote

try:
    import requests
except ImportError as exc:
    print(
        "error: requests is required to run this script. Install with: pip install requests",
        file=sys.stderr,
    )
    raise SystemExit(1) from exc

try:
    from PIL import Image
except ImportError as exc:
    print(
        "error: Pillow is required to run this script. Install with: pip install Pillow",
        file=sys.stderr,
    )
    raise SystemExit(1) from exc

try:
    from tqdm import tqdm
except ImportError as exc:
    print(
        "error: tqdm is required to run this script. Install with: pip install tqdm",
        file=sys.stderr,
    )
    raise SystemExit(1) from exc

if TYPE_CHECKING:
    from opencc import OpenCC

_s2t_convert: Callable[[str], str]

try:
    from opencc import OpenCC
    _s2t_convert = OpenCC("s2t").convert
except Exception:  # pragma: no cover
    print(
        "warning: opencc-python-reimplemented not installed "
        "author/work name simplified->traditional conversion will be skipped. "
        "Install with: pip install opencc-python-reimplemented",
        file=sys.stderr,
    )

    def _s2t_convert_fallback(string: str) -> str:
        return string

    _s2t_convert = _s2t_convert_fallback

# --------- constants ---------

API_URL = "https://zi.tools/api/tu/"
SOURCE_TAG = "zi.tools"

# Rows that decode to more than this many bytes are treated as corrupt
# or runaway and skipped. Keeps the script from blowing out disk on a
# single bad response.
MAX_IMAGE_BYTES = 5 * 1024 * 1024

# zi.tools returns style as a short label; map to our canonical slug.
# 篆書 is intentionally absent — zi.tools doesn't return it on this
# endpoint (bronze-inscription glyphs come back as 金/金文 instead).
STYLE_LABEL_TO_SLUG = {
    "金": "jinwen",
    "金文": "jinwen",
    "篆": "zhuan",
    "隸": "li",
    "隶": "li",
    "楷": "kai",
    "行": "xing",
    "草": "cao",
}

# Heuristic for telling "this is a work title" apart from "this is an
# author name" when a row has only one of the two fields. Any of these
# suffix characters implies a work title. Ported directly from the
# user's standalone scraper.
WORK_SUFFIX_CHARS = frozenset("碑帖序經銘誌卷書簡文盟版石鼎")
_WORK_SUFFIX_EXTRAS = ("字典",)  # 2-char suffixes

def looks_like_work(text: str) -> bool:
    if not text:
        return False
    return (
        text.endswith(_WORK_SUFFIX_EXTRAS)
        or (len(text) > 0 and text[-1] in WORK_SUFFIX_CHARS)
    )

# Time period labels that appear in 金文 rows (e.g. 西周早期, 春秋, 戰國).
# These are not calligrapher names or work titles — rows using them as the
# sole attribution should be skipped.
_PERIOD_SUFFIX_CHARS = frozenset("期代末初")

# Bare dynasty / era names used as attribution in 金文 rows
_PERIOD_BARE_NAMES = frozenset([
    "西周", "東周", "春秋", "戰國", "商", "周",
])

def looks_like_period(text: str) -> bool:
    if not text:
        return False
    # Ends in explicit period qualifier (早期, 中期, 晚期, 時代, …)
    if text[-1] in _PERIOD_SUFFIX_CHARS:
        return True
    # Exact bare dynasty / era name
    if text in _PERIOD_BARE_NAMES:
        return True
    # Compound range like '西周晚期或春秋早期'
    if "或" in text:
        return True
    return False

# --------- CJK helpers ---------

def _is_cjk(ch: str) -> bool:
    if len(ch) != 1:
        return False
    o = ord(ch)
    return (
        0x4E00 <= o <= 0x9FFF  # CJK Unified Ideographs
        or 0x3400 <= o <= 0x4DBF  # Extension A
    )

def char_to_unicode_hex(char: str) -> str:
    return f"{ord(char):04X}"

def unique_cjk_chars(text: str) -> list[str]:
    """Return CJK characters from `text` in first-seen order."""
    seen: set[str] = set()
    out: list[str] = []
    for ch in text:
        if _is_cjk(ch) and ch not in seen:
            seen.add(ch)
            out.append(ch)
    return out

# --------- DB helpers (mirror ingest_zhuojg.py) ---------

def get_or_create_character(cursor: sqlite3.Cursor, char: str) -> int:
    hex_code = char_to_unicode_hex(char)
    cursor.execute(
        "INSERT OR IGNORE INTO characters (character, unicode_hex) VALUES (?, ?)",
        (char, hex_code),
    )
    cursor.execute("SELECT id FROM characters WHERE character = ?", (char,))
    return cursor.fetchone()[0]

def get_or_create_calligrapher(
    cursor: sqlite3.Cursor, name_zh: str, dynasty: Optional[str]
) -> Optional[int]:
    if not name_zh or name_zh == "Unknown":
        return None
    cursor.execute("SELECT id FROM calligraphers WHERE name_zh = ?", (name_zh,))
    row = cursor.fetchone()
    if row:
        return row[0]
    cursor.execute(
        "INSERT INTO calligraphers (name_zh, dynasty) VALUES (?, ?)",
        (name_zh, dynasty),
    )
    return cursor.lastrowid # type: ignore[return-value]

def get_or_create_work(
    cursor: sqlite3.Cursor,
    name_zh: str,
    calligrapher_id: Optional[int],
    style_id: int,
) -> Optional[int]:
    if not name_zh or name_zh == "Unknown":
        return None
    cursor.execute("SELECT id FROM works WHERE name_zh = ?", (name_zh,))
    row = cursor.fetchone()
    if row:
        return row[0]
    cursor.execute(
        "INSERT INTO works (name_zh, calligrapher_id, style_id) VALUES (?, ?, ?)",
        (name_zh, calligrapher_id, style_id),
    )
    return cursor.lastrowid # type: ignore[return-value]

# --------- zi.tools API ---------

def _headers_for(char: str) -> dict[str, str]:
    # The Referer is non-optional — without it the API returns nothing.
    return {
        "User-Agent": (
            "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) "
            "AppleWebKit/537.36 (KHTML, like Gecko) "
            "Chrome/120.0.841.36 Safari/537.36"
        ),
        "Accept": "application/json",
        "Content-Type": "application/json",
        "Referer": f"https://zi.tools/zi/{quote(char)}",
        "Origin": "https://zi.tools",
    }

def fetch_character(
    session: requests.Session, char: str, timeout: float = 30.0
) -> Optional[dict]:
    """POST /api/tu/ for a single character, with 3 retries on 5xx / network."""
    backoff = 1.0
    for attempt in range(3):
        try:
            resp = session.post(
                API_URL,
                data=json.dumps({"zi": char}),
                headers=_headers_for(char),
                timeout=timeout,
            )
            if resp.status_code == 200:
                return resp.json()
            if 400 <= resp.status_code < 500:
                # Client error — probably banned or bad char. Don't retry.
                print(
                    f"  zi.tools returned {resp.status_code} for {char!r}; skipping",
                    file=sys.stderr
                )
                return None
            
            # 5xx — retry
            print(
                f"  zi.tools {resp.status_code} for {char!r} (attempt {attempt + 1})",
                file=sys.stderr,
            )
        except (requests.RequestException, json.JSONDecodeError) as e:
            print(
                f"  network error for {char!r} (attempt {attempt + 1}): {e}",
                file=sys.stderr,
            )
        
        time.sleep(backoff)
        backoff *= 2
    return None

# --------- row parsing ---------

def extract_author_and_source(row: list) -> tuple[str, str]:
    """
    Returns `(author, work)` as raw (possibly simplified) strings.
    "Unknown" means no value was supplied by the API.

    Row indices that carry attribution (all others are internal IDs):
    - row[7]: calligrapher name OR work title (disambiguated by heuristics)
    - row[8]: work title when populated (row[7] is then the calligrapher);
              confirmed always empty in practice but handled for correctness
    """
    def safe(i: int) -> str:
        return row[i] if len(row) > i and isinstance(row[i], str) else ""

    seven = safe(7)
    eight = safe(8)

    if eight:
        # row[7] = calligrapher, row[8] = work
        author = seven or "Unknown"
        work = eight
    elif seven:
        if looks_like_work(seven):
            work = seven
            author = "Unknown"
        elif looks_like_period(seven):
            # Time period label (e.g. 西周早期) — not a calligrapher or work
            author = "Unknown"
            work = "Unknown"
        else:
            author = seven
            work = "Unknown"
    else:
        author = "Unknown"
        work = "Unknown"

    return author, work

def parse_row(row: list) -> Optional[dict]:
    """
    Validate a single style_group row and pull the bits we care about.
    Returns None for rows without a base64 PNG payload.
    Fields: author, work, dynasty, b64
    """
    if not isinstance(row, list) or len(row) < 5:
        return None
    b64 = row[4]
    if not isinstance(b64, str) or not b64.startswith("iVBOR"):
        return None
    
    dynasty = row[6] if len(row) > 6 and isinstance(row[6], str) else ""
    author_raw, work_raw = extract_author_and_source(row)
    
    return {
        "author": author_raw.strip(),
        "work": work_raw.strip(),
        "dynasty": dynasty.strip() or None,
        "b64": b64,
    }

# --------- image pipeline ---------

def process_image_bytes(raw: bytes, dst: Path) -> None:
    img = Image.open(BytesIO(raw))
    img = img.convert("L")  # grayscale
    bbox = img.getbbox()
    if bbox:
        img = img.crop(bbox)
    img.thumbnail((256, 256), Image.Resampling.LANCZOS)
    dst.parent.mkdir(parents=True, exist_ok=True)
    img.save(str(dst), "WEBP", quality=85)

# --------- core scraping loop (importable by scrape_corpus.py) ---------

def scrape_chars(
    chars: list[str],
    db_path: str = "data/shufazidian.db",
    output_dir: str = "public/images",
    delay: float = 2.0,
    limit: Optional[int] = None,
    dry_run: bool = False,
    clean_source: bool = False,
    errors_log_path: str = "data/zi_tools_errors.log",
) -> dict[str, int]:
    """Scrape zi.tools for each character in *chars*.

    Skips characters already recorded in zi_tools_scrapes. Returns a
    {style_slug: image_count} breakdown dict. Importable by scrape_corpus.py.
    """
    if limit:
        chars = chars[:limit]

    if not chars:
        print("no CJK characters to scrape")
        return {}

    print(f"will scrape {len(chars)} unique characters")

    conn = sqlite3.connect(db_path)
    conn.execute("PRAGMA journal_mode = WAL")
    conn.execute("PRAGMA foreign_keys = ON")
    cursor = conn.cursor()

    cursor.execute("SELECT slug, id FROM script_styles")
    style_id_by_slug = {slug: sid for slug, sid in cursor.fetchall()}
    missing = set(STYLE_LABEL_TO_SLUG.values()) - style_id_by_slug.keys()
    if missing:
        print(
            f"error: script_styles is missing slugs {missing}. "
            "Run `npx tsx scripts/seed_reference.ts` first.",
            file=sys.stderr,
        )
        conn.close()
        return {}

    cursor.execute("""
        CREATE TABLE IF NOT EXISTS zi_tools_scrapes (
            character TEXT PRIMARY KEY,
            scraped_at TEXT NOT NULL
        )
    """)
    conn.commit()

    if clean_source and not dry_run:
        cursor.execute("DELETE FROM calligraphy_images WHERE source = ?", (SOURCE_TAG,))
        deleted = cursor.rowcount
        cursor.execute("DELETE FROM zi_tools_scrapes")
        conn.commit()
        print(f"cleaned {deleted} existing rows with source={SOURCE_TAG} and reset scrape tracker")

    out_dir = Path(output_dir)

    cursor.execute("SELECT image_path FROM calligraphy_images WHERE source = ?", (SOURCE_TAG,))
    existing_paths: set[str] = {row[0] for row in cursor.fetchall()}
    if existing_paths:
        print(f"found {len(existing_paths)} existing {SOURCE_TAG} rows; will skip duplicates")

    errors_path = Path(errors_log_path)
    errors_path.parent.mkdir(parents=True, exist_ok=True)
    errors_log = None if dry_run else open(errors_path, "a", encoding="utf-8")

    session = requests.Session()

    total_inserted = 0
    total_skipped_dup = 0
    total_errors = 0
    per_style: dict[str, int] = {}

    try:
        for char in tqdm(chars, desc="characters", unit="char"):
            trad_char = _s2t_convert(char)
            if len(trad_char) != 1 or not _is_cjk(trad_char):
                trad_char = next((c for c in trad_char if _is_cjk(c)), char)

            cursor.execute("SELECT 1 FROM zi_tools_scrapes WHERE character = ?", (trad_char,))
            if cursor.fetchone():
                continue

            data = fetch_character(session, trad_char)
            time.sleep(delay)
            if not data:
                continue

            tu = data.get("tu") or []
            if not tu:
                continue
            style_groups = tu[0].get("styles") or []

            for group in style_groups:
                raw_style = (group.get("style") or "").strip()
                slug = STYLE_LABEL_TO_SLUG.get(raw_style)
                if not slug:
                    continue
                style_id = style_id_by_slug[slug]
                rows = group.get("rows") or []

                for row in rows:
                    parsed = parse_row(row)
                    if parsed is None:
                        continue

                    try:
                        raw_bytes = base64.b64decode(parsed["b64"], validate=False)
                    except Exception as e:
                        total_errors += 1
                        if errors_log is not None:
                            errors_log.write(f"{trad_char}\t{slug}\tbase64:{e}\n")
                        continue

                    if len(raw_bytes) > MAX_IMAGE_BYTES:
                        total_errors += 1
                        if errors_log is not None:
                            errors_log.write(f"{trad_char}\t{slug}\toversized:{len(raw_bytes)}\n")
                        continue

                    author_trad = _s2t_convert(parsed["author"])
                    work_trad = _s2t_convert(parsed["work"])
                    dynasty = parsed["dynasty"]

                    if author_trad == "Unknown" and work_trad == "Unknown":
                        continue

                    hex_code = char_to_unicode_hex(trad_char)
                    stem = hashlib.md5(parsed["b64"].encode("utf-8")).hexdigest()[:16]
                    rel_out = f"images/{slug}/{hex_code}/{stem}.webp"

                    if rel_out in existing_paths:
                        total_skipped_dup += 1
                        continue

                    if dry_run:
                        total_inserted += 1
                        per_style[slug] = per_style.get(slug, 0) + 1
                        existing_paths.add(rel_out)
                        continue

                    try:
                        out_path = out_dir / slug / hex_code / f"{stem}.webp"
                        process_image_bytes(raw_bytes, out_path)

                        char_id = get_or_create_character(cursor, trad_char)
                        cal_id = get_or_create_calligrapher(cursor, author_trad, dynasty)
                        work_id = get_or_create_work(cursor, work_trad, cal_id, style_id)

                        cursor.execute(
                            """
                            INSERT INTO calligraphy_images
                            (character_id, style_id, calligrapher_id, work_id, image_path, source)
                            VALUES (?, ?, ?, ?, ?, ?)
                            """,
                            (char_id, style_id, cal_id, work_id, rel_out, SOURCE_TAG),
                        )
                        total_inserted += 1
                        per_style[slug] = per_style.get(slug, 0) + 1
                        existing_paths.add(rel_out)

                        if total_inserted % 50 == 0:
                            conn.commit()
                    except Exception as e:
                        total_errors += 1
                        if errors_log is not None:
                            errors_log.write(f"{trad_char}\t{slug}\t{type(e).__name__}: {e}\n")
                            errors_log.flush()
                        else:
                            print(f"  error on {trad_char}/{slug}: {e}", file=sys.stderr)
                        continue

            if not dry_run:
                cursor.execute(
                    "INSERT OR REPLACE INTO zi_tools_scrapes (character, scraped_at) "
                    "VALUES (?, datetime('now'))",
                    (trad_char,),
                )
                conn.commit()

    finally:
        if errors_log is not None:
            errors_log.close()
        conn.commit()
        conn.close()

    mode = "DRY RUN" if dry_run else "INSERT"
    print(f"\n==== per-style breakdown ====")
    for slug, n in sorted(per_style.items(), key=lambda kv: -kv[1]):
        print(f"{slug:8s} {n:7d}")
    print("============================")
    print(
        f"{mode}: total images = {total_inserted}, "
        f"skipped (dup) = {total_skipped_dup}, "
        f"errors = {total_errors}"
    )
    if total_errors and not dry_run:
        print(f"error log: {errors_log_path}")
    return per_style


# --------- main ---------

def main() -> int:
    parser = argparse.ArgumentParser(
        description="Scrape zi.tools glyph data into shufazidian.db"
    )
    src = parser.add_mutually_exclusive_group(required=True)
    src.add_argument(
        "--chars",
        help="String of characters to scrape, e.g. --chars '永和九年'",
    )
    src.add_argument(
        "--chars-file",
        help="Path to a UTF-8 text file; CJK characters are deduplicated.",
    )
    parser.add_argument(
        "--output-dir",
        default="public/images",
        help="Output directory for processed WebP images (default: public/images)",
    )
    parser.add_argument(
        "--db",
        default="data/shufazidian.db",
        help="SQLite database path (default: data/shufazidian.db)",
    )
    parser.add_argument(
        "--rate",
        type=float,
        default=2.0,
        help="Seconds to sleep between API calls (default: 2.0)",
    )
    parser.add_argument(
        "--limit",
        type=int,
        default=None,
        help="Only scrape the first N characters (smoke test).",
    )
    parser.add_argument(
        "--dry-run",
        action="store_true",
        help="Parse responses but do not write images or insert rows.",
    )
    parser.add_argument(
        "--clean-source",
        action="store_true",
        help=f"DELETE rows with source='{SOURCE_TAG}' before scraping.",
    )
    parser.add_argument(
        "--errors-log",
        default="data/zi_tools_errors.log",
        help="Per-row error log path (default: data/zi_tools_errors.log)",
    )
    args = parser.parse_args()

    if args.chars_file:
        text = Path(args.chars_file).read_text(encoding="utf-8")
    else:
        text = args.chars or ""

    chars = unique_cjk_chars(text)

    if not chars:
        print("error: no CJK characters to scrape")
        return 1

    scrape_chars(
        chars=chars,
        db_path=args.db,
        output_dir=args.output_dir,
        delay=args.rate,
        limit=args.limit,
        dry_run=args.dry_run,
        clean_source=args.clean_source,
        errors_log_path=args.errors_log,
    )
    return 0


if __name__ == "__main__":
    raise SystemExit(main())