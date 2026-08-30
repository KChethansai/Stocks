"""Train the ONNX classifier + metadata bundle consumed by ml/trainedPredictor.js.

Usage:
    .venv/bin/python -m ml.python.train              # real data (yfinance)
    .venv/bin/python -m ml.python.train --synthetic   # offline smoke path
    .venv/bin/python -m ml.python.train --horizon 3 --symbols AAPL NVDA
"""
from __future__ import annotations

import argparse
import json
from datetime import datetime, timezone
from pathlib import Path

import numpy as np
import pandas as pd
from xgboost import XGBClassifier

from .data import CURRENT_TICKERS, build_all, fetch_ohlcv
from .features import FEATURE_COLUMNS, HORIZONS

ROOT = Path(__file__).resolve().parents[2]  # Backend/ml
OUT_DIR = ROOT / "models"
CLASSES = ["DOWN", "NEUTRAL", "UP"]
CLASS_TO_IDX = {c: i for i, c in enumerate(CLASSES)}
MODEL_ID = lambda h: f"xgboost-onnx-{h}d"  # noqa: E731


def split_features(data: pd.DataFrame, label_col: str):
    """Time-ordered train/val/test split (train→val→test in calendar time)."""
    dates = pd.to_datetime(data["date"])
    n = len(dates)
    idx = np.arange(n)
    val_cut = int(n * 0.70)
    te_cut = int(n * 0.85)
    # contiguous by sorted (date, symbol) order == sorted(calendar time)
    tr_idx, va_idx, te_idx = idx[:val_cut], idx[val_cut:te_cut], idx[te_cut:]
    cols = FEATURE_COLUMNS
    return (
        data.iloc[tr_idx][cols].to_numpy(dtype=float), np.array([CLASS_TO_IDX[v] for v in data.iloc[tr_idx][label_col]]),
        data.iloc[va_idx][cols].to_numpy(dtype=float), np.array([CLASS_TO_IDX[v] for v in data.iloc[va_idx][label_col]]),
        data.iloc[te_idx][cols].to_numpy(dtype=float), np.array([CLASS_TO_IDX[v] for v in data.iloc[te_idx][label_col]]),
    )


def report(name: str, y_true: np.ndarray, probs: np.ndarray, classes: list[str]) -> dict:
    pred = probs.argmax(axis=1)
    acc = float((pred == y_true).mean())
    print(f"[eval] {name}: accuracy={acc:.3f}  n={len(y_true)}  classes={classes}")
    for i, c in enumerate(classes):
        mask = y_true == i
        if not mask.any():
            continue
        p = pred[mask]
        precision = float((p == i).mean())  # class precision = P(class given true)
        recall = float((pred[mask] == i).mean()) if mask.any() else 0.0
        f1 = 2 * precision * recall / (precision + recall) if precision + recall else 0.0
        print(f"       {c:<7} precision={precision:.3f} recall={recall:.3f} f1={f1:.3f}")
    return {"accuracy": acc}


def main() -> None:
    ap = argparse.ArgumentParser(description=__doc__)
    ap.add_argument("--horizon", type=int, default=2, choices=HORIZONS)
    ap.add_argument("--symbols", nargs="*", default=CURRENT_TICKERS)
    ap.add_argument("--synthetic", action="store_true")
    args = ap.parse_args()
    OUT_DIR.mkdir(parents=True, exist_ok=True)

    raw = fetch_ohlcv(args.symbols, synthetic=args.synthetic)
    if not raw:
        raise SystemExit("No data fetched — check network or --synthetic")
    data = build_all(raw, horizon=args.horizon)
    label_col = f"label_{args.horizon}d"
    data = data.dropna(subset=FEATURE_COLUMNS + [label_col])
    print(f"[train] {len(data):,} labeled rows, {len(raw)} symbols, horizon={args.horizon}d")

    X_tr, y_tr, X_va, y_va, X_te, y_te = split_features(data, label_col)
    # Classes NOT present in train are dropped from the learned mapping — the
    # model can only ever emit the labels it saw. All splits reindex identically.
    present = sorted(set(map(int, y_tr)))
    mapping = {old: new for new, old in enumerate(present)}
    learned_classes = [CLASSES[i] for i in present]
    mask_va = np.array([mapping.get(int(v)) is not None for v in y_va])
    mask_te = np.array([mapping.get(int(v)) is not None for v in y_te])
    y_tr = np.array([mapping[int(v)] for v in y_tr])
    y_va = np.array([mapping[int(v)] for v in y_va[mask_va]])
    y_te = np.array([mapping[int(v)] for v in y_te[mask_te]])
    X_va = X_va[mask_va]
    X_te = X_te[mask_te]

    model = XGBClassifier(
        n_estimators=300,
        max_depth=5,
        learning_rate=0.05,
        subsample=0.8,
        colsample_bytree=0.8,
        objective="multi:softprob",
        num_class=len(learned_classes),
        eval_metric="mlogloss",
        tree_method="hist",
        n_jobs=-1,
        early_stopping_rounds=20,
    )
    model.fit(X_tr, y_tr, eval_set=[(X_va, y_va)], verbose=False)

    report("val", y_va, model.predict_proba(X_va), learned_classes)
    metrics = report("test", y_te, model.predict_proba(X_te), learned_classes)

    # Save the classifier as proper ONNX (XGBoost's own save_model writes
    # UBJSON even into a .onnx filename — this wheel has no native ONNX export).
    import onnxmltools
    from onnxmltools.convert.common.data_types import FloatTensorType

    onnx_model = onnxmltools.convert_xgboost(
        model,
        initial_types=[("features", FloatTensorType([None, len(FEATURE_COLUMNS)]))],
    )
    onnx_path = OUT_DIR / f"predictor-{args.horizon}d.onnx"
    with onnx_path.open("wb") as fh:
        fh.write(onnx_model.SerializeToString())
    meta = {
        "model_id": MODEL_ID(args.horizon),
        "horizon": args.horizon,
        "feature_columns": FEATURE_COLUMNS,
        "classes": learned_classes,
        "class_indices": present,
        "trained_at": datetime.now(timezone.utc).isoformat(),
        "n_rows": int(len(data)),
        "n_symbols": len(raw),
        "synthetic": args.synthetic,
        "metrics": metrics,
    }
    meta_path = OUT_DIR / f"predictor-{args.horizon}d.meta.json"
    meta_path.write_text(json.dumps(meta, indent=2))
    print(f"[train] wrote {onnx_path}")
    print(f"[train] wrote {meta_path}")


if __name__ == "__main__":
    main()