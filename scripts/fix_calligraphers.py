"""
One-time fix: clean up misclassified calligrapher entries from zi.tools scrape.

Two categories of fixes:
  NULL  — entry is a book/reference/work title, not a person.
          Images keep their data but calligrapher_id → NULL.
  SPLIT — entry is "monk_name + work_description" concatenated.
          A proper calligrapher row is created for the monk;
          images are re-pointed to the new row.

Run:
    python scripts/fix_calligraphers.py           # dry run
    python scripts/fix_calligraphers.py --apply   # write to DB
"""

import argparse
import sqlite3

DB = "data/shufazidian.db"

# ── Entries to NULL out (not real people) ────────────────────────────────────
# id → name (for logging)
NULL_IDS: dict[int, str] = {
    344: "出師頌",               # work title, not a person
    72:  "古文四聲韻",            # Song dynasty character reference
    214: "古文磚",               # brick inscription rubbings
    213: "尚書文字合編",           # compilation
    165: "臨王羲之",              # "copy of Wang Xizhi" — not a name
    174: "說文解字",              # Shuowen Jiezi dictionary
    145: "隸釋 隸續",             # Han stele studies by 洪适
    73:  "集古文韻上聲韻第三",       # section of a reference
    74:  "集篆古文韻海",            # seal script dictionary
    251: "魏石經古文彙編",          # stone classics compilation
    # ── Period/dynasty labels that slipped through when row[8] was present ──
    496: "商",
    641: "商或西周早期",
    508: "戰國",
    590: "戰國早期",
    634: "西周中期",
    429: "西周早期",
    693: "西周早期或中期",
    330: "西周晚期",
    # ── 簡牘 archaeological documents (not calligraphers) ──────────────────
    175: "睡虎地簡牘",
    260: "樓蘭簡牘",
    409: "居延簡牘",
}

# ── Entries to split (monk name + "集王羲之" concatenated) ─────────────────
# old_id → (real_calligrapher_name, dynasty)
SPLIT_MAP: dict[int, tuple[str, str]] = {
    198: ("釋大雅", "唐"),   # 釋大雅集王羲之
    89:  ("釋懷仁", "唐"),   # 釋懷仁集王羲之 (compiled 聖教序)
    378: ("釋玄序", "唐"),   # 釋玄序集王羲之
}


def main() -> None:
    parser = argparse.ArgumentParser()
    parser.add_argument("--apply", action="store_true",
                        help="Write changes to DB (default: dry run)")
    parser.add_argument("--db", default=DB)
    args = parser.parse_args()

    dry = not args.apply
    conn = sqlite3.connect(args.db)
    conn.execute("PRAGMA foreign_keys = ON")
    cur = conn.cursor()

    total_nulled = 0
    total_split  = 0

    # ── NULL fixes ───────────────────────────────────────────────────────────
    print("=== NULL fixes (books / misclassified titles) ===")
    for bad_id, label in NULL_IDS.items():
        cur.execute(
            "SELECT COUNT(*) FROM calligraphy_images WHERE calligrapher_id = ?",
            (bad_id,)
        )
        img_count = cur.fetchone()[0]
        print(f"  [{bad_id:4d}] {label:30s}  → NULL calligrapher on {img_count} images")
        total_nulled += img_count
        if not dry:
            cur.execute(
                "UPDATE calligraphy_images SET calligrapher_id = NULL WHERE calligrapher_id = ?",
                (bad_id,)
            )
            # works table also has a FK to calligraphers
            cur.execute(
                "UPDATE works SET calligrapher_id = NULL WHERE calligrapher_id = ?",
                (bad_id,)
            )
            cur.execute("DELETE FROM calligraphers WHERE id = ?", (bad_id,))

    print()
    print("=== SPLIT fixes (monk + work concatenated) ===")
    for old_id, (new_name, dynasty) in SPLIT_MAP.items():
        # Check whether a row for this monk already exists
        cur.execute("SELECT id FROM calligraphers WHERE name_zh = ?", (new_name,))
        existing = cur.fetchone()

        cur.execute(
            "SELECT COUNT(*) FROM calligraphy_images WHERE calligrapher_id = ?",
            (old_id,)
        )
        img_count = cur.fetchone()[0]
        old_name = next(
            (n for oi, (n, _) in SPLIT_MAP.items() if oi == old_id), str(old_id)
        )
        # fetch actual name from DB for display
        cur.execute("SELECT name_zh FROM calligraphers WHERE id = ?", (old_id,))
        row = cur.fetchone()
        old_label = row[0] if row else str(old_id)

        if existing:
            new_id = existing[0]
            print(f"  [{old_id:4d}] {old_label:30s}  → reuse existing '{new_name}' (id={new_id}), {img_count} images")
        else:
            new_id = None
            print(f"  [{old_id:4d}] {old_label:30s}  → create '{new_name}' ({dynasty}), {img_count} images")

        total_split += img_count

        if not dry:
            if not existing:
                cur.execute(
                    "INSERT INTO calligraphers (name_zh, dynasty) VALUES (?, ?)",
                    (new_name, dynasty)
                )
                new_id = cur.lastrowid
            cur.execute(
                "UPDATE calligraphy_images SET calligrapher_id = ? WHERE calligrapher_id = ?",
                (new_id, old_id)
            )
            cur.execute("DELETE FROM calligraphers WHERE id = ?", (old_id,))

    print()
    print(f"{'DRY RUN — ' if dry else ''}Summary:")
    print(f"  {len(NULL_IDS)} bad entries → NULL calligrapher  ({total_nulled} images)")
    print(f"  {len(SPLIT_MAP)} entries split into real calligraphers ({total_split} images)")
    if dry:
        print("\nRun with --apply to commit changes.")
    else:
        conn.commit()
        print("\nChanges committed.")

    conn.close()


if __name__ == "__main__":
    main()
