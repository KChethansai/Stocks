"""Dataset fetching + persistence.

Primary source: yfinance (needs network) with auto_adjust=True so splits and
dividends stay adjusted. Supplemental smoke path (--synthetic) uses a seeded
geometric random walk and must NEVER be used for real accuracy claims — the
train meta flags synthetic:true explicitly.

Ticker scope:
- APP_TICKERS: the 30 symbols the app actually trades (supported application
  tickers, mirrors baseStocks in Backend/config/universe.js).
- MARKET_CONTEXT_TICKERS: SPY/QQQ/DIA/IWM — market-context inputs only, not
  tradable in the app.
- TRAIN_TICKERS: APP + MARKET, the default real-training universe.
- CURRENT_TICKERS: backward-compat alias for TRAIN_TICKERS.
"""
from __future__ import annotations

import json
import os
import random
from datetime import datetime, timezone
from pathlib import Path
from uuid import uuid4

import numpy as np
import pandas as pd

from .features import FEATURE_COLUMNS, build_dataset

# Mirrors baseStocks in Backend/config/universe.js — the app's tradable universe.
APP_TICKERS = [
    "AAPL", "MSFT", "GOOGL", "AMZN", "NVDA", "TSLA", "META", "NFLX",
    "JPM", "V", "JNJ", "WMT", "PG", "XOM", "UNH", "MA", "HD", "BAC",
    "DIS", "CSCO", "ADBE", "CRM", "PEP", "KO", "INTC", "PFE", "ABT",
    "MRK", "T", "VZ",
]

# Market-context inputs only — never offered as tradable app symbols.
MARKET_CONTEXT_TICKERS = ["SPY", "QQQ", "DIA", "IWM"]

# Default real-training universe: supported app tickers + market context.
TRAIN_TICKERS = APP_TICKERS + MARKET_CONTEXT_TICKERS

CURRENT_TICKERS = TRAIN_TICKERS  # backward-compat alias

DATASET_ROOT = Path(__file__).resolve().parents[2] / "data"
RAW_DIR = DATASET_ROOT / "raw"


def fetch_ohlcv(
    symbols: list[str],
    start: str = "2010-01-01",
    end: str | None = None,
    synthetic: bool = False,
) -> dict[str, pd.DataFrame]:
    """Return {symbol: DataFrame(open,high,low,close,volume)}.

    Real path uses yfinance with auto_adjust=True (split/dividend-adjusted).
    When `synthetic` is set, no network call happens — the walk is seeded so
    repeated smoke runs are comparable. Never claim synthetic accuracy as real.
    """
    if synthetic:
        return {s: _synthetic_walk(s, start, end) for s in symbols}
    try:
        import yfinance as yf
    except ImportError as exc:  # pragma: no cover
        raise SystemExit(
            "yfinance not installed — run `.venv/bin/pip install -r ml/python/requirements.txt` or pass --synthetic"
        ) from exc

    out: dict[str, pd.DataFrame] = {}
    for sym in symbols:
        raw = yf.download(sym, start=start, end=end, auto_adjust=True,
                          progress=False)
        if raw.empty:
            continue
        if isinstance(raw.columns, pd.MultiIndex):
            # Single-symbol download may still nest under the ticker level.
            for level in (0, 1):
                try:
                    cand = raw.xs(sym, axis=1, level=level)
                    if not cand.empty:
                        raw = cand
                        break
                except KeyError:
                    continue
            if isinstance(raw.columns, pd.MultiIndex):
                # Flatten last level (Open/High/...) as fallback.
                raw.columns = raw.columns.get_level_values(-1)
        # yfinance column names vary by version (Price/Open vs Open).
        cols = {c.lower() if isinstance(c, str) else c: c for c in raw.columns}
        # MultiIndex already collapsed above; single-ticker frames use flat names.
        def _col(*names):
            for n in names:
                if n in raw.columns:
                    return raw[n]
                for k, v in cols.items():
                    if isinstance(k, str) and k.lower() == n.lower():
                        return raw[v]
            return None
        o = _col("Open"); h = _col("High"); lo = _col("Low"); c = _col("Close"); v = _col("Volume")
        if c is None or raw.empty or c.dropna().empty:
            continue
        df = pd.DataFrame({
            "open": o, "high": h, "low": lo,
            "close": c, "volume": v if v is not None else 0,
        })
        df.index = pd.to_datetime(df.index)
        # Align to the exact daily closes to drop overnight gaps cleanly.
        df = df[df["close"] > 0].sort_index()
        if not df.empty:
            out[sym] = df
    return out


def _synthetic_walk(symbol: str, start: str, end: str | None) -> pd.DataFrame:
    rng = random.Random(f"marketforge-{symbol}")
    py_rng = np.random.default_rng(rng.randint(0, 2**31))
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
    # Per-step returns (not a single repeated return — that made smoke acc=1.0).
    rets = py_rng.normal(drift, vol, n)
    closes = 100 * np.exp(np.cumsum(rets))
    gap = py_rng.normal(0, vol / 2, n)
    opens = np.hstack([closes[0], closes[:-1]]) * (1 + gap)
    highs = np.maximum(opens, closes) * (1 + np.abs(py_rng.normal(0, vol, n)))
    lows = np.minimum(opens, closes) * (1 - np.abs(py_rng.normal(0, vol, n)))
    volumes = py_rng.integers(1e5, 5e6, n)
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
    frames = [f for f in frames if not f.empty]
    if not frames:
        return pd.DataFrame()
    data = pd.concat(frames, ignore_index=True)
    data["date"] = pd.to_datetime(data["date"])
    data = data.sort_values(["date", "symbol"]).reset_index(drop=True)
    return data


def atomic_symlink(link: Path, target: str) -> None:
    """Replace only a symlink (or absent pointer), never its destination."""
    if link.exists() and not link.is_symlink():
        raise FileExistsError(f"Refusing to replace non-symlink: {link}")
    temporary = link.with_name(f".{link.name}.{uuid4().hex}.tmp")
    temporary.symlink_to(target)
    try:
        os.replace(temporary, link)
    finally:
        temporary.unlink(missing_ok=True)


def save_dataset(raw: dict[str, pd.DataFrame], manifest: dict) -> Path:
    """Persist versioned, gitignored local OHLCV + manifest for reproducibility."""
    stamp = datetime.now(timezone.utc).strftime("%Y%m%d-%H%M%S")
    out_dir = RAW_DIR / stamp
    out_dir.mkdir(parents=True, exist_ok=True)
    for sym, df in raw.items():
        df_out = df.copy()
        df_out.index.name = "date"
        df_out.to_parquet(out_dir / f"{sym}.parquet")
    (out_dir / "MANIFEST.json").write_text(json.dumps(manifest, indent=2))
    # Stable pointer for training scripts.
    atomic_symlink(RAW_DIR / "latest", stamp)
    return out_dir


def dataset_quality(raw: dict[str, pd.DataFrame]) -> dict:
    """Lightweight quality report: coverage, gaps, staleness per symbol."""
    report = {}
    for sym, df in raw.items():
        idx = pd.to_datetime(df.index).sort_values()
        expected_bd = pd.bdate_range(idx.min(), idx.max())
        missing_bd = len(expected_bd) - len(idx.intersection(expected_bd))
        report[sym] = {
            "rows": int(len(df)),
            "start": str(idx.min().date()) if len(idx) else None,
            "end": str(idx.max().date()) if len(idx) else None,
            "missing_business_days": int(max(0, missing_bd)),
            "null_closes": int(df["close"].isna().sum()),
            "non_positive_closes": int((df["close"] <= 0).sum()),
        }
    return report


BENCHMARK_STOCKS = APP_TICKERS  # documented app scope; market context is supplemental
