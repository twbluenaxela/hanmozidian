#!/usr/bin/env python3
"""
Curate calligraphy images that are filed under the wrong character.

For each image stored under SOURCE_CHAR, opens the image file and
prompts you to classify it. Updates character_id in the DB in-place;
image files are NOT moved (the path stays as-is).

Usage:
  # Curate 裏 images (reassign stray 裡 / 里 forms)
  python scripts/curate_variants.py --char 裏 --variants 裏 裡 里

  # Curate 鬆 images
  python scripts/curate_variants.py --char 鬆 --variants 鬆 松

  # Curate multiple source characters back-to-back
  python scripts/curate_variants.py --char 別 --variants 別 彆
  python scripts/curate_variants.py --char 禦 --variants 禦 御

Options:
  --char        The character whose image bucket you want to curate
  --variants    All valid target characters (include the source char itself)
  --db          Path to SQLite DB  [default: data/shufazidian.db]
  --images-dir  Root directory for image files  [default: public/images]
  --style       Only curate images of this style slug (e.g. li, xing, kai)
  --source      Only curate images from this source (e.g. zhuojg, zi.tools)
  --dry-run     Print what would change without writing to DB
"""

import argparse
import os
import platform
import sqlite3
import subprocess
import sys
from pathlib import Path


def open_image(full_path: Path) -> None:
    if not full_path.exists():
        print(f"  [file not found: {full_path}]")
        return
    system = platform.system()
    try:
        if system == "Darwin":
            subprocess.Popen(["open", str(full_path)])
        elif system == "Linux":
            subprocess.Popen(["xdg-open", str(full_path)],
                             stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL)
        else:
            os.startfile(str(full_path))  # Windows
    except Exception as e:
        print(f"  [could not open image: {e}]")


def get_or_create_character(cursor: sqlite3.Cursor, char: str) -> int:
    hex_code = f"{ord(char):04X}"
    cursor.execute("SELECT id FROM characters WHERE character = ?", (char,))
    row = cursor.fetchone()
    if row:
        return row[0]
    cursor.execute(
        "INSERT INTO characters (character, unicode_hex) VALUES (?, ?)",
        (char, hex_code),
    )
    print(f"  [created new character entry: {char} U+{hex_code}]")
    return cursor.lastrowid


def main() -> None:
    parser = argparse.ArgumentParser(
        description="Reassign calligraphy images to the correct character variant."
    )
    parser.add_argument("--char", required=True,
                        help="Character whose images to review (e.g. 裏)")
    parser.add_argument("--variants", nargs="+", required=True,
                        help="Valid target characters, space-separated (e.g. 裏 裡 里)")
    parser.add_argument("--db", default="data/shufazidian.db")
    parser.add_argument("--images-dir", default="public/images")
    parser.add_argument("--style", default=None,
                        help="Filter by style slug (e.g. li, xing, kai)")
    parser.add_argument("--source", default=None,
                        help="Filter by source tag (e.g. zhuojg, zi.tools)")
    parser.add_argument("--dry-run", action="store_true")
    args = parser.parse_args()

    conn = sqlite3.connect(args.db)
    conn.execute("PRAGMA journal_mode = WAL")
    conn.execute("PRAGMA foreign_keys = ON")
    cursor = conn.cursor()

    cursor.execute("SELECT id FROM characters WHERE character = ?", (args.char,))
    row = cursor.fetchone()
    if not row:
        print(f"Character {args.char!r} not found in DB. Exiting.")
        conn.close()
        sys.exit(1)
    source_char_id = row[0]

    # Build query with optional filters
    where_clauses = ["ci.character_id = ?"]
    params: list = [source_char_id]
    if args.style:
        where_clauses.append("ss.slug = ?")
        params.append(args.style)
    if args.source:
        where_clauses.append("ci.source = ?")
        params.append(args.source)

    cursor.execute(
        f"""
        SELECT ci.id, ci.image_path, ci.source, ss.name_zh, ss.slug
        FROM calligraphy_images ci
        JOIN script_styles ss ON ci.style_id = ss.id
        WHERE {' AND '.join(where_clauses)}
        ORDER BY ss.name_zh, ci.source, ci.id
        """,
        params,
    )
    images = cursor.fetchall()

    if not images:
        print(f"No images found for {args.char!r} with those filters.")
        conn.close()
        return

    # Ensure all variant character entries exist
    variant_ids: dict[str, int] = {}
    for v in args.variants:
        variant_ids[v] = get_or_create_character(cursor, v)
    if not args.dry_run:
        conn.commit()

    total = len(images)
    shortcut = "/".join(args.variants)
    print(f"\n{'[DRY RUN] ' if args.dry_run else ''}"
          f"Curating {total} images for {args.char!r}.")
    print(f"For each image: type one of [{shortcut}] + Enter to reassign,")
    print(f"                Enter alone = keep as {args.char!r},  q = quit.\n")

    images_root = Path(args.images_dir)
    reassigned = 0
    kept = 0

    for i, (img_id, img_path, source, style_name, style_slug) in enumerate(images, 1):
        full_path = images_root / img_path
        print(f"[{i}/{total}] {style_name} · {source}")
        print(f"  {img_path}")
        open_image(full_path)

        while True:
            try:
                answer = input(f"  [{shortcut}] or Enter/q: ").strip()
            except (EOFError, KeyboardInterrupt):
                print("\nInterrupted — saving progress.")
                if not args.dry_run:
                    conn.commit()
                conn.close()
                sys.exit(0)

            if answer == "q":
                print(f"Quit at {i}/{total}. {reassigned} reassigned, {kept} kept.")
                if not args.dry_run:
                    conn.commit()
                conn.close()
                sys.exit(0)

            if answer == "":
                kept += 1
                print(f"  → kept as {args.char}")
                break

            if answer not in variant_ids:
                print(f"  Not a valid choice. Pick from: {shortcut}")
                continue

            target_id = variant_ids[answer]
            if target_id == source_char_id:
                kept += 1
                print(f"  → kept as {args.char}")
            else:
                if not args.dry_run:
                    cursor.execute(
                        "UPDATE calligraphy_images SET character_id = ? WHERE id = ?",
                        (target_id, img_id),
                    )
                reassigned += 1
                print(f"  {'[dry-run] would reassign' if args.dry_run else '→ reassigned'} to {answer}")
            break

    if not args.dry_run:
        conn.commit()
    conn.close()
    print(f"\nDone. {reassigned} reassigned, {kept} kept as {args.char!r}.")


if __name__ == "__main__":
    main()
