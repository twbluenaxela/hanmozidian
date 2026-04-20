import sqlite3
conn = sqlite3.connect('/home/redna/shufazidian/data/shufazidian.db')
cur = conn.cursor()

# ── 1. Merge single-char 石鼓文 sections into work id=45 (石鼓文) ─────────────
SHIGUW_ID = 45
MERGE_INTO_SHIGUW = [56, 69, 71, 61, 66, 59, 64, 70, 65, 68, 67]  # 。冊又悔慎戉教植産自拘句

print("=== Merging 石鼓文 sub-sections into work id=45 ===")
for wid in MERGE_INTO_SHIGUW:
    name = conn.execute("SELECT name_zh FROM works WHERE id=?", (wid,)).fetchone()
    name = name[0] if name else "?"
    n = conn.execute("SELECT COUNT(*) FROM calligraphy_images WHERE work_id=?", (wid,)).fetchone()[0]
    cur.execute("UPDATE calligraphy_images SET work_id=? WHERE work_id=?", (SHIGUW_ID, wid))
    cur.execute("DELETE FROM works WHERE id=?", (wid,))
    print("  merged %r (%d imgs) → 石鼓文" % (name, n))

# ── 2. Calligrapher names in the works table → NULL work_id ──────────────────
# These are real calligraphers whose name got stored as a work title
CALLI_IN_WORKS = {
    53: "梁同書",
    63: "趙秉文",
    54: "禹之鼎",
    62: "翟汝文",
    60: "黎簡",
    52: "萬經",   # 萬經 (1659-1741) Qing calligrapher/scholar
}

print()
print("=== Nulling calligrapher-names-as-works ===")
for wid, name in CALLI_IN_WORKS.items():
    n = conn.execute("SELECT COUNT(*) FROM calligraphy_images WHERE work_id=?", (wid,)).fetchone()[0]
    cur.execute("UPDATE calligraphy_images SET work_id=NULL WHERE work_id=?", (wid,))
    cur.execute("DELETE FROM works WHERE id=?", (wid,))
    print("  nulled work %r (%d imgs)" % (name, n))

conn.commit()
print()

# ── Verify ────────────────────────────────────────────────────────────────────
shiguw_count = conn.execute(
    "SELECT COUNT(*) FROM calligraphy_images WHERE work_id=?", (SHIGUW_ID,)
).fetchone()[0]
print("石鼓文 now has %d images" % shiguw_count)

remaining_short = conn.execute(
    "SELECT id, name_zh FROM works WHERE LENGTH(name_zh) <= 2"
).fetchall()
print("Remaining short work names:", remaining_short)
