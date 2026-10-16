"""Isolated, pre-registered CPU validation campaign; never modifies runtime models.

Run from Backend: .venv/bin/python -m ml.python.campaign
Rerun offline: --context-from <previous run>/context

Context-fetch network bounds do not cover the legacy data.py/yfinance or
import_stooq.py transports; those remain outside this safety scope.
"""
from __future__ import annotations

import os
for _key in ("OMP_NUM_THREADS", "OPENBLAS_NUM_THREADS", "MKL_NUM_THREADS", "NUMEXPR_NUM_THREADS"):
    os.environ[_key] = "1"

import argparse
import hashlib
import io
import json
import subprocess
import time
import urllib.request
from urllib.parse import urlsplit
from datetime import datetime, timezone
from pathlib import Path

import numpy as np
import pandas as pd
from sklearn.impute import SimpleImputer
from sklearn.linear_model import LogisticRegression
from sklearn.pipeline import make_pipeline
from sklearn.preprocessing import StandardScaler
from lightgbm import LGBMClassifier
from threadpoolctl import threadpool_limits

from .data import APP_TICKERS, build_all
from .evaluate import onnx_probs
from .experiment import load_raw, ece_score
from .features import FEATURE_COLUMNS, DEADBAND
from .features_v2 import V2_COLUMNS, build_dataset_v2
from .train import CLASSES, CLASS_TO_IDX, ML_DIR, split_by_date, compute_metrics

ROOT = ML_DIR / "campaign"
SEED = 7
MAX_CONTEXT_BYTES = 8_000_000


class ContextRedirectHandler(urllib.request.HTTPRedirectHandler):
    def redirect_request(self, req, fp, code, msg, headers, newurl):
        url = urlsplit(newurl)
        if (url.scheme != "https" or url.hostname not in {"query1.finance.yahoo.com", "query2.finance.yahoo.com"}
                or url.port not in (None, 443) or url.username is not None or url.password is not None):
            raise ValueError("Context redirect outside allowed public HTTPS hosts")
        return super().redirect_request(req, fp, code, msg, headers, newurl)


def _context_frame(payload, start, end, last):
    if len(payload) > MAX_CONTEXT_BYTES:
        raise ValueError("Context response exceeds 8 MB")
    result = json.loads(payload)["chart"]["result"][0]
    timestamps = result["timestamp"]
    if not isinstance(timestamps, list) or not timestamps:
        raise ValueError("Context timestamps must be a nonempty array")
    if len(timestamps) > (end - start) // 86400:
        raise ValueError("Too many context rows for daily requested range")
    if (any(type(t) is not int or not start <= t < end for t in timestamps)
            or any(a >= b for a, b in zip(timestamps, timestamps[1:]))):
        raise ValueError("Context timestamps must be ordered, unique and in range")
    quotes = result["indicators"]["quote"][0]
    columns = ["open", "high", "low", "close", "volume"]
    arrays = [quotes[column] for column in columns]
    if any(not isinstance(a, list) or len(a) != len(timestamps) for a in arrays):
        raise ValueError("Context OHLCV arrays must match timestamps")
    if any(type(v) not in (int, float) for a in arrays for v in a):
        raise ValueError("Context OHLCV must contain numeric values")
    values = np.array(arrays, dtype=float).T
    if (not np.isfinite(values).all() or (values[:, :4] <= 0).any() or (values[:, 4] < 0).any()
            or (values[:, 1] < values[:, [0, 2, 3]].max(axis=1)).any()
            or (values[:, 2] > values[:, [0, 1, 3]].min(axis=1)).any()):
        raise ValueError("Context OHLCV must be finite, positive, ordered with nonnegative volume")
    idx = pd.to_datetime(timestamps, unit="s", utc=True).tz_convert("America/New_York").tz_localize(None).normalize()
    if (not idx.is_unique or not idx.is_monotonic_increasing
            or (idx < pd.Timestamp(start, unit="s").normalize()).any() or (idx > pd.Timestamp(last)).any()):
        raise ValueError("Context session dates must be ordered, unique and in range")
    return pd.DataFrame(values, columns=columns, index=idx)


def sha(path):
    return hashlib.sha256(Path(path).read_bytes()).hexdigest()


def write_json(path, value):
    # Exclusive create: a rerun cannot silently rewrite evidence.
    with Path(path).open("x") as fh:
        json.dump(value, fh, indent=2, default=str, allow_nan=False)


def fingerprint():
    roots = [ML_DIR / "models", ML_DIR / "experiments", ML_DIR / "releases",
             ML_DIR.parent / "data" / "raw"]
    return {str(p.relative_to(ML_DIR.parent)): sha(p)
            for root in roots for p in sorted(root.rglob("*"))
            if p.is_file() and not p.is_symlink()}


def acquire_context(out, last, replay=None):
    out.mkdir()
    records, raw = [], {}
    opener = urllib.request.build_opener(ContextRedirectHandler())
    for sym in ("XLK", "XLF", "XLE", "^VIX"):
        if replay:
            path = Path(replay) / f"{sym}.parquet"
            if path.exists():
                raw[sym] = pd.read_parquet(path)
                raw[sym].to_parquet(out / path.name)
            records.append({"symbol": sym, "replayed_from": str(path),
                            "available": sym in raw})
            continue
        start = int(pd.Timestamp("2010-01-01", tz="UTC").timestamp())
        end = int((pd.Timestamp(last).tz_localize("UTC") + pd.Timedelta(days=1)).timestamp())
        url = f"https://query1.finance.yahoo.com/v8/finance/chart/{sym}?period1={start}&period2={end}&interval=1d"
        rec = {"symbol": sym, "url": url, "access_utc": datetime.now(timezone.utc).isoformat(),
               "availability": "daily close assumed known after NY close; revisions not PIT",
               "license": "public endpoint, not redistribution permission; local research only"}
        try:
            req = urllib.request.Request(url, headers={"User-Agent": "Mozilla/5.0"})
            with opener.open(req, timeout=12) as response:
                payload = response.read(MAX_CONTEXT_BYTES + 1)
                rec["http_status"] = response.status
            df = _context_frame(payload, start, end, last)
            (out / f"{sym}.response.json").write_bytes(payload)
            rec["response_sha256"] = hashlib.sha256(payload).hexdigest()
            df.to_parquet(out / f"{sym}.parquet")
            raw[sym] = df
            rec.update(rows=len(df), start=str(df.index.min()), end=str(df.index.max()),
                       price_basis="unadjusted Yahoo quote OHLC; no mixing with adjusted stock levels")
        except Exception as exc:
            rec["error"] = f"{type(exc).__name__}: {exc}"
        records.append(rec)
    write_json(out / "ACCESS.json", records)
    return raw


def past_join(source, dates):
    """Same-close-known data; backward only, no future fill, bounded stale age."""
    left = pd.DataFrame({"date": pd.to_datetime(dates)}).sort_values("date")
    right = source.rename_axis("available_date").reset_index().sort_values("available_date")
    left['date'] = left['date'].astype('datetime64[ns]')
    right['available_date'] = right['available_date'].astype('datetime64[ns]')
    joined = pd.merge_asof(left, right, left_on="date", right_on="available_date",
                           direction="backward", tolerance=pd.Timedelta(days=7))
    assert (joined.available_date.dropna() <= joined.loc[joined.available_date.notna(), "date"]).all()
    return joined.set_index("date").drop(columns="available_date")


def extra_features(raw):
    context = {}
    for sym in ("SPY", "QQQ", "DIA", "IWM", "XLK", "XLF", "XLE"):
        if sym in raw:
            c = raw[sym].close
            context[sym] = pd.DataFrame({f"ctx_{sym}_ret5": c.pct_change(5),
                                       f"ctx_{sym}_vol20": c.pct_change().rolling(20).std()})
    spy = raw["SPY"].close
    reg = pd.DataFrame({"reg_trend": spy / spy.rolling(60).mean() - 1,
                        "reg_vol": spy.pct_change().rolling(20).std()})
    returns = pd.concat({s: raw[s].close.pct_change() for s in APP_TICKERS}, axis=1)
    reg["reg_breadth"] = (returns > 0).sum(axis=1) / returns.notna().sum(axis=1)
    reg["reg_dispersion"] = returns.std(axis=1)
    if "^VIX" in raw:
        reg["reg_vix"] = raw["^VIX"].close
    frames = []
    for sym in APP_TICKERS:
        bars = raw[sym]
        c, v = bars.close, bars.volume
        turnover = c * v
        df = pd.DataFrame({"liq_log_turnover": np.log1p(turnover),
                           "liq_amihud20": (c.pct_change().abs() / turnover.replace(0, np.nan)).rolling(20).mean() * 1e9,
                           "liq_relvol5": v / v.shift(1).rolling(5).mean(),
                           "liq_volume_trend": v.rolling(5).mean() / v.shift(5).rolling(20).mean(),
                           "liq_signed_flow": (np.sign(c.pct_change()) * v).rolling(5).sum() / v.rolling(5).sum()}, index=bars.index)
        for block in [*context.values(), reg]:
            df = df.join(past_join(block, df.index))
        for etf in ("XLK", "XLF", "XLE"):
            if f"ctx_{etf}_ret5" in df:
                df[f"ctx_relative_{etf}"] = c.pct_change(5) - df[f"ctx_{etf}_ret5"]
        df = df.replace([np.inf, -np.inf], np.nan)
        for col in list(df):
            df[f"{col}_missing"] = df[col].isna().astype(float)
        frames.append(df.rename_axis("date").reset_index().assign(symbol=sym))
    return pd.concat(frames, ignore_index=True)


def temporal_split(dates, boundary, horizon):
    dates = list(dates)
    return dates[:max(0, boundary - horizon - 1)], dates[boundary:]


def metrics(frame, probabilities, ci=True):
    y = frame.y.to_numpy(dtype=int)
    p = np.asarray(probabilities, dtype=float)
    assert p.shape == (len(y), 3) and np.isfinite(p).all()
    assert np.allclose(p.sum(1), 1, atol=1e-4)
    m = compute_metrics(y, p, CLASSES)
    m.update(ece=ece_score(y, p), brier=float(np.mean(np.sum((p - np.eye(3)[y]) ** 2, axis=1))),
             coverage=1.0, label_proportions={c: float((y == i).mean()) for i, c in enumerate(CLASSES)})
    if ci:
        m["accuracy_ci95_date_block20"] = block_ci(frame.date, (p.argmax(1) == y).astype(float))
    return m


def block_ci(dates, values):
    daily = pd.DataFrame({"date": dates, "value": values}).groupby("date", sort=True).value.mean().to_numpy()
    n = len(daily)
    rng = np.random.default_rng(SEED)
    length = min(20, n)
    samples = []
    for _ in range(500):
        starts = rng.integers(0, n - length + 1, int(np.ceil(n / length)))
        indices = (starts[:, None] + np.arange(length)).ravel()[:n]
        samples.append(daily[indices].mean())
    return [float(x) for x in np.quantile(samples, [.025, .975])]


def estimator(kind):
    if kind.startswith("lr"):
        return make_pipeline(SimpleImputer(strategy="median", keep_empty_features=True),
                             StandardScaler(), LogisticRegression(C=float(kind[2:]), max_iter=400, random_state=SEED))
    return make_pipeline(SimpleImputer(strategy="median", keep_empty_features=True),
                         LGBMClassifier(n_estimators=80, num_leaves=int(kind[4:]), min_child_samples=100,
                                        learning_rate=.05, reg_lambda=5, n_jobs=1, verbosity=-1,
                                        random_state=SEED, deterministic=True, force_col_wise=True))


def fit_predict(train, test, cols, kind, shuffle=False):
    model = estimator(kind)
    y = train.y.to_numpy()
    if shuffle:
        y = np.random.default_rng(SEED).permutation(y)
    model.fit(train[cols].to_numpy(), y)
    return model, model.predict_proba(test[cols].to_numpy())


def session(model_path):
    import onnxruntime as ort
    opt = ort.SessionOptions()
    opt.intra_op_num_threads = opt.inter_op_num_threads = 1
    return ort.InferenceSession(str(model_path), sess_options=opt, providers=["CPUExecutionProvider"])


def canonical_reproduction(out, deadline):
    result = {}
    # Original train snapshots preceded refresh; attempt every snapshot until exact hash match.
    snapshots = sorted(p for p in (ML_DIR.parent / "data/raw").iterdir()
                       if p.is_dir() and not p.is_symlink() and p.name != "latest")
    for h in range(1, 6):
        meta = json.loads((ML_DIR / f"models/predictor-{h}d.meta.json").read_text())
        attempts = []
        matched = None
        # Most recent snapshot before training is the strongest provenance match.
        eligible = [p for p in snapshots if p.name.replace("-", "") <= meta["trained_at"][:19].replace("-", "").replace(":", "").replace("T", "")]
        for snap in reversed(eligible or snapshots):
            if time.monotonic() > deadline:
                raise TimeoutError("campaign budget exceeded during reproduction")
            raw = load_raw(str(snap))
            data = build_all(raw, h).dropna(subset=FEATURE_COLUMNS + [f"label_{h}d"])
            hash16 = hashlib.sha256(pd.util.hash_pandas_object(data[FEATURE_COLUMNS + [f"label_{h}d", "date", "symbol"]]).values).hexdigest()[:16]
            attempts.append({"snapshot": str(snap), "hash16": hash16, "rows": len(data)})
            if hash16 == meta["data_hash"]:
                matched = (snap, data)
                break
        if matched is None:
            snap, data = snap, data
        else:
            snap, data = matched
        tr, _, tail = split_by_date(data, f"label_{h}d", h)
        tail = tail.copy()
        tail["y"] = tail[f"label_{h}d"].map(CLASS_TO_IDX)
        p = onnx_probs(session(ML_DIR / f"models/predictor-{h}d.onnx"), tail[FEATURE_COLUMNS].to_numpy(), meta["classes"])
        p = p[:, [meta["classes"].index(c) for c in CLASSES]]
        app = tail.symbol.isin(APP_TICKERS).to_numpy()
        result[str(h)] = {"exact_dataset_hash_match": matched is not None, "attempts": attempts,
                          "metadata_accuracy": meta["test"][meta["exported_kind"]]["accuracy"],
                          "original_34_symbol_tail": metrics(tail, p),
                          "app_30_symbol_tail": metrics(tail[app], p[app]),
                          "onnx_sha256": sha(ML_DIR / f"models/predictor-{h}d.onnx"),
                          "snapshot": str(snap), "tail_start": str(tail.date.min()), "tail_end": str(tail.date.max())}
        print(f"[canonical h{h}] hash_match={matched is not None} acc={result[str(h)]['original_34_symbol_tail']['accuracy']:.6f}", flush=True)
    write_json(out / "canonical-reproduction.json", result)
    return result


def inventory(out):
    summaries = {}
    for p in sorted((ML_DIR / "experiments").rglob("*.json")):
        if p.name.startswith("report-") or p.name == "SUMMARY.json" or p.name.endswith(".meta.json"):
            obj = json.loads(p.read_text())
            summaries[str(p.relative_to(ML_DIR))] = {k: obj.get(k) for k in
                ("horizon", "mode", "selection_rank", "promotion", "holdout", "results", "oof", "horizons") if k in obj}
    write_json(out / "previous-work.json", summaries)
    write_json(out / "environment.json", {"utc": datetime.now(timezone.utc).isoformat(),
        "git_status": subprocess.check_output(["git", "status", "--short"], text=True),
        "python": subprocess.check_output([os.sys.executable, "--version"], text=True),
        "packages": subprocess.check_output([os.sys.executable, "-m", "pip", "freeze"], text=True)})


def heuristic(frame):
    # Literal existing pure JS function; no server/network/DB invocation.
    rows = [{"lastClose": 1, "sma5": 1 + r.sma5_rel, "sma20": 1 + r.sma20_rel,
             "emaTrendSlope": r.slope_norm, "slopeIntercept": r.intercept_norm,
             "slopeR2": r.slope_r2, "slopeWindowLength": 20, "roc10": r.roc10,
             "volatility": r.volatility, "rsi14": r.rsi14 * 100, "closes": []}
            for r in frame.itertuples()]
    code = "import {scoreFeatures} from './ml/predictor.js'; let s=''; for await(const c of process.stdin)s+=c; process.stdout.write(JSON.stringify(JSON.parse(s).map(r=>scoreFeatures(r).direction)))"
    labels = json.loads(subprocess.check_output(["node", "--input-type=module", "-e", code],
                        input=json.dumps(rows), text=True, cwd=ML_DIR.parent, timeout=90))
    return np.eye(3)[[CLASS_TO_IDX[v] for v in labels]]


def run_horizon(frame, h, groups, out, deadline, bounded_secondary=False):
    dates = sorted(frame.date.unique())
    chunks = np.array_split(dates, 4)
    grid = {f"{family}_{kind}": (cols, kind)
            for family, cols in groups.items() if family in ("v1", "v2", "full")
            for kind in ("lr0.1", "lr1", "tree7", "tree15")}
    for family, cols in groups.items():
        if family.startswith("drop_"):
            grid[f"{family}_tree7"] = (cols, "tree7")
    if bounded_secondary:
        grid = {n: v for n, v in grid.items()
                if n in ('v1_lr0.1', 'v2_tree7', 'full_tree7', 'full_tree15')}
    records, fold_log = {}, []
    for fold in range(3):
        if time.monotonic() > deadline:
            raise TimeoutError("campaign 900s compute limit reached")
        pre_dates = [d for chunk in chunks[:fold + 1] for d in chunk]
        tr_dates, _ = temporal_split(pre_dates + list(chunks[fold+1]), len(pre_dates), h)
        tr = frame[frame.date.isin(tr_dates)]
        te = frame[frame.date.isin(chunks[fold + 1])].copy()
        assert tr.label_end.max() < te.date.min()
        it, iv = temporal_split(tr_dates, int(len(tr_dates) * .8), h)
        inner, val = tr[tr.date.isin(it)], tr[tr.date.isin(iv)]
        assert inner.label_end.max() < val.date.min()
        scores, outer_probs = {}, {}
        for name, (cols, kind) in grid.items():
            if time.monotonic() > deadline:
                raise TimeoutError("campaign 900s compute limit reached")
            _, q = fit_predict(inner, val, cols, kind)
            scores[name] = metrics(val, q, ci=False)["macro_f1"]
            _, p = fit_predict(tr, te, cols, kind)
            outer_probs[name] = p
        # Fixed vote of complementary feature sets, no learned weights.
        qs = [fit_predict(inner, val, groups[f], "tree7")[1] for f in ("v2", "full")]
        scores["equal_vote"] = metrics(val, (qs[0] + qs[1]) / 2, ci=False)["macro_f1"]
        outer_probs["equal_vote"] = (outer_probs["v2_tree7"] + outer_probs["full_tree7"]) / 2
        winner = max(scores, key=scores.get)
        outer_probs["selected_policy"] = outer_probs[winner]
        majority = int(tr.y.value_counts().idxmax())
        outer_probs["majority"] = np.tile(np.eye(3)[majority], (len(te), 1))
        outer_probs["random_uniform_draw"] = np.eye(3)[np.random.default_rng(SEED+fold).integers(0, 3, len(te))]
        outer_probs["random_probability_forecast"] = np.full((len(te), 3), 1/3)
        outer_probs["shuffled_labels"] = fit_predict(tr, te, groups["full"], "tree7", shuffle=True)[1]
        outer_probs["heuristic"] = heuristic(te)
        fold_log.append({"fold": fold, "train_start": str(tr.date.min()), "train_end": str(tr.date.max()),
                         "label_end_max": str(tr.label_end.max()), "validation_start": str(te.date.min()),
                         "validation_end": str(te.date.max()), "winner_inner_only": winner,
                         "inner_scores": scores, "n_train": len(tr), "n_validation": len(te)})
        for name, p in outer_probs.items():
            block = te[["date", "symbol", "y", "reg_trend", "reg_vol"]].copy()
            block[["p_down", "p_neutral", "p_up"]] = p
            records.setdefault(name, []).append(block)
        print(f"[h{h} fold{fold}] selected={winner} accuracy={metrics(te, outer_probs['selected_policy'], False)['accuracy']:.4f}", flush=True)
    results = {}
    for name, blocks in records.items():
        f = pd.concat(blocks, ignore_index=True)
        p = f[["p_down", "p_neutral", "p_up"]].to_numpy()
        f["regime"] = np.where(f.reg_trend >= 0, "trailing_bull", "trailing_bear")
        f["vol_regime"] = np.where(f.reg_vol >= .015, "high_vol", "low_vol")
        m = metrics(f, p)
        m["per_symbol"] = {str(k): metrics(g, g[["p_down", "p_neutral", "p_up"]].to_numpy(), False) for k, g in f.groupby("symbol")}
        m["per_regime"] = {f"{column}:{k}": metrics(g, g[["p_down", "p_neutral", "p_up"]].to_numpy(), False)
                           for column in ("regime", "vol_regime") for k, g in f.groupby(column)}
        results[name] = m
        f.to_parquet(out / f"oof-{h}d-{name}.parquet", index=False)
    selected = pd.concat(records["selected_policy"], ignore_index=True)
    majority = pd.concat(records["majority"], ignore_index=True)
    cols = ["p_down", "p_neutral", "p_up"]
    delta = (selected[cols].to_numpy().argmax(1) == selected.y).astype(float) - (majority[cols].to_numpy().argmax(1) == majority.y).astype(float)
    ranking = sorted(results, key=lambda n: results[n]["macro_f1"], reverse=True)
    # Final inner-only selection; outer ranking does not choose the frozen artifact.
    it, iv = temporal_split(dates, int(len(dates) * .8), h)
    inner, val = frame[frame.date.isin(it)], frame[frame.date.isin(iv)]
    final_scores = {name: metrics(val, fit_predict(inner, val, c, k)[1], False)["macro_f1"] for name, (c, k) in grid.items()}
    vote = [fit_predict(inner, val, groups[f], "tree7")[1] for f in ("v2", "full")]
    final_scores["equal_vote"] = metrics(val, (vote[0] + vote[1])/2, False)["macro_f1"]
    choice = max(final_scores, key=final_scores.get)
    import joblib
    if choice == "equal_vote":
        members = [(f, fit_predict(frame, frame.iloc[:1], groups[f], "tree7")[0]) for f in ("v2", "full")]
    else:
        c, k = grid[choice]
        members = [(choice, fit_predict(frame, frame.iloc[:1], c, k)[0])]
    artifact = out / f"candidate-{h}d.joblib"
    joblib.dump({"members": members, "columns": groups if choice == "equal_vote" else {choice: grid[choice][0]},
                 "classes": CLASSES, "horizon": h, "experimental": True, "promoted": False}, artifact)
    rep = {"horizon": h, "status": "validation-only", "ranking_descriptive_not_selection": ranking,
           "metrics": results, "folds": fold_log, "final_inner_scores": final_scores,
           "locked_candidate": choice, "candidate_sha256": sha(artifact), "n_panel": len(frame),
           "n_dates": len(dates), "panel_start": str(min(dates)), "panel_end": str(max(dates)),
           "full_universe": sorted(frame.symbol.unique()), "paired_selected_minus_majority_ci95": block_ci(selected.date, delta),
           "promote": False, "independent_test": False}
    write_json(out / f"report-{h}d.json", rep)
    return rep


def main():
    ap = argparse.ArgumentParser(description=__doc__)
    ap.add_argument("--data-dir", default="data/raw/latest")
    ap.add_argument("--context-from", type=Path)
    ap.add_argument("--reproduction-from", type=Path,
                    help="reuse exact immutable canonical reproduction after infrastructure-only failure")
    args = ap.parse_args()
    start = time.monotonic()
    deadline = start + 900
    stamp = datetime.now(timezone.utc).strftime("%Y%m%dT%H%M%S%fZ")
    out = ROOT / stamp
    out.mkdir()
    (out / "PROTOCOL.md").write_bytes((ROOT / "PROTOCOL.md").read_bytes())
    (out / "runner.py").write_bytes(Path(__file__).read_bytes())
    write_json(out / "PRE_REGISTRATION.json", {"locked_at": datetime.now(timezone.utc).isoformat(),
        "protocol_sha256": sha(out / "PROTOCOL.md"), "runner_sha256": sha(out / "runner.py"),
        "command": os.sys.argv, "budget_seconds": 900})
    print(f"[campaign] exclusive evidence directory {out}", flush=True)
    before = fingerprint()
    write_json(out / "preserved-before.json", before)
    inventory(out)
    with threadpool_limits(limits=1):
        raw = load_raw(args.data_dir)
        assert set(APP_TICKERS) <= set(raw)
        last = min(df.index.max() for s, df in raw.items() if s in APP_TICKERS)
        new = acquire_context(out / "context", last, args.context_from)
        if args.reproduction_from:
            previous = args.reproduction_from.resolve()
            assert json.loads((previous / 'preserved-before.json').read_text()) == before
            canonical = json.loads((previous / 'canonical-reproduction.json').read_text())
            assert all(r['exact_dataset_hash_match'] for r in canonical.values())
            write_json(out / 'canonical-reproduction.json', canonical)
            write_json(out / 'RESUME.json', {'source': str(previous),
                       'canonical_reproduction_sha256': sha(previous / 'canonical-reproduction.json'),
                       'reason': 'Pandas 3 mixed datetime units failed feature as-of join before any candidate fit; normalized units, same protocol/grid'})
        else:
            canonical = canonical_reproduction(out, deadline)
        raw.update(new)
        base = build_dataset_v2(raw, 1)
        extra = extra_features(raw)
        # Real perturbation check: alter every future source after midpoint.
        cut = raw["SPY"].index[len(raw["SPY"])//2]
        changed = {s: df.copy() for s, df in raw.items()}
        for df in changed.values():
            df.loc[df.index > cut, ["open", "high", "low", "close"]] *= 1.7
            df.loc[df.index > cut, "volume"] *= 3
        altered_extra = extra_features(changed)
        pd.testing.assert_frame_equal(extra[extra.date <= cut].reset_index(drop=True), altered_extra[altered_extra.date <= cut].reset_index(drop=True))
        # V1/V2 causal rebuilding on truncated data checks all past rows, not a tautology.
        truncated = build_dataset_v2({s: df.loc[:cut] for s, df in raw.items()}, 1)
        reference = base.merge(truncated[["date", "symbol"]], on=["date", "symbol"])
        pd.testing.assert_frame_equal(reference[V2_COLUMNS].reset_index(drop=True), truncated[V2_COLUMNS].reset_index(drop=True))
        write_json(out / "leakage.json", {"future_perturbation": "PASS", "v1_v2_prefix_invariance": "PASS", "cut": str(cut),
                    "caveat": "Causality conditional on frozen downloaded bars; does not prove vendor PIT revision history"})
        all_data = base.merge(extra, on=["date", "symbol"], validate="one_to_one")
        new_cols = [c for c in extra if c not in ("date", "symbol")]
        groups = {"v1": FEATURE_COLUMNS, "v2": V2_COLUMNS, "full": V2_COLUMNS + new_cols}
        for name, prefix in (("context", "ctx_"), ("liquidity", "liq_"), ("regime", "reg_")):
            groups[f"drop_{name}"] = [c for c in groups["full"] if not c.startswith(prefix)]
        reports = {}
        for h in (2, 1, 3, 4, 5):
            frame = all_data.copy()
            frame["y"], frame["label_end"] = np.nan, pd.NaT
            for sym in APP_TICKERS:
                bars = raw[sym]
                mask = frame.symbol == sym
                fwd = bars.close.shift(-h) / bars.close - 1
                labels = pd.Series(np.where(fwd > DEADBAND, 2, np.where(fwd < -DEADBAND, 0, 1)), index=bars.index).where(fwd.notna())
                frame.loc[mask, "y"] = labels.reindex(frame.loc[mask, "date"]).to_numpy()
                end = pd.Series(bars.index, index=bars.index).shift(-h)
                frame.loc[mask, "label_end"] = end.reindex(frame.loc[mask, "date"]).to_numpy()
            counts = frame.dropna(subset=["y", "label_end"]).groupby("date").symbol.nunique()
            good_dates = counts[counts == len(APP_TICKERS)].index
            f = frame[frame.date.isin(good_dates)].sort_values(["date", "symbol"]).reset_index(drop=True)
            f.y = f.y.astype(int)
            assert (f.groupby("date").size() == 30).all() and not f.duplicated(["date", "symbol"]).any()
            f.to_parquet(out / f"dataset-{h}d.parquet", index=False)
            write_json(out / f"coverage-{h}d.json", {"rows_before_common_panel": len(frame), "rows_panel": len(f),
                       "excluded_rows": len(frame)-len(f), "missing_features": f[groups['full']].isna().sum().to_dict()})
            reports[str(h)] = run_horizon(f, h, groups, out, deadline)
        after = fingerprint()
        assert before == after, "existing artifacts changed during campaign"
        write_json(out / "preserved-after.json", after)
    lock = {"locked_at": datetime.now(timezone.utc).isoformat(), "promoted": False, "independent_accuracy_proven": False,
            "last_historical_session": str(last), "elapsed_seconds": time.monotonic()-start,
            "candidates": {h: {"name": r["locked_candidate"], "sha256": r["candidate_sha256"]} for h, r in reports.items()},
            "prospective_requirement": "All 30 predictions locked after this UTC timestamp, before execution; 252 new complete sessions, unchanged thresholds; lower block-CI bound >=.90; positive paired gains vs canonical/majority; no retuning"}
    write_json(out / "FUTURE_LOCK.json", lock)
    lines = ["# ML optimization evidence", "", "**90% independently proven target NOT achieved. No promotion.**", "",
             f"Run `{stamp}`; wall compute {lock['elapsed_seconds']:.1f}s; one CPU thread. Protocol was hashed before downloads/fits.", "",
             "## Primary two-session result (nested temporal validation only)"]
    primary = reports["2"]
    for name in ("selected_policy", "majority", "heuristic", "shuffled_labels"):
        m = primary["metrics"][name]
        lines.append(f"- {name}: accuracy {m['accuracy']:.4f}, balanced {m['balanced_accuracy']:.4f}, macro-F1 {m['macro_f1']:.4f}, ECE {m['ece']:.4f}, Brier {m['brier']:.4f}; 95% date-block CI {m['accuracy_ci95_date_block20']}; n={m['n']}, coverage=100%.")
    lines += [f"- Paired selected-minus-majority CI: {primary['paired_selected_minus_majority_ci95']}.",
              f"- Final inner-selected isolated candidate: `{primary['locked_candidate']}`, SHA256 `{primary['candidate_sha256']}`.", "",
              "## Canonical reproduction", "", "|Horizon|Exact dataset hash|34-symbol accuracy|30-app accuracy|", "|---|---|---|---|"]
    for h, r in canonical.items():
        lines.append(f"|{h}|{r['exact_dataset_hash_match']}|{r['original_34_symbol_tail']['accuracy']:.6f}|{r['app_30_symbol_tail']['accuracy']:.6f}|")
    lines += ["", "## Evidence index", "- `report-{1..5}d.json`: full ranking, nested decisions, calibration, recalls, symbol/regime slices and ablations.",
              "- `oof-*.parquet`: row-level predictions; `dataset-*.parquet`: common-panel features/labels; `coverage-*.json`: exclusions/missingness.",
              "- `canonical-reproduction.json`, `previous-work.json`, `environment.json`, `context/ACCESS.json`, `leakage.json`, preservation fingerprints, `FUTURE_LOCK.json`, `HASHES.json`.", "",
              "## Audit and limitations", "- All historical data are reused validation, including refreshed/newly downloaded OLD bars. Nested outer policy avoids direct fold selection but does not restore independence after prior campaigns.",
              "- Canonical original 34-symbol task includes ETFs; app-only results differ. Fixed canonical/V2 artifacts cannot be honest OOF when trained on earlier OOF years. Previous ensemble results are preserved in previous-work.json; Phase-1 stack selects on meta-training labels; Phase-1.5 reports validation overlap. Platt/stack previously collapsed to majority.",
              "- train.walk_forward_scores uses calendar-day test gaps without explicit training-label purge; campaign instead checks actual label-end dates and session embargo. evaluate.py majority is chosen using evaluation labels; campaign majority is training-only. Existing files unchanged.",
              "- Today's survivor universe, retrospectively adjusted stock bars, no delisting/constituent archives, no historical vendor revisions: corporate-action and survivor bias remain. OHLCV bar dates verified; original historical availability is assumed, not certified.",
              "- New context OHLC is unadjusted, with internal ETF returns only. Missing context uses train-only medians and missing indicators, not invented values. VIX is close-known, not intraday. No licensed timestamped news/fundamentals/filing archives: those families blocked, not fabricated.",
              "- Labels remain close-to-close; after-close information cannot be traded at that same close. No P&L or executable return claim. Raw classifier scores are not calibrated probabilities; ECE/Brier disclose this.",
              "- Common date panel excludes pre-full-universe history; all evaluated dates have exactly 30 symbols, no abstention. Slice diagnostics address symbol/regime disparities; no demographic data or demographic inference exists in this stock task.",
              "- Date-block bootstrap retains cross-symbol/date dependence but block length=20 is assumed; intervals conditional on reused validation and not selection-adjusted.",
              "- Candidate joblib is local trusted-only experimental serialization; never load untrusted pickles. No runtime/export/promotion changes. Full prospective gate in PROTOCOL.md and FUTURE_LOCK.json."]
    with (out / "REPORT.md").open("x") as fh:
        fh.write("\n".join(lines) + "\n")
    write_json(out / "HASHES.json", {str(p.relative_to(out)): sha(p) for p in sorted(out.rglob("*")) if p.is_file()})
    print(f"[campaign] FINISHED {out / 'REPORT.md'}", flush=True)


if __name__ == "__main__":
    main()
