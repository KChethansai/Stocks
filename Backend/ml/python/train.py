"""Train the ONNX classifier + metadata bundle consumed by ml/trainedPredictor.js.

Usage:
    .venv/bin/python -m ml.python.train              # real data (yfinance)
    .venv/bin/python -m ml.python.train --synthetic   # offline smoke path
    .venv/bin/python -m ml.python.train --horizon 3 --symbols AAPL NVDA
    .venv/bin/python -m ml.python.train --save-data  # persist versioned dataset

Point-in-time correctness: features use only the trailing 30 sessions,
labels use forward trading-session returns (not calendar days). Splits are
chronological by date with purging + embargo so overlapping forward labels
never straddle a boundary, and same-date symbols never split across sets.
"""
from __future__ import annotations

import argparse
import hashlib
import json
import subprocess
from datetime import datetime, timezone
from pathlib import Path

import numpy as np
import pandas as pd

from .data import (
    APP_TICKERS,
    MARKET_CONTEXT_TICKERS,
    TRAIN_TICKERS,
    build_all,
    dataset_quality,
    fetch_ohlcv,
    save_dataset,
)
from .features import FEATURE_COLUMNS, HORIZONS

ML_DIR = Path(__file__).resolve().parents[1]  # Backend/ml
OUT_DIR = ML_DIR / "models"
CLASSES = ["DOWN", "NEUTRAL", "UP"]
CLASS_TO_IDX = {c: i for i, c in enumerate(CLASSES)}


def model_id(horizon: int, ensemble: bool = False) -> str:
    base = "ensemble-onnx" if ensemble else "xgboost-onnx"
    return f"{base}-{horizon}d"


def _purge_label_windows(rows: pd.DataFrame, panel: pd.DataFrame, horizon: int, next_start):
    """Missing filtered sessions delay inferred endpoints, so purging is conservative."""
    sessions = panel[["symbol", "date"]].copy()
    sessions["date"] = pd.to_datetime(sessions["date"])
    sessions = sessions.drop_duplicates().sort_values(["symbol", "date"])
    ends = sessions.groupby("symbol")["date"].shift(-horizon)
    safe = pd.MultiIndex.from_frame(sessions.loc[ends < next_start, ["symbol", "date"]])
    keys = pd.MultiIndex.from_arrays([rows["symbol"], pd.to_datetime(rows["date"])])
    return rows.loc[keys.isin(safe)]


def split_by_date(data: pd.DataFrame, label_col: str, horizon: int,
                  train_frac: float = 0.70, val_frac: float = 0.15):
    """Chronological train/val/test split grouped by date with embargo.

    Rows are grouped by trading date so the same date never appears in two
    splits (guards cross-symbol same-date leakage). An embargo of `horizon`
    trading sessions is purged around each cut because forward labels overlap.
    Residual per-symbol label windows are purged for ragged panels.
    Returns (train_df, val_df, test_df) with sealed final test window.
    """
    dates = sorted(pd.to_datetime(data["date"]).unique())
    n = len(dates)
    tr_cut = int(n * train_frac)
    va_cut = int(n * (train_frac + val_frac))
    embargo = int(horizon)
    tr_dates = set(dates[:max(0, tr_cut - embargo)])
    va_dates = set(dates[tr_cut + embargo:va_cut - embargo])
    te_dates = set(dates[va_cut + embargo:])
    d = pd.to_datetime(data["date"])
    tr = data[d.isin(tr_dates)].reset_index(drop=True)
    va = data[d.isin(va_dates)].reset_index(drop=True)
    te = data[d.isin(te_dates)].reset_index(drop=True)
    tr = _purge_label_windows(tr, data, horizon, va["date"].min() if not va.empty else te["date"].min())
    va = _purge_label_windows(va, data, horizon, te["date"].min())
    tr, va = tr.reset_index(drop=True), va.reset_index(drop=True)
    return tr, va, te


def compute_metrics(y_true: np.ndarray, probs: np.ndarray, classes: list[str]) -> dict:
    """Correct multiclass metrics (precision != recall)."""
    from sklearn.metrics import (
        accuracy_score,
        balanced_accuracy_score,
        confusion_matrix,
        f1_score,
        log_loss,
        precision_recall_fscore_support,
    )

    pred = probs.argmax(axis=1)
    prec, rec, f1, _ = precision_recall_fscore_support(
        y_true, pred, labels=list(range(len(classes))), zero_division=0
    )
    cm = confusion_matrix(y_true, pred, labels=list(range(len(classes)))).tolist()
    try:
        ll = float(log_loss(y_true, probs, labels=list(range(len(classes)))))
    except Exception:
        ll = None
    out = {
        "accuracy": float(accuracy_score(y_true, pred)),
        "balanced_accuracy": float(balanced_accuracy_score(y_true, pred)),
        "macro_f1": float(f1_score(y_true, pred, average="macro", zero_division=0)),
        "log_loss": ll,
        "confusion_matrix": cm,
        "per_class": {
            c: {"precision": float(prec[i]), "recall": float(rec[i]), "f1": float(f1[i]),
                "support": int((y_true == i).sum())}
            for i, c in enumerate(classes)
        },
        "n": int(len(y_true)),
    }
    return out


def report(name: str, y_true: np.ndarray, probs: np.ndarray, classes: list[str]) -> dict:
    m = compute_metrics(y_true, probs, classes)
    print(f"[eval] {name}: acc={m['accuracy']:.3f} bal={m['balanced_accuracy']:.3f} "
          f"macroF1={m['macro_f1']:.3f} logloss={m['log_loss']} n={m['n']} classes={classes}")
    for c in classes:
        p = m["per_class"][c]
        print(f"       {c:<7} precision={p['precision']:.3f} recall={p['recall']:.3f} "
              f"f1={p['f1']:.3f} n={p['support']}")
    return m


def baselines(X_tr, y_tr, X_va, classes: list[str], n_classes: int):
    """Majority-class, always-UP, uniform + logistic baselines (val probs)."""
    from sklearn.dummy import DummyClassifier
    from sklearn.linear_model import LogisticRegression

    out = {}
    maj = DummyClassifier(strategy="most_frequent")
    maj.fit(X_tr, y_tr)
    out["majority"] = maj.predict_proba(X_va)
    # Always-UP in learned-index space (fall back to majority if UP unseen).
    up_idx = classes.index("UP") if "UP" in classes else int(np.argmax(np.bincount(y_tr)))
    probs = np.zeros((len(X_va), n_classes))
    probs[:, up_idx] = 1.0
    out["always_UP"] = probs
    uni = DummyClassifier(strategy="uniform")
    uni.fit(X_tr, y_tr)
    out["uniform"] = uni.predict_proba(X_va)
    lr = LogisticRegression(max_iter=2000)
    lr.fit(X_tr, y_tr)
    out["logistic"] = lr.predict_proba(X_va)
    out["_models"] = {"logistic": lr}
    return out


def walk_forward_scores(data: pd.DataFrame, label_col: str, horizon: int, n_splits: int = 3):
    """Walk-forward validation over date groups (embargoed, leak-free)."""
    from sklearn.linear_model import LogisticRegression

    dates = sorted(pd.to_datetime(data["date"]).unique())
    folds = np.array_split(dates, n_splits + 1)
    scores = []
    for i in range(n_splits):
        boundary = sum(len(f) for f in folds[: i + 1])
        # Purge forward training labels and embargo test dates in session ranks.
        tr_dates = set(dates[:max(0, boundary - horizon)])
        te_dates = set(folds[i + 1][horizon:])
        if not tr_dates or not te_dates:
            continue
        tr = data[pd.to_datetime(data["date"]).isin(tr_dates)]
        te = data[pd.to_datetime(data["date"]).isin(te_dates)]
        tr = _purge_label_windows(tr, data, horizon, te["date"].min())
        if tr.empty:
            continue
        Xtr = tr[FEATURE_COLUMNS].to_numpy(dtype=float)
        ytr = np.array([CLASS_TO_IDX[v] for v in tr[label_col]])
        Xte = te[FEATURE_COLUMNS].to_numpy(dtype=float)
        yte = np.array([CLASS_TO_IDX[v] for v in te[label_col]])
        clf = LogisticRegression(max_iter=1000)
        clf.fit(Xtr, ytr)
        acc = float((clf.predict(Xte) == yte).mean())
        scores.append(acc)
        print(f"[walk-forward] fold {i + 1}: acc={acc:.3f} n_train={len(Xtr):,} n_test={len(Xte):,}")
    return scores


def main() -> None:
    ap = argparse.ArgumentParser(description=__doc__)
    ap.add_argument("--horizon", type=int, default=2, choices=HORIZONS)
    ap.add_argument("--symbols", nargs="*", default=TRAIN_TICKERS)
    ap.add_argument("--synthetic", action="store_true")
    ap.add_argument("--save-data", action="store_true",
                    help="persist versioned parquet dataset + manifest under ml/data/raw/")
    ap.add_argument("--no-lightgbm", action="store_true", help="skip LightGBM candidate")
    ap.add_argument("--start", type=str, default="2010-01-01")
    ap.add_argument("--data-dir", type=str, default=None,
                    help="load versioned parquet dataset instead of fetching (e.g. data/raw/latest)")
    args = ap.parse_args()
    OUT_DIR.mkdir(parents=True, exist_ok=True)

    if args.data_dir and not args.synthetic:
        from pathlib import Path as _P
        ddir = _P(args.data_dir)
        if not ddir.is_absolute():
            ddir = ML_DIR.parent / ddir if (ML_DIR.parent / ddir).exists() else ML_DIR / ddir
        # Resolve 'latest' symlink relative to Backend/data/raw.
        if not ddir.exists():
            alt = ML_DIR.parent / "data" / "raw" / ddir.name
            if alt.exists():
                ddir = alt
        raw = {}
        for pq in sorted(ddir.glob("*.parquet")):
            df = pd.read_parquet(pq)
            df.index = pd.to_datetime(df.index if "date" not in df.columns else df.pop("date"))
            raw[pq.stem] = df.sort_index()
        print(f"[train] loaded {len(raw)} symbols from {ddir}")
    else:
        raw = fetch_ohlcv(args.symbols, start=args.start, synthetic=args.synthetic)
    if not raw:
        raise SystemExit("No data fetched — check network or --synthetic")
    data = build_all(raw, horizon=args.horizon)
    label_col = f"label_{args.horizon}d"
    data = data.dropna(subset=FEATURE_COLUMNS + [label_col])
    if data.empty:
        raise SystemExit("No labeled rows after feature build")
    print(f"[train] {len(data):,} labeled rows, {len(raw)} symbols, horizon={args.horizon}d")

    quality = dataset_quality(raw)
    if args.save_data and not args.synthetic:
        manifest = {
            "fetched_at": datetime.now(timezone.utc).isoformat(),
            "source": "yfinance",
            "auto_adjust": True,
            "start": args.start,
            "symbols": sorted(raw.keys()),
            "app_tickers": APP_TICKERS,
            "market_context": MARKET_CONTEXT_TICKERS,
            "horizon": args.horizon,
            "quality": quality,
        }
        out = save_dataset(raw, manifest)
        print(f"[train] dataset saved to {out}")
    else:
        n_missing = sum(v["missing_business_days"] for v in quality.values())
        print(f"[train] quality: {len(quality)} symbols, total missing business days={n_missing}")

    tr_df, va_df, te_df = split_by_date(data, label_col, args.horizon)
    print(f"[train] splits (embargo={args.horizon}d): train={len(tr_df):,} "
          f"val={len(va_df):,} test={len(te_df):,} (sealed)")
    if min(len(tr_df), len(va_df), len(te_df)) < 100:
        raise SystemExit("Splits too small after embargo — fetch more history")

    X_tr = tr_df[FEATURE_COLUMNS].to_numpy(dtype=float)
    y_tr_full = np.array([CLASS_TO_IDX[v] for v in tr_df[label_col]])
    X_va = va_df[FEATURE_COLUMNS].to_numpy(dtype=float)
    y_va_full = np.array([CLASS_TO_IDX[v] for v in va_df[label_col]])
    X_te = te_df[FEATURE_COLUMNS].to_numpy(dtype=float)
    y_te_full = np.array([CLASS_TO_IDX[v] for v in te_df[label_col]])

    # Classes NOT present in train are dropped from the learned mapping — the
    # model can only ever emit the labels it saw. All splits reindex identically.
    present = sorted(set(map(int, y_tr_full)))
    mapping = {old: new for new, old in enumerate(present)}
    learned_classes = [CLASSES[i] for i in present]
    mask_va = np.array([mapping.get(int(v)) is not None for v in y_va_full])
    mask_te = np.array([mapping.get(int(v)) is not None for v in y_te_full])
    y_tr = np.array([mapping[int(v)] for v in y_tr_full])
    y_va = np.array([mapping[int(v)] for v in y_va_full[mask_va]])
    y_te = np.array([mapping[int(v)] for v in y_te_full[mask_te]])
    X_va = X_va[mask_va]
    X_te = X_te[mask_te]
    va_df = va_df.iloc[mask_va].reset_index(drop=True)
    te_df = te_df.iloc[mask_te].reset_index(drop=True)

    # Baselines first — any candidate must beat these on VALIDATION, not test.
    print("[train] baselines (validation):")
    base = baselines(X_tr, y_tr, X_va, learned_classes, len(learned_classes))
    base_metrics = {}
    for name in ("majority", "always_UP", "uniform", "logistic"):
        base_metrics[name] = report(f"baseline/{name}", y_va, base[name], learned_classes)

    wf = walk_forward_scores(data, label_col, args.horizon)
    if wf:
        print(f"[train] walk-forward logistic mean acc={np.mean(wf):.3f}")

    from xgboost import XGBClassifier

    xgb = XGBClassifier(
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
    xgb.fit(X_tr, y_tr, eval_set=[(X_va, y_va)], verbose=False)
    xgb_va = xgb.predict_proba(X_va)
    xgb_va_m = report("val/xgboost", y_va, xgb_va, learned_classes)

    lgbm = None
    lgbm_va = None
    if not args.no_lightgbm:
        try:
            from lightgbm import LGBMClassifier

            lgbm = LGBMClassifier(
                n_estimators=300, max_depth=-1, learning_rate=0.05,
                subsample=0.8, colsample_bytree=0.8, n_jobs=-1, verbose=-1,
            )
            lgbm.fit(X_tr, y_tr, eval_set=[(X_va, y_va)])
            lgbm_va = lgbm.predict_proba(X_va)
            report("val/lightgbm", y_va, lgbm_va, learned_classes)
        except Exception as exc:
            print(f"[train] lightgbm skipped: {exc}")
            lgbm = None

    # Soft-voting ensemble using strictly out-of-fold (validation)
    # predictions — test set stays sealed until final reporting.
    # (Phase 1 serves single-estimator ONNX; sigmoid calibration via
    # CalibratedClassifierCV is deferred — val/test log loss already reports
    # calibration quality honestly.)
    va_probs = []
    weights = []
    members = [("xgb", xgb)] + ([("lgbm", lgbm)] if lgbm is not None else [])
    member_probs = {}
    for name, est in members:
        p = est.predict_proba(X_va)
        va_probs.append(p)
        member_probs[name] = p
        m = compute_metrics(y_va, p, learned_classes)
        weights.append(max(0.0, m["macro_f1"]))
        print(f"[train] member/{name}: macroF1={m['macro_f1']:.3f}")
    weights = np.array(weights, dtype=float)
    weights = weights / weights.sum() if weights.sum() > 0 else np.ones(len(weights)) / len(weights)
    ens_va = sum(w * p for w, p in zip(weights, va_probs))
    ens_va_m = report("val/ensemble-soft-vote", y_va, ens_va, learned_classes)

    # Stacking on validation probs (logistic meta-learner, OOF-only).
    from sklearn.linear_model import LogisticRegression

    stack_X_va = np.hstack(va_probs)
    stacker = LogisticRegression(max_iter=2000)
    stacker.fit(stack_X_va, y_va)
    stack_va = stacker.predict_proba(stack_X_va)
    stack_va_m = report("val/stacked", y_va, stack_va, learned_classes)
    ensemble_member_names = [n for n, _ in members]

    # Model selection on VALIDATION macro-F1 (never test-set tuning).
    candidates = {
        "xgboost": xgb_va_m["macro_f1"],
        "ensemble": ens_va_m["macro_f1"],
        "stacked": stack_va_m["macro_f1"],
        "logistic": base_metrics["logistic"]["macro_f1"],
    }
    if lgbm_va is not None:
        candidates["lightgbm"] = compute_metrics(y_va, lgbm_va, learned_classes)["macro_f1"]
    winner = max(candidates, key=candidates.get)
    print(f"[train] selection (val macro-F1): {candidates} -> winner={winner}")

    # Final sealed-test report for the winner + all candidates (no tuning here).
    def test_probs(kind: str):
        if kind == "xgboost":
            return xgb.predict_proba(X_te)
        if kind == "lightgbm":
            return lgbm.predict_proba(X_te)
        if kind == "logistic":
            return base["_models"]["logistic"].predict_proba(X_te)
        if kind == "ensemble":
            member_map = dict(members)
            ps = [member_map[n].predict_proba(X_te) for n in ensemble_member_names]
            return sum(w * p for w, p in zip(weights, ps))
        if kind == "stacked":
            member_map = dict(members)
            return stacker.predict_proba(np.hstack([member_map[n].predict_proba(X_te) for n in ensemble_member_names]))
        raise ValueError(kind)

    test_metrics = {}
    for kind in candidates:
        try:
            test_metrics[kind] = report(f"test/{kind}", y_te, test_probs(kind), learned_classes)
        except Exception as exc:
            print(f"[train] test/{kind} failed: {exc}")

    # Export the winner as ONNX when it is a single tree estimator; ensemble /
    # stack winners are evaluation-only in Phase 1 (their val win is recorded,
    # production serves the XGBoost backbone to avoid mislabeling a blend as a
    # single model — see meta.selection + meta.ensemble).
    import onnxmltools
    from onnxmltools.convert.common.data_types import FloatTensorType

    export_est = xgb
    export_kind = "xgboost"
    use_ensemble = False
    ensemble_meta = None
    if winner == "lightgbm" and lgbm is not None:
        export_est = lgbm
        export_kind = "lightgbm"
    elif winner in ("ensemble", "stacked"):
        use_ensemble = True
        ensemble_meta = {
            "members": [n for n, _ in members],
            "weights": [float(w) for w in weights],
            "kind": winner,
            "note": "Phase-1 production serves the XGBoost backbone; ensemble win recorded for next experiment (multi-ONNX blending)",
        }
        print(f"[train] winner={winner}: evaluation-only, exporting XGBoost backbone + {ensemble_meta}")

    initial = [("features", FloatTensorType([None, len(FEATURE_COLUMNS)]))]
    if export_kind == "lightgbm":
        # zipmap=False → dense probability tensor (onnxruntime-node cannot
        # consume ZipMap sequence/map outputs: "Non tensor type" error).
        onnx_model = onnxmltools.convert_lightgbm(
            export_est, initial_types=initial, target_opset=12, zipmap=False
        )
    else:
        onnx_model = onnxmltools.convert_xgboost(export_est, initial_types=initial)
    onnx_path = OUT_DIR / f"predictor-{args.horizon}d.onnx"
    with onnx_path.open("wb") as fh:
        fh.write(onnx_model.SerializeToString())
    # Versioned copy for rollback.
    stamp = datetime.now(timezone.utc).strftime("%Y%m%d-%H%M%S")
    versioned = OUT_DIR / f"predictor-{args.horizon}d-{stamp}.onnx"
    with versioned.open("wb") as fh:
        fh.write(onnx_model.SerializeToString())

    try:
        git_sha = subprocess.check_output(
            ["git", "rev-parse", "--short", "HEAD"], cwd=ML_DIR.parent
        ).decode().strip()
    except Exception:
        git_sha = None
    data_hash = hashlib.sha256(
        pd.util.hash_pandas_object(data[FEATURE_COLUMNS + [label_col, "date", "symbol"]]).values
    ).hexdigest()[:16]

    # Confidence-threshold coverage on sealed test (winner): selective vs all.
    winner_probs = test_probs(winner)
    coverage = {}
    for thr in (0.5, 0.6, 0.7, 0.8, 0.9):
        conf = winner_probs.max(axis=1)
        mask = conf >= thr
        cov = float(mask.mean()) if len(mask) else 0.0
        acc = float(((winner_probs.argmax(axis=1)[mask]) == y_te[mask]).mean()) if mask.any() else None
        coverage[str(thr)] = {"coverage": cov, "accuracy": acc, "n": int(mask.sum())}

    # Per-symbol sealed-test accuracy (winner).
    per_symbol = {}
    pred_te = winner_probs.argmax(axis=1)
    te_df = te_df.copy()
    te_df["_pred"] = pred_te
    te_df["_true"] = y_te
    for sym, g in te_df.groupby("symbol"):
        per_symbol[sym] = {
            "accuracy": float((g["_pred"] == g["_true"]).mean()) if len(g) else None,
            "n": int(len(g)),
        }

    meta = {
        "model_id": f"{export_kind}-onnx-{args.horizon}d",
        "exported_kind": export_kind,
        "horizon": args.horizon,
        "feature_columns": FEATURE_COLUMNS,
        "classes": learned_classes,
        "class_indices": present,
        "trained_at": datetime.now(timezone.utc).isoformat(),
        "git_sha": git_sha,
        "data_hash": data_hash,
        "data_start": args.start,
        "n_rows": int(len(data)),
        "n_symbols": len(raw),
        "symbols": sorted(raw.keys()),
        "app_tickers": APP_TICKERS,
        "market_context": MARKET_CONTEXT_TICKERS,
        "synthetic": args.synthetic,
        "selection": {"candidates_val_macro_f1": candidates, "winner": winner},
        "baselines_val": {k: {"accuracy": v["accuracy"], "macro_f1": v["macro_f1"]} for k, v in base_metrics.items()},
        "walk_forward_logistic": wf,
        "test": test_metrics,
        "coverage_test": coverage,
        "per_symbol_test": per_symbol,
        "ensemble": ensemble_meta,
        "metrics": test_metrics.get(winner, {}),
    }
    meta_path = OUT_DIR / f"predictor-{args.horizon}d.meta.json"
    meta_path.write_text(json.dumps(meta, indent=2))
    (OUT_DIR / f"predictor-{args.horizon}d-{stamp}.meta.json").write_text(json.dumps(meta, indent=2))
    print(f"[train] wrote {onnx_path}")
    print(f"[train] wrote {meta_path}")
    print(f"[train] versioned {versioned.name} (rollback: copy back to {onnx_path.name})")


if __name__ == "__main__":
    main()
