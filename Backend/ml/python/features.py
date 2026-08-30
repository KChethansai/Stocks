"""Feature engineering — a faithful mirror of Backend/ml/features.js.

Every indicator must match the JS implementation exactly, because at serving
time JS recomputes features with features.js and feeds them to the ONNX model.
If these drift apart, train/serve mismatch silently degrades the model.
"""
from __future__ import annotations

import numpy as np
import pandas as pd

MIN_CANDLES = 30  # mirrors MIN_HISTORY_CANDLES in ml/history.js
DEFAULT_LOOKBACK = 30
SHORT_SMA = 5
LONG_SMA = 20
SLOPE_WINDOW = 20
ROC_PERIOD = 10
RSI_PERIOD = 14

# Columns, in the exact order the ONNX model expects them.
FEATURE_COLUMNS = [
    "sma5_rel",     # sma5 / lastClose - 1
    "sma20_rel",    # sma20 / lastClose - 1
    "slope_norm",   # OLS slope / lastClose
    "intercept_norm",  # OLS intercept / lastClose
    "slope_r2",
    "roc10",        # 10-session rate of change (fraction)
    "volatility",   # sample stddev of daily returns
    "rsi14",
]

HORIZONS = (1, 2, 3, 5)
DEADBAND = 0.001  # ±0.1% symmetric — closures below this are NEUTRAL


def rsi(closes: np.ndarray, period: int = RSI_PERIOD) -> float:
    """Wilder's RSI — identical recipe to ml/features.js `rsi`."""
    if len(closes) < period + 1:
        return np.nan
    deltas = np.diff(closes)
    avg_gain = float(np.mean(np.clip(deltas[:period], 0, None)))
    avg_loss = float(np.mean(np.clip(-deltas[:period], 0, None)))
    for i in range(period, len(deltas)):
        gain = max(deltas[i], 0.0)
        loss = max(-deltas[i], 0.0)
        avg_gain = (avg_gain * (period - 1) + gain) / period
        avg_loss = (avg_loss * (period - 1) + loss) / period
    if avg_loss == 0:
        return 50.0 if avg_gain == 0 else 100.0
    rs = avg_gain / avg_loss
    return 100.0 - 100.0 / (1.0 + rs)


def linear_regression(values: np.ndarray) -> tuple[float, float, float]:
    """OLS fit of y against its own index (x = 0..n-1). Returns (slope, intercept, r2)."""
    n = len(values)
    if n < 2:
        return 0.0, float(values[0]) if n else 0.0, 0.0
    x = np.arange(n, dtype=float)
    x_mean = (n - 1) / 2.0
    y_mean = float(values.mean())
    numerator = float(((x - x_mean) * (values - y_mean)).sum())
    denominator = float(((x - x_mean) ** 2).sum())
    slope = numerator / denominator if denominator else 0.0
    intercept = y_mean - slope * x_mean
    ss_tot = float(((values - y_mean) ** 2).sum())
    ss_res = float(((values - (intercept + slope * x)) ** 2).sum())
    r2 = 0.0 if ss_tot == 0 else max(0.0, 1.0 - ss_res / ss_tot)
    return slope, intercept, r2


def compute_features(closes: np.ndarray) -> dict[str, float]:
    """Feature vector for the most recent session of `closes` (chronological)."""
    if len(closes) < MIN_CANDLES:
        raise ValueError(f"Need at least {MIN_CANDLES} closes")
    window = closes[-DEFAULT_LOOKBACK:]
    last = float(window[-1])
    if not np.isfinite(last) or last <= 0:
        raise ValueError("Last close must be finite and > 0")

    slope, intercept, fit_r2 = linear_regression(window[-SLOPE_WINDOW:])
    sma5 = float(np.mean(window[-SHORT_SMA:])) if len(window) >= SHORT_SMA else np.nan
    sma20 = float(np.mean(window[-LONG_SMA:])) if len(window) >= LONG_SMA else np.nan

    roc10 = float((window[-1] - window[-1 - ROC_PERIOD]) / window[-1 - ROC_PERIOD])

    returns = np.diff(window)
    volatility = float(returns.std(ddof=1)) if len(returns) >= 3 else 0.0

    return {
        "sma5_rel": sma5 / last - 1,
        "sma20_rel": sma20 / last - 1,
        "slope_norm": slope / last,
        "intercept_norm": intercept / last,
        "slope_r2": fit_r2,
        "roc10": roc10,
        "volatility": volatility,
        "rsi14": rsi(window) / 100.0,  # scale to [0,1], avoid numeric shock vs other features
    }


def build_dataset(
    ohlcv: pd.DataFrame, horizons: tuple[int, ...] = HORIZONS, deadband: float = DEADBAND
) -> pd.DataFrame:
    """Rolling-window features + forward-return labels from one symbol's OHLCV.

    `ohlcv` columns: open, high, low, close, volume (ascending date index).
    Returns long-form rows keyed by (date, symbol); on each floor date the
    features describe the trailing DEFAULT_LOOKBACK sessions and the labels
    describe that day's forward return per horizon.
    """
    closes = ohlcv["close"].to_numpy(dtype=float)
    n = len(closes)
    rows: list[dict] = []
    for t in range(MIN_CANDLES, n - max(horizons)):
        try:
            feat = compute_features(closes[: t + 1])
        except ValueError:
            continue
        row = {"date": ohlcv.index[t], "close": float(closes[t])}
        row.update(feat)
        for h in horizons:
            fwd = closes[t + h] / closes[t] - 1.0
            if fwd > deadband:
                label = "UP"
            elif fwd < -deadband:
                label = "DOWN"
            else:
                label = "NEUTRAL"
            row[f"label_{h}d"] = label
        rows.append(row)
    return pd.DataFrame(rows)