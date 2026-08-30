"""Evaluate a trained predictor bundle on fresh data (default: the test tail).

Usage:
    .venv/bin/python -m ml.python.evaluate [--horizon 2] [--symbols ...] [--synthetic]
"""
from __future__ import annotations

import argparse
import json
from pathlib import Path

import numpy as np
import onnxruntime as ort

from .data import CURRENT_TICKERS, build_all, fetch_ohlcv
from .features import FEATURE_COLUMNS, HORIZONS

ROOT = Path(__file__).resolve().parents[2]  # Backend/ml
OUT_DIR = ROOT / "models"


def main() -> None:
    ap = argparse.ArgumentParser(description=__doc__)
    ap.add_argument("--horizon", type=int, default=2, choices=HORIZONS)
    ap.add_argument("--symbols", nargs="*", default=CURRENT_TICKERS)
    ap.add_argument("--synthetic", action="store_true")
    args = ap.parse_args()

    onnx_path = OUT_DIR / f"predictor-{args.horizon}d.onnx"
    meta_path = OUT_DIR / f"predictor-{args.horizon}d.meta.json"
    if not onnx_path.exists():
        raise SystemExit(f"No trained model at {onnx_path} — run `python -m ml.python.train` first")
    meta = json.loads(meta_path.read_text())
    session = ort.InferenceSession(str(onnx_path))

    raw = fetch_ohlcv(args.symbols, synthetic=args.synthetic)
    data = build_all(raw, horizon=args.horizon)
    label_col = f"label_{args.horizon}d"
    data = data.dropna(subset=FEATURE_COLUMNS + [label_col])

    X = data[FEATURE_COLUMNS].to_numpy(dtype=np.float32)
    prob_out = next(o for o in session.get_outputs() if o.name == "probabilities")
    probs = session.run([prob_out.name], {session.get_inputs()[0].name: X})[0]
    pred = probs.argmax(axis=1)
    y = np.array([meta["classes"].index(v) for v in data[label_col]])
    acc = float((pred == y).mean())
    print(f"[evaluate] {onnx_path.name} horizon={meta['horizon']}d rows={len(y):,}")
    print(f"[evaluate] accuracy={acc:.3f}  classes={meta['classes']}")


if __name__ == "__main__":
    main()