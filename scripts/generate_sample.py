"""Deterministic synthetic research data. Never presented as observed MT5 results."""
from pathlib import Path
import random
import xml.etree.ElementTree as ET

SS = "urn:schemas-microsoft-com:office:spreadsheet"
ET.register_namespace("ss", SS)


def generate(count: int = 5000, suffix: str = "") -> bytes:
    rng = random.Random(20261003)
    workbook = ET.Element(f"{{{SS}}}Workbook")
    sheet = ET.SubElement(workbook, f"{{{SS}}}Worksheet", {f"{{{SS}}}Name": "Optimization"})
    table = ET.SubElement(sheet, f"{{{SS}}}Table")
    def row(values):
        r = ET.SubElement(table, f"{{{SS}}}Row")
        for value in values:
            c = ET.SubElement(r, f"{{{SS}}}Cell")
            ET.SubElement(c, f"{{{SS}}}Data", {f"{{{SS}}}Type": "String"}).text = str(value)
    for key, value in [("Expert", "HybridSMC"), ("Symbol", "XAUUSD"), ("Timeframe", "M1"), ("Date from", "2026.07.01"), ("Date to", "2026.10.01"), ("Server", "Synthetic Demo Server"), ("Initial deposit", "3000"), ("Leverage", "1:100"), ("Modelling method", "1 minute OHLC"), ("Optimization method", "Genetic"), ("Optimization criterion", "Custom max")]:
        row([key, value])
    row(["Pass", "Result", "Profit", "Expected Payoff", "Profit Factor", "Recovery Factor", "Sharpe Ratio", "Custom", "Equity DD %", "Trades", "InpTFBias", "InpTFZone", "InpTFEntry", "InpRiskPercent", "InpMinRR", "InpSwingLookback", "InpUseTrailing", "InpOBLookback"])
    for i in range(count):
        profit = 1388.66 if i == 0 else round(rng.uniform(-700, 2500), 2)
        dd = 2.92 if i == 0 else round(rng.uniform(1, 24), 2)
        pf = 6.0 if i == 0 else round(rng.uniform(.6, 6.5), 2)
        recovery = 12.13 if i == 0 else round(rng.uniform(.2, 14), 2)
        sharpe = 25.87 if i == 0 else round(rng.uniform(-2, 28), 2)
        trades = 111 if i == 0 else rng.randint(35, 350)
        row([i + 1, round(profit / max(dd, 1), 2), profit, round(profit / trades, 2), pf, recovery, sharpe, profit, dd, trades, "M3", "H4", "M6", "0.3" if i == 0 else str(round(rng.choice([.2,.3,.4,.5]), 1)), "1.5" if i == 0 else str(rng.choice([1.2,1.5,2,2.5])), 36 if i == 0 else 20 + i % 60, "true" if i % 2 == 0 else "false", 24 if i == 0 else 10 + i // 60])
    if suffix:
        row([])
        workbook.set("fixture", suffix)
    return ET.tostring(workbook, encoding="utf-8", xml_declaration=True)


if __name__ == "__main__":
    directory = Path(__file__).resolve().parents[1] / "sample-data"
    directory.mkdir(exist_ok=True)
    for name, count in [("mt5-optimization.xml", 12), ("mt5-optimization-5000.xml", 5000)]:
        (directory / name).write_bytes(generate(count))
    print("Generated 12-row and 5,000-row synthetic MT5 fixtures.")
