"""Import wider historical OHLCV from Stooq free CSVs into data/raw/ as parquet.

Why Stooq: (a) free, no API key, ~15k US tickers, (b) daily adjusted OHLCV,
(c) downloads are one HTTP GET each so a 500-symbol universe is minutes,
(d) it backfills decades, unlike the recent-only endpoints.

Usage:
    .venv/bin/python -m ml.python.import_stooq AAPL NVDA ...   # symbols
    .venv/bin/python -m ml.python.import_stooq --list sp500.txt
    .venv/bin/python -m ml.python.import_stooq --all           # data.py CURRENT_TICKERS

Output: Backend/ml/data/raw/{SYMBOL}.parquet (schema from data.fetch_ohlcv)
This directory is only an optional training-time cache — never read by the server.
"""
from __future__ import annotations

import argparse
import time
from pathlib import Path

import pandas as pd

from .data import CURRENT_TICKERS

RAW_DIR = Path(__file__).resolve().parents[2] / "data" / "raw"
BASE = "https://stooq.com/q/d/l/?s={ticker}.us&i=d"


def save_one(symbol: str, df: pd.DataFrame) -> None:
    df = df.rename(columns={"Open": "open", "High": "high", "Low": "low",
                            "Close": "close", "Volume": "volume"})
    df.index = pd.to_datetime(df.index)
    df = df[df["close"] > 0]
    RAW_DIR.mkdir(parents=True, exist_ok=True)
    df.to_parquet(RAW_DIR / f"{symbol}.parquet")


def main() -> None:
    ap = argparse.ArgumentParser(description=__doc__)
    ap.add_argument("symbols", nargs="*")
    ap.add_argument("--list", type=Path)
    ap.add_argument("--all", action="store_true")
    args = ap.parse_args()

    if args.all:
        symbols = CURRENT_TICKERS
    elif args.list:
        symbols = [l.strip().upper() for l in args.list.read_text().splitlines() if l.strip()]
    else:
        symbols = [s.upper() for s in args.symbols]
    if not symbols:
        raise SystemExit("Give symbols, --list file, or --all")

    for sym in symbols:
        try:
            df = pd.read_csv(BASE.format(ticker=sym.lower()), index_col=0)
            if df.empty:
                print(f"[stooq] {sym}: empty (ticker not found?)"); continue
            save_one(sym, df)
            print(f"[stooq] {sym}: {len(df)} rows -> {RAW_DIR / sym}.parquet")
        except Exception as exc:  # noqa: BLE001 — one bad ticker must not kill the run
            print(f"[stooq] {sym}: FAILED {exc}")
        time.sleep(0.15)  # be polite to stooq


if __name__ == "__main__":
    main()