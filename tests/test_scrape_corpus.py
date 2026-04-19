"""
Unit tests for scrape_corpus.py

Covers corpus loading, global character extraction, and the
already-scraped deduplication query — all without network calls.
"""

import json
import sqlite3
import sys
import tempfile
import unittest
from pathlib import Path

sys.path.insert(0, str(Path(__file__).parent.parent / "scripts"))

from scrape_corpus import already_scraped, extract_global_chars, load_corpus


# ---------------------------------------------------------------------------
# Helpers
# ---------------------------------------------------------------------------

def _write_corpus(data: dict, directory: str) -> Path:
    path = Path(directory) / "corpus.json"
    path.write_text(json.dumps(data, ensure_ascii=False), encoding="utf-8")
    return path


def _make_scrapes_db(chars: list[str], directory: str) -> str:
    """Write a SQLite DB with zi_tools_scrapes pre-populated."""
    db_path = str(Path(directory) / "test.db")
    conn = sqlite3.connect(db_path)
    conn.execute("""
        CREATE TABLE zi_tools_scrapes (
            character  TEXT PRIMARY KEY,
            scraped_at TEXT NOT NULL
        )
    """)
    for ch in chars:
        conn.execute(
            "INSERT INTO zi_tools_scrapes (character, scraped_at) VALUES (?, datetime('now'))",
            (ch,),
        )
    conn.commit()
    conn.close()
    return db_path


# ---------------------------------------------------------------------------
# load_corpus
# ---------------------------------------------------------------------------

class TestLoadCorpus(unittest.TestCase):

    def test_loads_pieces_with_text(self):
        with tempfile.TemporaryDirectory() as tmp:
            path = _write_corpus({
                "pieces": [
                    {"id": "a", "text": "永和九年"},
                    {"id": "b", "text": "天下第一"},
                ]
            }, tmp)
            pieces = load_corpus(path)
            self.assertEqual(len(pieces), 2)

    def test_filters_empty_text(self):
        with tempfile.TemporaryDirectory() as tmp:
            path = _write_corpus({
                "pieces": [
                    {"id": "a", "text": "永和九年"},
                    {"id": "b", "text": ""},
                    {"id": "c", "text": "   "},
                ]
            }, tmp)
            pieces = load_corpus(path)
            self.assertEqual(len(pieces), 1)
            self.assertEqual(pieces[0]["id"], "a")

    def test_filters_missing_text_key(self):
        with tempfile.TemporaryDirectory() as tmp:
            path = _write_corpus({
                "pieces": [
                    {"id": "a", "text": "永和九年"},
                    {"id": "b"},                   # no "text" key at all
                ]
            }, tmp)
            pieces = load_corpus(path)
            self.assertEqual(len(pieces), 1)

    def test_missing_pieces_key_returns_empty(self):
        with tempfile.TemporaryDirectory() as tmp:
            path = _write_corpus({}, tmp)
            self.assertEqual(load_corpus(path), [])

    def test_invalid_json_raises(self):
        with tempfile.TemporaryDirectory() as tmp:
            path = Path(tmp) / "corpus.json"
            path.write_text("{ not valid json }", encoding="utf-8")
            with self.assertRaises(Exception):
                load_corpus(path)

    def test_missing_file_raises(self):
        with self.assertRaises((FileNotFoundError, OSError)):
            load_corpus(Path("/nonexistent/path/corpus.json"))

    def test_returns_list(self):
        with tempfile.TemporaryDirectory() as tmp:
            path = _write_corpus({"pieces": [{"id": "a", "text": "永"}]}, tmp)
            result = load_corpus(path)
            self.assertIsInstance(result, list)


# ---------------------------------------------------------------------------
# extract_global_chars
# ---------------------------------------------------------------------------

class TestExtractGlobalChars(unittest.TestCase):

    def test_empty_pieces(self):
        self.assertEqual(extract_global_chars([]), [])

    def test_single_piece_unique_chars(self):
        result = extract_global_chars([{"text": "永和九年"}])
        self.assertEqual(result, ["永", "和", "九", "年"])

    def test_global_dedup_across_pieces(self):
        # 之 in both pieces must appear exactly once
        pieces = [{"text": "王羲之"}, {"text": "顏真之卿"}]
        result = extract_global_chars(pieces)
        self.assertEqual(result.count("之"), 1)

    def test_first_seen_order_across_pieces(self):
        pieces = [{"text": "永和"}, {"text": "和九"}]
        result = extract_global_chars(pieces)
        # 永 seen first, 和 seen second, 九 seen third (and not 和 again)
        self.assertEqual(result, ["永", "和", "九"])

    def test_non_cjk_excluded(self):
        result = extract_global_chars([{"text": "永 Hello 和，。123"}])
        self.assertEqual(result, ["永", "和"])

    def test_s2t_deduplication(self):
        # 爱 (simplified) should convert to 愛 (traditional) via opencc;
        # when 愛 is then encountered it's already in seen → result has length 1
        pieces = [{"text": "爱"}, {"text": "愛"}]
        result = extract_global_chars(pieces)
        self.assertEqual(len(result), 1)
        self.assertEqual(result[0], "愛")

    def test_piece_without_text_key_is_skipped(self):
        pieces = [{"id": "no-text"}, {"text": "永和"}]
        result = extract_global_chars(pieces)
        self.assertEqual(result, ["永", "和"])

    def test_returns_list(self):
        self.assertIsInstance(extract_global_chars([{"text": "永"}]), list)

    def test_all_chars_are_cjk(self):
        pieces = [{"text": "永和 Hello 九年 123"}]
        result = extract_global_chars(pieces)
        for ch in result:
            with self.subTest(ch=ch):
                o = ord(ch)
                in_unified = 0x4E00 <= o <= 0x9FFF
                in_ext_a   = 0x3400 <= o <= 0x4DBF
                self.assertTrue(in_unified or in_ext_a, f"{ch!r} is not CJK")


# ---------------------------------------------------------------------------
# already_scraped
# ---------------------------------------------------------------------------

class TestAlreadyScraped(unittest.TestCase):

    def test_empty_table_returns_empty_set(self):
        with tempfile.TemporaryDirectory() as tmp:
            db_path = _make_scrapes_db([], tmp)
            result = already_scraped(["永", "和"], db_path)
            self.assertEqual(result, set())

    def test_returns_scraped_chars_as_set(self):
        with tempfile.TemporaryDirectory() as tmp:
            db_path = _make_scrapes_db(["永", "和"], tmp)
            result = already_scraped(["永", "和", "九"], db_path)
            self.assertIsInstance(result, set)
            self.assertIn("永", result)
            self.assertIn("和", result)

    def test_returns_all_table_chars_not_just_input(self):
        # already_scraped returns the whole table; filtering is done by the caller
        with tempfile.TemporaryDirectory() as tmp:
            db_path = _make_scrapes_db(["永", "和", "九"], tmp)
            result = already_scraped(["永"], db_path)  # only ask about 永
            # But the function returns ALL chars in the table
            self.assertIn("和", result)
            self.assertIn("九", result)

    def test_new_db_creates_table_and_returns_empty(self):
        with tempfile.TemporaryDirectory() as tmp:
            db_path = str(Path(tmp) / "brand_new.db")
            # File doesn't exist yet
            result = already_scraped(["永"], db_path)
            self.assertEqual(result, set())
            # Table must now exist so future inserts don't fail
            conn = sqlite3.connect(db_path)
            conn.execute("SELECT COUNT(*) FROM zi_tools_scrapes")
            conn.close()

    def test_returns_set_type(self):
        with tempfile.TemporaryDirectory() as tmp:
            db_path = _make_scrapes_db(["永"], tmp)
            result = already_scraped(["永"], db_path)
            self.assertIsInstance(result, set)

    def test_no_chars_in_input_still_works(self):
        with tempfile.TemporaryDirectory() as tmp:
            db_path = _make_scrapes_db(["永"], tmp)
            result = already_scraped([], db_path)
            self.assertIsInstance(result, set)


# ---------------------------------------------------------------------------
# Cross-function integration: extract then subtract
# ---------------------------------------------------------------------------

class TestExtractAndSubtract(unittest.TestCase):
    """
    Verifies the full deduplication pipeline:
    extract_global_chars → subtract already_scraped → remaining list.
    This mirrors exactly what scrape_corpus.main() does.
    """

    def test_already_scraped_chars_excluded_from_remaining(self):
        pieces = [{"text": "永和九年"}]
        all_chars = extract_global_chars(pieces)
        self.assertIn("永", all_chars)

        with tempfile.TemporaryDirectory() as tmp:
            db_path = _make_scrapes_db(["永"], tmp)
            done = already_scraped(all_chars, db_path)
            remaining = [c for c in all_chars if c not in done]

        self.assertNotIn("永", remaining)
        self.assertIn("和", remaining)
        self.assertIn("九", remaining)
        self.assertIn("年", remaining)

    def test_nothing_remaining_when_all_scraped(self):
        pieces = [{"text": "永和"}]
        all_chars = extract_global_chars(pieces)

        with tempfile.TemporaryDirectory() as tmp:
            db_path = _make_scrapes_db(all_chars, tmp)
            done = already_scraped(all_chars, db_path)
            remaining = [c for c in all_chars if c not in done]

        self.assertEqual(remaining, [])

    def test_remaining_preserves_order(self):
        pieces = [{"text": "之乎者也"}]
        all_chars = extract_global_chars(pieces)

        with tempfile.TemporaryDirectory() as tmp:
            db_path = _make_scrapes_db(["乎"], tmp)
            done = already_scraped(all_chars, db_path)
            remaining = [c for c in all_chars if c not in done]

        self.assertEqual(remaining, ["之", "者", "也"])


if __name__ == "__main__":
    unittest.main(verbosity=2)
