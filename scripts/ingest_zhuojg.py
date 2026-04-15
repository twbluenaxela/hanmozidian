"""
Ingest the zhuojg/chinese-calligraphy-dataset into the
SQLite database.

We use the *calligrapher-organized* half of the dataset as
the primary source
because its folder names encode script style + author/work,
e.g.
楷-柳公权、行-米芾、楷-多宝塔. The *character-organized*
half has no
style or author metadata, so ingesting it would just pollute
the style tabs.
We skip it here.

Folder-name decoding:
- 楷-柳公权  -> style=kai, kind=calligrapher, name=柳公权
- 行-米芾    -> style=xing, kind=calligrapher, name=米芾
- 楷-多宝塔  -> style=kai, kind=work, name=多宝塔碑, author=颜真卿
- 楷-魏碑    -> style=kai, kind=work, name=魏碑, author=NULL

Inner layout: two variants seen in the wild. The script
auto-detects.
- subdir: {style}-{name}/{char}/{file}.gif
- flat:   {style}-{name}/{char}_{seq}.gif (character is
glyph of the filename stem)

Usage:
  pip install Pillow tqdm opencc-python-reimplemented

  python scripts/ingest_zhuojg.py \
    --calligrapher-dir data/zhuojg/chinese-calligraphy-dataset-with-calligrapher \
    --output-dir public/images \
    --db data/shufazidian.db \
    --dry-run             # no writes, just counts
    --limit 2             # first 2 folders only
    --clean-source        # DELETE zhuojg rows before ingest (idempotent re-run)
"""

import argparse
import hashlib
import sqlite3
import sys
from pathlib import Path
from typing import Callable, Optional

from PIL import Image
from tqdm import tqdm

_s2t_convert: Callable[[str], str]

try:
    from opencc import OpenCC
    _s2t_convert = OpenCC("s2t").convert
except Exception:  # pragma: no cover
    print(
        "warning: opencc-python-reimplemented not installed "
        "character simplified->traditional conversion will be skipped. "
        "Install with: pip install opencc-python-reimplemented",
        file=sys.stderr,
    )

    def _s2t_convert_fallback(string: str) -> str:
        return string

    _s2t_convert = _s2t_convert_fallback

# ---------- static mappings ----------

STYLE_CHAR_TO_SLUG = {
    "楷": "kai",
    "行": "xing",
    "隶": "li",
    "魏": "li",
    "篆": "zhuan",
    "草": "cao",
}

# Simplified folder name -> (traditional name, dynasty) for
# the 19 zhuojg
# calligraphers we know about. Hand-mapped so we don't need
# a full s2t lib
# for author names.
CALLIGRAPHER_S2T: dict[str, tuple[str, Optional[str]]] = {
    # Already seeded by scripts/seed_reference.ts
    "柳公权": ("柳公權", "唐"),
    "邓石如": ("鄧石如", "清"),
    "何绍基": ("何紹基", "清"),
    "虞世南": ("虞世南", "唐"),
    "米芾": ("米芾", "宋"),
    "金农": ("金農", "清"),
    # Not seeded; the script will INSERT OR IGNORE them
    "赵之谦": ("趙之謙", "清"),
    "王铎": ("王鐸", "明"),
    "智永": ("智永", "隋"),
    "张即之": ("張即之", "宋"),
    "傅山": ("傅山", "明"),
    "沈尹默": ("沈尹默", "現代"),
    "郑板桥": ("鄭板橋", "清"),
    "伊秉绶": ("伊秉綬", "清"),
    "王壮为": ("王壯為", "現代"),
}

# Simplified folder NAME (the part after "{style}-") ->
# (traditional work
# name, traditional author name or None). The author name
# must either match
# a seeded calligrapher or will be created on the fly.
WORK_FOLDERS: dict[str, tuple[str, Optional[str]]] = {
    "魏碑": ("魏碑", None),
    "多宝塔": ("多寶塔碑", "顏真卿"),
    "集字圣教序": ("集字聖教序", "王羲之"),
    "赵孟頫三门记": ("三門記", "趙孟頫"),
}

# Image file extensions we accept.
IMAGE_EXTS = {".jpg", ".jpeg", ".png", ".gif", ".bmp", ".webp"}

# CJK Unified Ideographs (BMP) + Extension A. Covers the
# vast majority of
# characters you'd practice calligraphy on.
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

# ---------- DB helpers ----------

def get_or_create_character(cursor: sqlite3.Cursor, char: str) -> int:
    hex_code = char_to_unicode_hex(char)
    cursor.execute("SELECT id FROM characters WHERE unicode_hex = ?", (hex_code,))
    row = cursor.fetchone()
    if row:
        return row[0]
    cursor.execute(
        "INSERT INTO characters (character, unicode_hex) VALUES (?, ?)",
        (char, hex_code),
    )
    return cursor.lastrowid # type: ignore[return-value]

def get_or_create_calligrapher(
    cursor: sqlite3.Cursor, 
    name_zh: str, 
    dynasty: Optional[str]
) -> int:
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
) -> int:
    cursor.execute("SELECT id FROM works WHERE name_zh = ?", (name_zh,))
    row = cursor.fetchone()
    if row:
        return row[0]
    cursor.execute(
        "INSERT INTO works (name_zh, calligrapher_id, style_id) VALUES (?, ?, ?)",
        (name_zh, calligrapher_id, style_id),
    )
    return cursor.lastrowid # type: ignore[return-value]

# ---------- folder classification ----------

def classify_folder(
    name: str,
) -> Optional[tuple[str, str, Optional[str], Optional[str]]]:
    """
    Return (kind, trad_name, author_trad_or_None, dynasty_or_None).
    kind is "calligrapher" or "work". Returns None for 
    unknown folders.
    """
    if name in WORK_FOLDERS:
        trad_work, trad_author = WORK_FOLDERS[name]
        return ("work", trad_work, trad_author, None)
    elif name in CALLIGRAPHER_S2T:
        trad_name, dynasty = CALLIGRAPHER_S2T[name]
        return ("calligrapher", trad_name, None, dynasty)
    return None

def detect_inner_layout(folder: Path) -> str:
    """Return 'subdir' if the first non-hidden entry is a directory, else 'flat'."""
    for entry in sorted(folder.iterdir()):
        if entry.name.startswith("."):
            continue
        if entry.is_dir():
            return "subdir"
        return "flat"
    return "flat"

def iter_image_files(folder: Path):
    for p in folder.rglob("*"):
        if p.is_file() and p.suffix.lower() in IMAGE_EXTS:
            yield p

def char_from_path(img: Path, folder: Path, layout: str) -> Optional[str]:
    """
    subdir layout: char is the immediate parent folder name (must be 1 CJK char).
    flat layout:   char is the first CJK char in the filename stem.
    """
    if layout == "subdir":
        parent = img.parent.name
        # Walk up if we're deeper than one level
        rel = img.relative_to(folder)
        if len(rel.parts) >= 2:
            parent = rel.parts[0]
        if _is_cjk(parent):
            return parent
        return None
    
    # flat: first CJK char of stem
    for ch in img.stem:
        if _is_cjk(ch):
            return ch
    return None

# ---------- image processing ----------

def process_image(src: Path, dst: Path) -> None:
    img = Image.open(src)
    img = img.convert("L")  # grayscale
    bbox = img.getbbox()
    if bbox:
        img = img.crop(bbox)
    img.thumbnail((256, 256), Image.Resampling.LANCZOS)
    dst.parent.mkdir(parents=True, exist_ok=True)
    img.save(str(dst), "WEBP", quality=85)

# ---------- main ----------

def main() -> int:
    parser = argparse.ArgumentParser(
        description="Ingest zhuojg calligraphy dataset (calligrapher-organized half)"
    )
    parser.add_argument(
        "--calligrapher-dir",
        required=True,
        help="Path to the calligrapher-organized dataset root (parent of the 楷-柳公权/, 行-米芾/, ... folders)",
    )
    parser.add_argument(
        "--char-dir",
        help="Accepted for compatibility with older invocations; currently ignored.",
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
        "--source-tag",
        default="zhuojg",
        help="Value written to calligraphy_images.source (default: zhuojg)",
    )
    parser.add_argument(
        "--dry-run",
        action="store_true",
        help="Do not write images or insert rows; just print counts.",
    )
    parser.add_argument(
        "--limit",
        type=int,
        default=None,
        help="Only process the first N calligrapher folders (smoke test).",
    )
    parser.add_argument(
        "--clean-source",
        action="store_true",
        help="DELETE existing rows with this source tag before ingesting.",
    )
    parser.add_argument(
        "--errors-log",
        default="data/zhuojg_errors.log",
        help="Path to write per-file error messages (default: data/zhuojg_errors.log)",
    )
    args = parser.parse_args()

    cal_root = Path(args.calligrapher_dir)
    if not cal_root.is_dir():
        print(f"error: --calligrapher-dir {cal_root} is not a directory")
        return 1

    conn = sqlite3.connect(args.db)
    conn.execute("PRAGMA journal_mode = WAL")
    conn.execute("PRAGMA foreign_keys = ON")
    cursor = conn.cursor()

    # Preload style slug -> id
    cursor.execute("SELECT slug, id FROM script_styles")
    style_id_by_slug = {slug: sid for slug, sid in cursor.fetchall()}
    missing_styles = set(STYLE_CHAR_TO_SLUG.values()) - set(style_id_by_slug.keys())
    if missing_styles:
        print(
            f"error: script_styles table is missing slugs {missing_styles}. "
            "Run `npx tsx scripts/seed_reference.ts` first."
        )
        return 1

    if args.clean_source and not args.dry_run:
        cursor.execute(
            "DELETE FROM calligraphy_images WHERE source = ?",
            (args.source_tag,),
        )
        deleted = cursor.rowcount
        conn.commit()
        print(f"cleaned {deleted} existing rows with source={args.source_tag}")

    output_dir = Path(args.output_dir)

    # Pre-fetch the set of image_paths already present for this source,
    # so without --clean-source we can skip re-ingesting the same files.
    cursor.execute(
        "SELECT image_path FROM calligraphy_images WHERE source = ?",
        (args.source_tag,),
    )
    existing_paths: set[str] = {row[0] for row in cursor.fetchall()}
    if existing_paths:
        print(f"found {len(existing_paths)} existing {args.source_tag} rows; will skip duplicates")

    raw_folders = sorted(
        d 
        for d in cal_root.iterdir() 
        if d.is_dir() and not d.name.startswith(".") and d.name != "__MACOSX"
    )

    # Pre-resolve each folder so --limit applies to *valid* folders only.
    # Invalid ones are reported once here and not iterated below.
    folders: list[tuple[Path, str, int, str, str, Optional[str], Optional[str]]] = []
    for d in raw_folders:
        if "-" not in d.name:
            print(f"skip {d.name}: no '-' separator")
            continue
        style_char, name = d.name.split("-", 1)
        slug = STYLE_CHAR_TO_SLUG.get(style_char)
        if not slug:
            print(f"skip {d.name}: unknown style char {style_char}")
            continue
        
        classified = classify_folder(name)
        if classified is None:
            print(
                f"skip {d.name}: unknown folder name {name} "
                "(not in CALLIGRAPHER_S2T or WORK_FOLDERS)"
            )
            continue
        
        kind, trad_name, author_trad, dynasty = classified
        folders.append((d, slug, style_id_by_slug[slug], kind, trad_name, author_trad, dynasty))

    if args.limit:
        folders = folders[: args.limit]
    
    if not folders:
        print(f"error: no usable calligrapher folders found under {cal_root}")
        return 1

    errors_path = Path(args.errors_log)
    errors_path.parent.mkdir(parents=True, exist_ok=True)
    errors_log = None if args.dry_run else open(errors_path, "a", encoding="utf-8")

    per_folder_summary: list[tuple[str, str, int, int]] = []
    total_inserted = 0
    total_skipped_dup = 0
    total_errors = 0

    for folder, style_slug, style_id, kind, trad_name, author_trad, dynasty in folders:
        if kind == "calligrapher":
            if args.dry_run:
                author_id = None
                work_id = None
            else:
                author_id = get_or_create_calligrapher(cursor, trad_name, dynasty)
                work_id = None
            display_name = trad_name
        else: # work
            if args.dry_run:
                author_id = None
                work_id = None
            else:
                author_id = (
                    get_or_create_calligrapher(cursor, author_trad, None)
                    if author_trad
                    else None
                )
                work_id = get_or_create_work(cursor, trad_name, author_id, style_id)
            display_name = trad_name

        layout = detect_inner_layout(folder)

        inserted = 0
        skipped = 0
        chars_seen: set[str] = set()

        img_iter = list(iter_image_files(folder))
        pbar = tqdm(
            img_iter,
            desc=f"{folder.name} ({display_name}/{style_slug})",
            unit="img",
            leave=False,
        )
        for img_path in pbar:
            try:
                simp_char = char_from_path(img_path, folder, layout)
                if simp_char is None:
                    continue
                trad_char = _s2t_convert(simp_char)
                if len(trad_char) != 1 or not _is_cjk(trad_char):
                    # opencc occasionally expands to multi-char; take first CJK
                    trad_char = next((c for c in trad_char if _is_cjk(c)), simp_char)
                
                hex_code = char_to_unicode_hex(trad_char)

                # Deterministic output filename: hash of source path (relative
                # to cal_root). Stable across re-runs, avoids collisions.
                rel_src = img_path.relative_to(cal_root)
                stem_hash = hashlib.md5(str(rel_src).encode("utf-8")).hexdigest()[:12]
                rel_out = f"images/{style_slug}/{hex_code}/{stem_hash}.webp"

                if rel_out in existing_paths:
                    skipped += 1
                    total_skipped_dup += 1
                    continue
                
                chars_seen.add(trad_char)

                if args.dry_run:
                    inserted += 1
                    total_inserted += 1
                    continue

                out_path = output_dir / style_slug / hex_code / f"{stem_hash}.webp"
                process_image(img_path, out_path)

                char_id = get_or_create_character(cursor, trad_char)
                
                cursor.execute(
                    """INSERT INTO calligraphy_images
                    (character_id, style_id, calligrapher_id, work_id, image_path, source)
                    VALUES (?, ?, ?, ?, ?, ?)""",
                    (char_id, style_id, author_id, work_id, rel_out, args.source_tag),
                )
                inserted += 1
                total_inserted += 1
                existing_paths.add(rel_out)

                if total_inserted % 200 == 0:
                    conn.commit()

            except Exception as e:
                total_errors += 1
                if errors_log is not None:
                    errors_log.write(f"{img_path}\t{type(e).__name__}: {e}\n")
                    errors_log.flush()
                else:
                    print(f"error processing {img_path}: {e}", file=sys.stderr)
                continue

        if not args.dry_run:
            conn.commit()
        
        per_folder_summary.append(
            (folder.name, f"{display_name}/{style_slug}", len(chars_seen), inserted)
        )

    if errors_log is not None:
        errors_log.close()
    
    conn.commit()
    conn.close()

    # -------- summary --------
    print("\n==== per-folder summary ====")
    for orig, tag, n_chars, n_inserted in per_folder_summary:
        print(f"{orig:20s} -> {tag:25s} {n_chars:5d} chars {n_inserted:7d} images")
    print("============================")
    mode = "DRY RUN" if args.dry_run else "INSERT"
    print(
        f"{mode}: total images = {total_inserted}, "
        f"skipped (already present) = {total_skipped_dup}, "
        f"errors = {total_errors}"
    )
    if total_errors and not args.dry_run:
        print(f"error log: {errors_path}")
    return 0

if __name__ == "__main__":
    raise SystemExit(main())