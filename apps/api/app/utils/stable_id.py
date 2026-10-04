import hashlib
import json
import re
from decimal import Decimal, InvalidOperation

TIMEFRAMES = {1: "M1", 2: "M2", 3: "M3", 4: "M4", 5: "M5", 6: "M6", 10: "M10", 12: "M12", 15: "M15", 20: "M20", 30: "M30", 60: "H1", 120: "H2", 180: "H3", 240: "H4", 360: "H6", 480: "H8", 720: "H12", 1440: "D1", 10080: "W1", 43200: "MN1", 16385: "H1", 16386: "H2", 16387: "H3", 16388: "H4", 16390: "H6", 16392: "H8", 16396: "H12", 16408: "D1", 32769: "W1", 49153: "MN1", 0: "CURRENT"}


def normalize(name: str, value: object) -> str:
    text = str(value).strip()
    if isinstance(value, bool) or text.lower() in {"true", "false"}:
        return text.lower()
    # Names identify timeframe enums; other numeric/categorical inputs stay intact.
    if re.search(r"timeframe|(?:^Inp|^)TF", name, re.I):
        tf = text.upper().removeprefix("PERIOD_")
        if tf in set(TIMEFRAMES.values()):
            return tf
        try:
            number = Decimal(text)
            if number == int(number) and int(number) in TIMEFRAMES:
                return TIMEFRAMES[int(number)]
        except (InvalidOperation, ValueError, OverflowError):
            pass
    try:
        number = Decimal(text)
        if number.is_finite():
            return "0" if number == 0 else format(number.normalize(), "f")
    except InvalidOperation:
        pass
    return text


def identify(parameters: dict) -> tuple[str, str, str, dict]:
    if not parameters:
        raise ValueError("No Inp parameters found; cannot create a Stable Set ID")
    normalized = {k: normalize(k, v) for k, v in sorted(parameters.items())}
    canonical = json.dumps(normalized, sort_keys=True, separators=(",", ":"), ensure_ascii=False)
    digest = hashlib.sha256(canonical.encode("utf-8")).hexdigest()
    return "SET-" + digest[:8].upper(), digest, canonical, normalized
