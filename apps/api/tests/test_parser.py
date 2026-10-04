import pytest
from app.parsers.mt5_xml import parse_xml, numeric


def test_valid_xml(xml):
    data = parse_xml(xml)
    assert len(data.rows) == 12
    assert data.metadata["deposit"] == 3000
    assert data.metadata["symbol"] == "XAUUSD"
    assert data.rows[0]["profit"] == 1388.66
    assert data.rows[0]["parameters"]["InpTFZone"] == "H4"


def test_missing_metadata_and_unknown_input():
    data = parse_xml(b'<Workbook><Worksheet><Table><Row><Cell><Data>Pass</Data></Cell><Cell><Data>InpUnknown</Data></Cell></Row><Row><Cell><Data>1</Data></Cell><Cell><Data>ABC</Data></Cell></Row></Table></Worksheet></Workbook>')
    assert data.rows[0]["parameters"] == {"InpUnknown": "ABC"}
    assert "Missing metadata" in data.warnings[0]


@pytest.mark.parametrize("content", [b"<broken>", b"<Workbook />", b'<!DOCTYPE x [<!ENTITY xxe SYSTEM "file:///etc/passwd">]><Workbook>&xxe;</Workbook>', b'<!DOCTYPE x [<!ENTITY x "foo">]><Workbook>&x;</Workbook>'])
def test_rejects_malformed_or_unsafe(content):
    with pytest.raises(ValueError):
        parse_xml(content)


@pytest.mark.parametrize("text, expected", [("1,388.66",1388.66),("1388,66",1388.66),("3.39%",3.39),(" 1 234.5 ",1234.5),("-7",-7)])
def test_numeric(text, expected):
    assert numeric(text) == expected


@pytest.mark.parametrize("text", ["NaN", "inf", "1e999", "xyz"])
def test_bad_numeric(text):
    with pytest.raises(ValueError):
        numeric(text)


def test_sparse_cells():
    xml = b'<Workbook xmlns:ss="urn:schemas-microsoft-com:office:spreadsheet"><Row><Cell><Data>Pass</Data></Cell><Cell><Data>Profit</Data></Cell><Cell><Data>InpX</Data></Cell></Row><Row><Cell><Data>1</Data></Cell><Cell ss:Index="3"><Data>2</Data></Cell></Row></Workbook>'
    row = parse_xml(xml).rows[0]
    assert "profit" not in row
    assert row["parameters"]["InpX"] == "2"


def test_missing_parameter_rejected(xml):
    with pytest.raises(ValueError, match="missing input"):
        parse_xml(xml.replace(b">M3<", b"><", 1))


def test_unknown_metric_warning(xml):
    data = parse_xml(xml.replace(b">Custom<", b">Future metric<"))
    assert "Future metric" in data.warnings[0]
