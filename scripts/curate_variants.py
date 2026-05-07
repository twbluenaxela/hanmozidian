#!/usr/bin/env python3
"""
Curate calligraphy images that are filed under the wrong character.

For each image stored under SOURCE_CHAR, opens the image file and
prompts you to classify it. Updates character_id in the DB in-place;
image files are NOT moved (the path stays as-is).

Progress is saved after every image, so you can quit (q) and resume
exactly where you left off.

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
  --images-dir  Root directory for image files  [default: public]
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
            raw = json.load(f)
        # Migrate old string-only format ("done"/"skip") to dict format
        migrated = {}
        for k, v in raw.items():
            if isinstance(v, str):
                migrated[k] = {"status": v, "reviewed_ids": []}
            else:
                migrated[k] = v
        return migrated
    return {}


def save_progress(progress: dict) -> None:
    with open(PROGRESS_FILE, "w", encoding="utf-8") as f:
        json.dump(progress, f, ensure_ascii=False, indent=2)


def get_group_progress(progress: dict, simp: str) -> tuple[str, set[int]]:
    """Returns (status, reviewed_ids_set) for a group key."""
    entry = progress.get(simp, {})
    status = entry.get("status", "")
    reviewed_ids = set(entry.get("reviewed_ids", []))
    return status, reviewed_ids


def mark_image_reviewed(progress: dict, simp: str, img_id: int) -> None:
    if simp not in progress:
        progress[simp] = {"status": "in_progress", "reviewed_ids": []}
    if img_id not in progress[simp].get("reviewed_ids", []):
        progress[simp].setdefault("reviewed_ids", []).append(img_id)
    progress[simp]["status"] = "in_progress"


def curate_group(
    conn: sqlite3.Connection,
    char: str,
    variants: list[str],
    images_root: Path,
    style_filter: str | None,
    source_filter: str | None,
    dry_run: bool,
    progress: dict,
    simp_key: str,
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
    all_images = cursor.fetchall()

    # Filter out already-reviewed images so we resume where we left off
    _, reviewed_ids = get_group_progress(progress, simp_key)
    images = [img for img in all_images if img[0] not in reviewed_ids]
    skipped_count = len(all_images) - len(images)

    if not images:
        print(f"  All images for {char!r} already reviewed.")
        return 0, 0

    variant_ids: dict[str, int] = {}
    for v in variants:
        variant_ids[v] = get_or_create_character(cursor, v)
    if not dry_run:
        conn.commit()

    total_remaining = len(images)
    total_all = len(all_images)
    numbered = {str(i + 1): v for i, v in enumerate(variants)}
    shortcut = "/".join(f"{i+1}:{v}" for i, v in enumerate(variants))
    resume_note = f" (resuming — {skipped_count} already reviewed)" if skipped_count else ""
    print(f"\n{'[DRY RUN] ' if dry_run else ''}"
          f"  {total_remaining}/{total_all} images remaining{resume_note}")
    print(f"  [{shortcut}] to reassign  |  Enter = keep  |  s = skip group  |  q = save & quit\n")

    reassigned = kept = 0

    for i, (img_id, img_path, source, style_name, style_slug) in enumerate(images, 1):
        full_path = images_root / img_path
        print(f"  [{i}/{total_remaining}] now={char}  {style_name} · {source}  {img_path}")
        open_image(full_path)

        while True:
            try:
                answer = input(f"  [{shortcut}] / Enter=keep / s / q: ").strip()
            except (EOFError, KeyboardInterrupt):
                print("\n  Interrupted — progress saved.")
                if not dry_run:
                    conn.commit()
                return reassigned, kept

            if answer in numbered:
                answer = numbered[answer]

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
                if not dry_run:
                    mark_image_reviewed(progress, simp_key, img_id)
                    save_progress(progress)
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

            if not dry_run:
                conn.commit()
                mark_image_reviewed(progress, simp_key, img_id)
                save_progress(progress)
            break

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
    progress = load_progress()

    if args.char:
        # Single-group mode — use the char itself as the progress key
        simp_key = args.char
        _, reviewed = get_group_progress(progress, simp_key)
        if reviewed:
            print(f"Resuming {args.char!r} — {len(reviewed)} images already reviewed.")
        try:
            r, k = curate_group(conn, args.char, args.variants, images_root,
                                 args.style, args.source, args.dry_run,
                                 progress, simp_key)
        except SystemExit:
            conn.close()
            return
        print(f"\nDone. {r} reassigned, {k} kept as {args.char!r}.")
        conn.close()
        return

    # Batch mode
    groups_path = Path("data/variant_groups.json")
    if not groups_path.exists():
        print("data/variant_groups.json not found.")
        conn.close()
        sys.exit(1)

    with open(groups_path, encoding="utf-8") as f:
        groups = json.load(f)

    total_groups = len(groups)
    done_count = sum(1 for g in groups
                     if progress.get(g["simp"], {}).get("status") == "done")
    print(f"\nBatch curation: {total_groups} groups, {done_count} already done.")
    print("Commands: character to reassign | Enter = keep | s = skip group | q = save & quit\n")

    for g in groups:
        simp = g["simp"]
        variants = g["variants"]
        total_images = g["total"]

        status, reviewed_ids = get_group_progress(progress, simp)
        remaining = total_images - len(reviewed_ids)

        if args.skip_done and status == "done":
            continue
        if total_images < args.min_images:
            continue

        counts_str = ", ".join(f"{c}:{g['counts'][c]}" for c in variants)
        resume_note = f"  [{len(reviewed_ids)} reviewed, {remaining} remaining]" if reviewed_ids else ""
        print(f"\n{'='*60}")
        print(f"Group: {simp} → {' / '.join(variants)}  [{counts_str}]{resume_note}")

        while True:
            try:
                cmd = input("  Enter group? [y/s/q]: ").strip().lower()
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
            if cmd in ("y", ""):
                total_r = total_k = 0
                try:
                    for char in variants:
                        print(f"\n  --- Curating images filed under {char!r} ---")
                        r, k = curate_group(conn, char, variants, images_root,
                                            args.style, args.source, args.dry_run,
                                            progress, simp)
                        total_r += r
                        total_k += k
                except SystemExit:
                    save_progress(progress)
                    conn.close()
                    return
                print(f"\n  Group summary: {total_r} reassigned, {total_k} kept.")
                cur_status = progress.get(simp, {}).get("status", "not started")
                cmd2 = input(f"  Mark group as done? (current: {cur_status}) [y/n, Enter=keep]: ").strip().lower()
                if cmd2 == "y":
                    cur_reviewed = set(progress.get(simp, {}).get("reviewed_ids", []))
                    progress[simp] = {"status": "done", "reviewed_ids": list(cur_reviewed)}
                    save_progress(progress)
                break
            print("  Invalid. Enter y/s/d/q.")

    save_progress(progress)
    conn.close()
    done_now = sum(1 for g in groups
                   if progress.get(g["simp"], {}).get("status") == "done")
    print(f"\nSession complete. {done_now}/{total_groups} groups done.")


if __name__ == "__main__":
    main()
