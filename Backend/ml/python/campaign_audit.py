"""Add exclusive supplemental evidence to a completed campaign, without fitting.

Run: .venv/bin/python -m ml.python.campaign_audit --run ml/campaign/<UTC-stamp>
"""
from __future__ import annotations

import argparse
import json
import os
import shutil
import subprocess
from datetime import datetime, timezone
from pathlib import Path

import numpy as np
import pandas as pd
from threadpoolctl import threadpool_limits

from .campaign import sha, write_json, metrics, session, block_ci, fingerprint
from .data import APP_TICKERS
from .evaluate import onnx_probs
from .features import FEATURE_COLUMNS
from .features_v2 import V2_COLUMNS
from .train import ML_DIR, CLASSES


def main():
    ap = argparse.ArgumentParser(description=__doc__)
    ap.add_argument('--run', required=True, type=Path)
    args = ap.parse_args()
    run = args.run.resolve()
    assert (run / 'FUTURE_LOCK.json').exists(), 'campaign must finish before supplemental audit'
    out = run / 'audit'
    out.mkdir()
    (out / 'audit_runner.py').write_bytes(Path(__file__).read_bytes())
    resume = json.loads((run / 'RESUME.json').read_text()) if (run / 'RESUME.json').exists() else None
    if resume:
        previous = Path(resume['source'])
        earliest = Path(resume.get('earliest_source', resume['source']))
        (out / 'original-context-ACCESS.json').write_bytes((earliest / 'context/ACCESS.json').read_bytes())
        replay_dir = run / 'context' if (run / 'context').exists() else previous / 'context'
        for path in (earliest / 'context').glob('*.parquet'):
            pd.testing.assert_frame_equal(pd.read_parquet(path), pd.read_parquet(replay_dir / path.name))
        first_lock = json.loads((earliest / 'PRE_REGISTRATION.json').read_text())['locked_at']
    else:
        first_lock = json.loads((run / 'PRE_REGISTRATION.json').read_text())['locked_at']
    completed = json.loads((run / 'FUTURE_LOCK.json').read_text())
    aggregate_wall_upper = (datetime.fromisoformat(completed['locked_at']) - datetime.fromisoformat(first_lock)).total_seconds()
    write_json(out / 'execution-history.json', {
        'first_attempt': {'command': '.venv/bin/python -u -m ml.python.campaign', 'exit_code': 1 if resume else 0,
                          'reason': 'Pandas mixed datetime units; before candidate fitting' if resume else 'completed'},
        'full_grid_resume': {'command': json.loads((previous / 'PRE_REGISTRATION.json').read_text())['command'] if resume else None,
                             'exit_code': 1 if resume and 'earliest_source' in resume else None,
                             'reason': 'User-authorized compute budget: explicit KeyboardInterrupt; h1/h2 complete, h3 interrupted'},
        'mixed_datetime_regression_red': {'command': '.venv/bin/python -m ml.python.test_campaign',
                                         'exit_code': 1 if resume else None},
        'completed_command': json.loads((run / 'PRE_REGISTRATION.json').read_text())['command'],
        'completed_exit_code': 0 if completed.get('campaign_complete', True) else 1,
        'completion_scope_wall_seconds': completed['elapsed_seconds'],
        'aggregate_wall_upper_bound_seconds_including_debugging': aggregate_wall_upper})
    verification = []
    commands = [
        ['.venv/bin/python', '-m', 'ml.python.test_campaign'],
        ['.venv/bin/python', '-m', 'ml.python.test_parity'],
        ['.venv/bin/python', '-m', 'ml.python.test_experiment'],
        ['node', 'ml/parityCheck.js'], ['node', 'ml/parityCheckV2.js'],
    ]
    with threadpool_limits(limits=1):
        for cmd in commands:
            cpu = min(os.sched_getaffinity(0))
            process = subprocess.run(cmd, text=True, capture_output=True, cwd=ML_DIR.parent, timeout=90,
                                     preexec_fn=lambda: os.sched_setaffinity(0, {cpu}),
                                     env={**os.environ, 'OMP_NUM_THREADS': '1', 'OPENBLAS_NUM_THREADS': '1', 'MKL_NUM_THREADS': '1'})
            verification.append({'command': ' '.join(cmd), 'exit_code': process.returncode,
                                 'stdout': process.stdout, 'stderr': process.stderr})
        write_json(out / 'verification.json', verification)
        assert all(v['exit_code'] == 0 for v in verification)
        integrity = {}
        for h in range(1, 6):
            if not (run / f'report-{h}d.json').exists():
                integrity[str(h)] = {'pass': False, 'status': 'incomplete: compute budget cap', 'canonical_reproduced': True}
                continue
            rep = json.loads((run / f'report-{h}d.json').read_text())
            data = pd.read_parquet(run / f'dataset-{h}d.parquet')
            oof = pd.read_parquet(run / f'oof-{h}d-selected_policy.parquet')
            assert len(rep['folds']) == 3 and (data.groupby('date').size() == 30).all()
            assert (oof.groupby('date').size() == 30).all() and set(oof.symbol) == set(APP_TICKERS)
            assert set(data.y) == {0, 1, 2} and not data.duplicated(['date', 'symbol']).any()
            assert rep['candidate_sha256'] == sha(run / f'candidate-{h}d.joblib')
            integrity[str(h)] = {'pass': True, 'panel_rows': len(data), 'oof_rows': len(oof), 'folds': 3}
        write_json(out / 'all-horizon-integrity.json', integrity)
        write_json(out / 'security-verification-status.json', {
            'semgrep_executable': shutil.which('semgrep'), 'codeql_executable': shutil.which('codeql'),
            'static_scanner_ran': False, 'security_verification_complete': False,
            'manual_scope': 'fixed public Yahoo GETs, bounded responses/timeouts, trusted-local artifacts, no DB/auth/runtime writes'})
        source = [p for p in (ML_DIR / 'python').glob('*.py')]
        source += [ML_DIR / p for p in ('features.js', 'featuresV2.js', 'predictor.js',
                    'trainedPredictor.js', 'trainedPredictorV2.js', 'modelRelease.js', 'sectorMap.js')]
        write_json(out / 'source-hashes.json', {str(p.relative_to(ML_DIR.parent)): sha(p) for p in source})
        reproduction = json.loads((run / 'canonical-reproduction.json').read_text())
        frame = pd.read_parquet(run / 'dataset-2d.parquet')
        selected = pd.read_parquet(run / 'oof-2d-selected_policy.parquet')
        frame = frame.merge(selected[['date', 'symbol']], on=['date', 'symbol'], validate='one_to_one')
        selected = selected.sort_values(['date', 'symbol']).reset_index(drop=True)
        frame = frame.sort_values(['date', 'symbol']).reset_index(drop=True)
        assert frame[['date', 'symbol']].equals(selected[['date', 'symbol']])
        comparison = {}
        models = [('canonical', ML_DIR / 'models/predictor-2d.onnx', FEATURE_COLUMNS)]
        models += [(str(p.parent.parent.name) + '_v2', p, V2_COLUMNS)
                   for p in sorted((ML_DIR / 'experiments').rglob('lgbm-v2-2d-experimental.onnx'))]
        for name, path, cols in models:
            p = onnx_probs(session(path), frame[cols].to_numpy(), CLASSES)
            p = p / p.sum(axis=1, keepdims=True)
            comparison[name] = {'artifact_sha256': sha(path),
                 'all_outer_dates_descriptive_contaminated': metrics(frame, p),
                 'warning': 'Frozen historical artifact can have trained on these earlier OOF dates; not honest OOF.'}
            # Last 200 common sessions occur after original canonical and V2 training.
            # Validation still reused; fixed common slice rather than selecting a favorable period.
            last_dates = sorted(frame.date.unique())[-200:]
            mask = frame.date.isin(last_dates).to_numpy()
            tail = frame[mask]
            comparison[name]['last_200_sessions_reused_validation'] = metrics(tail, p[mask])
            comparison[name]['per_symbol_last_200'] = {
                sym: metrics(tail[tail.symbol == sym], p[mask][(tail.symbol == sym).to_numpy()], False)
                for sym in APP_TICKERS}
            regimes = np.where(tail.reg_trend >= 0, 'trailing_bull', 'trailing_bear')
            comparison[name]['per_regime_last_200'] = {
                regime: metrics(tail[regimes == regime], p[mask][regimes == regime], False)
                for regime in sorted(set(regimes))}
            selected_p = selected[['p_down', 'p_neutral', 'p_up']].to_numpy()[mask]
            comparison[name]['selected_policy_same_200_sessions'] = metrics(tail, selected_p)
            difference = (selected_p.argmax(1) == tail.y).astype(float) - (p[mask].argmax(1) == tail.y).astype(float)
            comparison[name]['paired_selected_minus_frozen_ci95'] = block_ci(tail.date, difference)
            predictions = frame[['date', 'symbol', 'y']].copy()
            predictions[['p_down', 'p_neutral', 'p_up']] = p
            predictions.to_parquet(out / f'{name}-same-row-predictions.parquet', index=False)
        write_json(out / 'frozen-comparison-2d.json', comparison)
        data_quality = {}
        raw_dir = ML_DIR.parent / 'data/raw/latest'
        for path in sorted(raw_dir.glob('*.parquet')):
            bars = pd.read_parquet(path)
            if 'date' in bars:
                bars = bars.set_index('date')
            data_quality[path.stem] = {'rows': len(bars), 'first': str(bars.index.min()), 'last': str(bars.index.max()),
                'duplicate_dates': int(bars.index.duplicated().sum()), 'nulls': bars.isna().sum().to_dict(),
                'nonpositive_close': int((bars.close <= 0).sum()), 'negative_volume': int((bars.volume < 0).sum()),
                'large_abs_daily_returns_gt20pct': int((bars.close.pct_change().abs() > .2).sum()),
                'ohlc_order_violations': int(((bars.high < bars[['open', 'close']].max(axis=1)) |
                                            (bars.low > bars[['open', 'close']].min(axis=1))).sum())}
        write_json(out / 'data-quality.json', data_quality)
        # Descriptive feature diagnostics, not an extra round of model selection.
        import joblib
        artifact = joblib.load(run / 'candidate-2d.joblib')  # own freshly generated trusted artifact only
        feature_diagnostics = {}
        for name, model in artifact['members']:
            cols = artifact['columns'][name]
            fitted = model.steps[-1][1]
            if hasattr(fitted, 'feature_importances_'):
                values = fitted.feature_importances_
                meaning = 'split counts, training-only descriptive, not causal utility'
            else:
                values = np.abs(fitted.coef_).mean(axis=0)
                meaning = 'mean absolute standardized class coefficient, not causal utility'
            feature_diagnostics[name] = {'meaning': meaning, 'importance': dict(zip(cols, map(float, values)))}
        write_json(out / 'feature-diagnostics.json', feature_diagnostics)
        expected = json.loads((run / 'preserved-before.json').read_text())
        assert expected == fingerprint(), 'canonical/old experiments/datasets changed'
        write_json(out / 'preservation-verified.json', {'pass': True, 'files': len(expected),
                    'utc': datetime.now(timezone.utc).isoformat()})
    rows = ['# Supplemental campaign audit', '',
            'All checks below are historical validation; no independent 90% result.', '',
            '## Frozen models, matched last 200 validation sessions',
            '|Model|Accuracy|Balanced accuracy|Macro F1|Selected policy accuracy|Paired selected-minus-frozen CI|',
            '|---|---|---|---|---|---|']
    for name, obj in comparison.items():
        m = obj['last_200_sessions_reused_validation']
        rows.append(f"|{name}|{m['accuracy']:.4f}|{m['balanced_accuracy']:.4f}|{m['macro_f1']:.4f}|{obj['selected_policy_same_200_sessions']['accuracy']:.4f}|{obj['paired_selected_minus_frozen_ci95']}|")
    rows += ['', '## Verification', *[f"- `{v['command']}`: exit {v['exit_code']}" for v in verification], '',
             '- Static security scan NOT verified: neither semgrep nor codeql executable is installed. Manual review only; no complete security-verification claim.',
             '- No specialist delegation or independent reviewer (user explicitly forbids subagents). Self-review only.',
             '- Yahoo raw context quote basis can contain corporate-action discontinuities; dated OHLCV is not a PIT revision archive. Existing dataset manifests record retrieval, not certified as-of values.',
             '- See data-quality.json for duplicates/nulls/large-return/ordering audits, feature-diagnostics.json for descriptive importance and report-2d.json for held-out ablations.',
             '- All original artifact fingerprints match. Local serialization is trusted-only. No DB, credentials, deployment, model promotion, or UI was touched.',
             '- Frozen models on all outer dates are explicitly contaminated descriptive comparisons. The last-200 slice avoids their original training windows but remains previously accessed validation.']
    rows += ['- Deterministic baselines/heuristic use one-hot hard forecasts for ECE/Brier, not the app heuristic confidence value.',
             '- New context/liquidity/regime features are Python-only experimental inputs. Existing V1/V2 JS parity passes; new-family runtime JS parity/export is deliberately not claimed.',
             f'- Aggregate wall upper bound from first registration through final lock (includes debugging/packaging): {aggregate_wall_upper:.1f}s; completion-scope wall {completed["elapsed_seconds"]:.1f}s, NOT fit time.',
             '- First infrastructure failure and failing-then-passing datetime regression are recorded in execution-history.json; no failed attempt was removed.']
    if not completed.get('campaign_complete', True):
        rows += ['- Campaign partial: h1–4 new nested OOF complete; h5 new nested OOF interrupted by compute cap. Original canonical and previous validation comparisons cover all five horizons. No complete all-horizon optimization claim.']
    with (out / 'AUDIT.md').open('x') as fh:
        fh.write('\n'.join(rows) + '\n')
    write_json(out / 'HASHES.json', {str(p.relative_to(out)): sha(p) for p in sorted(out.rglob('*')) if p.is_file()})
    print(json.dumps({'audit': str(out / 'AUDIT.md'), 'sha256': sha(out / 'AUDIT.md'),
                      'comparison': {n: {'metrics': c['last_200_sessions_reused_validation'],
                                         'paired_ci': c['paired_selected_minus_frozen_ci95']}
                                     for n, c in comparison.items()}}, indent=2))


if __name__ == '__main__':
    main()
