"""
Edge-case tests for the CJK detection and character-extraction pipeline.

Focuses on characters that LOOK Chinese but aren't, or that appear
legitimately in calligraphy source texts and must be handled correctly:

  • CJK punctuation (，。《》「」…) — not ideographs, must be excluded
  • Full-width ASCII (Ａ、１) — not ideographs, must be excluded
  • Japanese kana (hiragana / katakana) — excluded
  • Bopomofo / Kangxi radicals / CJK strokes — excluded
  • CJK Compatibility Ideographs (U+F900–U+FAFF) — look like characters
    but are outside our checked ranges → currently excluded
  • Extension B+ ideographs (U+20000+) — valid CJK but outside our ranges
    → currently excluded; documents the known limitation
  • Iteration / special CJK marks (々〇〆) — excluded
  • Whitespace and control characters — excluded
  • Author/row fields with leading-trailing spaces or wrong types
  • Corpus pieces where ALL content is punctuation — result must be empty
  • Very long repeated text — deduplication still works correctly
"""

import json
import sqlite3
import sys
import tempfile
import unittest
from pathlib import Path

sys.path.insert(0, str(Path(__file__).parent.parent / "scripts"))

from scrape_corpus import extract_global_chars
from scrape_zi_tools import (
    _is_cjk,
    extract_author_and_source,
    looks_like_work,
    looks_like_period,
    parse_row,
    unique_cjk_chars,
)


# ---------------------------------------------------------------------------
# _is_cjk — character classification
# ---------------------------------------------------------------------------

class TestIsCjkEdgeCases(unittest.TestCase):

    # ── CJK punctuation ──────────────────────────────────────────────────
    def test_cjk_punctuation_excluded(self):
        """Characters commonly found in Chinese text but NOT ideographs."""
        punctuation = [
            "，",  # U+FF0C full-width comma
            "。",  # U+3002 ideographic full stop
            "、",  # U+3001 ideographic comma
            "：",  # U+FF1A full-width colon
            "；",  # U+FF1B full-width semicolon
            "「",  # U+300C left corner bracket
            "」",  # U+300D right corner bracket
            "《",  # U+300A left double angle bracket
            "》",  # U+300B right double angle bracket
            "【",  # U+3010 left black lenticular bracket
            "】",  # U+3011 right black lenticular bracket
            "！",  # U+FF01 full-width exclamation
            "？",  # U+FF1F full-width question mark
            "…",  # U+2026 horizontal ellipsis
            "—",  # U+2014 em dash
            "·",  # U+00B7 middle dot (used as separator)
        ]
        for ch in punctuation:
            with self.subTest(char=repr(ch), codepoint=hex(ord(ch))):
                self.assertFalse(_is_cjk(ch))

    # ── Full-width ASCII ─────────────────────────────────────────────────
    def test_fullwidth_ascii_excluded(self):
        """Full-width Latin / digits (U+FF01–U+FF60) are not ideographs."""
        for ch in "Ａａ１２Ｚｚ":
            with self.subTest(char=repr(ch)):
                self.assertFalse(_is_cjk(ch))

    # ── Japanese kana ────────────────────────────────────────────────────
    def test_hiragana_excluded(self):
        """Hiragana (U+3040–U+309F) is before Extension A and not CJK."""
        for ch in "あいうえおかきくけこ":
            with self.subTest(char=repr(ch)):
                self.assertFalse(_is_cjk(ch))

    def test_katakana_excluded(self):
        """Katakana (U+30A0–U+30FF) is before Extension A and not CJK."""
        for ch in "アイウエオカキクケコ":
            with self.subTest(char=repr(ch)):
                self.assertFalse(_is_cjk(ch))

    # ── Bopomofo / Radicals / Strokes ───────────────────────────────────
    def test_bopomofo_excluded(self):
        """Bopomofo (U+3100–U+312F) is before Extension A."""
        self.assertFalse(_is_cjk("ㄅ"))  # U+3105
        self.assertFalse(_is_cjk("ㄇ"))  # U+3107

    def test_kangxi_radicals_excluded(self):
        """Kangxi radicals (U+2F00–U+2FDF) are not in our checked ranges."""
        self.assertFalse(_is_cjk("\u2F00"))  # ⼀ radical one
        self.assertFalse(_is_cjk("\u2FD5"))  # last Kangxi radical

    def test_cjk_strokes_excluded(self):
        """CJK Strokes (U+31C0–U+31EF) — before Extension A."""
        self.assertFalse(_is_cjk("\u31C0"))  # ㇀

    # ── CJK iteration / special marks ───────────────────────────────────
    def test_iteration_mark_excluded(self):
        """々 (U+3005 CJK iteration mark) is not in either checked range."""
        self.assertFalse(_is_cjk("々"))  # U+3005

    def test_ideographic_number_zero_excluded(self):
        """〇 (U+3007) appears in Chinese text but is not a CJK ideograph."""
        self.assertFalse(_is_cjk("〇"))  # U+3007

    # ── CJK Compatibility Ideographs ────────────────────────────────────
    def test_cjk_compatibility_ideographs_excluded(self):
        """U+F900–U+FAFF look like characters but are outside our ranges.
        This documents current behaviour — if Extension ranges are expanded,
        update both the code and this test.
        """
        self.assertFalse(_is_cjk("\uF900"))  # 豈 compatibility ideograph
        self.assertFalse(_is_cjk("\uFA00"))  # another compatibility ideograph

    # ── Extension B (U+20000+) ───────────────────────────────────────────
    def test_extension_b_excluded(self):
        """Extension B ideographs are valid CJK but outside our range.
        Documents the known limitation: rare archaic characters won't be scraped.
        """
        self.assertFalse(_is_cjk("\U00020000"))  # 𠀀 first Extension B char

    # ── Gap between Extension A and CJK Unified ─────────────────────────
    def test_gap_between_ext_a_and_unified_excluded(self):
        """U+4DC0–U+4DFF sits between Extension A and CJK Unified — not CJK."""
        self.assertFalse(_is_cjk("\u4DC0"))  # Yijing hexagram symbols start
        self.assertFalse(_is_cjk("\u4DFF"))  # end of gap

    # ── Whitespace and control characters ───────────────────────────────
    def test_whitespace_excluded(self):
        for ch in " \t\n\r\u3000":  # includes ideographic space U+3000
            with self.subTest(char=repr(ch)):
                self.assertFalse(_is_cjk(ch))

    def test_control_characters_excluded(self):
        for ch in "\x00\x01\x1f\x7f":
            with self.subTest(char=repr(ch)):
                self.assertFalse(_is_cjk(ch))

    # ── Emoji ────────────────────────────────────────────────────────────
    def test_emoji_excluded(self):
        """Emoji are nowhere near CJK ranges."""
        for ch in "😀🎨🖌️":
            # 🖌️ is a two-code-point sequence; test each code point
            if len(ch) == 1:
                with self.subTest(char=repr(ch)):
                    self.assertFalse(_is_cjk(ch))

    # ── Korean Hangul ────────────────────────────────────────────────────
    def test_hangul_excluded(self):
        """Hangul syllables (U+AC00–U+D7A3) are not CJK ideographs."""
        self.assertFalse(_is_cjk("한"))  # U+D55C
        self.assertFalse(_is_cjk("국"))  # U+AD6D


# ---------------------------------------------------------------------------
# unique_cjk_chars — text extraction
# ---------------------------------------------------------------------------

class TestUniqueCjkCharsEdgeCases(unittest.TestCase):

    def test_punctuation_only_text(self):
        """Text composed entirely of CJK punctuation yields nothing."""
        self.assertEqual(unique_cjk_chars("，。！？《》「」【】—…"), [])

    def test_mixed_cjk_and_kana(self):
        """Kana characters are filtered; CJK ideographs pass through."""
        result = unique_cjk_chars("永あ和いう九")
        self.assertEqual(result, ["永", "和", "九"])

    def test_fullwidth_digits_excluded(self):
        result = unique_cjk_chars("永１２３和")
        self.assertEqual(result, ["永", "和"])

    def test_iteration_mark_excluded(self):
        """々 between two real characters — only the real ones survive."""
        result = unique_cjk_chars("日々月")
        self.assertEqual(result, ["日", "月"])

    def test_ideographic_space_excluded(self):
        """U+3000 ideographic space must not sneak through."""
        result = unique_cjk_chars("永\u3000和")
        self.assertEqual(result, ["永", "和"])

    def test_extreme_dedup_large_repeated_text(self):
        """1 000 repetitions of the same character → only one entry."""
        text = "之" * 1000
        result = unique_cjk_chars(text)
        self.assertEqual(result, ["之"])

    def test_compatibility_ideograph_excluded(self):
        """F900-block characters are excluded by our range check."""
        # 豈 (U+F900) should not appear in results
        result = unique_cjk_chars("永\uF900和")
        self.assertNotIn("\uF900", result)
        self.assertEqual(result, ["永", "和"])

    def test_newline_and_tab_excluded(self):
        result = unique_cjk_chars("永\n和\t之")
        self.assertEqual(result, ["永", "和", "之"])

    def test_arabic_and_latin_excluded(self):
        result = unique_cjk_chars("永ABCabc١٢٣和")
        self.assertEqual(result, ["永", "和"])


# ---------------------------------------------------------------------------
# extract_global_chars — corpus-level extraction
# ---------------------------------------------------------------------------

class TestExtractGlobalCharsEdgeCases(unittest.TestCase):

    def test_punctuation_only_piece_yields_empty(self):
        pieces = [{"text": "，。！？《》「」—…"}]
        self.assertEqual(extract_global_chars(pieces), [])

    def test_mixed_punctuation_and_ideographs(self):
        """Punctuation is stripped; ideographs survive."""
        pieces = [{"text": "永，和。之！"}]
        result = extract_global_chars(pieces)
        self.assertEqual(sorted(result), sorted(["永", "和", "之"]))

    def test_japanese_kana_in_corpus_filtered(self):
        """If corpus text includes kana (e.g. mixed-script source), they're dropped."""
        pieces = [{"text": "永あいう和"}]
        result = extract_global_chars(pieces)
        self.assertEqual(result, ["永", "和"])

    def test_whitespace_only_piece_yields_empty(self):
        pieces = [{"text": "   \n\t\u3000  "}]
        self.assertEqual(extract_global_chars(pieces), [])

    def test_fullwidth_numbers_not_collected(self):
        pieces = [{"text": "永１２３和"}]
        result = extract_global_chars(pieces)
        self.assertEqual(result, ["永", "和"])

    def test_iteration_mark_not_collected(self):
        pieces = [{"text": "日々月"}]
        result = extract_global_chars(pieces)
        self.assertNotIn("々", result)

    def test_dedup_across_many_pieces_same_char(self):
        """之 repeated across 50 pieces → exactly one entry in output."""
        pieces = [{"text": "之" + str(i)} for i in range(50)]
        result = extract_global_chars(pieces)
        self.assertEqual(result.count("之"), 1)

    def test_empty_string_text_field(self):
        pieces = [{"text": ""}]
        self.assertEqual(extract_global_chars(pieces), [])

    def test_none_like_text_value_skipped(self):
        # text must be a string; missing key is handled by .get("text", "")
        pieces = [{"text": None}, {"text": "永"}]  # type: ignore[list-item]
        # None text: iterating over None raises TypeError, but get("text","")
        # returns None here since the key is present.
        # Behaviour: should not crash; 永 from piece 2 should be collected.
        # If this fails it indicates a robustness gap worth fixing.
        try:
            result = extract_global_chars(pieces)
            self.assertIn("永", result)
        except TypeError:
            self.fail(
                "extract_global_chars crashed on text=None — "
                "consider guarding with isinstance(text, str)"
            )


# ---------------------------------------------------------------------------
# extract_author_and_source — row field edge cases
# ---------------------------------------------------------------------------

class TestExtractAuthorSourceEdgeCases(unittest.TestCase):

    def _row(self, seven="", eight=""):
        r = [""] * 9
        r[7] = seven
        r[8] = eight
        return r

    def test_leading_trailing_spaces_stripped(self):
        """API sometimes returns padded strings."""
        author, work = extract_author_and_source(self._row(seven="  王羲之  "))
        self.assertEqual(author, "王羲之")

    def test_work_trailing_spaces_stripped(self):
        author, work = extract_author_and_source(self._row(seven="蘭亭序  "))
        # After stripping, ends in 序 → work title
        self.assertEqual(work, "蘭亭序")

    def test_whitespace_only_seven_gives_unknown(self):
        """Whitespace-only field should resolve to Unknown."""
        author, work = extract_author_and_source(self._row(seven="   "))
        # "   ".strip() → "" which is falsy, so both should be Unknown
        self.assertEqual(author, "Unknown")
        self.assertEqual(work, "Unknown")

    def test_non_string_in_row_seven(self):
        """Non-string values at index 7 must not crash — returns Unknown."""
        for bad_value in [None, 42, [], {}]:
            r = [""] * 9
            r[7] = bad_value
            with self.subTest(value=bad_value):
                try:
                    author, work = extract_author_and_source(r)
                    self.assertEqual(author, "Unknown")
                except (TypeError, AttributeError):
                    self.fail(
                        f"extract_author_and_source crashed on row[7]={bad_value!r} — "
                        "guard with isinstance check"
                    )

    def test_non_string_in_row_eight(self):
        """Non-string values at index 8 must not crash — falls back to row[7]."""
        for bad_value in [None, 42]:
            r = [""] * 9
            r[7] = "王羲之"
            r[8] = bad_value
            with self.subTest(value=bad_value):
                try:
                    author, work = extract_author_and_source(r)
                    # row[8] bad → should fall through to row[7] logic
                    self.assertEqual(author, "王羲之")
                except (TypeError, AttributeError):
                    self.fail(
                        f"extract_author_and_source crashed on row[8]={bad_value!r}"
                    )


# ---------------------------------------------------------------------------
# parse_row — payload edge cases
# ---------------------------------------------------------------------------

class TestParseRowEdgeCases(unittest.TestCase):

    _VALID_B64 = (
        "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAAC0lEQVQI12NgAAIABQ"
        "AABjkB6QAAAABJRU5ErkJggg=="
    )

    def _row(self, b64=None, dynasty="唐", seven="王羲之", eight=""):
        r = [""] * 9
        r[4] = self._VALID_B64 if b64 is None else b64
        r[6] = dynasty
        r[7] = seven
        r[8] = eight
        return r

    def test_whitespace_only_b64_returns_none(self):
        self.assertIsNone(parse_row(self._row(b64="   ")))

    def test_non_string_b64_returns_none(self):
        self.assertIsNone(parse_row(self._row(b64=12345)))

    def test_none_b64_returns_none(self):
        r = self._row()
        r[4] = None
        self.assertIsNone(parse_row(r))

    def test_dynasty_with_spaces_stripped(self):
        result = parse_row(self._row(dynasty="  唐  "))
        self.assertIsNotNone(result)
        self.assertEqual(result["dynasty"], "唐")

    def test_whitespace_only_dynasty_becomes_none(self):
        result = parse_row(self._row(dynasty="   "))
        self.assertIsNotNone(result)
        self.assertIsNone(result["dynasty"])

    def test_author_with_spaces_stripped(self):
        result = parse_row(self._row(seven="  顏真卿  "))
        self.assertIsNotNone(result)
        self.assertEqual(result["author"], "顏真卿")


# ---------------------------------------------------------------------------
# Regression tests — real misclassifications caught in production data
#
# Each test documents a specific category of bad data that slipped through
# and was manually fixed. If any of these fail after a code change, that
# change has re-opened a known bug.
# ---------------------------------------------------------------------------

class TestLooksLikeWorkRegressions(unittest.TestCase):
    """
    Reference works and compilations that zi.tools attributes to characters
    but which are NOT calligrapher names.  Every entry here was found in the
    calligraphers table in production and had to be cleaned up.
    """

    # ── 古文 keyword (user rule: anything with 古文 is a reference) ───────────
    def test_guwen_keyword_caught(self):
        for title in ["古文四聲韻", "集古文韻上聲韻第三", "魏石經古文彙編"]:
            with self.subTest(title=title):
                self.assertTrue(looks_like_work(title))

    # ── 集篆 / 集古 keyword ───────────────────────────────────────────────────
    def test_jizuan_jiju_caught(self):
        self.assertTrue(looks_like_work("集篆古文韻海"))
        self.assertTrue(looks_like_work("集古文韻"))

    # ── 說文 keyword ──────────────────────────────────────────────────────────
    def test_shuowen_caught(self):
        self.assertTrue(looks_like_work("說文解字"))

    # ── 隸釋 / 隸續 keyword ───────────────────────────────────────────────────
    def test_lishu_lishu_caught(self):
        self.assertTrue(looks_like_work("隸釋 隸續"))
        self.assertTrue(looks_like_work("隸釋"))

    # ── 簡牘 keyword ──────────────────────────────────────────────────────────
    def test_jiandu_keyword_caught(self):
        for title in ["睡虎地簡牘", "樓蘭簡牘", "居延簡牘"]:
            with self.subTest(title=title):
                self.assertTrue(looks_like_work(title))

    # ── 牘 suffix (added to WORK_SUFFIX_CHARS) ───────────────────────────────
    def test_du_suffix_caught(self):
        self.assertTrue(looks_like_work("木牘"))
        self.assertTrue(looks_like_work("封牘"))

    # ── Long-name suffixes (≥4 chars guards against 陳鑑, 虞集, 梁同書) ──────
    def test_long_suffix_applies_only_at_4_plus_chars(self):
        """陳鑑 (2 chars ending in 鑑) must NOT be caught."""
        self.assertFalse(looks_like_work("陳鑑"))

    def test_shu_suffix_length_gated(self):
        """梁同書 ends in 書 but is only 3 chars — a real calligrapher name, not a work."""
        self.assertFalse(looks_like_work("梁同書"))

    def test_shu_suffix_caught_at_four_chars(self):
        """A 4+ char title ending in 書 IS a work (e.g. 集王羲之書)."""
        self.assertTrue(looks_like_work("集王羲之書"))

    def test_虞集_not_caught(self):
        """虞集 ends in 集 but is only 2 chars — must stay as a calligrapher name."""
        self.assertFalse(looks_like_work("虞集"))

    def test_李鶴錄_not_caught(self):
        """李鶴錄 ends in 錄 but is a confirmed real person (3 chars)."""
        self.assertFalse(looks_like_work("李鶴錄"))

    def test_four_char_lu_suffix_caught(self):
        """A 4+ char title ending in 錄 IS a reference work."""
        self.assertTrue(looks_like_work("書法叢錄"))
        self.assertTrue(looks_like_work("金石萃編錄"))

    def test_four_char_bian_suffix_caught(self):
        self.assertTrue(looks_like_work("尚書文字合編"))
        self.assertTrue(looks_like_work("彙編"))    # 2 chars — not caught by length gate
        # ↑ 彙編 IS caught because 彙 is in _REFERENCE_KEYWORDS via 彙編 keyword
        self.assertTrue(looks_like_work("金石彙編"))


class TestExtractAuthorSourceRegressions(unittest.TestCase):
    """
    Real attribution patterns from zi.tools that caused bad DB entries.
    """

    def _row(self, seven="", eight=""):
        r = [""] * 9
        r[7] = seven
        r[8] = eight
        return r

    # ── Period label in row[7] when row[8] is also present ───────────────────
    def test_period_in_seven_with_eight_present(self):
        """
        zi.tools sometimes puts 西周早期 in row[7] (calligrapher slot) even
        when row[8] has a work title.  The period must be caught and author
        set to Unknown regardless.
        """
        author, work = extract_author_and_source(self._row("西周早期", "毛公鼎"))
        self.assertEqual(author, "Unknown")

    def test_all_period_variants_blocked_when_eight_present(self):
        for period in ["商", "戰國", "西周中期", "商或西周早期", "西周晚期"]:
            with self.subTest(period=period):
                author, work = extract_author_and_source(self._row(period, "某碑"))
                self.assertEqual(author, "Unknown",
                    f"Period label {period!r} slipped through as author")

    # ── row[8] == row[7] (calligrapher name repeated as work) ────────────────
    def test_repeated_calligrapher_name_in_eight_gives_unknown_work(self):
        """
        zi.tools sometimes puts the calligrapher name in both row[7] and row[8].
        The repeated name must not become a work title.
        Use 顏真卿 (ends in 卿, not a work suffix) to isolate the row[8]==row[7] guard.
        """
        author, work = extract_author_and_source(self._row("顏真卿", "顏真卿"))
        self.assertEqual(author, "顏真卿")
        self.assertEqual(work, "Unknown")

    def test_repeated_name_various_calligraphers(self):
        for name in ["黎簡", "禹之鼎", "趙秉文", "翟汝文"]:
            with self.subTest(name=name):
                author, work = extract_author_and_source(self._row(name, name))
                self.assertEqual(work, "Unknown",
                    f"Repeated calligrapher name {name!r} stored as work title")

    # ── Short non-work string in row[8] ──────────────────────────────────────
    def test_short_non_work_string_in_eight_gives_unknown_work(self):
        """
        A ≤3-char string in row[8] that doesn't end in a work suffix is likely
        a calligrapher name or category label, not a work title.
        """
        author, work = extract_author_and_source(self._row("歐陽詢", "歐陽詢"))
        self.assertEqual(work, "Unknown")

    def test_legitimate_short_work_title_preserved(self):
        """
        A 3-char work title that ends in a proper suffix (帖/碑/序…) must
        still be stored correctly even though it's short.
        """
        author, work = extract_author_and_source(self._row("顏真卿", "自敘帖"))
        self.assertEqual(work, "自敘帖")

    def test_legitimate_work_in_eight_preserved(self):
        author, work = extract_author_and_source(self._row("褚遂良", "雁塔聖教序"))
        self.assertEqual(author, "褚遂良")
        self.assertEqual(work, "雁塔聖教序")

    # ── Reference/book title in row[7] with row[8] work present ──────────────
    def test_reference_title_in_seven_blocked(self):
        """
        If row[7] is a reference book (looks_like_work), it must not become
        the calligrapher even when row[8] is also present.
        """
        author, work = extract_author_and_source(self._row("古文四聲韻", "某字"))
        self.assertEqual(author, "Unknown")


if __name__ == "__main__":
    unittest.main(verbosity=2)
