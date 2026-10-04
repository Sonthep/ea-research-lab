import pytest
from app.utils.stable_id import identify, normalize


def test_order_independent():
    assert identify({"InpB":"2", "InpA":"1"})[1] == identify({"InpA":"1", "InpB":"2"})[1]


def test_numeric_and_boolean_formatting():
    assert identify({"InpRisk":"0.3000", "InpFlag":"TRUE"})[1] == identify({"InpFlag":True, "InpRisk":.3})[1]


@pytest.mark.parametrize("text", ["H4", "PERIOD_H4", "16388", "240", "240.0"])
def test_timeframe(text):
    assert normalize("InpTFZone", text) == "H4"


def test_change_changes_hash():
    assert identify({"InpA":"1"})[1] != identify({"InpA":"2"})[1]


def test_other_enum_not_timeframe():
    assert normalize("InpMode", "16388") == "16388"
    assert normalize("InpLabel", "Case Sensitive") == "Case Sensitive"


def test_full_hash_and_empty():
    short, full, canonical, _ = identify({"InpRisk": "-0.0"})
    assert len(full) == 64 and short == "SET-" + full[:8].upper()
    assert canonical == '{"InpRisk":"0"}'
    with pytest.raises(ValueError):
        identify({})
