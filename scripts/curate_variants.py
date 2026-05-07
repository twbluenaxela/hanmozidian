#!/usr/bin/env python3
"""
Curate calligraphy images that are filed under the wrong character.

For each image stored under SOURCE_CHAR, opens the image file and
prompts you to classify it. Updates character_id in the DB in-place;
image files are NOT moved (the path stays as-is).

Single-group mode:
  python scripts/curate_variants.py --char 裏 --variants 裏 裡 里

Batch mode (works through data/variant_groups.json automatically):
  python scripts/curate_variants.py --batch
  python scripts/curate_variants.py --batch --skip-done   # skip groups marked done
  python scripts/curate_variants.py --batch --min-images 50  # skip small groups

Options:
  --char        Character whose images to review
  --variants    Valid target characters, space-separated
  --batch       Work through all groups in data/variant_groups.json
  --skip-done   In batch mode, skip groups already marked done in the progress file
  --min-images  In batch mode, skip groups with fewer total images than this
  --db          Path to SQLite DB  [default: data/shufazidian.db]
  --images-dir  Root directory for image files  [default: public/images]
  --style       Only curate images of this style slug (e.g. li, xing, kai)
  --source      Only curate images from this source (e.g. zhuojg, zi.tools)
  --dry-run     Print what would change without writing to DB
"""

import argparse
import json
import os
import platform
import sqlite3
import subprocess
import sys
from pathlib import Path

PROGRESS_FILE = "data/variant_groups_progress.json"


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
            os.startfile(str(full_path))
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


def load_progress() -> dict:
    if Path(PROGRESS_FILE).exists():
        with open(PROGRESS_FILE, encoding="utf-8") as f:
            return json.load(f)
    return {}


def save_progress(progress: dict) -> None:
    with open(PROGRESS_FILE, "w", encoding="utf-8") as f:
        json.dump(progress, f, ensure_ascii=False, indent=2)


def curate_group(
    conn: sqlite3.Connection,
    char: str,
    variants: list[str],
    images_root: Path,
    style_filter: str | None,
    source_filter: str | None,
    dry_run: bool,
) -> tuple[int, int]:
    """Curate one character group. Returns (reassigned, kept)."""
    cursor = conn.cursor()

    cursor.execute("SELECT id FROM characters WHERE character = ?", (char,))
    row = cursor.fetchone()
    if not row:
        print(f"  Character {char!r} not in DB — skipping.")
        return 0, 0
    source_char_id = row[0]

    where = ["ci.character_id = ?"]
    params: list = [source_char_id]
    if style_filter:
        where.append("ss.slug = ?")
        params.append(style_filter)
    if source_filter:
        where.append("ci.source = ?")
        params.append(source_filter)

    cursor.execute(
        f"""
        SELECT ci.id, ci.image_path, ci.source, ss.name_zh, ss.slug
        FROM calligraphy_images ci
        JOIN script_styles ss ON ci.style_id = ss.id
        WHERE {' AND '.join(where)}
        ORDER BY ss.name_zh, ci.source, ci.id
        """,
        params,
    )
    images = cursor.fetchall()

    if not images:
        print(f"  No images for {char!r} with current filters.")
        return 0, 0

    variant_ids: dict[str, int] = {}
    for v in variants:
        variant_ids[v] = get_or_create_character(cursor, v)
    if not dry_run:
        conn.commit()

    total = len(images)
    shortcut = "/".join(variants)
    print(f"\n{'[DRY RUN] ' if dry_run else ''}"
          f"  {total} images — enter [{shortcut}] to reassign, Enter = keep, q = quit, s = skip group\n")

    reassigned = kept = 0

    for i, (img_id, img_path, source, style_name, style_slug) in enumerate(images, 1):
        full_path = images_root / img_path
        print(f"  [{i}/{total}] {style_name} · {source}  {img_path}")
        open_image(full_path)

        while True:
            try:
                answer = input(f"  [{shortcut}] / Enter / s / q: ").strip()
            except (EOFError, KeyboardInterrupt):
                print("\n  Interrupted — saving progress.")
                if not dry_run:
                    conn.commit()
                return reassigned, kept

            if answer == "q":
                if not dry_run:
                    conn.commit()
                raise SystemExit(0)

            if answer == "s":
                print(f"  Skipping rest of {char!r}.")
                if not dry_run:
                    conn.commit()
                return reassigned, kept

            if answer == "":
                kept += 1
                print(f"  → kept as {char}")
                break

            if answer not in variant_ids:
                print(f"  Not valid. Choose from: {shortcut}")
                continue

            target_id = variant_ids[answer]
            if target_id == source_char_id:
                kept += 1
                print(f"  → kept as {char}")
            else:
                if not dry_run:
                    cursor.execute(
                        "UPDATE calligraphy_images SET character_id = ? WHERE id = ?",
                        (target_id, img_id),
                    )
                reassigned += 1
                print(f"  {'[dry-run] → ' if dry_run else '→ '}reassigned to {answer}")
            break

    if not dry_run:
        conn.commit()
    return reassigned, kept


def main() -> None:
    parser = argparse.ArgumentParser(
        description="Reassign calligraphy images to the correct character variant."
    )
    mode = parser.add_mutually_exclusive_group(required=True)
    mode.add_argument("--char", help="Character to curate (single-group mode)")
    mode.add_argument("--batch", action="store_true",
                      help="Work through all groups in data/variant_groups.json")
    parser.add_argument("--variants", nargs="+",
                        help="Target characters (required in single-group mode)")
    parser.add_argument("--skip-done", action="store_true",
                        help="[batch] Skip groups already marked done")
    parser.add_argument("--min-images", type=int, default=0,
                        help="[batch] Skip groups with fewer total images than this")
    parser.add_argument("--db", default="data/shufazidian.db")
    parser.add_argument("--images-dir", default="public")
    parser.add_argument("--style")
    parser.add_argument("--source")
    parser.add_argument("--dry-run", action="store_true")
    args = parser.parse_args()

    if args.char and not args.variants:
        parser.error("--variants is required with --char")

    conn = sqlite3.connect(args.db)
    conn.execute("PRAGMA journal_mode = WAL")
    conn.execute("PRAGMA foreign_keys = ON")
    images_root = Path(args.images_dir)

    if args.char:
        # Single-group mode
        try:
            r, k = curate_group(conn, args.char, args.variants, images_root,
                                 args.style, args.source, args.dry_run)
        except SystemExit:
            conn.close()
            return
        print(f"\nDone. {r} reassigned, {k} kept as {args.char!r}.")
        conn.close()
        return

    # Batch mode
    groups_path = Path("data/variant_groups.json")
    if not groups_path.exists():
        print("data/variant_groups.json not found. Run the generation script first.")
        conn.close()
        sys.exit(1)

    with open(groups_path, encoding="utf-8") as f:
        groups = json.load(f)

    progress = load_progress()

    total_groups = len(groups)
    done_count = sum(1 for g in groups if progress.get(g["simp"]) == "done")
    print(f"\nBatch curation: {total_groups} groups, {done_count} already done.")
    print("Commands: character to reassign | Enter = keep | s = skip group | d = mark group done | q = quit\n")

    for g in groups:
        simp = g["simp"]
        variants = g["variants"]
        total_images = g["total"]

        if args.skip_done and progress.get(simp) == "done":
            continue
        if total_images < args.min_images:
            continue

        counts_str = ", ".join(f"{c}:{g['counts'][c]}" for c in variants)
        print(f"\n{'='*60}")
        print(f"Group: {simp} → {' / '.join(variants)}  [{counts_str}]  total:{total_images}")

        # Ask whether to enter this group or skip/mark done
        while True:
            try:
                cmd = input("  Enter group? [y/s/d/q] (y=yes, s=skip, d=mark done, q=quit): ").strip().lower()
            except (EOFError, KeyboardInterrupt):
                print("\nInterrupted.")
                save_progress(progress)
                conn.close()
                sys.exit(0)

            if cmd == "q":
                save_progress(progress)
                conn.close()
                sys.exit(0)
            if cmd == "s":
                break
            if cmd == "d":
                progress[simp] = "done"
                save_progress(progress)
                print(f"  Marked {simp!r} as done.")
                break
            if cmd in ("y", ""):
                # Curate each variant in the group
                total_r = total_k = 0
                try:
                    for char in variants:
                        print(f"\n  --- Curating images filed under {char!r} ---")
                        r, k = curate_group(conn, char, variants, images_root,
                                            args.style, args.source, args.dry_run)
                        total_r += r
                        total_k += k
                except SystemExit:
                    save_progress(progress)
                    conn.close()
                    return
                print(f"\n  Group summary: {total_r} reassigned, {total_k} kept.")
                cmd2 = input("  Mark group as done? [y/n]: ").strip().lower()
                if cmd2 == "y":
                    progress[simp] = "done"
                    save_progress(progress)
                break
            print("  Invalid. Enter y/s/d/q.")

    save_progress(progress)
    conn.close()
    done_now = sum(1 for g in groups if progress.get(g["simp"]) == "done")
    print(f"\nSession complete. {done_now}/{total_groups} groups done.")


if __name__ == "__main__":
    main()
