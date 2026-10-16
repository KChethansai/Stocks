"""Small offline checks: python -m ml.python.test_campaign."""
import numpy as np
import pandas as pd
import re
import ast
from .campaign import past_join, temporal_split, block_ci, metrics, fit_predict
from .features import DEADBAND
from .data import APP_TICKERS
from .train import ML_DIR


def main():
    # Canonical JS universe lives in config/universe.js (extracted from
    # APIs/StockAPI.js during the integrity pass so the seed script can share
    # it without booting the router). StockAPI imports baseStocks from there.
    api = (ML_DIR.parent / 'config/universe.js').read_text()
    symbols = re.findall(r"symbol:\s*'([A-Z]+)'", api)
    assert len(symbols) == len(APP_TICKERS) == 30 and set(symbols) == set(APP_TICKERS)
    dates = list(pd.bdate_range("2024-01-01", periods=100))
    for h in range(1, 6):
        tr, te = temporal_split(dates, 70, h)
        assert dates.index(te[0]) - dates.index(tr[-1]) == h + 2
        assert dates[dates.index(tr[-1])+h] < te[0]
    source = pd.DataFrame({"x": [1., 9.]}, index=pd.to_datetime(["2024-01-01", "2024-01-04"]))
    joined = past_join(source, pd.to_datetime(["2023-12-31", "2024-01-03", "2024-01-04"]))
    assert np.isnan(joined.x.iloc[0]) and list(joined.x.iloc[1:]) == [1., 9.]
    mixed = source.copy()
    mixed.index = mixed.index.as_unit('s')
    same = past_join(mixed, pd.DatetimeIndex(joined.index).as_unit('ms'))
    np.testing.assert_allclose(same.x, joined.x, equal_nan=True)
    ret = np.array([-DEADBAND-1e-8, -DEADBAND, 0, DEADBAND, DEADBAND+1e-8])
    assert np.where(ret > DEADBAND, 2, np.where(ret < -DEADBAND, 0, 1)).tolist() == [0, 1, 1, 1, 2]
    frame = pd.DataFrame({"date": dates[:3], "y": [0, 1, 2]})
    m = metrics(frame, np.eye(3))
    assert m['accuracy'] == 1 and m['brier'] == 0 and m['ece'] == 0
    assert block_ci(dates, np.ones(100)) == [1., 1.]
    assert block_ci(dates, np.arange(100)/100) == block_ci(dates, np.arange(100)/100)
    train = pd.DataFrame({'x': [1., np.nan, 3., 4., 5., 6.], 'y': [0, 1, 2, 0, 1, 2]})
    validation = pd.DataFrame({'x': [999., np.nan], 'y': [0, 2]})
    model, probs = fit_predict(train, validation, ['x'], 'lr0.1')
    assert model.steps[0][1].statistics_[0] == 4.
    assert abs(model.steps[1][1].mean_[0] - 23/6) < 1e-12
    assert probs.shape == (2, 3) and np.allclose(probs.sum(1), 1.)
    for path in (ML_DIR / 'python').glob('campaign*.py'):
        tree = ast.parse(path.read_text())
        for function in (n for n in ast.walk(tree) if isinstance(n, (ast.FunctionDef, ast.AsyncFunctionDef))):
            assert not any(isinstance(n, ast.Name) and n.id == 'datetime' and isinstance(n.ctx, ast.Store)
                           for n in ast.walk(function)), f'datetime shadow in {path}:{function.name}'
            assert not any(isinstance(n, ast.ImportFrom) and any(a.name == 'datetime' for a in n.names)
                           for n in ast.walk(function)), f'local datetime import in {path}:{function.name}'
    print("8 campaign checks passed: app universe, session purge, past-only mixed-unit joins, thresholds, metrics, date-block bootstrap, train-only preprocessing, datetime scope")


if __name__ == '__main__':
    main()
