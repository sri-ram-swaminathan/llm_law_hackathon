from cco.agent.locator import line_range, locate

CONFIG = '''import os

DISCLAIMER = (
    "Wealthpilot provides information and educational content only. "
    "This is not financial advice. Always consult a certified investment "
    "advisor before making investment decisions."
)
BASE_CURRENCY = "EUR"
'''


def test_exact_match_offsets():
    t = "Hello world, this is a plain sentence.\nSecond line here."
    m = locate(t, "this is a plain sentence")
    assert m and t[m.start : m.end] == "this is a plain sentence" and m.score == 100


def test_whitespace_collapsed():
    t = "alpha   beta\n\n   gamma delta"
    m = locate(t, "alpha beta gamma delta")
    assert m and t[m.start : m.end] == t


def test_split_string_literals_config_case():
    # the model merges the three literals into one sentence
    q = "information and educational content only. This is not financial advice. Always consult"
    m = locate(CONFIG, q)
    assert m is not None
    assert "This is not financial advice." in CONFIG[m.start : m.end]
    first, last = line_range(CONFIG, m.start, m.end)
    assert (first, last) == (4, 5)


def test_quote_with_literal_joins_and_quote_chars():
    q = '"only. " "This is not financial advice. Always consult a certified investment " "advisor before'
    m = locate(CONFIG, q)
    assert m is not None
    assert "advisor before" in CONFIG[m.start : m.end]


def test_fuzzy_small_typo():
    t = "The controller must provide the identity and contact details of the controller at collection time."
    m = locate(t, "must provide the identty and contact details of the controller")
    assert m is not None and m.score >= 90


def test_not_found():
    assert locate(CONFIG, "We process biometric data for retina scanning purposes.") is None
    assert locate(CONFIG, "") is None


def test_line_range():
    t = "a\nb\nc\nd"
    assert line_range(t, 2, 5) == (2, 3)
    assert line_range(t, 0, 1) == (1, 1)
