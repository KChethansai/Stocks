"""H5-only continuation with process-enforced five-minute total budget.

From Backend: .venv/bin/python -u -m ml.python.campaign_h5
"""
import os
for key in ('OMP_NUM_THREADS', 'OPENBLAS_NUM_THREADS', 'MKL_NUM_THREADS', 'NUMEXPR_NUM_THREADS'):
    os.environ[key] = '1'

import argparse
import json
import signal
import subprocess
import sys
import time
PROCESS_STARTED = time.monotonic()
from datetime import datetime, timezone
from pathlib import Path

import numpy as np
import pandas as pd
from threadpoolctl import threadpool_limits

from .campaign import (ROOT, ML_DIR, sha, write_json, fingerprint, run_horizon,
                       temporal_split, fit_predict, metrics, heuristic)
from .features import FEATURE_COLUMNS
from .features_v2 import V2_COLUMNS
from .train import CLASSES

PREVIOUS = ROOT / '20261010T035850459829Z'


def fallback(frame, out):
    """Fixed regularized comparator; explicitly NOT nested model selection."""
    chunks = np.array_split(sorted(frame.date.unique()), 4)
    records = {n: [] for n in ('v1_lr0.1', 'majority', 'heuristic')}
    folds = []
    for fold in range(3):
        pre = [d for chunk in chunks[:fold+1] for d in chunk]
        dates, _ = temporal_split(pre + list(chunks[fold+1]), len(pre), 5)
        tr, te = frame[frame.date.isin(dates)], frame[frame.date.isin(chunks[fold+1])]
        assert tr.label_end.max() < te.date.min()
        p = fit_predict(tr, te, FEATURE_COLUMNS, 'lr0.1')[1]
        probabilities = {'v1_lr0.1': p,
                         'majority': np.tile(np.eye(3)[int(tr.y.value_counts().idxmax())], (len(te), 1)),
                         'heuristic': heuristic(te)}
        folds.append({'fold': fold, 'train_end': str(tr.date.max()),
                      'label_end_max': str(tr.label_end.max()), 'validation_start': str(te.date.min())})
        for name, q in probabilities.items():
            block = te[['date', 'symbol', 'y']].copy()
            block[['p_down', 'p_neutral', 'p_up']] = q
            records[name].append(block)
    results = {}
    for name, blocks in records.items():
        data = pd.concat(blocks, ignore_index=True)
        results[name] = metrics(data, data[['p_down', 'p_neutral', 'p_up']].to_numpy())
        data.to_parquet(out / f'oof-5d-{name}.parquet', index=False)
    import joblib
    model = fit_predict(frame, frame.iloc[:1], FEATURE_COLUMNS, 'lr0.1')[0]
    artifact = out / 'candidate-5d.joblib'
    joblib.dump({'members': [('v1_lr0.1', model)], 'columns': {'v1_lr0.1': FEATURE_COLUMNS},
                 'classes': CLASSES, 'experimental': True, 'promoted': False, 'horizon': 5}, artifact)
    rep = {'horizon': 5, 'status': 'REDUCED/NON-NESTED validation-only',
           'ranking_descriptive_not_selection': sorted(results, key=lambda n: results[n]['macro_f1'], reverse=True),
           'metrics': results, 'folds': folds, 'locked_candidate': 'v1_lr0.1',
           'candidate_sha256': sha(artifact), 'promote': False, 'independent_test': False}
    write_json(out / 'report-5d.json', rep)


def compute_only(out, mode):
    frame = pd.read_parquet(PREVIOUS / 'dataset-5d.parquet')
    assert (frame.groupby('date').size() == 30).all() and set(frame.y) == {0, 1, 2}
    with threadpool_limits(limits=1):
        if mode == 'nested':
            new = [c for c in frame if c.startswith(('ctx_', 'reg_', 'liq_'))]
            groups = {'v1': FEATURE_COLUMNS, 'v2': V2_COLUMNS, 'full': V2_COLUMNS + new}
            run_horizon(frame, 5, groups, out, float('inf'), bounded_secondary=True)
        else:
            fallback(frame, out)


def bounded_command(command, timeout, log_dir, name):
    started = time.monotonic()
    cpu = min(os.sched_getaffinity(0))
    process = subprocess.Popen(command, cwd=ML_DIR.parent, stdout=subprocess.PIPE, stderr=subprocess.PIPE,
                               text=True, start_new_session=True,
                               preexec_fn=lambda: os.sched_setaffinity(0, {cpu}))
    timed_out = False
    try:
        stdout, stderr = process.communicate(timeout=max(.01, timeout))
    except subprocess.TimeoutExpired:
        timed_out = True
        os.killpg(process.pid, signal.SIGKILL)
        stdout, stderr = process.communicate()
    (log_dir / f'{name}.stdout.txt').write_text(stdout)
    (log_dir / f'{name}.stderr.txt').write_text(stderr)
    return {'command': command, 'exit_code': process.returncode, 'timed_out': timed_out,
            'elapsed_seconds': time.monotonic()-started}


def main():
    ap = argparse.ArgumentParser(description=__doc__)
    ap.add_argument('--compute-only', type=Path)
    ap.add_argument('--mode', choices=('nested', 'fallback'), default='nested')
    args = ap.parse_args()
    if args.compute_only:
        compute_only(args.compute_only, args.mode)
        return
    started = PROCESS_STARTED
    deadline = started + 300
    stamp = datetime.now(timezone.utc).strftime('%Y%m%dT%H%M%S%fZ')
    out = ROOT / stamp
    out.mkdir()
    logs = out / 'logs'
    logs.mkdir()
    (out / 'PROTOCOL.md').write_bytes((ROOT / 'H5_COMPLETION_PROTOCOL.md').read_bytes())
    (out / 'runner.py').write_bytes(Path(__file__).read_bytes())
    (out / 'campaign_library.py').write_bytes((ML_DIR / 'python/campaign.py').read_bytes())
    prior = [ROOT / s for s in ('20261010T034035138231Z', '20261010T034424551670Z', PREVIOUS.name)]
    preserved = {str(p.relative_to(ML_DIR.parent)): sha(p) for d in prior for p in d.rglob('*') if p.is_file()}
    canon = fingerprint()
    write_json(out / 'PRE_REGISTRATION.json', {'utc': datetime.now(timezone.utc).isoformat(),
        'protocol_sha256': sha(out / 'PROTOCOL.md'), 'hard_budget_seconds': 300,
        'dataset_sha256': sha(PREVIOUS / 'dataset-5d.parquet'), 'only_horizon': 5,
        'command': [sys.executable, '-u', '-m', 'ml.python.campaign_h5']})
    print(f'[h5] continuation {out}', flush=True)
    executions = []
    attempt = out / 'nested'
    attempt.mkdir()
    cmd = [sys.executable, '-u', '-m', 'ml.python.campaign_h5', '--compute-only', str(attempt), '--mode', 'nested']
    executions.append(bounded_command(cmd, deadline-time.monotonic()-35, logs, 'nested'))
    chosen = attempt
    if executions[-1]['exit_code'] != 0:
        chosen = out / 'fallback'
        chosen.mkdir()
        cmd = [sys.executable, '-u', '-m', 'ml.python.campaign_h5', '--compute-only', str(chosen), '--mode', 'fallback']
        executions.append(bounded_command(cmd, deadline-time.monotonic()-10, logs, 'fallback'))
    assert executions[-1]['exit_code'] == 0, 'H5 compute failed; all attempts/logs retained, no complete claim'
    test = [sys.executable, '-m', 'ml.python.test_campaign']
    executions.append(bounded_command(test, deadline-time.monotonic()-5, logs, 'tests'))
    assert executions[-1]['exit_code'] == 0, 'test verification failed'
    report5 = json.loads((chosen / 'report-5d.json').read_text())
    reports = {str(h): json.loads((PREVIOUS / f'report-{h}d.json').read_text()) for h in range(1, 5)}
    reports['5'] = report5
    old_lock = json.loads((PREVIOUS / 'FUTURE_LOCK.json').read_text())
    now = datetime.now(timezone.utc)
    assert now > datetime.fromisoformat(old_lock['locked_at'])
    lock = {**old_lock, 'locked_at': now.isoformat(), 'campaign_complete': report5['status'] == 'validation-only',
            'horizons_covered': [1, 2, 3, 4, 5], 'completed_horizons': sorted(reports), 'incomplete_horizons': [],
            'h5_procedure': report5['status'], 'budget_status': 'additional HARD 300-second budget',
            'elapsed_seconds': time.monotonic()-started, 'elapsed_scope': 'entire H5 continuation incl tests/packaging',
            'supersedes_lock': str(PREVIOUS / 'FUTURE_LOCK.json'), 'old_lock_sha256': sha(PREVIOUS / 'FUTURE_LOCK.json'),
            'candidates': {**old_lock['candidates'], '5': {'name': report5['locked_candidate'],
                         'sha256': report5['candidate_sha256'], 'artifact': str(chosen / 'candidate-5d.joblib')}}}
    write_json(out / 'FUTURE_LOCK.json', lock)
    ranking = {h: {'descriptive_rank': rep['ranking_descriptive_not_selection'],
                   'metrics': {n: {k: v for k, v in m.items() if k not in ('per_symbol', 'per_regime')}
                               for n, m in rep['metrics'].items()},
                   'full_report': str(chosen / 'report-5d.json' if h == '5' else PREVIOUS / f'report-{h}d.json'),
                   'status': rep['status']} for h, rep in reports.items()}
    write_json(out / 'FULL_RANKING.json', ranking)
    history = json.loads((PREVIOUS / 'audit/execution-history.json').read_text())
    write_json(out / 'EXECUTION_HISTORY.json', {'prior': history, 'new': executions,
               'all_previous_run_directories_retained': [str(d) for d in prior]})
    assert canon == fingerprint()
    assert all(sha(ML_DIR.parent / p) == digest for p, digest in preserved.items())
    write_json(out / 'PRESERVATION.json', {'pass': True, 'prior_files': preserved, 'canonical_files': canon})
    lines = ['# ML campaign — horizon 5 continuation', '',
             f'**H5 procedure: {report5["status"]}. All five horizons covered; h1–4 were NOT refitted.**',
             '**All results are historical validation. No independent 90% target established; no runtime promotion.**', '',
             '|Horizon|Selected procedure accuracy|Balanced accuracy|Macro-F1|ECE|Brier|', '|---|---|---|---|---|---|']
    for h, rep in sorted(reports.items()):
        m = rep['metrics'].get('selected_policy', rep['metrics'].get('v1_lr0.1'))
        lines.append(f"|{h}|{m['accuracy']:.6f}|{m['balanced_accuracy']:.6f}|{m['macro_f1']:.6f}|{m['ece']:.6f}|{m['brier']:.6f}|")
    lines += ['', f'New UTC future lock: **{lock["locked_at"]}**. Old lock retained at `{lock["supersedes_lock"]}`.',
              f'H5 isolated candidate: `{report5["locked_candidate"]}`, SHA256 `{report5["candidate_sha256"]}`.',
              '- FULL_RANKING.json contains full descriptive rankings/metrics for all horizons; full reports referenced there retain slices and intervals.',
              '- EXECUTION_HISTORY.json includes the original datetime failure, interrupted full grid, secondary budget cap and every new attempt. No failures were removed.',
              '- Mixed-datetime-unit joins are normalized to ns and regression-tested. Datetime bindings remain module-scoped; no local datetime shadowing.',
              '- Existing report/audit, source access/response hashes, corporate-action/survivorship/licensing/PIT caveats remain authoritative and unchanged.',
              '- All acquired observations are validation. Any independent confirmation must use prospective predictions after this later lock, per unchanged 252-new-session criterion.',
              '- New-family runtime JS parity/export is not claimed. No downloads, production DB writes, canonical/runtime/UI edits, subagents, commits or deployment.',
              f'- Continuation elapsed before final manifest: {time.monotonic()-started:.2f}s; hard cap 300s. Earlier campaign exceeded its original target; this extension does not conceal that.']
    with (out / 'REPORT.md').open('x') as fh:
        fh.write('\n'.join(lines) + '\n')
    assert time.monotonic() < deadline, 'additional five-minute budget exceeded'
    write_json(out / 'HASHES.json', {str(p.relative_to(out)): sha(p) for p in out.rglob('*') if p.is_file()})
    print(json.dumps({'report': str(out / 'REPORT.md'), 'report_sha256': sha(out / 'REPORT.md'),
                      'ranking_sha256': sha(out / 'FULL_RANKING.json'), 'lock_sha256': sha(out / 'FUTURE_LOCK.json'),
                      'elapsed_seconds': time.monotonic()-started, 'executions': executions}, indent=2), flush=True)


if __name__ == '__main__':
    main()
