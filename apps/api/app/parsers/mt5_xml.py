"""Bounded, entity-safe SpreadsheetML optimization import with sparse-cell support."""
from dataclasses import dataclass, field
from decimal import Decimal, InvalidOperation
from io import BytesIO
import re
from defusedxml.ElementTree import iterparse
from defusedxml.common import DefusedXmlException
from xml.etree.ElementTree import ParseError

SS = "{urn:schemas-microsoft-com:office:spreadsheet}"
METRICS = {"pass": "mt5_pass", "result": "result", "profit": "profit", "expected payoff": "expected_payoff", "profit factor": "profit_factor", "recovery factor": "recovery_factor", "sharpe ratio": "sharpe", "sharpe": "sharpe", "custom": "custom", "equity dd %": "equity_dd", "equity drawdown %": "equity_dd", "trades": "trades"}
META = {"expert": "ea_name", "expert advisor": "ea_name", "ea": "ea_name", "ea name": "ea_name", "symbol": "symbol", "timeframe": "timeframe", "period": "period", "date from": "date_from", "from": "date_from", "date to": "date_to", "to": "date_to", "broker": "broker", "server": "broker", "initial deposit": "deposit", "deposit": "deposit", "leverage": "leverage", "modelling method": "modelling_method", "model": "modelling_method", "optimization method": "optimization_algorithm", "optimization algorithm": "optimization_algorithm", "optimization criterion": "criterion", "criterion": "criterion"}


@dataclass
class ParsedImport:
    rows: list[dict] = field(default_factory=list)
    metadata: dict = field(default_factory=dict)
    parameter_names: list[str] = field(default_factory=list)
    warnings: list[str] = field(default_factory=list)


def numeric(value: str) -> float:
    text = value.strip().replace("\u00a0", "").replace(" ", "").removesuffix("%")
    # MT5 uses decimal dot; accept decimal comma when unambiguous.
    if "," in text and "." in text:
        text = text.replace(",", "")
    elif "," in text:
        text = text.replace(",", ".")
    try:
        number = Decimal(text)
        result = float(number)
        if not number.is_finite() or abs(result) > 1e100:
            raise ValueError()
        return result
    except (InvalidOperation, ValueError, OverflowError):
        raise ValueError(f"Invalid numeric value: {value[:80]}") from None


def cells(row) -> list[str]:
    values: list[str] = []
    for cell in row:
        if cell.tag.split("}")[-1] != "Cell":
            continue
        index = cell.attrib.get(SS + "Index", cell.attrib.get("Index"))
        if index:
            position = int(index)
            if position < len(values) + 1 or position > 512:
                raise ValueError("Invalid sparse cell index")
            values.extend([""] * (position - len(values) - 1))
        data = next((e for e in cell if e.tag.split("}")[-1] == "Data"), None)
        values.append("" if data is None else "".join(data.itertext()).strip())
        if len(values) > 512:
            raise ValueError("At most 512 columns are supported")
    return values


def parse_xml(content: bytes) -> ParsedImport:
    output = ParsedImport()
    headers: list[str] | None = None
    row_number = 0
    root_seen = False
    depth = 0
    try:
        for event, element in iterparse(BytesIO(content), events=("start", "end"), forbid_dtd=True, forbid_entities=True, forbid_external=True):
            local = element.tag.split("}")[-1]
            if event == "start":
                depth += 1
                if not root_seen:
                    root_seen = True
                    if local != "Workbook":
                        raise ValueError("Expected a SpreadsheetML Workbook root")
                if depth > 64:
                    raise ValueError("XML nesting exceeds 64 levels")
            else:
                depth -= 1
            if event == "start" and row_number == 0 and local == "Workbook":
                for key, value in element.attrib.items():
                    mapped = META.get(key.split("}")[-1].replace("_", " ").lower())
                    if mapped:
                        output.metadata[mapped] = value
            if event != "end":
                continue
            if local == "Worksheet":
                headers = None
                element.clear()
            if local != "Row":
                continue
            row_number += 1
            values = cells(element)
            element.clear()
            if not any(values):
                continue
            if any(v.strip().lower() == "pass" for v in values) and any(v.startswith("Inp") for v in values):
                headers = values
                if len(set(headers)) != len(headers) or any(not h for h in headers):
                    raise ValueError("Headers must be nonempty and unique")
                params = [h for h in headers if h.startswith("Inp")]
                if output.parameter_names and params != output.parameter_names:
                    raise ValueError("Worksheets have incompatible input columns")
                output.parameter_names = params
                unknown = [h for h in headers if not h.startswith("Inp") and h.lower() not in METRICS]
                if unknown:
                    output.warnings.append("Unrecognized metric columns: " + ", ".join(unknown))
                continue
            if headers is None:
                if len(values) >= 2:
                    mapped = META.get(values[0].strip().rstrip(":").lower())
                    if mapped:
                        output.metadata[mapped] = values[1]
                elif len(values) == 1 and ":" in values[0]:
                    key, value = values[0].split(":", 1)
                    if key.lower().strip() in META:
                        output.metadata[META[key.lower().strip()]] = value.strip()
                continue
            if len(values) > len(headers):
                raise ValueError(f"Row {row_number} has more cells than headers")
            values += [""] * (len(headers) - len(values))
            record: dict = {"parameters": {}}
            for name, value in zip(headers, values):
                if name.startswith("Inp"):
                    if value == "":
                        raise ValueError(f"Row {row_number}: missing input {name}")
                    record["parameters"][name] = value
                elif name.lower() in METRICS:
                    metric = METRICS[name.lower()]
                    if metric == "mt5_pass":
                        record[metric] = value
                    elif value:
                        try:
                            parsed = numeric(value)
                            if metric == "trades":
                                if parsed < 0 or parsed != int(parsed):
                                    raise ValueError("Trades must be a nonnegative integer")
                                parsed = int(parsed)
                            record[metric] = parsed
                        except ValueError as exc:
                            raise ValueError(f"Row {row_number}, {name}: {exc}") from exc
            output.rows.append(record)
            if len(output.rows) > 200_000:
                raise ValueError("Import exceeds 200,000 rows; split the export")
    except (ParseError, DefusedXmlException) as exc:
        raise ValueError("Malformed or unsafe XML. DTDs and entities are forbidden.") from exc
    if not output.rows:
        raise ValueError("No optimization rows found. Expected SpreadsheetML Row/Cell/Data with Pass and Inp* headers.")
    if "period" in output.metadata:
        period = output.metadata.pop("period")
        match = re.match(r"(\w+)\s*\((\d{4}[.\-/]\d{2}[.\-/]\d{2})\s*-\s*(\d{4}[.\-/]\d{2}[.\-/]\d{2})\)", period)
        if match:
            output.metadata.update(timeframe=match[1], date_from=match[2], date_to=match[3])
        else:
            output.metadata.setdefault("timeframe", period)
    if "deposit" in output.metadata:
        output.metadata["deposit"] = numeric(output.metadata["deposit"])
        if output.metadata["deposit"] <= 0:
            raise ValueError("Initial deposit must be positive")
    missing = [key for key in ("ea_name", "symbol", "timeframe", "deposit", "date_from", "date_to") if not output.metadata.get(key)]
    if missing:
        output.warnings.append("Missing metadata (can be supplied during import): " + ", ".join(missing))
    return output
