"""
Generate a static HTML gallery of scraped calligraphy images.

Reads the SQLite DB, groups images by character, and writes
public/gallery.html — a browsable, searchable gallery showing
each image labeled with character, calligrapher, dynasty, work,
and style.

Usage:
    python scripts/generate_gallery.py
    python scripts/generate_gallery.py --db data/shufazidian.db --out public/gallery.html
    python scripts/generate_gallery.py --char 永    # only show one character
    python scripts/generate_gallery.py --limit 50  # first 50 characters only
"""

import argparse
import html
import sqlite3
import sys
from pathlib import Path


STYLE_LABELS = {
    "zhuan": "篆書 Zhuan",
    "li":    "隸書 Li",
    "kai":   "楷書 Kai",
    "xing":  "行書 Xing",
    "cao":   "草書 Cao",
}

STYLE_COLORS = {
    "zhuan": "#7c3aed",
    "li":    "#b45309",
    "kai":   "#1d4ed8",
    "xing":  "#0f766e",
    "cao":   "#be123c",
}


def query_images(conn: sqlite3.Connection, char: str | None, limit: int | None) -> list[dict]:
    sql = """
        SELECT
            c.character,
            c.unicode_hex,
            COALESCE(ca.name_zh, 'Unknown') AS calligrapher,
            COALESCE(ca.dynasty, '')         AS dynasty,
            COALESCE(w.name_zh, 'Unknown')   AS work,
            ss.slug                          AS style,
            ci.image_path
        FROM calligraphy_images ci
        JOIN characters c ON ci.character_id = c.id
        LEFT JOIN calligraphers ca ON ci.calligrapher_id = ca.id
        LEFT JOIN works w ON ci.work_id = w.id
        LEFT JOIN script_styles ss ON ci.style_id = ss.id
    """
    params: list = []
    if char:
        sql += " WHERE c.character = ?"
        params.append(char)
    sql += " ORDER BY c.character, ss.sort_order, ca.name_zh"

    rows = conn.execute(sql, params).fetchall()
    cols = ["character", "unicode_hex", "calligrapher", "dynasty", "work", "style", "image_path"]
    result = [dict(zip(cols, r)) for r in rows]

    if limit:
        # Take first N *distinct* characters
        seen: set[str] = set()
        limited: list[dict] = []
        for row in result:
            seen.add(row["character"])
            if len(seen) > limit:
                break
            limited.append(row)
        return limited

    return result


def group_by_char(rows: list[dict]) -> dict[str, list[dict]]:
    groups: dict[str, list[dict]] = {}
    for row in rows:
        ch = row["character"]
        groups.setdefault(ch, []).append(row)
    return groups


def render_html(groups: dict[str, list[dict]], total_images: int, total_chars: int) -> str:
    chars_shown = len(groups)
    images_shown = sum(len(v) for v in groups.values())

    # Build character index bar
    index_items = []
    for ch in groups:
        u = groups[ch][0]["unicode_hex"]
        index_items.append(f'<a href="#char-{u}" class="idx-link">{html.escape(ch)}</a>')
    index_html = "\n".join(index_items)

    # Build card sections
    sections = []
    for ch, images in groups.items():
        u = images[0]["unicode_hex"]
        cards = []
        for img in images:
            style = img["style"]
            color = STYLE_COLORS.get(style, "#555")
            style_label = STYLE_LABELS.get(style, style)
            calligrapher = html.escape(img["calligrapher"])
            dynasty = html.escape(img["dynasty"])
            work = html.escape(img["work"])
            src = html.escape("/" + img["image_path"].replace("\\", "/"))
            badge = f'<span class="badge" style="background:{color}">{html.escape(style_label)}</span>'
            dynasty_span = f' <span class="dynasty">({dynasty})</span>' if dynasty else ""
            cards.append(f"""
        <div class="card">
          <img src="{src}" alt="{html.escape(ch)} by {calligrapher}" loading="lazy" onerror="this.parentElement.style.opacity='0.4'">
          <div class="card-info">
            {badge}
            <div class="calligrapher">{calligrapher}{dynasty_span}</div>
            <div class="work">{work if work != 'Unknown' else ''}</div>
          </div>
        </div>""")

        cards_html = "\n".join(cards)
        sections.append(f"""
  <section id="char-{u}" class="char-section">
    <h2 class="char-heading">
      <span class="char-display">{html.escape(ch)}</span>
      <span class="char-meta">U+{u} &nbsp;·&nbsp; {len(images)} image{"s" if len(images) != 1 else ""}</span>
    </h2>
    <div class="cards">
{cards_html}
    </div>
  </section>""")

    sections_html = "\n".join(sections)

    return f"""<!DOCTYPE html>
<html lang="zh-Hant">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <title>書法字典 — Calligraphy Image Gallery</title>
  <style>
    *, *::before, *::after {{ box-sizing: border-box; margin: 0; padding: 0; }}
    body {{ font-family: system-ui, -apple-system, sans-serif; background: #0f172a; color: #e2e8f0; }}

    header {{ background: #1e293b; padding: 1.5rem 2rem; border-bottom: 1px solid #334155; }}
    header h1 {{ font-size: 1.5rem; font-weight: 700; }}
    header p {{ color: #94a3b8; margin-top: .25rem; font-size: .9rem; }}

    .search-bar {{ padding: 1rem 2rem; background: #1e293b; border-bottom: 1px solid #334155; }}
    .search-bar input {{
      width: 100%; max-width: 400px; padding: .5rem 1rem;
      background: #0f172a; border: 1px solid #475569; border-radius: 6px;
      color: #e2e8f0; font-size: 1rem;
    }}

    .char-index {{
      padding: .75rem 2rem;
      background: #1e293b;
      border-bottom: 1px solid #334155;
      display: flex; flex-wrap: wrap; gap: .3rem;
    }}
    .idx-link {{
      display: inline-block; width: 2rem; text-align: center;
      padding: .2rem;
      background: #0f172a; border: 1px solid #334155; border-radius: 4px;
      color: #cbd5e1; text-decoration: none; font-size: 1.1rem;
      transition: background .15s;
    }}
    .idx-link:hover {{ background: #334155; color: #f1f5f9; }}

    main {{ padding: 2rem; }}

    .char-section {{ margin-bottom: 3rem; scroll-margin-top: 1rem; }}
    .char-heading {{
      display: flex; align-items: baseline; gap: 1rem;
      margin-bottom: 1rem; padding-bottom: .5rem;
      border-bottom: 2px solid #334155;
    }}
    .char-display {{
      font-size: 3rem; line-height: 1;
      font-family: "Noto Serif CJK TC", "Source Han Serif TC", serif;
      color: #f8fafc;
    }}
    .char-meta {{ font-size: .85rem; color: #64748b; }}

    .cards {{
      display: flex; flex-wrap: wrap; gap: .75rem;
    }}
    .card {{
      background: #1e293b; border: 1px solid #334155; border-radius: 8px;
      overflow: hidden; width: 140px; flex-shrink: 0;
      transition: transform .15s, border-color .15s;
    }}
    .card:hover {{ transform: translateY(-2px); border-color: #64748b; }}
    .card img {{
      display: block; width: 140px; height: 140px;
      object-fit: contain; background: #fff;
    }}
    .card-info {{ padding: .4rem .5rem; }}
    .badge {{
      display: inline-block; font-size: .65rem; font-weight: 600;
      padding: .1rem .4rem; border-radius: 3px; color: #fff;
      margin-bottom: .25rem;
    }}
    .calligrapher {{ font-size: .8rem; color: #cbd5e1; font-weight: 500; }}
    .dynasty {{ font-size: .75rem; color: #64748b; }}
    .work {{ font-size: .75rem; color: #94a3b8; margin-top: .1rem; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }}

    .hidden {{ display: none !important; }}

    @media (max-width: 600px) {{
      main {{ padding: 1rem; }}
      .char-index {{ padding: .5rem 1rem; }}
    }}
  </style>
</head>
<body>
  <header>
    <h1>書法字典 — Calligraphy Gallery</h1>
    <p>
      {images_shown:,} images across {chars_shown:,} characters shown
      (DB total: {total_images:,} images, {total_chars:,} characters scraped)
    </p>
  </header>

  <div class="search-bar">
    <input type="search" id="search" placeholder="Search character, calligrapher, or work…" autocomplete="off">
  </div>

  <div class="char-index">
{index_html}
  </div>

  <main id="main">
{sections_html}
  </main>

  <script>
    const search = document.getElementById('search');
    const sections = Array.from(document.querySelectorAll('.char-section'));

    search.addEventListener('input', () => {{
      const q = search.value.trim().toLowerCase();
      sections.forEach(sec => {{
        if (!q) {{ sec.classList.remove('hidden'); return; }}
        const text = sec.textContent.toLowerCase();
        sec.classList.toggle('hidden', !text.includes(q));
      }});
    }});
  </script>
</body>
</html>
"""


def main() -> int:
    parser = argparse.ArgumentParser(description="Generate static HTML gallery of calligraphy images")
    parser.add_argument("--db", default="data/shufazidian.db")
    parser.add_argument("--out", default="public/gallery.html")
    parser.add_argument("--char", default=None, help="Only show this character")
    parser.add_argument("--limit", type=int, default=None, help="Only first N characters")
    args = parser.parse_args()

    db_path = Path(args.db)
    if not db_path.exists():
        print(f"error: DB not found: {db_path}", file=sys.stderr)
        return 1

    conn = sqlite3.connect(str(db_path))
    total_images = conn.execute("SELECT COUNT(*) FROM calligraphy_images").fetchone()[0]
    total_chars  = conn.execute("SELECT COUNT(*) FROM zi_tools_scrapes").fetchone()[0]

    rows = query_images(conn, args.char, args.limit)
    conn.close()

    if not rows:
        print("no images found", file=sys.stderr)
        return 1

    groups = group_by_char(rows)
    out_html = render_html(groups, total_images, total_chars)

    out_path = Path(args.out)
    out_path.parent.mkdir(parents=True, exist_ok=True)
    out_path.write_text(out_html, encoding="utf-8")

    print(f"wrote {out_path}  ({len(groups)} chars, {len(rows)} images)")
    print(f"open: http://localhost:3000/gallery.html")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
