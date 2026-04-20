"""
Unit tests for scrape_zi_tools.py

Covers every pure function and the DB helper layer.
No network calls — fetch_character and scrape_chars are integration-only.
"""

import sqlite3
import sys
import unittest
from pathlib import Path

sys.path.insert(0, str(Path(__file__).parent.parent / "scripts"))

from scrape_zi_tools import (
    _is_cjk,
    char_to_unicode_hex,
    extract_author_and_source,
    get_or_create_calligrapher,
    get_or_create_character,
    get_or_create_work,
    looks_like_period,
    looks_like_work,
    parse_row,
    unique_cjk_chars,
)


# ---------------------------------------------------------------------------
# Helpers
# ---------------------------------------------------------------------------

def _make_db() -> sqlite3.Connection:
    """In-memory DB with the minimal schema used by the helper functions."""
    conn = sqlite3.connect(":memory:")
    conn.executescript("""
        CREATE TABLE characters (
            id          INTEGER PRIMARY KEY AUTOINCREMENT,
            character   TEXT    UNIQUE NOT NULL,
            unicode_hex TEXT    NOT NULL
        );
        CREATE TABLE calligraphers (
            id       INTEGER PRIMARY KEY AUTOINCREMENT,
            name_zh  TEXT UNIQUE NOT NULL,
            dynasty  TEXT
        );
        CREATE TABLE works (
            id               INTEGER PRIMARY KEY AUTOINCREMENT,
            name_zh          TEXT UNIQUE NOT NULL,
            calligrapher_id  INTEGER,
            style_id         INTEGER
        );
    """)
    conn.commit()
    return conn


_VALID_B64 = (
    "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAAC0lEQVQI12NgAAIABQ"
    "AABjkB6QAAAABJRU5ErkJggg=="
)


def _row(seven: str = "", eight: str = "", b64: str | None = None, dynasty: str = "唐") -> list:
    """Build a minimal zi.tools API row list.

    Pass b64=None (default) for the canonical valid PNG base64.
    Pass b64="" to simulate a missing/empty payload (should → parse_row returns None).
    """
    r = [""] * 9
    r[4] = _VALID_B64 if b64 is None else b64
    r[6] = dynasty
    r[7] = seven
    r[8] = eight
    return r


# ---------------------------------------------------------------------------
# _is_cjk
# ---------------------------------------------------------------------------

class TestIsCjk(unittest.TestCase):

    def test_common_unified_chars(self):
        for ch in "永和之中國":
            with self.subTest(ch=ch):
                self.assertTrue(_is_cjk(ch))

    def test_block_boundaries(self):
        self.assertTrue(_is_cjk("\u4E00"))   # first CJK Unified
        self.assertTrue(_is_cjk("\u9FFF"))   # last CJK Unified
        self.assertTrue(_is_cjk("\u3400"))   # first Extension A
        self.assertTrue(_is_cjk("\u4DBF"))   # last Extension A

    def test_just_outside_blocks(self):
        self.assertFalse(_is_cjk("\u3399"))  # one before Extension A
        self.assertFalse(_is_cjk("\uA000"))  # Yi Syllables

    def test_non_cjk_chars(self):
        for ch in "Aa1 ，。\n":
            with self.subTest(ch=repr(ch)):
                self.assertFalse(_is_cjk(ch))

    def test_empty_string(self):
        self.assertFalse(_is_cjk(""))

    def test_multi_char_string(self):
        # Function contract: must be exactly 1 char
        self.assertFalse(_is_cjk("永和"))


# ---------------------------------------------------------------------------
# char_to_unicode_hex
# ---------------------------------------------------------------------------

class TestCharToUnicodeHex(unittest.TestCase):

    def test_known_values(self):
        self.assertEqual(char_to_unicode_hex("永"), "6C38")
        self.assertEqual(char_to_unicode_hex("之"), "4E4B")
        self.assertEqual(char_to_unicode_hex("中"), "4E2D")

    def test_zero_padded_to_four_digits(self):
        # U+0041 = 'A' — ensures padding even for small code points
        self.assertEqual(char_to_unicode_hex("\u0041"), "0041")

    def test_uppercase_hex(self):
        result = char_to_unicode_hex("永")
        self.assertEqual(result, result.upper())


# ---------------------------------------------------------------------------
# unique_cjk_chars
# ---------------------------------------------------------------------------

class TestUniqueCjkChars(unittest.TestCase):

    def test_empty_string(self):
        self.assertEqual(unique_cjk_chars(""), [])

    def test_no_cjk(self):
        self.assertEqual(unique_cjk_chars("Hello, world! 123 ，。"), [])

    def test_deduplication(self):
        self.assertEqual(unique_cjk_chars("永和永"), ["永", "和"])

    def test_first_seen_order(self):
        self.assertEqual(unique_cjk_chars("之乎者也之乎"), ["之", "乎", "者", "也"])

    def test_mixed_cjk_and_ascii(self):
        self.assertEqual(unique_cjk_chars("永 and 和 and 永"), ["永", "和"])

    def test_punctuation_excluded(self):
        # CJK punctuation like ，。 is NOT in the CJK Unified / Extension A blocks
        self.assertEqual(unique_cjk_chars("永，和。之"), ["永", "和", "之"])

    def test_returns_list(self):
        self.assertIsInstance(unique_cjk_chars("永"), list)


# ---------------------------------------------------------------------------
# looks_like_work
# ---------------------------------------------------------------------------

class TestLooksLikeWork(unittest.TestCase):

    def test_empty_string(self):
        self.assertFalse(looks_like_work(""))

    def test_stele_suffixes(self):
        for name in ["張遷碑", "乙瑛碑", "禮器碑", "曹全碑"]:
            with self.subTest(name=name):
                self.assertTrue(looks_like_work(name))

    def test_tie_xu_ming_suffixes(self):
        for name in ["蘭亭帖", "雁塔聖教序", "九成宮醴泉銘"]:
            with self.subTest(name=name):
                self.assertTrue(looks_like_work(name))

    def test_ji_suffix_recognised(self):
        # 記 was added to WORK_SUFFIX_CHARS — 麻姑仙壇記 is correctly a work title.
        
        self.assertTrue(looks_like_work("麻姑仙壇記"))

    def test_zidian_two_char_suffix(self):
        self.assertTrue(looks_like_work("字典"))
        self.assertTrue(looks_like_work("康熙字典"))

    def test_calligrapher_names_are_not_works(self):
        for name in ["王羲之", "顏真卿", "褚遂良", "柳公權"]:
            with self.subTest(name=name):
                self.assertFalse(looks_like_work(name))


# ---------------------------------------------------------------------------
# looks_like_period
# ---------------------------------------------------------------------------

class TestLooksLikePeriod(unittest.TestCase):

    def test_empty_string(self):
        self.assertFalse(looks_like_period(""))

    def test_bare_dynasty_names(self):
        for period in ["西周", "東周", "春秋", "戰國", "商", "周"]:
            with self.subTest(period=period):
                self.assertTrue(looks_like_period(period))

    def test_period_with_phase_suffix(self):
        for period in ["西周早期", "春秋晚期", "戰國中期", "商代", "西周末"]:
            with self.subTest(period=period):
                self.assertTrue(looks_like_period(period))

    def test_compound_range_with_huo(self):
        self.assertTrue(looks_like_period("西周晚期或春秋早期"))

    def test_calligrapher_names_not_periods(self):
        for name in ["王羲之", "顏真卿", "李斯"]:
            with self.subTest(name=name):
                self.assertFalse(looks_like_period(name))

    def test_work_names_not_periods(self):
        self.assertFalse(looks_like_period("張遷碑"))
        self.assertFalse(looks_like_period("蘭亭序"))

    def test_dynasty_not_in_bare_names(self):
        # 唐 is a common dynasty but NOT in _PERIOD_BARE_NAMES
        self.assertFalse(looks_like_period("唐"))


# ---------------------------------------------------------------------------
# extract_author_and_source
# ---------------------------------------------------------------------------

class TestExtractAuthorAndSource(unittest.TestCase):

    def test_both_fields_present(self):
        author, work = extract_author_and_source(_row("王羲之", "蘭亭序"))
        self.assertEqual(author, "王羲之")
        self.assertEqual(work, "蘭亭序")

    def test_only_calligrapher_name(self):
        author, work = extract_author_and_source(_row("顏真卿"))
        self.assertEqual(author, "顏真卿")
        self.assertEqual(work, "Unknown")

    def test_only_work_title_in_seven(self):
        author, work = extract_author_and_source(_row("多寶塔碑"))
        self.assertEqual(author, "Unknown")
        self.assertEqual(work, "多寶塔碑")

    def test_period_label_gives_unknown_both(self):
        author, work = extract_author_and_source(_row("西周早期"))
        self.assertEqual(author, "Unknown")
        self.assertEqual(work, "Unknown")

    def test_both_empty_gives_unknown_both(self):
        author, work = extract_author_and_source(_row())
        self.assertEqual(author, "Unknown")
        self.assertEqual(work, "Unknown")

    def test_short_row_gives_unknown_both(self):
        author, work = extract_author_and_source(["a", "b"])
        self.assertEqual(author, "Unknown")
        self.assertEqual(work, "Unknown")

    def test_eight_overrides_seven_as_work(self):
        # When row[8] is present, row[7] = calligrapher, row[8] = work
        author, work = extract_author_and_source(_row("顏真卿", "多寶塔碑"))
        self.assertEqual(author, "顏真卿")
        self.assertEqual(work, "多寶塔碑")


# ---------------------------------------------------------------------------
# parse_row
# ---------------------------------------------------------------------------

class TestParseRow(unittest.TestCase):

    def test_valid_row_returns_dict(self):
        result = parse_row(_row("王羲之"))
        self.assertIsNotNone(result)
        self.assertEqual(result["author"], "王羲之")
        self.assertEqual(result["dynasty"], "唐")
        self.assertTrue(result["b64"].startswith("iVBOR"))

    def test_missing_b64_returns_none(self):
        self.assertIsNone(parse_row(_row(b64="")))

    def test_wrong_b64_prefix_returns_none(self):
        self.assertIsNone(parse_row(_row(b64="AAAA1234notpng")))

    def test_non_list_returns_none(self):
        self.assertIsNone(parse_row("not a list"))
        self.assertIsNone(parse_row(None))
        self.assertIsNone(parse_row(42))

    def test_too_short_returns_none(self):
        self.assertIsNone(parse_row([]))
        self.assertIsNone(parse_row(["a", "b", "c"]))

    def test_empty_dynasty_becomes_none(self):
        result = parse_row(_row("王羲之", dynasty=""))
        self.assertIsNotNone(result)
        self.assertIsNone(result["dynasty"])

    def test_work_parsed_when_in_eight(self):
        result = parse_row(_row("顏真卿", "多寶塔碑"))
        self.assertIsNotNone(result)
        self.assertEqual(result["work"], "多寶塔碑")

    def test_period_label_produces_unknown_author_work(self):
        result = parse_row(_row("西周早期"))
        self.assertIsNotNone(result)
        self.assertEqual(result["author"], "Unknown")
        self.assertEqual(result["work"], "Unknown")


# ---------------------------------------------------------------------------
# DB helpers — get_or_create_*
# ---------------------------------------------------------------------------

class TestGetOrCreateCharacter(unittest.TestCase):

    def setUp(self):
        self.conn = _make_db()
        self.cur = self.conn.cursor()

    def tearDown(self):
        self.conn.close()

    def test_creates_row_and_returns_id(self):
        char_id = get_or_create_character(self.cur, "永")
        self.assertIsInstance(char_id, int)
        self.cur.execute("SELECT character, unicode_hex FROM characters WHERE id=?", (char_id,))
        row = self.cur.fetchone()
        self.assertEqual(row[0], "永")
        self.assertEqual(row[1], "6C38")

    def test_idempotent_same_id(self):
        id1 = get_or_create_character(self.cur, "永")
        id2 = get_or_create_character(self.cur, "永")
        self.assertEqual(id1, id2)

    def test_different_chars_different_ids(self):
        id1 = get_or_create_character(self.cur, "永")
        id2 = get_or_create_character(self.cur, "和")
        self.assertNotEqual(id1, id2)

    def test_only_one_row_after_double_insert(self):
        get_or_create_character(self.cur, "永")
        get_or_create_character(self.cur, "永")
        self.cur.execute("SELECT COUNT(*) FROM characters WHERE character='永'")
        self.assertEqual(self.cur.fetchone()[0], 1)


class TestGetOrCreateCalligrapher(unittest.TestCase):

    def setUp(self):
        self.conn = _make_db()
        self.cur = self.conn.cursor()

    def tearDown(self):
        self.conn.close()

    def test_creates_row_with_dynasty(self):
        cal_id = get_or_create_calligrapher(self.cur, "王羲之", "東晉")
        self.assertIsInstance(cal_id, int)
        self.cur.execute("SELECT name_zh, dynasty FROM calligraphers WHERE id=?", (cal_id,))
        row = self.cur.fetchone()
        self.assertEqual(row[0], "王羲之")
        self.assertEqual(row[1], "東晉")

    def test_idempotent_same_id(self):
        id1 = get_or_create_calligrapher(self.cur, "王羲之", "東晉")
        id2 = get_or_create_calligrapher(self.cur, "王羲之", "東晉")
        self.assertEqual(id1, id2)

    def test_unknown_returns_none(self):
        self.assertIsNone(get_or_create_calligrapher(self.cur, "Unknown", "唐"))

    def test_empty_string_returns_none(self):
        self.assertIsNone(get_or_create_calligrapher(self.cur, "", None))

    def test_only_one_row_after_double_insert(self):
        get_or_create_calligrapher(self.cur, "顏真卿", "唐")
        get_or_create_calligrapher(self.cur, "顏真卿", "唐")
        self.cur.execute("SELECT COUNT(*) FROM calligraphers WHERE name_zh='顏真卿'")
        self.assertEqual(self.cur.fetchone()[0], 1)


class TestGetOrCreateWork(unittest.TestCase):

    def setUp(self):
        self.conn = _make_db()
        self.cur = self.conn.cursor()

    def tearDown(self):
        self.conn.close()

    def test_creates_row(self):
        work_id = get_or_create_work(self.cur, "蘭亭序", calligrapher_id=1, style_id=1)
        self.assertIsInstance(work_id, int)
        self.cur.execute("SELECT name_zh FROM works WHERE id=?", (work_id,))
        self.assertEqual(self.cur.fetchone()[0], "蘭亭序")

    def test_idempotent_same_id(self):
        id1 = get_or_create_work(self.cur, "蘭亭序", 1, 1)
        id2 = get_or_create_work(self.cur, "蘭亭序", 1, 1)
        self.assertEqual(id1, id2)

    def test_unknown_returns_none(self):
        self.assertIsNone(get_or_create_work(self.cur, "Unknown", None, 1))

    def test_empty_string_returns_none(self):
        self.assertIsNone(get_or_create_work(self.cur, "", None, 1))

    def test_only_one_row_after_double_insert(self):
        get_or_create_work(self.cur, "多寶塔碑", 1, 1)
        get_or_create_work(self.cur, "多寶塔碑", 1, 1)
        self.cur.execute("SELECT COUNT(*) FROM works WHERE name_zh='多寶塔碑'")
        self.assertEqual(self.cur.fetchone()[0], 1)


if __name__ == "__main__":
    unittest.main(verbosity=2)
