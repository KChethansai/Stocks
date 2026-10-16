"""Offline regressions: python -m ml.python.test_evaluation_integrity."""
import json
import sys
import tempfile
from pathlib import Path
from types import SimpleNamespace
from unittest.mock import patch

import numpy as np
import pandas as pd

from . import evaluate, train


def test_majority_uses_training_split():
    dates = pd.bdate_range("2024-01-02", periods=100)
    data = pd.DataFrame({column: np.zeros(100) for column in train.FEATURE_COLUMNS})
    data["date"], data["symbol"] = dates, "AAPL"
    data["label_2d"] = ["DOWN"] * 50 + ["UP"] * 50
    tr, _, te = train.split_by_date(data, "label_2d", 2)
    assert tr.label_2d.mode().iloc[0] == "DOWN"
    assert te.label_2d.mode().iloc[0] == "UP"
    reports = {}

    def report(name, y, probs, classes):
        reports[name] = (y.copy(), probs.copy(), classes)
        return {"accuracy": float((probs.argmax(axis=1) == y).mean())}

    session = SimpleNamespace(get_inputs=lambda: [], get_outputs=lambda: [])
    runtime = SimpleNamespace(InferenceSession=lambda path: session)
    # Reversed learned-class order catches accidental use of the global indices.
    classes = ["UP", "DOWN"]
    with tempfile.TemporaryDirectory() as directory:
        out = Path(directory)
        (out / "predictor-2d.onnx").touch()
        (out / "predictor-2d.meta.json").write_text(json.dumps({"classes": classes, "horizon": 2}))
        with patch.object(evaluate, "OUT_DIR", out), \
                patch.object(evaluate, "fetch_ohlcv", return_value={}), \
                patch.object(evaluate, "build_all", return_value=data), \
                patch.object(evaluate, "onnx_probs", return_value=np.tile([1., 0.], (len(te), 1))), \
                patch.object(evaluate, "report", side_effect=report), \
                patch.dict(sys.modules, {"onnxruntime": runtime}), \
                patch.object(sys, "argv", ["evaluate", "--synthetic"]):
            evaluate.main()
    y, probs, learned = reports["test/baseline-majority"]
    assert learned == classes
    assert (probs.argmax(axis=1) == classes.index("DOWN")).all(), \
        "majority baseline must select from training, not test labels"
    assert (y == classes.index("UP")).all()
    assert (probs.argmax(axis=1) == y).mean() == 0.


def test_walk_forward_session_purge():
    dates = pd.bdate_range("2024-06-24", periods=25).difference(pd.to_datetime(["2024-07-04"]))
    data = pd.DataFrame({column: np.repeat(np.arange(24), 2) for column in train.FEATURE_COLUMNS})
    data["date"] = np.repeat(dates, 2)
    data["symbol"] = ["AAPL", "MSFT"] * 24
    data["label_2d"] = ["DOWN", "UP"] * 24
    data = data.sample(frac=1, random_state=7)
    fitted, predicted = [], []

    class SpyClassifier:
        def __init__(self, **kwargs):
            pass

        def fit(self, X, y):
            fitted.append(X[:, 0].astype(int))
            return self

        def predict(self, X):
            predicted.append(X[:, 0].astype(int))
            return np.zeros(len(X), dtype=int)

    with patch("sklearn.linear_model.LogisticRegression", SpyClassifier):
        scores = train.walk_forward_scores(data, "label_2d", horizon=2, n_splits=2)
    assert len(scores) == len(fitted) == len(predicted) == 2
    for i, (tr, te) in enumerate(zip(fitted, predicted)):
        boundary = 8 * (i + 1)
        assert set(tr) == set(range(boundary - 2)), "training forward labels must be purged"
        assert set(te) == set(range(boundary + 2, boundary + 8)), "embargo must count sessions"
        assert tr.max() + 2 < boundary, "training label endpoint reaches unpurged test window"
        assert te.min() - (boundary - 1) > 2
        assert all((tr == rank).sum() == 2 for rank in set(tr)), "same-date symbols split"
        assert all((te == rank).sum() == 2 for rank in set(te)), "same-date symbols split"
    assert scores == [0.5, 0.5]


def test_walk_forward_skips_empty_purged_folds():
    data = pd.DataFrame({"date": pd.to_datetime(["2024-07-03", "2024-07-05", "2024-07-08"])})
    with patch("sklearn.linear_model.LogisticRegression") as classifier:
        assert train.walk_forward_scores(data, "label_2d", horizon=2) == []
        ragged = pd.DataFrame({"date": pd.bdate_range("2024-06-24", periods=12),
                               "symbol": [f"S{i}" for i in range(12)]})
        assert train.walk_forward_scores(ragged, "label_2d", horizon=2) == []
        classifier.assert_not_called()


def _ragged_panel():
    dates = pd.bdate_range("2024-06-24", periods=49).difference(pd.to_datetime(["2024-07-04"]))
    sessions = {
        "FULL": list(range(48)),
        "GAPS": [0, 1, 2, 8, 9, 20, 21, 27, 28, 32, 33, 39, 40, 47],
        "LATE": [19, 20, 21, 27, 28, 32, 33, 39, 40, 47],
        "ENDED": [0, 1, 2, 8, 9, 20, 21],
        "VAL_ENDED": [26, 27, 28, 32, 33],
        "TOUCH": [0, 20, 26, 32, 38, 39, 47],
    }
    rows = [(dates[rank], symbol) for symbol, ranks in sessions.items() for rank in ranks]
    data = pd.DataFrame(rows, columns=["date", "symbol"])
    for column in train.FEATURE_COLUMNS:
        data[column] = np.arange(len(data))
    data["label_2d"] = np.where(np.arange(len(data)) % 2, "UP", "DOWN")
    return data.sample(frac=1, random_state=7).reset_index(drop=True), dates


def _assert_symbol_windows_before(rows, panel, start, horizon=2):
    for symbol, group in rows.groupby("symbol"):
        dates = sorted(pd.to_datetime(panel.loc[panel.symbol == symbol, "date"]).unique())
        for date in pd.to_datetime(group.date):
            end = dates.index(date) + horizon
            assert end < len(dates) and dates[end] < start, \
                f"unsafe forward label: {symbol} {date} before {start}"


def test_split_by_date_ragged_boundaries():
    data, dates = _ragged_panel()
    original = data.copy(deep=True)
    tr, va, te = train.split_by_date(data, "label_2d", 2, train_frac=0.5, val_frac=0.25)
    _assert_symbol_windows_before(tr, data, va.date.min())
    _assert_symbol_windows_before(va, data, te.date.min())
    assert set(tr.loc[tr.symbol == "GAPS", "date"]) == set(dates[[0, 1, 2, 8, 9]])
    assert set(tr.loc[tr.symbol == "LATE", "date"]) == {dates[19]}
    assert set(tr.loc[tr.symbol == "ENDED", "date"]) == set(dates[[0, 1, 2, 8, 9]])
    assert set(va.loc[va.symbol == "GAPS", "date"]) == set(dates[[27, 28]])
    assert set(va.loc[va.symbol == "VAL_ENDED", "date"]) == set(dates[[26, 27, 28]])
    assert "TOUCH" not in set(tr.symbol) | set(va.symbol), "endpoint must be strictly before cut"
    assert set(tr.loc[tr.symbol == "FULL", "date"]) == set(dates[:22])
    assert set(va.loc[va.symbol == "FULL", "date"]) == set(dates[26:34])
    assert set(te.date) == set(dates[38:])
    assert not set(tr.date) & (set(va.date) | set(te.date))
    assert not set(va.date) & set(te.date)
    assert all(list(part.columns) == list(data.columns) for part in (tr, va, te))
    pd.testing.assert_frame_equal(data, original)


def test_walk_forward_ragged_windows():
    data, dates = _ragged_panel()
    original = data.copy(deep=True)
    fitted, predicted = [], []

    class SpyClassifier:
        def __init__(self, **kwargs):
            pass

        def fit(self, X, y):
            fitted.append(data[data[train.FEATURE_COLUMNS[0]].isin(X[:, 0])])
            return self

        def predict(self, X):
            predicted.append(data[data[train.FEATURE_COLUMNS[0]].isin(X[:, 0])])
            return np.zeros(len(X), dtype=int)

    with patch("sklearn.linear_model.LogisticRegression", SpyClassifier):
        scores = train.walk_forward_scores(data, "label_2d", horizon=2, n_splits=2)
    assert len(scores) == len(fitted) == len(predicted) == 2
    for i, (tr, te) in enumerate(zip(fitted, predicted)):
        boundary = 16 * (i + 1)
        _assert_symbol_windows_before(tr, data, te.date.min())
        assert set(tr.loc[tr.symbol == "FULL", "date"]) == set(dates[:boundary - 2])
        assert set(te.date) == set(dates[boundary + 2:boundary + 16])
        assert not set(tr.date) & set(te.date)
    assert set(fitted[0].loc[fitted[0].symbol == "GAPS", "date"]) == set(dates[[0, 1, 2]])
    assert "LATE" not in set(fitted[0].symbol)
    assert set(fitted[1].loc[fitted[1].symbol == "ENDED", "date"]) == set(dates[[0, 1, 2, 8, 9]])
    pd.testing.assert_frame_equal(data, original)


def main():
    test_majority_uses_training_split()
    print("  ok  training-only majority in learned-class order")
    test_walk_forward_session_purge()
    print("  ok  training-label purge and weekend/holiday session embargo")
    test_walk_forward_skips_empty_purged_folds()
    print("  ok  empty purged folds skipped without fitting")
    test_split_by_date_ragged_boundaries()
    print("  ok  ragged train/validation and validation/test label windows")
    test_walk_forward_ragged_windows()
    print("  ok  ragged walk-forward label windows and late listings")
    print("5 evaluation-integrity checks passed")


if __name__ == "__main__":
    main()
