import pytest
from app.utils.metrics import profit_percentage, relative_degradation, drawdown_change


def test_profit_percentage():
    assert profit_percentage(1388.66, 3000) == pytest.approx(46.2886667)
    assert profit_percentage(10,0) is None
    assert profit_percentage(None,3000) is None


def test_degradation():
    assert relative_degradation(1277.83,1388.66) == pytest.approx(-.079810734)
    assert relative_degradation(1,0) is None
    assert relative_degradation(-5,-10) == .5


def test_drawdown():
    assert drawdown_change(3.39,2.92) == pytest.approx(.47)
