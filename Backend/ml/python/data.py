"""Dataset fetching + persistence.

Primary source: yfinance (needs network). Fallback used by --smoke: a
geometric random walk so the whole train→export pipeline can be exercised
offline.
"""
from __future__ import annotations

import random

import numpy as np
import pandas as pd

from .features import FEATURE_COLUMNS, build_dataset

CURRENT_TICKERS = [
    "AAPL", "ABT", "ADBE", "AMZN", "ASML", "AVGO", "BRK-B", "CAT", "COST",
    "CRM", "CSCO", "DHR", "F", "GOOGL", "GS", "HD", "JNJ", "JPM", "KO",
    "LLY", "MA", "META", "MSFT", "NFLX", "NVDA", "ORCL", "PFE", "PLTR",
    "TM", "TSLA", "UNH", "V", "XOM",
]


def fetch_ohlcv(
    symbols: list[str],
    start: str = "2000-01-01",
    end: str | None = None,
    synthetic: bool = False,
) -> dict[str, pd.DataFrame]:
    """Return {symbol: DataFrame(open,high,low,close,volume)}.

    When `synthetic` is set, no network call happens — the walk is seeded so
    repeated smoke runs are comparable.
    """
    if synthetic:
        return {s: _synthetic_walk(s, start, end) for s in symbols}
    try:
        import yfinance as yf
    except ImportError as exc:  # pragma: no cover
        raise SystemExit(
            "yfinance not installed — run `pip install yfinance` or pass --synthetic"
        ) from exc

    out: dict[str, pd.DataFrame] = {}
    for sym in symbols:
        raw = yf.download(sym, start=start, end=end, auto_adjust=True,
                          progress=False, group_by="ticker")
        if isinstance(raw.columns, pd.MultiIndex):
            raw = raw.xs(sym, axis=1, level=1)
        if raw.empty or raw["Close"].dropna().empty:
            continue
        df = pd.DataFrame({
            "open": raw["Open"], "high": raw["High"], "low": raw["Low"],
            "close": raw["Close"], "volume": raw["Volume"],
        })
        # Align to the exact daily closes to drop overnight gaps cleanly.
        out[sym] = df[df["close"] > 0]
    return out


def _synthetic_walk(symbol: str, start: str, end: str | None) -> pd.DataFrame:
    rng = random.Random(f"marketforge-{symbol}")
    n = 900
    dates = pd.bdate_range(end=end or pd.Timestamp.today(), periods=n)
    # Mixed regimes: some trending names (UP/DOWN populated), some flat/low-vol
    # (NEUTRAL populated) — otherwise a smoke run learns a trivial one-sided task.
    regime = rng.choice(["trend_up", "trend_down", "flat", "chop"])
    if regime == "trend_up":
        vol, drift = rng.uniform(0.008, 0.02), rng.uniform(0.0002, 0.0007)
    elif regime == "trend_down":
        vol, drift = rng.uniform(0.008, 0.02), rng.uniform(-0.0007, -0.0002)
    elif regime == "flat":
        vol, drift = rng.uniform(0.0003, 0.001), 0.0
    else:  # chop: high volatility, no drift → signals conflict often
        vol, drift = rng.uniform(0.025, 0.045), 0.0
    rets = rng.gauss(drift, vol)  # type: ignore[arg-type]
    closes = 100 * np.exp(np.cumsum(np.full(n, rets)))
    opens = np.hstack([closes[0], closes[:-1]]) * (1 + rng.gauss(0, vol / 2))
    highs = np.maximum(opens, closes) * (1 + abs(rng.gauss(0, vol)))
    lows = np.minimum(opens, closes) * (1 - abs(rng.gauss(0, vol)))
    volumes = np.random.default_rng(rng.randint(0, 2**31)).integers(1e5, 5e6, n)
    return pd.DataFrame(
        {"open": opens, "high": highs, "low": lows,
         "close": closes, "volume": volumes},
        index=pd.to_datetime(dates),
    )


def build_all(
    raw: dict[str, pd.DataFrame], horizon: int, deadband: float = 0.001
) -> pd.DataFrame:
    """Concatenate per-symbol feature rows into one training DataFrame."""
    frames = [
        build_dataset(df, horizons=(horizon,), deadband=deadband).assign(symbol=sym)
        for sym, df in raw.items()
    ]
    data = pd.concat(frames, ignore_index=True)
    data["date"] = pd.to_datetime(data["date"])
    data = data.sort_values(["date", "symbol"]).reset_index(drop=True)
    return data


BENCHMARK_STOCKS = CURRENT_TICKERS  # documented dataset scope; superset via stooq importer