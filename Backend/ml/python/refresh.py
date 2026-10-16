"""Refresh OHLCV through the last fully completed US trading session.

Usage:
    .venv/bin/python -m ml.python.refresh [--symbols ...] [--start 2010-01-01]
    .venv/bin/python -m ml.python.refresh --check-only   # audit only, no writes

Rules:
- Last completed session is derived from America/New_York time: weekends map
  to Friday; weekdays before 16:05 ET map to the previous business day.
- Any bar dated AFTER the last completed session is quarantined (written to
  quarantine/ inside the new stamp, never used for features/labels).
- Corporate actions: source is yfinance auto_adjust=True (splits/dividends
  adjusted). The audit cross-checks split-scale jumps via gross (unadjusted)
  close ratios only as a sanity report — training data stays adjusted.
- Symbol coverage is audited against SPY as the calendar reference: dates SPY
  traded but a symbol missed are symbol-specific gaps; dates neither traded
  are market holidays/closures.
- Never touches the previous stamp dir. Moves the `latest` symlink only after
  all writes + audits succeed, and records the previous stamp for rollback.

Output: Backend/data/raw/<stamp>/ (*.parquet + MANIFEST.json + QUARANTINE.json)
"""
from __future__ import annotations

import argparse
import json
from datetime import datetime, timedelta, timezone
from pathlib import Path
from zoneinfo import ZoneInfo

import numpy as np
import pandas as pd

from .data import (
    APP_TICKERS,
    MARKET_CONTEXT_TICKERS,
    RAW_DIR,
    TRAIN_TICKERS,
    atomic_symlink,
    dataset_quality,
    fetch_ohlcv,
)

ET = ZoneInfo("America/New_York")
CLOSE_BUFFER_MIN = 65  # 16:00 ET close + data-settlement buffer


def last_completed_us_session(now_utc: datetime | None = None) -> pd.Timestamp:
    """Most recent fully completed US regular trading session (date, no tz)."""
    now_utc = now_utc or datetime.now(timezone.utc)
    et = now_utc.astimezone(ET)
    d = et.date()
    if d.weekday() == 5:  # Saturday -> Friday
        d = d - timedelta(days=1)
    elif d.weekday() == 6:  # Sunday -> Friday
        d = d - timedelta(days=2)
    elif d.weekday() < 5:
        close_et = et.replace(hour=16, minute=5, second=0, microsecond=0)
        if et < close_et:
            d = d - timedelta(days=1)
            while d.weekday() >= 5:  # landed on weekend -> back to Friday
                d = d - timedelta(days=1)
    return pd.Timestamp(d)


def audit_coverage(raw: dict[str, pd.DataFrame], session: pd.Timestamp) -> dict:
    """SPY-referenced coverage audit + revision/quarantine accounting."""
    audit: dict = {"last_completed_session": str(session.date())}
    spy_idx = set()
    if "SPY" in raw:
        spy_idx = set(pd.to_datetime(raw["SPY"].index).date.astype(str))
    per_symbol = {}
    for sym, df in raw.items():
        idx = pd.to_datetime(df.index)
        dates = set(idx.date.astype(str))
        beyond = sorted(str(x) for x in idx.date if pd.Timestamp(x) > session)
        missing_vs_spy = sorted(spy_idx - dates) if sym != "SPY" else []
        per_symbol[sym] = {
            "rows": int(len(df)),
            "start": str(idx.min().date()) if len(idx) else None,
            "end": str(idx.max().date()) if len(idx) else None,
            "bars_beyond_session": beyond,
            "missing_vs_spy": missing_vs_spy[:10],
            "n_missing_vs_spy": len(missing_vs_spy),
            "null_closes": int(df["close"].isna().sum()),
            "non_positive_closes": int((df["close"] <= 0).sum()),
        }
    audit["per_symbol"] = per_symbol
    # Market-wide closures = business days with no SPY bar (holidays etc.).
    if "SPY" in raw:
        idx = pd.to_datetime(raw["SPY"].index)
        if len(idx):
            expected = pd.bdate_range(idx.min(), idx.max())
            have = set(idx.date.astype(str))
            audit["market_closures_no_spy_bar"] = [
                str(d.date()) for d in expected if str(d.date()) not in have
            ][:25]
            audit["n_market_closures_no_spy_bar"] = int(
                len([d for d in expected if str(d.date()) not in have])
            )
    return audit


def revision_report(old_dir: Path, new_raw: dict, session: pd.Timestamp) -> dict:
    """Compare the session bar old-partial vs new-complete (same session date)."""
    rep: dict = {}
    old_manifest = old_dir / "MANIFEST.json"
    rep["old_stamp"] = old_dir.name
    if old_manifest.exists():
        try:
            rep["old_fetched_at"] = json.loads(old_manifest.read_text()).get("fetched_at")
        except Exception:
            pass
    for sym, df in new_raw.items():
        pq = old_dir / f"{sym}.parquet"
        if not pq.exists():
            continue
        try:
            old = pd.read_parquet(pq)
            old_idx = pd.to_datetime(old.index if "date" not in old.columns else old["date"])
            new_idx = pd.to_datetime(df.index)
            sdate = session.date()
            om = old_idx.date == sdate
            nm = new_idx.date == sdate
            if om.any() and nm.any():
                oc = float(old.loc[om, "close"].iloc[-1] if "close" in old.columns else np.nan)
                nc = float(df.loc[nm, "close"].iloc[-1])
                if oc and nc:
                    rep[sym] = {"old_close": oc, "new_close": nc,
                                "rel_change": float((nc - oc) / oc)}
        except Exception as exc:
            rep[sym] = {"error": str(exc)}
    return rep


def main() -> None:
    ap = argparse.ArgumentParser(description=__doc__)
    ap.add_argument("--symbols", nargs="*", default=TRAIN_TICKERS)
    ap.add_argument("--start", type=str, default="2010-01-01")
    ap.add_argument("--check-only", action="store_true")
    args = ap.parse_args()

    session = last_completed_us_session()
    print(f"[refresh] last completed US session: {session.date()} "
          f"(now={datetime.now(timezone.utc).isoformat()})")

    # end = session + 1 day: yfinance end is exclusive, so the session bar is included.
    end = (session + pd.Timedelta(days=1)).strftime("%Y-%m-%d")
    raw = fetch_ohlcv(args.symbols, start=args.start, end=end)
    if not raw:
        raise SystemExit("No data fetched — check network")
    print(f"[refresh] fetched {len(raw)} symbols through end={end}")

    # Truncate + quarantine anything beyond the completed session.
    quarantined: dict[str, list] = {}
    clean: dict[str, pd.DataFrame] = {}
    for sym, df in raw.items():
        idx = pd.to_datetime(df.index)
        keep = idx <= session
        if not keep.all():
            q = df.loc[~keep]
            quarantined[sym] = [
                {"date": str(d.date()), "close": float(r["close"]),
                 "volume": float(r.get("volume", 0))}
                for d, r in q.iterrows()
            ]
        cdf = df.loc[keep]
        cdf = cdf[cdf["close"] > 0].sort_index()
        if not cdf.empty:
            clean[sym] = cdf

    quality = dataset_quality(clean)
    coverage = audit_coverage(clean, session)

    # Revision vs previous stamp (partial-bar correction magnitude).
    prev = RAW_DIR / "latest"
    prev_dir = prev.resolve() if prev.is_symlink() else None
    revisions = revision_report(prev_dir, clean, session) if prev_dir and prev_dir.exists() else {}

    n_quar = sum(len(v) for v in quarantined.values())
    print(f"[refresh] clean={len(clean)} symbols quarantined_bars={n_quar} "
          f"missing_bd_total={sum(v['missing_business_days'] for v in quality.values())}")
    if args.check_only:
        print(json.dumps({"session": str(session.date()), "quarantined": quarantined,
                          "coverage_sample": {k: coverage["per_symbol"][k] for k in list(coverage["per_symbol"])[:3]}},
                         indent=2))
        return

    stamp = datetime.now(timezone.utc).strftime("%Y%m%d-%H%M%S")
    out_dir = RAW_DIR / stamp
    out_dir.mkdir(parents=True, exist_ok=True)
    for sym, df in clean.items():
        df_out = df.copy()
        df_out.index.name = "date"
        df_out.to_parquet(out_dir / f"{sym}.parquet")
    manifest = {
        "fetched_at": datetime.now(timezone.utc).isoformat(),
        "source": "yfinance",
        "auto_adjust": True,
        "start": args.start,
        "end_exclusive": end,
        "last_completed_session": str(session.date()),
        "symbols": sorted(clean.keys()),
        "app_tickers": APP_TICKERS,
        "market_context": MARKET_CONTEXT_TICKERS,
        "quality": quality,
        "coverage_audit": coverage,
        "revision_vs_previous": revisions,
        "previous_stamp": prev_dir.name if prev_dir else None,
    }
    (out_dir / "MANIFEST.json").write_text(json.dumps(manifest, indent=2))
    (out_dir / "QUARANTINE.json").write_text(json.dumps(quarantined, indent=2))
    try:
        atomic_symlink(prev, stamp)
    except OSError as exc:
        raise SystemExit(f"[refresh] symlink update failed ({exc}); data preserved at {out_dir}") from exc
    print(f"[refresh] wrote {out_dir} (previous={prev_dir})")


if __name__ == "__main__":
    main()
