"""Export the best Phase-1.5 experimental model + Node-verify fixture.

Refits v2_lgbm (h=2, frozen config, seed 7) on the experiment selection zone,
exports dense ONNX (zipmap=False — onnxruntime-node cannot consume ZipMap),
and writes fixture.json {feature_vector, expected_probs} for
ml/verifyExperimentV2.js. Also scores the CANONICAL Phase-1 bundle on the
identical holdout rows for a direct same-window comparison.

Writes ONLY under ml/experiments/<stamp>/onnx/ — canonical bundles untouched.

Usage:
    .venv/bin/python -m ml.python.export_v2 --report ml/experiments/<stamp>/report-2d.json
"""
from __future__ import annotations

import argparse
import json
from pathlib import Path

import numpy as np
import pandas as pd

from . import experiment as E
from .features_v2 import V2_COLUMNS, build_dataset_v2
from .train import CLASSES, compute_metrics


def main() -> None:
    ap = argparse.ArgumentParser(description=__doc__)
    ap.add_argument("--report", required=True)
    ap.add_argument("--data-dir", default="data/raw/latest")
    args = ap.parse_args()

    rep = json.loads(Path(args.report).read_text())
    horizon = rep["horizon"]
    label_col = f"label_{horizon}d"
    raw = E.load_raw(args.data_dir)
    v2 = build_dataset_v2(raw, horizon)
    dates = sorted(pd.to_datetime(v2["date"]).unique())
    sel_dates, hold_dates = E.selection_holdout_split(dates, horizon)
    sel = v2[pd.to_datetime(v2["date"]).isin(sel_dates)]
    hold = v2[pd.to_datetime(v2["date"]).isin(hold_dates)].reset_index(drop=True)
    Xtr, ytr = E.encode(sel, V2_COLUMNS, label_col, CLASSES)
    Xte, yte = E.encode(hold, V2_COLUMNS, label_col, CLASSES)

    est = E.make_estimators(3)["lgbm"].fit(Xtr, ytr)
    probs = est.predict_proba(Xte)
    m = compute_metrics(yte, probs, CLASSES)
    print(f"[export] v2_lgbm refit holdout acc={m['accuracy']:.4f} macroF1={m['macro_f1']:.4f}")

    # Direct same-window comparison: canonical Phase-1 bundle on identical rows.
    from .train import ML_DIR, OUT_DIR

    canon = OUT_DIR / f"predictor-{horizon}d.onnx"
    canon_m = None
    if canon.exists():
        import onnxruntime as ort

        sess = ort.InferenceSession(str(canon))
        meta = json.loads((OUT_DIR / f"predictor-{horizon}d.meta.json").read_text())
        n8 = len(meta["feature_columns"])
        X8 = hold[meta["feature_columns"]].to_numpy(dtype=np.float32)
        out = sess.run([o.name for o in sess.get_outputs()],
                       {sess.get_inputs()[0].name: X8})
        raw_p = out[1] if len(out) > 1 else out[0]
        if isinstance(raw_p, list):
            order = meta["classes"]
            cp = np.array([[d.get(c, 0.0) for c in order] for d in raw_p])
        else:
            cp = np.asarray(raw_p, dtype=float)
        # Remap canonical class order → CLASSES order for comparability.
        remap = [meta["classes"].index(c) if c in meta["classes"] else None for c in CLASSES]
        full = np.zeros((len(yte), len(CLASSES)))
        for new_i, old_i in enumerate(remap):
            if old_i is not None:
                full[:, new_i] = cp[:, old_i]
        canon_m = compute_metrics(yte, full, CLASSES)
        print(f"[export] canonical {meta['model_id']} same-window "
              f"acc={canon_m['accuracy']:.4f} macroF1={canon_m['macro_f1']:.4f}")

    import onnxmltools
    from onnxmltools.convert.common.data_types import FloatTensorType

    onx = onnxmltools.convert_lightgbm(
        est, initial_types=[("features", FloatTensorType([None, len(V2_COLUMNS)]))],
        target_opset=12, zipmap=False)
    out_dir = Path(args.report).parent / "onnx"
    out_dir.mkdir(parents=True, exist_ok=True)
    (out_dir / "lgbm-v2-2d-experimental.onnx").write_bytes(onx.SerializeToString())
    fx_row = int(len(Xte) // 2)
    (out_dir / "fixture.json").write_text(json.dumps({
        "feature_columns": V2_COLUMNS,
        "feature_vector": [float(x) for x in Xte[fx_row]],
        "expected_probs": [float(x) for x in probs[fx_row]],
        "expected_label": CLASSES[int(probs[fx_row].argmax())],
        "holdout_row": fx_row,
    }, indent=2))
    meta = {"model_id": "lgbm-v2-2d-experimental", "experimental": True,
            "horizon": horizon, "feature_columns": V2_COLUMNS, "classes": CLASSES,
            "seed": E.SEED, "data_dir": args.data_dir,
            "holdout": {"accuracy": m["accuracy"], "macro_f1": m["macro_f1"],
                        "balanced_accuracy": m["balanced_accuracy"],
                        "log_loss": m["log_loss"]},
            "canonical_same_window": canon_m,
            "note": "Experimental — NOT promoted (gain below bar). Canonical bundles untouched."}
    (out_dir / "lgbm-v2-2d-experimental.meta.json").write_text(json.dumps(meta, indent=2))
    print(f"[export] wrote {out_dir}")


if __name__ == "__main__":
    main()
