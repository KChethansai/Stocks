"""Evaluate a trained predictor bundle on the sealed chronological test tail.

Usage:
    .venv/bin/python -m ml.python.evaluate [--horizon 2] [--symbols ...] [--synthetic]

Never tunes on the test set — reports genuine generalization for the bundle
written by train.py. Distinguishes accuracy across ALL predictions from
selective high-confidence accuracy.
"""
from __future__ import annotations

import argparse
import json
from pathlib import Path

import numpy as np
import pandas as pd

from .data import TRAIN_TICKERS, build_all, fetch_ohlcv
from .features import FEATURE_COLUMNS, HORIZONS
from .train import CLASSES, compute_metrics, report, split_by_date

ML_DIR = Path(__file__).resolve().parents[1]  # Backend/ml
OUT_DIR = ML_DIR / "models"


def onnx_probs(session, X: np.ndarray, classes: list[str]) -> np.ndarray:
    """Run ONNX session → (n, C) prob array, handling ZipMap dict outputs."""
    inputs = session.get_inputs()
    outputs = session.get_outputs()
    feed = {inputs[0].name: X.astype(np.float32)}
    # Prefer an output named probabilities/output_probability; else last output.
    prob_out = None
    for o in outputs:
        n = (o.name or "").lower()
        if "prob" in n:
            prob_out = o
            break
    if prob_out is None:
        prob_out = outputs[-1]
    raw = session.run([prob_out.name], feed)[0]
    if isinstance(raw, np.ndarray) and raw.ndim == 2:
        return np.asarray(raw, dtype=float)
    # ZipMap: sequence of dicts {class_label: prob}.
    if isinstance(raw, (list, np.ndarray)) and len(raw) and isinstance(raw[0], dict):
        # Keys may be ints (learned indices) or class strings.
        sample_keys = list(raw[0].keys())
        if all(isinstance(k, str) for k in sample_keys):
            order = classes
            arr = np.array([[d.get(c, 0.0) for c in order] for d in raw], dtype=float)
        else:
            # int keys → assume 0..C-1 in learned order.
            order = sorted(sample_keys)
            arr = np.array([[d.get(k, 0.0) for k in order] for d in raw], dtype=float)
        return arr
    raise RuntimeError(f"Unrecognized ONNX probability output type: {type(raw)}")


def main() -> None:
    ap = argparse.ArgumentParser(description=__doc__)
    ap.add_argument("--horizon", type=int, default=2, choices=HORIZONS)
    ap.add_argument("--symbols", nargs="*", default=TRAIN_TICKERS)
    ap.add_argument("--synthetic", action="store_true")
    ap.add_argument("--start", type=str, default="2010-01-01")
    args = ap.parse_args()

    onnx_path = OUT_DIR / f"predictor-{args.horizon}d.onnx"
    meta_path = OUT_DIR / f"predictor-{args.horizon}d.meta.json"
    if not onnx_path.exists():
        raise SystemExit(f"No trained model at {onnx_path} — run `python -m ml.python.train` first")
    meta = json.loads(meta_path.read_text())
    if meta.get("synthetic") and not args.synthetic:
        print("[evaluate] WARNING: bundle was trained on synthetic data — scores are NOT real")

    import onnxruntime as ort

    session = ort.InferenceSession(str(onnx_path))
    print(f"[evaluate] inputs={[(i.name, i.shape) for i in session.get_inputs()]} "
          f"outputs={[(o.name, o.type) for o in session.get_outputs()]}")

    raw = fetch_ohlcv(args.symbols, start=args.start, synthetic=args.synthetic)
    data = build_all(raw, horizon=args.horizon)
    label_col = f"label_{args.horizon}d"
    data = data.dropna(subset=FEATURE_COLUMNS + [label_col])
    tr_df, _, te_df = split_by_date(data, label_col, args.horizon)
    print(f"[evaluate] sealed test rows={len(te_df):,} (embargo={args.horizon}d)")

    classes = meta["classes"]
    class_to_learned = {c: i for i, c in enumerate(classes)}
    # Drop test rows whose true label was never seen in training.
    te_df = te_df[te_df[label_col].isin(classes)].reset_index(drop=True)
    X = te_df[FEATURE_COLUMNS].to_numpy(dtype=np.float32)
    y = np.array([class_to_learned[v] for v in te_df[label_col]])

    probs = onnx_probs(session, X, classes)
    m = report("test/onnx", y, probs, classes)
    print(f"[evaluate] {onnx_path.name} horizon={meta['horizon']}d rows={len(y):,}")

    # Baselines on the same sealed test (majority from train distribution).
    from collections import Counter
    print(f"[evaluate] test label distribution: {dict(Counter(te_df[label_col]))}")
    train_counts = Counter(tr_df.loc[tr_df[label_col].isin(classes), label_col])
    if not train_counts:
        raise SystemExit("No training labels match the bundle's learned classes")
    maj_label = train_counts.most_common(1)[0][0]
    maj_idx = class_to_learned[maj_label]
    maj_probs = np.zeros_like(probs)
    maj_probs[:, maj_idx] = 1.0
    report("test/baseline-majority", y, maj_probs, classes)
    up_idx = class_to_learned.get("UP")
    if up_idx is not None:
        up_probs = np.zeros_like(probs)
        up_probs[:, up_idx] = 1.0
        report("test/baseline-always-UP", y, up_probs, classes)

    # Confidence-threshold coverage: selective vs all.
    print("[evaluate] confidence coverage (selective vs all):")
    conf = probs.max(axis=1)
    pred = probs.argmax(axis=1)
    for thr in (0.5, 0.6, 0.7, 0.8, 0.9):
        sel = conf >= thr
        acc = float((pred[sel] == y[sel]).mean()) if sel.any() else float("nan")
        print(f"  thr={thr:.1f} coverage={sel.mean():.3f} selective_acc={acc:.3f} n={int(sel.sum())}")
    print(f"  ALL coverage=1.000 acc={m['accuracy']:.3f} n={len(y)}")

    # Per-symbol sealed-test accuracy.
    print("[evaluate] per-symbol (top 10 by n):")
    te_df = te_df.copy()
    te_df["_pred"] = pred
    te_df["_true"] = y
    rows = []
    for sym, g in te_df.groupby("symbol"):
        rows.append((sym, float((g["_pred"] == g["_true"]).mean()), len(g)))
    for sym, acc, n in sorted(rows, key=lambda r: -r[2])[:10]:
        print(f"  {sym:<8} acc={acc:.3f} n={n}")

    # Regime split by year (bull/bear proxy via yearly mean forward label).
    print("[evaluate] per-year regime:")
    te_df["year"] = pd.to_datetime(te_df["date"]).dt.year
    for yr, g in sorted(te_df.groupby("year")):
        acc = float((g["_pred"] == g["_true"]).mean())
        print(f"  {yr} acc={acc:.3f} n={len(g)}")


if __name__ == "__main__":
    main()
