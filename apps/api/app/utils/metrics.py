def profit_percentage(profit: float | None, deposit: float | None) -> float | None:
    return profit / deposit * 100 if profit is not None and deposit and deposit > 0 else None


def relative_degradation(new: float, baseline: float) -> float | None:
    return (new - baseline) / abs(baseline) if baseline else None


def drawdown_change(new: float, baseline: float) -> float:
    return new - baseline
