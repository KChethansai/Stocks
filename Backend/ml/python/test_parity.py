"""Cross-language + ONNX parity guards (no network, deterministic).

Run: .venv/bin/python -m ml.python.test_parity
- Python feature math matches ml/features.js recipes (OLS, SMA, ROC, RSI,
  relative-return volatility, rsi/100 scaling, column order).
- ONNX export round-trips XGB predict_proba (max abs diff < 1e-5).
"""
from __future__ import annotations

import numpy as np

from .features import FEATURE_COLUMNS, compute_features, linear_regression, rsi


def _assert_close(a, b, tol=1e-9, name=""):
    assert abs(float(a) - float(b)) <= tol, f"{name}: {a} != {b}"


def test_ols_exact():
    closes = np.array([50 + 2 * i for i in range(30)], dtype=float)
    f = compute_features(closes)
    # slope of perfect line over last 20, normalized by last close
    last = float(closes[-1])
    _assert_close(f["slope_norm"], 2.0 / last, 1e-12, "slope_norm")
    _assert_close(f["slope_r2"], 1.0, 1e-12, "r2")
    slope, intercept, r2 = linear_regression(closes[-20:])
    _assert_close(slope, 2.0, 1e-9, "slope")


def test_sma_roc():
    closes = np.arange(100, 130, dtype=float)  # 100..129
    f = compute_features(closes)
    last = 129.0
    _assert_close(f["sma5_rel"], 127.0 / last - 1, 1e-12, "sma5_rel")
    _assert_close(f["sma20_rel"], 119.5 / last - 1, 1e-12, "sma20_rel")
    _assert_close(f["roc10"], 10 / 119.0, 1e-12, "roc10")


def test_volatility_is_relative():
    # Flat prices → 0; absolute-diff bug would also give 0, so use ramp:
    # relative returns shrink as price grows, absolute diffs do not.
    ramp = np.arange(100, 130, dtype=float)
    f = compute_features(ramp)
    rets = np.diff(ramp) / ramp[:-1]
    expected = float(rets.std(ddof=1))
    _assert_close(f["volatility"], expected, 1e-12, "volatility")
    assert f["volatility"] < 0.01, f"ramp vol too big: {f['volatility']}"
    # High relative vol must exceed low relative vol at same price level.
    calm = compute_features(np.array([100 + i for i in range(30)], dtype=float))
    wild = compute_features(np.array([100 + i + (9 if i % 2 else -9) for i in range(30)], dtype=float))
    assert wild["volatility"] > calm["volatility"]


def test_rsi_parity():
    up = np.array([100 + i for i in range(30)], dtype=float)
    dn = np.array([200 - i for i in range(30)], dtype=float)
    assert rsi(up) == 100.0
    assert rsi(dn) == 0.0
    f = compute_features(up)
    _assert_close(f["rsi14"], 1.0, 1e-12, "rsi14 scaled")


def test_column_order():
    assert FEATURE_COLUMNS == [
        "sma5_rel", "sma20_rel", "slope_norm", "intercept_norm",
        "slope_r2", "roc10", "volatility", "rsi14",
    ]


def test_onnx_roundtrip():
    from xgboost import XGBClassifier
    import onnxmltools
    from onnxmltools.convert.common.data_types import FloatTensorType
    import onnxruntime as ort

    rng = np.random.default_rng(0)
    X = rng.normal(size=(60, len(FEATURE_COLUMNS))).astype(np.float32)
    y = (X[:, 5] > 0).astype(int)  # roc10 sign → 2 classes
    clf = XGBClassifier(n_estimators=10, max_depth=3, n_jobs=-1)
    clf.fit(X, y)
    onx = onnxmltools.convert_xgboost(
        clf, initial_types=[("features", FloatTensorType([None, len(FEATURE_COLUMNS)]))]
    )
    sess = ort.InferenceSession(onx.SerializeToString())
    prob_out = next(o for o in sess.get_outputs() if "prob" in o.name.lower())
    got = sess.run([prob_out.name], {sess.get_inputs()[0].name: X})[0]
    if isinstance(got, list):  # ZipMap
        got = np.array([[d[k] for k in sorted(d)] for d in got], dtype=float)
    want = clf.predict_proba(X)
    assert got.shape == want.shape, f"{got.shape} != {want.shape}"
    assert np.max(np.abs(got - want)) < 1e-5, f"max diff {np.max(np.abs(got - want))}"


def test_v2_hand_values():
    from .features_v2 import GROUPS, SECTOR_OF, V2_COLUMNS, V2_NEW_COLUMNS, compute_v2_row

    n = 30
    c = np.linspace(100, 130, n)
    o = np.hstack([c[0], c[:-1]])  # gap == 0 by construction
    h = c * 1.01
    l = c * 0.99
    v = np.full(n, 1_000_000.0)
    spy = np.linspace(400, 420, n)
    sec = np.stack([np.linspace(50, 60, n), np.linspace(52, 61, n)])
    f = compute_v2_row(o, h, l, c, v, spy, sec)
    _assert_close(f["gap"], 0.0, 1e-12, "gap")
    _assert_close(f["close_pos"], 0.5, 1e-12, "close_pos")
    _assert_close(f["ret_1"], 130 / c[-2] - 1, 1e-12, "ret_1")
    _assert_close(f["ret_5"], 130 / c[-6] - 1, 1e-12, "ret_5")
    _assert_close(f["rel_volume"], 1.0, 1e-12, "rel_volume")
    assert f["dist_high"] <= 0 and f["dist_low"] >= 0
    assert f["vol_ratio"] > 0 and np.isfinite(f["vol_ratio"])
    # Market-relative: symbol outran SPY here → positive.
    assert f["mkt_rel_10"] > 0, f["mkt_rel_10"]
    assert len(V2_COLUMNS) == 23 and len(V2_NEW_COLUMNS) == 15
    assert set(sum(GROUPS.values(), [])) == set(V2_COLUMNS), "ablation groups must partition V2"
    from .data import APP_TICKERS

    assert set(SECTOR_OF) == set(APP_TICKERS), "every app ticker needs a sector"


def test_v2_fixture_self_consistent():
    import json
    from pathlib import Path

    import pandas as pd

    from .features_v2 import _aligned, compute_v2_row

    fx = json.loads(Path(__file__).with_name("fixtures").joinpath("v2_parity.json").read_text())
    for name, kase in fx.items():
        if "inputs" in kase:
            got = compute_v2_row(
                np.array(kase["inputs"]["o"]), np.array(kase["inputs"]["h"]),
                np.array(kase["inputs"]["l"]), np.array(kase["inputs"]["c"]),
                np.array(kase["inputs"]["v"]), np.array(kase["inputs"]["spy"]),
                np.array(kase["inputs"]["sec"]),
            )
        else:
            # Serving-assembly case (gap_ffill): past-only ffill alignment of
            # gappy market context onto the symbol's sessions, mirroring
            # trainedPredictorV2.assembleV2Row (JS side skips these generically
            # and covers them in its own gap_ffill block — same split here).
            idx = pd.DatetimeIndex(pd.to_datetime(kase["candles"]["t"]))
            spy = pd.Series(
                np.asarray(kase["spy_gappy"]["c"], dtype=float),
                index=pd.DatetimeIndex(pd.to_datetime(kase["spy_gappy"]["t"])),
            )
            peers = np.stack([
                _aligned(
                    pd.Series(
                        np.asarray(p["c"], dtype=float),
                        index=pd.DatetimeIndex(pd.to_datetime(p["t"])),
                    ),
                    idx,
                )
                for p in kase["peers_gappy"]
            ])
            c = kase["candles"]
            got = compute_v2_row(
                np.asarray(c["o"], dtype=float), np.asarray(c["h"], dtype=float),
                np.asarray(c["l"], dtype=float), np.asarray(c["c"], dtype=float),
                np.asarray(c["v"], dtype=float), _aligned(spy, idx), peers,
            )
        for col, want in kase["expected"].items():
            _assert_close(got[col], want, 1e-12, f"{name}.{col}")


def main():
    test_ols_exact()
    print("  ok  ols/slope parity")
    test_sma_roc()
    print("  ok  sma/roc parity")
    test_volatility_is_relative()
    print("  ok  relative-return volatility parity")
    test_rsi_parity()
    print("  ok  rsi parity + scaling")
    test_column_order()
    print("  ok  feature column order")
    test_onnx_roundtrip()
    print("  ok  onnx round-trip")
    test_v2_hand_values()
    print("  ok  v2 hand values + groups/sectors")
    test_v2_fixture_self_consistent()
    print("  ok  v2 fixture self-consistent")
    print("\n8 parity checks passed")


if __name__ == "__main__":
    main()
