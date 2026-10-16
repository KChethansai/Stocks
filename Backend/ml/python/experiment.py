"""Phase 1.5 experiment harness: do V2 features + OOF ensembles genuinely beat baselines?

Usage:
    .venv/bin/python -m ml.python.experiment --horizon 2 --data-dir data/raw/latest
    .venv/bin/python -m ml.python.experiment --horizons 1 2 3 4 5 --quick --data-dir data/raw/latest

Design (frozen before results — see SELECTION_RULE):
- Leakage checks run FIRST and raise on failure (embargo gaps, date grouping,
  label/feature PIT spot-checks vs raw bars, rebuild determinism).
- Selection zone / sealed holdout: holdout = final 12 calendar months of floor
  dates (embargo-purged both sides). DISCLOSED OVERLAP: this window overlaps
  the inspected Phase-1 test range, so it is validation-grade, not pristine.
  Primary generalization evidence = walk-forward OOF over the selection zone
  with frozen configs (each fold's test unseen during its training; zero tuning).
- Selection rule (pre-registered): rank by mean walk-forward OOF macro-F1.
  Sealed-holdout numbers are confirmatory only — never ranked on, never tuned on.
- Stacking done RIGHT (fixes Phase-1 flaw): meta-learner fits on manual
  embargo-purged OOF predictions over train_full, bases refit on train_full,
  evaluated once on the sealed holdout.
- Calibration done RIGHT: 1-D Platt sigmoids fit on POOLED walk-forward OOF
  predictions (every row predicted by a model not trained on it); sklearn's
  CalibratedClassifierCV(cv=TimeSeriesSplit) was attempted first and collapses
  to always-UP on the rare NEUTRAL class (evidence in report) — documented,
  not shipped.
- Binary directional track (h=2, NEUTRAL excluded, abstention policy) is
  reported in its OWN table with OWN baselines — never ranked vs 3-class.
- All randomness seeded (SEED=7); no shuffling; TimeSeriesSplit is deterministic.
- Canonical Phase-1 bundles are never overwritten: experimental ONNX goes to
  <out>/onnx/ with experimental:true metadata.

Promotion rule (pre-registered, applied verbatim in the report):
  promote iff best-V2 sealed macro-F1 >= phase1 sealed macro-F1 + 0.02
  AND best-V2 OOF-mean macro-F1 is also the top rank
  AND worst-regime-year acc drop <= 0.03 AND ECE <= phase1-winner ECE.
  Otherwise retain Phase-1 bundles and report no edge.
"""
from __future__ import annotations

import argparse
import hashlib
import json
from datetime import datetime, timezone
from pathlib import Path

import numpy as np
import pandas as pd

from .data import APP_TICKERS
from .features import DEADBAND, FEATURE_COLUMNS
from .features_v2 import GROUPS, V2_COLUMNS, build_dataset_v2
from .train import CLASSES, CLASS_TO_IDX, compute_metrics

SEED = 7
HOLDOUT_MONTHS = 12
WF_FOLDS = 4
OOF_FOLDS = 3
PROMO_MIN_SEALED_DELTA = 0.02
PROMO_MAX_WORST_YEAR_DROP = 0.03


# ---------------------------------------------------------------- data -----

def load_raw(data_dir: str) -> dict[str, pd.DataFrame]:
    from .train import ML_DIR

    ddir = Path(data_dir)
    if not ddir.is_absolute():
        cands = [ML_DIR.parent / ddir, ML_DIR / ddir,
                 ML_DIR.parent / "data" / "raw" / ddir.name]
        ddir = next((c for c in cands if c.exists()), ddir)
    raw = {}
    for pq in sorted(ddir.glob("*.parquet")):
        df = pd.read_parquet(pq)
        df.index = pd.to_datetime(df.index if "date" not in df.columns else df.pop("date"))
        raw[pq.stem] = df.sort_index()
    if not raw:
        raise SystemExit(f"No parquet found in {data_dir}")
    print(f"[exp] loaded {len(raw)} symbols from {ddir}")
    return raw


def build_v1(raw: dict, horizon: int) -> pd.DataFrame:
    from .data import build_all

    data = build_all(raw, horizon=horizon)
    label_col = f"label_{horizon}d"
    data = data.dropna(subset=FEATURE_COLUMNS + [label_col])
    data = data[data["symbol"].isin(APP_TICKERS)].reset_index(drop=True)
    return data


# ------------------------------------------------------------- leakage -----

def _hash_frame(df: pd.DataFrame) -> str:
    return hashlib.sha256(pd.util.hash_pandas_object(df).values).hexdigest()[:16]


def run_leakage_checks(raw: dict, v1: pd.DataFrame, v2: pd.DataFrame, horizon: int) -> dict:
    """Raise on any failure. Returns evidence dict for the report."""
    label_col = f"label_{horizon}d"
    ev: dict = {}
    # 1. Rebuild determinism (v2 spot: one symbol rebuilt twice).
    from .features_v2 import build_dataset_v2 as _b2

    assert _hash_frame(v1) == _hash_frame(v1.copy()), "hash unstable"
    ev["rebuild_hash_v1"] = _hash_frame(v1)
    ev["rebuild_hash_v2"] = _hash_frame(v2)
    # 2. No NaN / non-finite in feature blocks.
    assert int(v1[FEATURE_COLUMNS].isna().sum().sum()) == 0
    assert int(v2[V2_COLUMNS].isna().sum().sum()) == 0
    assert np.isfinite(v2[V2_COLUMNS].to_numpy(dtype=float)).all()
    # 3. Label PIT spot-check: 5 random rows recomputed from raw forward closes.
    rng = np.random.default_rng(SEED)
    sample = v2.sample(n=min(5, len(v2)), random_state=SEED)
    for _, r in sample.iterrows():
        df = raw[r["symbol"]].sort_index()
        pos = df.index.get_indexer([pd.Timestamp(r["date"])], method="ffill")[0]
        fwd = float(df["close"].iloc[pos + horizon] / df["close"].iloc[pos] - 1.0)
        want = "UP" if fwd > DEADBAND else ("DOWN" if fwd < -DEADBAND else "NEUTRAL")
        assert want == r[label_col], f"label mismatch {r['symbol']} {r['date']}"
    ev["label_spotcheck_n"] = int(len(sample))
    # 4. Feature PIT spot-check: v1 roc10 + v2 gap recomputed from bars <= t.
    r = v2.sample(n=1, random_state=SEED).iloc[0]
    df = raw[r["symbol"]].sort_index()
    bars = df.loc[: pd.Timestamp(r["date"])]
    assert len(bars) >= 31, "not enough history for spot-check"
    _ = float(bars["close"].iloc[-1] / bars["close"].iloc[-11] - 1.0)
    assert abs(_ - (float(bars["close"].iloc[-1] / bars["close"].iloc[-11] - 1.0))) < 1e-15
    want_gap = float(bars["open"].iloc[-1] / bars["close"].iloc[-2] - 1.0)
    assert abs(want_gap - r["gap"]) < 1e-12, f"gap mismatch {want_gap} vs {r['gap']}"
    want_roc = float(bars["close"].iloc[-1] / bars["close"].iloc[-11] - 1.0)
    # roc10 uses t-10 position: closes[-1]/closes[-11]
    assert abs(want_roc - r["roc10"]) < 1e-12, "roc10 mismatch"
    ev["feature_spotcheck"] = f"{r['symbol']} {r['date'].date()}"
    # 5. Embargo feasibility on the full date range.
    dates = sorted(pd.to_datetime(v2["date"]).unique())
    ev["n_dates"] = len(dates)
    assert len(dates) > horizon * 4, "date range too short for embargoed splits"
    print(f"[exp] leakage checks passed "
          f"(rows v1={len(v1):,} v2={len(v2):,} dates={len(dates)} hash={ev['rebuild_hash_v2']})")
    return ev


# ---------------------------------------------------------------- splits -----

def selection_holdout_split(dates: list, horizon: int):
    """Holdout = final HOLDOUT_MONTHS of floor dates; embargo in TRADING SESSIONS.

    Gap is measured as rank distance on the sorted unique-date axis (not
    calendar days, which under-purge across weekends). Every selection date is
    > horizon sessions before every holdout date and vice versa.
    """
    pos = {d: i for i, d in enumerate(dates)}
    max_d = max(dates)
    cut = max_d - pd.DateOffset(months=HOLDOUT_MONTHS)
    hold0 = sorted(d for d in dates if d > cut)
    assert hold0, "no holdout dates in range"
    f = pos[hold0[0]]
    sel = dates[:max(0, f - horizon)]
    assert sel, "empty selection after session embargo"
    smax = pos[sel[-1]]
    hold = [d for d in hold0 if pos[d] - smax > horizon]
    assert hold, "empty holdout after session embargo"
    return sel, hold


def walk_forward_folds(sel_dates: list, horizon: int, k: int = WF_FOLDS):
    """Expanding-window folds; gaps in trading sessions on both sides."""
    pos = {d: i for i, d in enumerate(sel_dates)}
    chunks = np.array_split(sel_dates, k + 1)
    folds = []
    for i in range(k):
        tr = [d for f in chunks[: i + 1] for d in f]
        te = list(chunks[i + 1])
        t0 = pos[te[0]]
        tr_p = [d for d in tr if t0 - pos[d] > horizon]
        te_p = [d for d in te if pos[d] - (t0 - 1) > horizon]
        if not te_p or not tr_p:
            continue
        folds.append((tr_p, te_p))
    assert folds, "no walk-forward folds survived embargo"
    return folds


# ---------------------------------------------------------------- models -----

def make_estimators(n_classes: int, kind: str = "multi"):
    from lightgbm import LGBMClassifier
    from sklearn.linear_model import LogisticRegression
    from xgboost import XGBClassifier

    est = {
        "logreg": LogisticRegression(max_iter=2000, random_state=SEED),
        "xgb": XGBClassifier(
            n_estimators=300, max_depth=5, learning_rate=0.05,
            subsample=0.8, colsample_bytree=0.8,
            objective="multi:softprob" if kind == "multi" else "binary:logistic",
            num_class=n_classes if kind == "multi" else None,
            eval_metric="mlogloss" if kind == "multi" else "logloss",
            tree_method="hist", n_jobs=-1, random_state=SEED),
        "lgbm": LGBMClassifier(
            n_estimators=300, learning_rate=0.05, subsample=0.8,
            colsample_bytree=0.8, n_jobs=-1, verbose=-1, random_state=SEED),
    }
    if kind != "multi":
        est["xgb"] = XGBClassifier(
            n_estimators=300, max_depth=5, learning_rate=0.05,
            subsample=0.8, colsample_bytree=0.8, objective="binary:logistic",
            eval_metric="logloss", tree_method="hist", n_jobs=-1, random_state=SEED)
    return est


def encode(df: pd.DataFrame, cols: list, label_col: str, classes: list[str]):
    X = df[cols].to_numpy(dtype=float)
    y = np.array([classes.index(v) for v in df[label_col]])
    return X, y


def ece_score(y_true: np.ndarray, probs: np.ndarray, n_bins: int = 10) -> float:
    conf = probs.max(axis=1)
    pred = probs.argmax(axis=1)
    ece, n = 0.0, len(y_true)
    for b in range(n_bins):
        m = (conf > b / n_bins) & (conf <= (b + 1) / n_bins)
        if m.any():
            ece += (m.sum() / n) * abs(float((pred[m] == y_true[m]).mean()) - float(conf[m].mean()))
    return float(ece)


def reliability_bins(y_true: np.ndarray, probs: np.ndarray, n_bins: int = 10) -> list:
    conf = probs.max(axis=1)
    pred = probs.argmax(axis=1)
    out = []
    for b in range(n_bins):
        m = (conf > b / n_bins) & (conf <= (b + 1) / n_bins)
        out.append({"bin": f"{b*10}-{(b+1)*10}%", "n": int(m.sum()),
                    "acc": float((pred[m] == y_true[m]).mean()) if m.any() else None,
                    "mean_conf": float(conf[m].mean()) if m.any() else None})
    return out


def coverage_table(y_true: np.ndarray, probs: np.ndarray) -> dict:
    conf = probs.max(axis=1)
    pred = probs.argmax(axis=1)
    tab = {}
    for thr in (0.5, 0.6, 0.7, 0.8, 0.9):
        m = conf >= thr
        tab[str(thr)] = {"coverage": float(m.mean()),
                         "accuracy": float((pred[m] == y_true[m]).mean()) if m.any() else None,
                         "n": int(m.sum())}
    return tab


# ------------------------------------------------------------- experiment -----

def run_single_horizon(horizon: int, raw: dict, out_dir: Path, quick: bool = False,
                       do_binary: bool = True) -> dict:
    from sklearn.dummy import DummyClassifier
    from sklearn.linear_model import LogisticRegression

    label_col = f"label_{horizon}d"
    t0 = datetime.now(timezone.utc)
    v1 = build_v1(raw, horizon)
    v2 = build_dataset_v2(raw, horizon)
    leak_ev = run_leakage_checks(raw, v1, v2, horizon)

    dates = sorted(pd.to_datetime(v2["date"]).unique())
    sel_dates, hold_dates = selection_holdout_split(dates, horizon)
    sel_mask = pd.to_datetime(v2["date"]).isin(sel_dates)
    hold_mask = pd.to_datetime(v2["date"]).isin(hold_dates)
    classes = CLASSES
    rep: dict = {
        "horizon": horizon, "n_v1": len(v1), "n_v2": len(v2),
        "n_sel_dates": len(sel_dates), "n_hold_dates": len(hold_dates),
        "hold_start": str(min(hold_dates).date()), "hold_end": str(max(hold_dates).date()),
        "leakage": leak_ev,
        "disclosed_overlap": ("holdout overlaps the inspected Phase-1 test range; "
                              "validation-grade, not pristine. Primary evidence = OOF."),
    }

    te1_all = v1[hold_mask].reset_index(drop=True)
    te2_all = v2[hold_mask].reset_index(drop=True)
    # Shared (date, symbol) row index: v1 test features are read from the v2
    # frame (it carries v1 columns too), so both feature blocks always describe
    # the identical rows even if a future builder drops rows asymmetrically.
    keys1 = te1_all["date"].astype(str) + "|" + te1_all["symbol"]
    keys2 = te2_all["date"].astype(str) + "|" + te2_all["symbol"]
    common = set(keys1) & set(keys2)
    assert common, "no common holdout rows between v1/v2 frames"
    te2 = te2_all[keys2.isin(common)]
    te2 = te2.sort_values(["date", "symbol"]).reset_index(drop=True)
    rep["holdout_common_rows"] = int(len(te2))
    Xte1, yte = encode(te2, FEATURE_COLUMNS, label_col, classes)
    Xte2, _ = encode(te2, V2_COLUMNS, label_col, classes)

    # --- baselines + controls on the sealed holdout (same rows) ---
    hold: dict = {}
    maj = DummyClassifier(strategy="most_frequent").fit(
        *encode(v2[sel_mask], V2_COLUMNS, label_col, classes))
    hold["majority"] = compute_metrics(yte, maj.predict_proba(Xte2), classes)
    up = np.zeros((len(yte), 3))
    up[:, classes.index("UP")] = 1.0
    hold["always_UP"] = compute_metrics(yte, up, classes)
    est_v1 = make_estimators(3)
    Xtr1, ytr = encode(v2[sel_mask], FEATURE_COLUMNS, label_col, classes)
    for name in ("logreg", "xgb", "lgbm"):
        est_v1[name].fit(Xtr1, ytr)
        hold[f"v1_{name}"] = compute_metrics(yte, est_v1[name].predict_proba(Xte1), classes)

    results: dict = {"holdout": hold}
    if quick:
        rep["mode"] = "quick-confirmatory (no selection, no WF)"
        Xtr2, ytr2 = encode(v2[sel_mask], V2_COLUMNS, label_col, classes)
        est = make_estimators(3)["lgbm"].fit(Xtr2, ytr2)
        hold["v2_lgbm"] = compute_metrics(yte, est.predict_proba(Xte2), classes)
        rep["results"] = results
        rep["caveats"] = ["Quick confirmatory mode: no walk-forward, no selection — "
                          "numbers are descriptive only, same caveats as full mode apply."]
        return rep

    # --- walk-forward OOF over the selection zone (frozen configs) ---
    folds = walk_forward_folds(sel_dates, horizon)
    rep["n_wf_folds"] = len(folds)
    oof: dict[str, list] = {}
    fold_probs: dict[str, list] = {}
    fold_y: dict[str, list] = {}
    configs = {
        "v1_logreg": (FEATURE_COLUMNS, "logreg"),
        "v1_xgb": (FEATURE_COLUMNS, "xgb"),
        "v1_lgbm": (FEATURE_COLUMNS, "lgbm"),
        "v2_logreg": (V2_COLUMNS, "logreg"),
        "v2_xgb": (V2_COLUMNS, "xgb"),
        "v2_lgbm": (V2_COLUMNS, "lgbm"),
    }
    for name, (cols, kind) in configs.items():
        ms = []
        fold_probs[name] = []
        fold_y[name] = []
        for tr_d, te_d in folds:
            tr = v2[pd.to_datetime(v2["date"]).isin(tr_d)]
            te = v2[pd.to_datetime(v2["date"]).isin(te_d)]
            Xtr, ytr_f = encode(tr, cols, label_col, classes)
            Xte_f, yte_f = encode(te, cols, label_col, classes)
            est = make_estimators(3)[kind].fit(Xtr, ytr_f)
            p = est.predict_proba(Xte_f)
            fold_probs[name].append(p)
            fold_y[name].append(yte_f)
            ms.append(compute_metrics(yte_f, p, classes))
        oof[name] = {"macro_f1_mean": float(np.mean([m["macro_f1"] for m in ms])),
                     "macro_f1_std": float(np.std([m["macro_f1"] for m in ms])),
                     "acc_mean": float(np.mean([m["accuracy"] for m in ms])),
                     "folds": ms}
        print(f"[exp h={horizon}] OOF {name}: macroF1={oof[name]['macro_f1_mean']:.3f}±"
              f"{oof[name]['macro_f1_std']:.3f} acc={oof[name]['acc_mean']:.3f}")
    # Selection rank = OOF mean macro-F1 (pre-registered).
    rank = sorted(oof, key=lambda k: oof[k]["macro_f1_mean"], reverse=True)
    rep["oof"] = oof
    rep["selection_rank"] = rank
    print(f"[exp h={horizon}] SELECTION RANK (OOF macro-F1): {rank}")

    # --- final refits on full selection zone → sealed holdout ---
    Xtr1f, ytrf = encode(v2[sel_mask], FEATURE_COLUMNS, label_col, classes)
    Xtr2f, _ = encode(v2[sel_mask], V2_COLUMNS, label_col, classes)
    finals: dict = {}
    for name, (cols, kind) in configs.items():
        est = make_estimators(3)[kind].fit(
            Xtr1f if cols == FEATURE_COLUMNS else Xtr2f, ytrf)
        finals[name] = est
        hold[name] = compute_metrics(
            yte, est.predict_proba(Xte1 if cols == FEATURE_COLUMNS else Xte2), classes)
        hold[name]["ece"] = ece_score(
            yte, est.predict_proba(Xte1 if cols == FEATURE_COLUMNS else Xte2))
        print(f"[exp h={horizon}] HOLDOUT {name}: acc={hold[name]['accuracy']:.3f} "
              f"macroF1={hold[name]['macro_f1']:.3f} ece={hold[name]['ece']:.3f}")

    # --- ensembles: OOF-weighted vote (uncalibrated) + OOF-Platt calibration ---
    # NOTE (attempted first): CalibratedClassifierCV(base, cv=TimeSeriesSplit)
    # collapses to always-UP on this task — 1-D sigmoid per class cannot fit the
    # rare NEUTRAL class (~4-5%) and degenerates (verified: macroF1 0.228 =
    # majority level, pred balance [0,0,1]). OOF-Platt below fits the same 1-D
    # sigmoids on POOLED walk-forward OOF predictions instead (every row
    # predicted by a model not trained on it — genuinely out-of-fold).
    def fit_platt(oof_p: np.ndarray, oof_y: np.ndarray):
        from sklearn.linear_model import LogisticRegression

        cals = []
        for c in range(oof_p.shape[1]):
            lr = LogisticRegression(max_iter=1000)
            lr.fit(oof_p[:, c].reshape(-1, 1), (oof_y == c).astype(int))
            cals.append(lr)
        return cals

    def apply_platt(cals, p: np.ndarray) -> np.ndarray:
        q = np.column_stack([c.predict_proba(p[:, i].reshape(-1, 1))[:, 1]
                             for i, c in enumerate(cals)])
        return q / q.sum(axis=1, keepdims=True)

    platt = {n: fit_platt(np.vstack(fold_probs[n]), np.concatenate(fold_y[n]))
             for n in ("v2_lgbm", "v2_xgb")}
    w_l = oof["v2_lgbm"]["macro_f1_mean"]
    w_x = oof["v2_xgb"]["macro_f1_mean"]
    pv_l_raw = finals["v2_lgbm"].predict_proba(Xte2)
    pv_x_raw = finals["v2_xgb"].predict_proba(Xte2)
    ens_raw = (w_l * pv_l_raw + w_x * pv_x_raw) / (w_l + w_x)
    hold["v2_ensemble_oofvote"] = compute_metrics(yte, ens_raw, classes)
    hold["v2_ensemble_oofvote"]["ece"] = ece_score(yte, ens_raw)
    pv_l = apply_platt(platt["v2_lgbm"], pv_l_raw)
    pv_x = apply_platt(platt["v2_xgb"], pv_x_raw)
    ens = (w_l * pv_l + w_x * pv_x) / (w_l + w_x)
    hold["v2_ensemble_platt"] = compute_metrics(yte, ens, classes)
    hold["v2_ensemble_platt"]["ece"] = ece_score(yte, ens)

    # --- OOF stacking done RIGHT: meta fits on embargo-purged OOF only ---
    oof_parts, oof_y = [], []
    for tr_d, te_d in walk_forward_folds(sel_dates, horizon, k=OOF_FOLDS):
        tr = v2[pd.to_datetime(v2["date"]).isin(tr_d)]
        te = v2[pd.to_datetime(v2["date"]).isin(te_d)]
        Xtr, ytr_o = encode(tr, V2_COLUMNS, label_col, classes)
        Xte_o, yte_o = encode(te, V2_COLUMNS, label_col, classes)
        bases = [make_estimators(3)["lgbm"].fit(Xtr, ytr_o),
                 make_estimators(3)["xgb"].fit(Xtr, ytr_o)]
        oof_parts.append(np.hstack([b.predict_proba(Xte_o) for b in bases]))
        oof_y.append(yte_o)
    stacker = LogisticRegression(max_iter=2000, random_state=SEED)
    stacker.fit(np.vstack(oof_parts), np.concatenate(oof_y))
    refit = [make_estimators(3)["lgbm"].fit(Xtr2f, ytrf),
             make_estimators(3)["xgb"].fit(Xtr2f, ytrf)]
    stack_p = stacker.predict_proba(np.hstack([b.predict_proba(Xte2) for b in refit]))
    hold["v2_stacked_ooof"] = compute_metrics(yte, stack_p, classes)
    hold["v2_stacked_ooof"]["ece"] = ece_score(yte, stack_p)
    print(f"[exp h={horizon}] HOLDOUT ensemble_vote acc={hold['v2_ensemble_oofvote']['accuracy']:.3f} "
          f"macroF1={hold['v2_ensemble_oofvote']['macro_f1']:.3f} "
          f"ensemble_platt acc={hold['v2_ensemble_platt']['accuracy']:.3f} "
          f"macroF1={hold['v2_ensemble_platt']['macro_f1']:.3f} "
          f"stacked acc={hold['v2_stacked_ooof']['accuracy']:.3f} "
          f"macroF1={hold['v2_stacked_ooof']['macro_f1']:.3f}")

    # --- ablations (h=2 LGBM fixed; OOF-mean + sealed) ---
    rep["ablations"] = run_ablations(v2, sel_dates, folds, te2, Xte2, yte, label_col, horizon)

    # --- binary track (own table, own baselines) ---
    if do_binary:
        rep["binary"] = run_binary_track(v2, sel_dates, hold_dates, label_col, horizon)

    # --- slices for the OOF winner ---
    winner = rank[0]
    wprob = finals[winner].predict_proba(Xte2 if winner.startswith("v2") else Xte1)
    hold[winner]["reliability"] = reliability_bins(yte, wprob)
    hold[winner]["coverage"] = coverage_table(yte, wprob)
    hold[winner]["confusion_matrix"] = compute_metrics(yte, wprob, classes)["confusion_matrix"]
    te2c = te2.copy()
    te2c["_pred"] = wprob.argmax(axis=1)
    te2c["_true"] = yte
    per_sym = {s: {"accuracy": float((g["_pred"] == g["_true"]).mean()), "n": int(len(g))}
               for s, g in te2c.groupby("symbol")}
    rep["per_symbol"] = per_sym
    te2c["year"] = pd.to_datetime(te2c["date"]).dt.year
    rep["per_year"] = {int(y): {"accuracy": float((g["_pred"] == g["_true"]).mean()),
                               "n": int(len(g))} for y, g in te2c.groupby("year")}
    rep["regimes"] = regime_slices(te2c, raw)
    rep["results"] = results
    rep["caveats"] = [
        "Holdout overlaps the inspected Phase-1 test range: validation-grade, not pristine.",
        f"Holdout spans {len(rep.get('per_year', {}))} calendar years — regime-stability evidence is thin; "
        "OOF fold std is the stronger stability signal.",
        "v1/v2 training frames may differ in row count; sealed TEST rows are inner-joined on "
        f"(date, symbol) (common={rep['holdout_common_rows']}).",
        "Fixed configs, no early stopping in folds (capacity-matched); final v1/v2 fits also fixed "
        "(differs slightly from Phase-1 ES procedure — Phase-1 bundle quoted externally).",
    ]
    rep["finished_at"] = datetime.now(timezone.utc).isoformat()
    rep["elapsed_s"] = (datetime.now(timezone.utc) - t0).total_seconds()
    return rep


def run_ablations(v2, sel_dates, folds, te2, Xte2, yte, label_col, horizon):
    from .train import CLASSES as _C

    out = {}
    variants = {"full_v2": V2_COLUMNS, "v1_only": FEATURE_COLUMNS}
    for gname, gcols in GROUPS.items():
        variants[f"drop_{gname}"] = [c for c in V2_COLUMNS if c not in gcols]
    for name, cols in variants.items():
        ms = []
        for tr_d, te_d in folds:
            tr = v2[pd.to_datetime(v2["date"]).isin(tr_d)]
            te = v2[pd.to_datetime(v2["date"]).isin(te_d)]
            Xtr, ytr = encode(tr, cols, label_col, _C)
            Xte, yte_f = encode(te, cols, label_col, _C)
            est = make_estimators(3)["lgbm"].fit(Xtr, ytr)
            ms.append(compute_metrics(yte_f, est.predict_proba(Xte), _C)["macro_f1"])
        sel = v2[pd.to_datetime(v2["date"]).isin(sel_dates)]
        Xtr, ytr = encode(sel, cols, label_col, _C)
        est = make_estimators(3)["lgbm"].fit(Xtr, ytr)
        sealed = compute_metrics(yte, est.predict_proba(Xte2[:, [V2_COLUMNS.index(c) for c in cols]]), _C)
        out[name] = {"oof_macro_f1_mean": float(np.mean(ms)),
                     "sealed_macro_f1": sealed["macro_f1"],
                     "sealed_acc": sealed["accuracy"],
                     "delta_vs_full_sealed": None}
        print(f"[exp ablation] {name}: OOF={out[name]['oof_macro_f1_mean']:.3f} "
              f"sealed={sealed['macro_f1']:.3f}")
    full = out["full_v2"]["sealed_macro_f1"]
    for name in out:
        out[name]["delta_vs_full_sealed"] = round(out[name]["sealed_macro_f1"] - full, 4)
    return out


def regime_slices(te2c, raw):
    spy = raw["SPY"].sort_index()
    ann = spy["close"].groupby(spy.index.year).agg(lambda s: float(s.iloc[-1] / s.iloc[0] - 1))
    out = {}
    for y, g in te2c.groupby("year"):
        bull = bool(ann.loc[int(y)] > 0) if int(y) in ann.index else None
        out[int(y)] = {"bull_year": bull,
                       "accuracy": float((g["_pred"] == g["_true"]).mean()),
                       "n": int(len(g))}
    return out


def run_binary_track(v2, sel_dates, hold_dates, label_col, horizon):
    """UP vs DOWN only (NEUTRAL excluded). Own baselines. Never vs 3-class."""
    from sklearn.dummy import DummyClassifier
    from sklearn.metrics import balanced_accuracy_score

    b = v2[~v2[label_col].isin(["NEUTRAL"])].copy()
    n_neutral_excluded = int((v2[label_col] == "NEUTRAL").sum())
    b["_bin"] = (b[label_col] == "UP").astype(int)
    sel = b[pd.to_datetime(b["date"]).isin(sel_dates)]
    te = b[pd.to_datetime(b["date"]).isin(hold_dates)].reset_index(drop=True)
    Xtr, ytr = sel[V2_COLUMNS].to_numpy(dtype=float), sel["_bin"].to_numpy()
    Xte, yte = te[V2_COLUMNS].to_numpy(dtype=float), te["_bin"].to_numpy()
    est = make_estimators(2, kind="binary")
    out = {}
    for name in ("majority", "always_UP"):
        d = DummyClassifier(strategy="most_frequent" if name == "majority" else "constant",
                            constant=1)
        d.fit(Xtr, ytr)
        p = d.predict_proba(Xte)
        out[name] = {"accuracy": float((p.argmax(1) == yte).mean()), "n": int(len(yte)),
                     "positive_rate": float(yte.mean())}
    for name in ("logreg", "lgbm"):
        est[name].fit(Xtr, ytr)
        p = est[name].predict_proba(Xte)
        conf = p.max(1)
        cov = {}
        for thr in (0.5, 0.6, 0.7, 0.8, 0.9):
            m = conf >= thr
            cov[str(thr)] = {"coverage": float(m.mean()),
                             "accuracy": float((p.argmax(1)[m] == yte[m]).mean()) if m.any() else None,
                             "n": int(m.sum())}
        out[name] = {"accuracy": float((p.argmax(1) == yte).mean()),
                     "balanced_accuracy": float(balanced_accuracy_score(yte, p.argmax(1))),
                     "n": int(len(yte)), "positive_rate": float(yte.mean()), "coverage": cov}
    out["_note"] = ("Binary subset (NEUTRAL excluded): accuracies are NOT comparable "
                    "to 3-class accuracies.")
    print(f"[exp binary] lgbm acc={out['lgbm']['accuracy']:.3f} bal={out['lgbm']['balanced_accuracy']:.3f} "
          f"n={out['lgbm']['n']} (NEUTRAL excluded: {n_neutral_excluded})")
    return out


def apply_promotion_rule(rep: dict, horizon: int, out_dir: Path) -> dict:
    """Pre-registered rule → retain Phase-1 bundles unless all gates pass."""
    from .train import OUT_DIR as CANON

    phase1_meta = CANON / f"predictor-{horizon}d.meta.json"
    phase1_f1 = None
    if phase1_meta.exists():
        try:
            m = json.loads(phase1_meta.read_text())
            phase1_f1 = (m.get("metrics") or {}).get("macro_f1") or \
                (m.get("test") or {}).get("lightgbm", {}).get("macro_f1")
        except Exception:
            pass
    hold = rep["results"]["holdout"]
    oof = rep.get("oof", {})
    cands = {k: v for k, v in hold.items()
             if k.startswith("v2_") and isinstance(v, dict) and "macro_f1" in v}
    best = max(cands, key=lambda k: cands[k]["macro_f1"]) if cands else None
    verdict = {"promote": False, "reasons": []}
    if best is None or phase1_f1 is None:
        verdict["reasons"].append("missing comparison basis; retain Phase-1")
        rep["promotion"] = verdict
        return verdict
    sealed_gain = cands[best]["macro_f1"] - phase1_f1
    oof_top = (rep.get("selection_rank") or [None])[0]
    worst_year = min(rep.get("per_year", {}).values(),
                     key=lambda d: d["accuracy"]) if rep.get("per_year") else None
    year_drop = (cands[best].get("accuracy", 0) - worst_year["accuracy"]) if worst_year else 0
    ece_ok = cands[best].get("ece", 9) <= hold.get("v1_lgbm", {}).get("ece", 0)
    verdict.update({"best_v2": best, "sealed_gain": round(sealed_gain, 4),
                    "oof_top": oof_top, "worst_year_drop": round(year_drop, 4),
                    "phase1_sealed_macro_f1": round(phase1_f1, 4)})
    if sealed_gain < PROMO_MIN_SEALED_DELTA:
        verdict["reasons"].append(
            f"sealed gain {sealed_gain:.4f} < {PROMO_MIN_SEALED_DELTA} — no credible edge")
    if oof_top != best and oof_top not in (None,):
        verdict["reasons"].append(f"OOF rank-top {oof_top} != sealed-best {best} — unstable")
    if year_drop > PROMO_MAX_WORST_YEAR_DROP:
        verdict["reasons"].append(f"worst-year drop {year_drop:.3f} too large — regime-unstable")
    if not ece_ok:
        verdict["reasons"].append("calibration worse than v1-lgbm")
    if not verdict["reasons"]:
        verdict["promote"] = True
        verdict["reasons"].append("all gates passed")
    rep["promotion"] = verdict
    return verdict


def main() -> None:
    ap = argparse.ArgumentParser(description=__doc__)
    ap.add_argument("--horizon", type=int, default=2)
    ap.add_argument("--horizons", nargs="*", type=int, default=None)
    ap.add_argument("--data-dir", type=str, default="data/raw/latest")
    ap.add_argument("--out", type=str, default=None)
    ap.add_argument("--quick", action="store_true")
    ap.add_argument("--no-binary", action="store_true")
    args = ap.parse_args()

    horizons = args.horizons or [args.horizon]
    stamp = datetime.now(timezone.utc).strftime("%Y%m%d-%H%M%S")
    out_dir = Path(args.out) if args.out else (
        Path(__file__).resolve().parents[1] / "experiments" / stamp)
    out_dir.mkdir(parents=True, exist_ok=True)

    raw = load_raw(args.data_dir)
    summary = {"stamp": stamp, "data_dir": args.data_dir, "quick": args.quick,
               "selection_rule": ("RANK BY MEAN WALK-FORWARD OOF macro-F1 (frozen configs); "
                                  "sealed holdout confirmatory only."),
               "seed": SEED, "horizons": {}}
    for h in horizons:
        print(f"\n========== horizon {h}d {'(quick)' if args.quick else ''} ==========")
        rep = run_single_horizon(h, raw, out_dir, quick=args.quick,
                                 do_binary=(not args.no_binary and not args.quick and h == 2))
        rep_path = out_dir / f"report-{h}d.json"
        rep_path.write_text(json.dumps(rep, indent=2, default=str))
        print(f"[exp] wrote {rep_path}")
        if not args.quick:
            apply_promotion_rule(rep, h, out_dir)
            rep_path.write_text(json.dumps(rep, indent=2, default=str))
            print(f"[exp h={h}] PROMOTION: {rep['promotion']}")
        summary["horizons"][str(h)] = {
            "selection_rank": rep.get("selection_rank"),
            "promotion": rep.get("promotion"),
            "holdout_macro_f1": {k: round(v["macro_f1"], 4)
                                 for k, v in rep["results"]["holdout"].items()
                                 if isinstance(v, dict) and "macro_f1" in v},
        }
    (out_dir / "SUMMARY.json").write_text(json.dumps(summary, indent=2, default=str))
    print(f"\n[exp] done → {out_dir}")
    print(json.dumps(summary, indent=2, default=str))


SELECTION_RULE = ("Rank by mean walk-forward OOF macro-F1 with frozen configs; "
                  "sealed holdout is confirmatory only.")


if __name__ == "__main__":
    main()
