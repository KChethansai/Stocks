"""V2 complementary features — strictly point-in-time-correct.

Every value for floor date t uses ONLY bars with date <= t (the symbol's own
trailing 30 sessions, SPY closes ffill-aligned to the symbol's dates, and
sector-peer closes ffill-aligned the same way — ffill never looks ahead).

Row inputs are trailing-30 arrays, oldest-first, all describing information
genuinely available at t's close:
  o,h,l,c,v : symbol open/high/low/close/volume
  spy_c     : SPY closes aligned to the same 30 dates
  sec_c     : (n_peers, 30) sector-peer closes (sector median INCLUDES self —
                always defined, no rows dropped; slight dilution in small groups)

Mirrors Backend/ml/featuresV2.js exactly — parity is enforced by the shared
fixture (ml/python/fixtures/v2_parity.json) consumed by both test suites.
"""
from __future__ import annotations

import numpy as np
import pandas as pd

from .data import APP_TICKERS
from .features import (
    DEADBAND,
    FEATURE_COLUMNS,
    HORIZONS,
    MIN_CANDLES,
    compute_features,
)

V2_NEW_COLUMNS = [
    "ret_1",        # close[t]/close[t-1]-1
    "ret_5",        # close[t]/close[t-5]-1
    "ret_20",       # close[t]/close[t-20]-1
    "gap",          # open[t]/close[t-1]-1 (overnight gap)
    "range",        # (high[t]-low[t])/close[t] (intraday range)
    "close_pos",    # (close[t]-low[t])/(high[t]-low[t]), 0.5 when flat
    "rel_volume",   # volume[t]/mean(volume[t-20:t]), clipped [0,8], 1.0 when mean<=0
    "vol_5",        # std of relative returns over last 5 sessions
    "vol_ratio",    # vol_5 / vol_20, 1.0 when vol_20<=0 (volatility regime)
    "dist_high",    # close[t]/max(high[t-20:t])-1 (<=0)
    "dist_low",     # close[t]/min(low[t-20:t])-1 (>=0)
    "reversal_5_10",  # close[t-5]/close[t-10]-1 (prior-leg momentum vs recent)
    "mkt_rel_10",   # ret_10(sym) - ret_10(SPY)
    "mkt_rel_5",    # ret_5(sym) - ret_5(SPY)
    "sec_rel_10",   # ret_10(sym) - median(ret_10 sector peers incl. self)
]

V2_COLUMNS = FEATURE_COLUMNS + V2_NEW_COLUMNS  # 8 + 15 = 23

# Sector context groups (static map; sector median includes self — always defined).
SECTOR_OF: dict[str, str] = {}
_SECTORS: dict[str, list[str]] = {
    "TECH": ["AAPL", "MSFT", "GOOGL", "NVDA", "CSCO", "ADBE", "CRM", "INTC"],
    "HEALTH": ["JNJ", "UNH", "PFE", "ABT", "MRK"],
    "FIN": ["JPM", "V", "MA", "BAC"],
    "CONSUMER": ["AMZN", "HD", "WMT", "PG", "PEP", "KO"],
    "MEDIA_TELCO": ["META", "NFLX", "DIS", "T", "VZ"],
    "ENERGY_AUTO": ["XOM", "TSLA"],
}
for _sec, _members in _SECTORS.items():
    for _m in _members:
        SECTOR_OF[_m] = _sec

# Ablation groups (v1 features partitioned + v2 groups).
GROUPS: dict[str, list[str]] = {
    "G1_trend": ["sma5_rel", "sma20_rel", "slope_norm", "intercept_norm", "slope_r2"],
    "G2_momentum": ["roc10", "rsi14", "ret_1", "ret_5", "ret_20", "reversal_5_10"],
    "G3_volatility": ["volatility", "vol_5", "vol_ratio", "range"],
    "G4_microstructure": ["gap", "close_pos", "rel_volume", "dist_high", "dist_low"],
    "G5_market": ["mkt_rel_10", "mkt_rel_5"],
    "G6_sector": ["sec_rel_10"],
}


def _rel(a: float, b: float) -> float:
    return a / b - 1.0 if b else float("nan")


def compute_v2_row(
    o: np.ndarray, h: np.ndarray, l: np.ndarray, c: np.ndarray, v: np.ndarray,
    spy_c: np.ndarray, sec_c: np.ndarray,
) -> dict[str, float]:
    """New-feature slice for trailing-30 arrays (oldest-first). Raises on short input."""
    if min(len(o), len(h), len(l), len(c), len(v), len(spy_c)) < MIN_CANDLES:
        raise ValueError(f"Need at least {MIN_CANDLES} sessions")
    if sec_c.shape[1] < MIN_CANDLES:
        raise ValueError(f"Need at least {MIN_CANDLES} sector sessions")
    o, h, l, c, v = (np.asarray(x, dtype=float)[-30:] for x in (o, h, l, c, v))
    spy_c = np.asarray(spy_c, dtype=float)[-30:]
    sec_c = np.asarray(sec_c, dtype=float)[:, -30:]
    last = float(c[-1])
    if not np.isfinite(last) or last <= 0:
        raise ValueError("Last close must be finite and > 0")

    ret_1 = _rel(c[-1], c[-2])
    ret_5 = _rel(c[-1], c[-6])
    ret_20 = _rel(c[-1], c[-21])
    gap = _rel(o[-1], c[-2])
    rng = (h[-1] - l[-1]) / last if last else float("nan")
    close_pos = (last - l[-1]) / (h[-1] - l[-1]) if h[-1] > l[-1] else 0.5
    vmean = float(np.mean(v[-21:-1]))
    rel_volume = min(8.0, max(0.0, float(v[-1]) / vmean)) if vmean > 0 else 1.0

    r1 = (c[1:] - c[:-1]) / np.where(c[:-1] > 0, c[:-1], np.nan)
    r1 = r1[np.isfinite(r1)]
    vol_5 = float(r1[-5:].std(ddof=1)) if len(r1[-5:]) >= 2 else 0.0
    vol_20 = float(r1[-20:].std(ddof=1)) if len(r1[-20:]) >= 2 else 0.0
    vol_ratio = vol_5 / vol_20 if vol_20 > 0 else 1.0

    dist_high = _rel(last, float(np.max(h[-21:-1])))
    dist_low = _rel(last, float(np.min(l[-21:-1])))
    reversal_5_10 = _rel(c[-6], c[-11])

    s_ret_10 = _rel(spy_c[-1], spy_c[-11])
    s_ret_5 = _rel(spy_c[-1], spy_c[-6])
    c_ret_10 = _rel(c[-1], c[-11])
    c_ret_5 = _rel(c[-1], c[-6])
    mkt_rel_10 = c_ret_10 - s_ret_10
    mkt_rel_5 = c_ret_5 - s_ret_5

    with np.errstate(divide="ignore", invalid="ignore"):
        peer_ret10 = (sec_c[:, -1] / sec_c[:, -11]) - 1.0
    peer_ret10 = peer_ret10[np.isfinite(peer_ret10)]
    sec_med = float(np.median(peer_ret10)) if len(peer_ret10) else float("nan")
    sec_rel_10 = c_ret_10 - sec_med

    return {
        "ret_1": float(ret_1), "ret_5": float(ret_5), "ret_20": float(ret_20),
        "gap": float(gap), "range": float(rng), "close_pos": float(close_pos),
        "rel_volume": float(rel_volume), "vol_5": float(vol_5),
        "vol_ratio": float(vol_ratio), "dist_high": float(dist_high),
        "dist_low": float(dist_low), "reversal_5_10": float(reversal_5_10),
        "mkt_rel_10": float(mkt_rel_10), "mkt_rel_5": float(mkt_rel_5),
        "sec_rel_10": float(sec_rel_10),
    }


def _aligned(series: pd.Series, index: pd.DatetimeIndex) -> np.ndarray:
    """ffill-align a series to a symbol's dates (past-only, PIT-safe)."""
    return series.reindex(index, method="ffill").to_numpy(dtype=float)


def build_dataset_v2(
    raw: dict[str, pd.DataFrame], horizon: int, deadband: float = DEADBAND
) -> pd.DataFrame:
    """V2 long-form rows for APP_TICKERS only (ETFs supply context, not rows).

    On each floor date t: v1 features + v2 features from trailing sessions,
    label from forward trading-session return. Rows with any non-finite
    feature or missing market/sector context are dropped (counted).
    """
    if "SPY" not in raw:
        raise SystemExit("build_dataset_v2 needs SPY in raw for market context")
    label_col = f"label_{horizon}d"
    frames: list[pd.DataFrame] = []
    dropped = 0
    for sym in APP_TICKERS:
        if sym not in raw:
            continue
        df = raw[sym].sort_index()
        closes = df["close"].to_numpy(dtype=float)
        opens = df["open"].to_numpy(dtype=float)
        highs = df["high"].to_numpy(dtype=float)
        lows = df["low"].to_numpy(dtype=float)
        vols = df["volume"].to_numpy(dtype=float)
        spy_c = _aligned(raw["SPY"]["close"], df.index)
        peers = [p for p in _SECTORS[SECTOR_OF[sym]] if p in raw]
        sec_c = np.stack([_aligned(raw[p]["close"], df.index) for p in peers])
        n = len(closes)
        rows: list[dict] = []
        for t in range(MIN_CANDLES, n - horizon):
            try:
                feat = compute_features(closes[: t + 1])
                v2 = compute_v2_row(
                    opens[: t + 1], highs[: t + 1], lows[: t + 1],
                    closes[: t + 1], vols[: t + 1],
                    spy_c[: t + 1],
                    sec_c[:, : t + 1],
                )
            except ValueError:
                dropped += 1
                continue
            feat.update(v2)
            if not all(np.isfinite(feat[k]) for k in V2_COLUMNS):
                dropped += 1
                continue
            row = {"date": df.index[t], "close": float(closes[t])}
            row.update(feat)
            fwd = closes[t + horizon] / closes[t] - 1.0
            row[label_col] = "UP" if fwd > deadband else ("DOWN" if fwd < -deadband else "NEUTRAL")
            rows.append(row)
        if rows:
            frames.append(pd.DataFrame(rows).assign(symbol=sym))
    data = pd.concat(frames, ignore_index=True) if frames else pd.DataFrame()
    if not data.empty:
        data["date"] = pd.to_datetime(data["date"])
        data = data.sort_values(["date", "symbol"]).reset_index(drop=True)
    print(f"[v2] {len(data):,} rows, dropped_nonfinite={dropped:,}")
    return data
