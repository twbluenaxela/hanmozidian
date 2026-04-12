"""
Ingest the zhuojg/chinese-calligraphy-dataset into the SQLite database.

Prerequisites:
  1. Download character-organized dataset from Google Drive
  2. Download calligrapher-organized dataset from Google Drive
  3. pip install Pillow tqdm

Usage:
  python scripts/ingest_zhuojg.py \
    --char-dir /path/to/character_organized \
    --calligrapher-dir /path/to/calligrapher_organized \
    --output-dir public/images \
    --db data/shufazidian.db
"""

import argparse
import os
import sqlite3
from pathlib import Path

from PIL import Image
from tqdm import tqdm


def char_to_unicode_hex(char: str) -> str:
    return f"{ord(char):04X}"


def get_or_create_character(cursor: sqlite3.Cursor, char: str) -> int:
    hex_code = char_to_unicode_hex(char)
    cursor.execute(
        "INSERT OR IGNORE INTO characters (character, unicode_hex) VALUES (?, ?)",
        (char, hex_code),
    )
    cursor.execute("SELECT id FROM characters WHERE character = ?", (char,))
    return cursor.fetchone()[0]


def get_or_create_calligrapher(
    cursor: sqlite3.Cursor, name_zh: str
) -> int:
    cursor.execute(
        "INSERT OR IGNORE INTO calligraphers (name_zh) VALUES (?)", (name_zh,)
    )
    cursor.execute("SELECT id FROM calligraphers WHERE name_zh = ?", (name_zh,))
    return cursor.fetchone()[0]


def main():
    parser = argparse.ArgumentParser(description="Ingest zhuojg calligraphy dataset")
    parser.add_argument("--char-dir", required=True, help="Path to character-organized dataset")
    parser.add_argument("--calligrapher-dir", help="Path to calligrapher-organized dataset (optional)")
    parser.add_argument("--output-dir", default="public/images", help="Output directory for processed images")
    parser.add_argument("--db", default="data/shufazidian.db", help="SQLite database path")
    parser.add_argument("--style-slug", default="kai", help="Default style slug if unknown")
    args = parser.parse_args()

    conn = sqlite3.connect(args.db)
    cursor = conn.cursor()
    cursor.execute("PRAGMA journal_mode = WAL")
    cursor.execute("PRAGMA foreign_keys = ON")

    # Get default style ID
    cursor.execute("SELECT id FROM script_styles WHERE slug = ?", (args.style_slug,))
    row = cursor.fetchone()
    if not row:
        print(f"Error: style '{args.style_slug}' not found in DB. Run seed_reference.ts first.")
        return
    default_style_id = row[0]

    # Build calligrapher lookup from calligrapher-organized dataset
    calligrapher_image_map: dict[str, str] = {}  # image_filename -> calligrapher_name
    if args.calligrapher_dir:
        cal_dir = Path(args.calligrapher_dir)
        for calligrapher_folder in cal_dir.iterdir():
            if not calligrapher_folder.is_dir():
                continue
            calligrapher_name = calligrapher_folder.name
            for img_file in calligrapher_folder.rglob("*"):
                if img_file.suffix.lower() in (".jpg", ".jpeg", ".png", ".gif", ".bmp"):
                    calligrapher_image_map[img_file.name] = calligrapher_name

    # Process character-organized dataset
    char_dir = Path(args.char_dir)
    output_dir = Path(args.output_dir)
    count = 0

    char_folders = sorted([d for d in char_dir.iterdir() if d.is_dir()])

    for char_folder in tqdm(char_folders, desc="Processing characters"):
        # Folder name should be the character or a numeric ID
        folder_name = char_folder.name

        # Try to determine the character from folder name
        if len(folder_name) == 1:
            char = folder_name
        else:
            # May be a numeric ID; skip or try to map via label file
            continue

        char_id = get_or_create_character(cursor, char)
        hex_code = char_to_unicode_hex(char)

        # Create output directory
        style_output = output_dir / args.style_slug / hex_code
        style_output.mkdir(parents=True, exist_ok=True)

        for img_file in sorted(char_folder.iterdir()):
            if img_file.suffix.lower() not in (".jpg", ".jpeg", ".png", ".gif", ".bmp"):
                continue

            # Look up calligrapher
            calligrapher_name = calligrapher_image_map.get(img_file.name)
            calligrapher_id = None
            if calligrapher_name:
                calligrapher_id = get_or_create_calligrapher(cursor, calligrapher_name)

            # Convert to WebP
            try:
                img = Image.open(img_file)
                img = img.convert("L")  # Grayscale

                # Crop whitespace
                bbox = img.getbbox()
                if bbox:
                    img = img.crop(bbox)

                # Resize to max 256x256
                img.thumbnail((256, 256), Image.Resampling.LANCZOS)

                out_name = f"{count:06d}.webp"
                out_path = style_output / out_name
                img.save(str(out_path), "WEBP", quality=85)

                # Relative path for DB
                rel_path = f"images/{args.style_slug}/{hex_code}/{out_name}"

                cursor.execute(
                    """INSERT INTO calligraphy_images
                    (character_id, style_id, calligrapher_id, work_id, image_path, source)
                    VALUES (?, ?, ?, ?, ?, ?)""",
                    (char_id, default_style_id, calligrapher_id, None, rel_path, "zhuojg"),
                )
                count += 1

            except Exception as e:
                print(f"Error processing {img_file}: {e}")
                continue

        if count % 1000 == 0:
            conn.commit()

    conn.commit()
    conn.close()
    print(f"\nIngested {count} images from zhuojg dataset.")


if __name__ == "__main__":
    main()
