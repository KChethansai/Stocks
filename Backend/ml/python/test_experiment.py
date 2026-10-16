"""Experiment-harness unit tests: splits, embargo, OOF stacking, binary isolation.

Run: .venv/bin/python -m ml.python.test_experiment
No network. Deterministic (SEED=7 everywhere).
"""
from __future__ import annotations

import numpy as np
import pandas as pd

from . import experiment as E


def _patched_universe():
    """Restrict the v2 universe to AAPL/MSFT for fast tests; restores on exit."""
    import ml.python.features_v2 as F
    from contextlib import contextmanager

    @contextmanager
    def _ctx():
        old_app, old_sec = F.APP_TICKERS, F._SECTORS["TECH"]
        old_map = dict(F.SECTOR_OF)
        F.APP_TICKERS = ["AAPL", "MSFT"]
        F._SECTORS["TECH"] = ["AAPL", "MSFT"]
        F.SECTOR_OF.update({"AAPL": "TECH", "MSFT": "TECH"})
        try:
            yield
        finally:
            F.APP_TICKERS = old_app
            F._SECTORS["TECH"] = old_sec
            F.SECTOR_OF.clear()
            F.SECTOR_OF.update(old_map)
    return _ctx()


def _tiny_raw(n: int = 120) -> dict[str, pd.DataFrame]:
    rng = np.random.default_rng(7)
    dates = pd.bdate_range("2023-01-01", periods=n)
    raw = {}
    for sym, start in (("AAPL", 100), ("MSFT", 200), ("SPY", 400)):
        rets = rng.normal(0.0005, 0.01, n)
        c = start * np.exp(np.cumsum(rets))
        o = np.hstack([c[0], c[:-1]])
        raw[sym] = pd.DataFrame(
            {"open": o, "high": c * 1.005, "low": c * 0.995,
             "close": c, "volume": np.full(n, 1e6)},
            index=dates)
    return raw


def test_split_embargo_and_grouping():
    dates = list(pd.bdate_range("2018-01-01", periods=900))
    pos = {d: i for i, d in enumerate(dates)}
    sel, hold = E.selection_holdout_split(dates, horizon=2)
    assert not set(sel) & set(hold), "selection/holdout overlap"
    assert min(pos[d] for d in hold) - max(pos[d] for d in sel) > 2, \
        "session-rank embargo violated (selection/holdout)"
    folds = E.walk_forward_folds(sel, horizon=2, k=4)
    assert len(folds) == 4
    for tr, te in folds:
        assert not set(tr) & set(te), "fold train/test overlap"
        assert min(pos[d] for d in te) - max(pos[d] for d in tr) > 2, \
            "session-rank embargo violated (fold)"


def test_oof_stacking_covers_train_once():
    from sklearn.linear_model import LogisticRegression
    from .train import CLASSES

    raw = _tiny_raw()
    import ml.python.features_v2 as F

    with _patched_universe():
        v2 = F.build_dataset_v2(raw, 2)
    label_col = "label_2d"
    dates = sorted(pd.to_datetime(v2["date"]).unique())
    folds = E.walk_forward_folds(dates, horizon=2, k=3)
    parts, ys, seen = [], [], set()
    for tr_d, te_d in folds:
        assert not seen & set(te_d), "OOF test windows must be disjoint"
        seen |= set(te_d)
        tr = v2[pd.to_datetime(v2["date"]).isin(tr_d)]
        te = v2[pd.to_datetime(v2["date"]).isin(te_d)]
        Xtr, ytr = E.encode(tr, F.V2_COLUMNS, label_col, CLASSES)
        Xte, yte = E.encode(te, F.V2_COLUMNS, label_col, CLASSES)
        m = LogisticRegression(max_iter=500).fit(Xtr, ytr)
        parts.append(m.predict_proba(Xte))
        ys.append(yte)
    OOF = np.vstack(parts)
    assert OOF.shape[0] == sum(len(y) for y in ys)
    assert OOF.shape[1] == 3
    meta = LogisticRegression(max_iter=500).fit(OOF, np.concatenate(ys))
    assert meta.coef_.shape == (3, 3)  # 3 classes x (1 base x 3 probs)
    print(f"  ok  OOF stacking covers {OOF.shape[0]} rows, meta {meta.coef_.shape}")


def test_binary_isolation():
    raw = _tiny_raw(950)
    import ml.python.features_v2 as F

    with _patched_universe():
        v2 = F.build_dataset_v2(raw, 2)
    dates = sorted(pd.to_datetime(v2["date"]).unique())
    sel, hold = E.selection_holdout_split(dates, horizon=2)
    out = E.run_binary_track(v2, sel, hold, "label_2d", 2)
    assert "_note" in out and "NOT comparable" in out["_note"]
    assert out["lgbm"]["n"] < len(v2), "binary must exclude NEUTRAL rows"
    assert set(out) & {"majority", "lgbm", "logreg"}


def test_ece_and_coverage_bounds():
    rng = np.random.default_rng(7)
    y = rng.integers(0, 3, 500)
    p = rng.dirichlet([1, 1, 1], 500)
    ece = E.ece_score(y, p)
    assert 0.0 <= ece <= 1.0, ece
    cov = E.coverage_table(y, p)
    assert set(cov) == {"0.5", "0.6", "0.7", "0.8", "0.9"}
    assert cov["0.5"]["coverage"] >= cov["0.9"]["coverage"]


def main():
    test_split_embargo_and_grouping()
    print("  ok  embargo + date grouping")
    test_oof_stacking_covers_train_once()
    test_binary_isolation()
    print("  ok  binary isolation")
    test_ece_and_coverage_bounds()
    print("  ok  ece/coverage bounds")
    print("\n4 experiment-harness checks passed")


if __name__ == "__main__":
    main()
