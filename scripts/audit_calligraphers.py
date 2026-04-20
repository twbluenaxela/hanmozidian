"""
Audit the calligraphers table for entries that are book/collection titles
rather than actual calligrapher names, and optionally fix them by reclassifying
them as works and setting calligrapher_id to NULL on the affected images.

Usage:
    python scripts/audit_calligraphers.py          # report only
    python scripts/audit_calligraphers.py --fix    # apply fixes to DB
"""

import argparse
import re
import sqlite3
from pathlib import Path

# Characters that commonly end book/collection titles, not person names
TITLE_SUFFIX_CHARS = frozenset("韻海釋續叢輯選集彙錄編纂考訂通鑑志要冊卷本")

# Substrings that indicate a reference work, not a person
TITLE_KEYWORDS = [
    "字典", "字海", "韻海", "韻府", "四聲", "集篆", "集古",
    "隸釋", "隸續", "字彙", "玉篇", "說文", "廣韻", "康熙",
    "正字", "六書", "篆法", "草法", "字法", "法帖",
    "石經", "刻石", "摩崖", "造像", "磚文", "陶文", "封泥",
    "第一", "第二", "第三", "第四", "上聲", "下聲", "入聲", "去聲",
    "古文四聲", "集韻", "類篇",
]

# Known exact misclassified entries (extend as you find more)
KNOWN_BAD = {
    "集篆顧問韻海",
    "古文四聲韻",
    "集古文韻上聲韻第三",
    "隸釋",
    "隸續",
    "出師頌",    # this is a work title, not a person
}


def is_suspicious(name: str) -> tuple[bool, list[str]]:
    reasons = []
    if not name or name == "Unknown":
        return False, []
    if name in KNOWN_BAD:
        reasons.append("known bad")
    if len(name) > 7:
        reasons.append(f"long ({len(name)} chars)")
    if name[-1] in TITLE_SUFFIX_CHARS:
        reasons.append(f"ends in '{name[-1]}'")
    for kw in TITLE_KEYWORDS:
        if kw in name:
            reasons.append(f'contains "{kw}"')
            break
    # Contains a Chinese numeral AND is longer than a normal name
    if re.search(r"[一二三四五六七八九十百千]", name) and len(name) > 4:
        reasons.append("has numeral")
    return bool(reasons), reasons


def main():
    parser = argparse.ArgumentParser()
    parser.add_argument("--db", default="data/shufazidian.db")
    parser.add_argument("--fix", action="store_true",
                        help="Move bad entries from calligraphers → works and NULL out calligrapher_id")
    args = parser.parse_args()

    conn = sqlite3.connect(args.db)
    conn.execute("PRAGMA foreign_keys = ON")

    rows = conn.execute("""
        SELECT ca.id, ca.name_zh, ca.dynasty, COUNT(ci.id) as img_count
        FROM calligraphers ca
        JOIN calligraphy_images ci ON ci.calligrapher_id = ca.id
        WHERE ci.source = 'zi.tools'
        GROUP BY ca.id
        ORDER BY ca.name_zh
    """).fetchall()

    flagged = []
    clean = []
    for rid, name, dynasty, imgs in rows:
        bad, reasons = is_suspicious(name)
        if bad:
            flagged.append((rid, name, dynasty, imgs, reasons))
        else:
            clean.append((rid, name, dynasty, imgs))

    print(f"Total zi.tools calligraphers: {len(rows)}")
    print(f"Flagged as suspicious:        {len(flagged)}")
    print(f"Appear clean:                 {len(clean)}")
    print()

    if flagged:
        print("=== SUSPICIOUS (likely titles/collections, not people) ===")
        for rid, name, dynasty, imgs, reasons in flagged:
            print(f"  id={rid:4d}  {name:40s}  dynasty={dynasty or '':8s}  imgs={imgs:4d}  [{', '.join(reasons)}]")

    if not args.fix:
        print("\nRun with --fix to reclassify these entries.")
        print("Each will have its images' calligrapher_id set to NULL (unknown author).")
        print("The calligrapher row itself will be deleted.")
        return

    print("\nApplying fixes...")
    cur = conn.cursor()
    for rid, name, dynasty, imgs, reasons in flagged:
        # Try to reclassify as a work entry if it looks like one
        # (For now: just NULL out calligrapher_id on affected images)
        cur.execute(
            "UPDATE calligraphy_images SET calligrapher_id = NULL WHERE calligrapher_id = ?",
            (rid,)
        )
        cur.execute("DELETE FROM calligraphers WHERE id = ?", (rid,))
        print(f"  fixed: {name!r} — {imgs} images set to unknown calligrapher, row deleted")

    conn.commit()
    conn.close()
    print(f"\nDone. {len(flagged)} bad entries removed.")


if __name__ == "__main__":
    main()
