"""Finish retained campaign evidence under a pre-registered secondary budget.

Usage: .venv/bin/python -m ml.python.campaign_finish --from-run ml/campaign/<stamp>
"""
import argparse
import json
import time
from datetime import datetime, timezone
from pathlib import Path

import numpy as np
import pandas as pd
from threadpoolctl import threadpool_limits

from .campaign import ROOT, SEED, sha, write_json, fingerprint, run_horizon
from .data import APP_TICKERS
from .experiment import load_raw
from .features import FEATURE_COLUMNS, DEADBAND
from .features_v2 import V2_COLUMNS


def seal_evidence(out):
    """Package partial evidence without any further download/model fitting."""
    expected = json.loads((out / 'preserved-before.json').read_text())
    assert fingerprint() == expected
    reports = {str(h): json.loads((out / f'report-{h}d.json').read_text())
               for h in range(1, 6) if (out / f'report-{h}d.json').exists()}
    assert '2' in reports
    write_json(out / 'preserved-after.json', expected)
    (out / 'seal_runner.py').write_bytes(Path(__file__).read_bytes())
    registration = json.loads((out / 'PRE_REGISTRATION.json').read_text())
    now = datetime.now(timezone.utc)
    lock = {'locked_at': now.isoformat(), 'promoted': False, 'independent_accuracy_proven': False,
            'campaign_complete': len(reports) == 5, 'completed_horizons': sorted(reports),
            'incomplete_horizons': [h for h in range(1, 6) if str(h) not in reports],
            'elapsed_seconds': (now - datetime.fromisoformat(registration['locked_at'])).total_seconds(),
            'elapsed_scope': 'registration to seal, includes post-timeout packaging; NOT measured fit time',
            'budget_status': '15-minute target exceeded; additional fitting stopped at 240-second deadline',
            'candidates': {h: {'name': r['locked_candidate'], 'sha256': r['candidate_sha256']} for h, r in reports.items()},
            'prospective_requirement': 'All 30 predictions fixed after lock before next execution; 252 NEW complete sessions, fixed thresholds; lower date-block accuracy CI >=.90 and positive paired gains vs canonical/majority; no retuning'}
    write_json(out / 'FUTURE_LOCK.json', lock)
    canonical = json.loads((out / 'canonical-reproduction.json').read_text())
    lines = ['# Final ML campaign evidence — bounded partial completion', '',
             '**90% independently proven target NOT achieved. No promotion. New nested campaign completes horizons 1–4; horizon 5 stopped by budget.**', '',
             'Primary h2 and h1 full grids retained unchanged. Secondary h3/h4 use the registered runtime-only subset. Canonical reproduction and previous experiments cover ALL horizons 1–5. The <=15-minute total compute target was missed; no additional fits after the secondary 240-second cap.', '',
             '## Primary two-session result: 30 symbols on every validation date, 80,670 predictions',
             '|Method|Accuracy|Balanced accuracy|Macro F1|ECE|Brier|95% date-block accuracy CI|', '|---|---|---|---|---|---|---|']
    for name in ('selected_policy', 'majority', 'heuristic', 'random_uniform_draw', 'shuffled_labels'):
        m = reports['2']['metrics'][name]
        lines.append(f"|{name}|{m['accuracy']:.4f}|{m['balanced_accuracy']:.4f}|{m['macro_f1']:.4f}|{m['ece']:.4f}|{m['brier']:.4f}|{m['accuracy_ci95_date_block20']}|")
    lines += [f"\nSelected-minus-majority paired accuracy CI: {reports['2']['paired_selected_minus_majority_ci95']}. NEUTRAL recall is zero; no credible accuracy improvement.", '',
              '## Horizon coverage', '|Horizon|New selected-policy accuracy|Macro F1|Final inner-selected isolated candidate|Canonical original accuracy|Exact dataset hash|', '|---|---|---|---|---|---|']
    for h in ('1', '2', '3', '4', '5'):
        c = canonical[h]
        if h in reports:
            r, m = reports[h], reports[h]['metrics']['selected_policy']
            values = f"{m['accuracy']:.4f}|{m['macro_f1']:.4f}|{r['locked_candidate']}"
        else:
            values = 'INCOMPLETE: budget cap|not claimed|none'
        lines.append(f"|{h}|{values}|{c['original_34_symbol_tail']['accuracy']:.6f}|{c['exact_dataset_hash_match']}|")
    lines += ['', '## Evidence index and audit limitations',
              '- report-{1..4}d.json: descriptive rankings, inner selection decisions, per-class/symbol/trailing-regime metrics, calibration, coverage and date-block CIs. Primary feature ablations complete; secondary ablations omitted by explicit budget amendment.',
              '- dataset-{1..5}d.parquet: cached common panel; oof-{1..4}d-*.parquet: completed row-level predictions. H5 only reached its first outer fold (accuracy .4788 in process output); no full OOF result or fitted final artifact is claimed.',
              '- canonical-reproduction.json: exact original 34-symbol hashes, 48–52% reproduced ONNX scores and 30-app subset. previous-work.json contains old validation results/ensembles for every horizon, NOT independent confirmation.',
              '- PROTOCOL.md was written first. BUDGET_AMENDMENT.md precedes amended h3–5 experiments. PRE_REGISTRATION.json and RESUME.json bind source runs. Failed/interrupted attempts remain intact.',
              '- Same-close-known past-only context joins usable NEXT execution, actual per-symbol forward-label-end purge plus one-session embargo; train-only scaling/imputation. Prefix/future-data perturbation checks passed (leakage.json). This does not certify historical vendor revisions.',
              '- Real XLK/XLF/XLE/VIX downloads with access UTC and raw HTTP hashes are retained in earliest source run (RESUME.json); Yahoo/exchange licensing/redistribution remains unverified, local research only.',
              '- Current survivor universe and retrospectively revised split/dividend-adjusted stock bars: corporate-action and survivor bias remain. Context raw quote closes have no certified PIT revision archive. No fabricated fundamentals or news: licensed timestamped filing/news archives unavailable, these features blocked.',
              '- Close-to-close direction labels remain unchanged; no next-open executable P&L or trading recommendation claim. All historical windows are reused validation, NEVER independent tests.',
              '- H2 NEUTRAL is only ~4.7% but retained with zero recall. Symbol/regime slices expose relevant disparities; demographic slices inapplicable to stock entities, no personal data used.',
              '- Existing train.walk_forward_scores uses calendar-day gaps without explicit label-end purge, evaluate.py selects majority from evaluation labels, and Phase-1 stack validation scores its own meta-training labels. Preserved unchanged; campaign avoids these mechanisms.',
              '- Previous ensemble/Platt/stack collapse toward majority documented in previous-work.json. Fixed equal-vote tested without hindsight weights. Raw classifier scores are not calibrated success rates; ECE/Brier reported.',
              '- Date-block intervals preserve same-date symbol dependence, but remain conditional reused-validation and not selection-adjusted. Final inner-selected candidate is not chosen from the outer leaderboard.',
              '- candidate-{1..4}d.joblib are trusted-local experimental artifacts, never promoted. FUTURE_LOCK.json freezes candidate hashes and prospective requirements. HASHES.json binds final artifacts.',
              '- audit/AUDIT.md adds exact commands/exits, canonical/V2 matched-row comparison, source/data quality/feature diagnostics, scanner limitations and integrity checks. No independent reviewer/subagent (explicit user prohibition).',
              '- New-family runtime JS parity/export is not claimed; existing V1/V2 parity is tested. No production DB, deployment, commit/push, runtime models or Phase2/UI changes. All existing model/data/experiment/release fingerprints unchanged.']
    with (out / 'REPORT.md').open('x') as fh:
        fh.write('\n'.join(lines) + '\n')
    write_json(out / 'HASHES.json', {str(p.relative_to(out)): sha(p) for p in sorted(out.rglob('*')) if p.is_file()})
    print(f'SEALED WITHOUT NEW FITS {out / "REPORT.md"}', flush=True)


def main():
    ap = argparse.ArgumentParser(description=__doc__)
    ap.add_argument('--from-run', required=True, type=Path)
    ap.add_argument('--seal-only', action='store_true', help='finalize partial evidence without any more compute')
    args = ap.parse_args()
    previous = args.from_run.resolve()
    if args.seal_only:
        seal_evidence(previous)
        return
    start = time.monotonic()
    stamp = datetime.now(timezone.utc).strftime('%Y%m%dT%H%M%S%fZ')
    out = ROOT / stamp
    out.mkdir()
    for name in ('PROTOCOL.md', 'BUDGET_AMENDMENT.md'):
        (out / name).write_bytes((ROOT / name).read_bytes())
    (out / 'runner.py').write_bytes(Path(__file__).read_bytes())
    from . import campaign
    (out / 'campaign_library.py').write_bytes(Path(campaign.__file__).read_bytes())
    write_json(out / 'PRE_REGISTRATION.json', {'locked_at': datetime.now(timezone.utc).isoformat(),
        'protocol_sha256': sha(out / 'PROTOCOL.md'), 'amendment_sha256': sha(out / 'BUDGET_AMENDMENT.md'),
        'runner_sha256': sha(out / 'runner.py'), 'library_sha256': sha(out / 'campaign_library.py'),
        'command': __import__('sys').argv, 'additional_budget_seconds': 240})
    expected = json.loads((previous / 'preserved-before.json').read_text())
    assert fingerprint() == expected
    # Preserve all prior evidence and reference its original UTC directory.
    for path in previous.iterdir():
        if path.is_file() and path.name not in ('runner.py', 'PRE_REGISTRATION.json', 'PROTOCOL.md', 'RESUME.json'):
            if not path.name.startswith(('dataset-3d', 'coverage-3d')):
                (out / path.name).write_bytes(path.read_bytes())
    write_json(out / 'RESUME.json', {'source': str(previous), 'earliest_source': json.loads((previous / 'RESUME.json').read_text())['source'],
               'reason': 'Interrupted full-grid secondary fit after measured runtime; completed h1/h2 reused unchanged; amendment preregistered'})
    reports = {h: json.loads((out / f'report-{h}d.json').read_text()) for h in ('1', '2')}
    base = pd.read_parquet(out / 'dataset-1d.parquet').drop(columns=['y', 'label_end'])
    new_cols = [c for c in base if c.startswith(('ctx_', 'reg_', 'liq_'))]
    groups = {'v1': FEATURE_COLUMNS, 'v2': V2_COLUMNS, 'full': V2_COLUMNS + new_cols}
    with threadpool_limits(limits=1):
        raw = load_raw('data/raw/latest')
        for h in (3, 4, 5):
            frame = base.copy()
            frame['y'], frame['label_end'] = np.nan, pd.NaT
            for sym in APP_TICKERS:
                bars = raw[sym]
                mask = frame.symbol == sym
                fwd = bars.close.shift(-h) / bars.close - 1
                labels = pd.Series(np.where(fwd > DEADBAND, 2, np.where(fwd < -DEADBAND, 0, 1)), index=bars.index).where(fwd.notna())
                frame.loc[mask, 'y'] = labels.reindex(frame.loc[mask, 'date']).to_numpy()
                frame.loc[mask, 'label_end'] = pd.Series(bars.index, index=bars.index).shift(-h).reindex(frame.loc[mask, 'date']).to_numpy()
            valid = frame.dropna(subset=['y', 'label_end']).groupby('date').symbol.nunique()
            frame = frame[frame.date.isin(valid[valid == 30].index)].reset_index(drop=True)
            frame.y = frame.y.astype(int)
            assert (frame.groupby('date').size() == 30).all()
            frame.to_parquet(out / f'dataset-{h}d.parquet', index=False)
            write_json(out / f'coverage-{h}d.json', {'rows_panel': len(frame), 'rows_cached_panel_before_tail_purge': len(base),
                       'excluded_early_dates': 'Same full-universe date restriction as completed h1; see prior coverage-1d.json',
                       'full_30_symbols_per_date': True})
            reports[str(h)] = run_horizon(frame, h, groups, out, start + 240, bounded_secondary=True)
        assert fingerprint() == expected
    write_json(out / 'preserved-after.json', expected)
    lock = {'locked_at': datetime.now(timezone.utc).isoformat(), 'promoted': False, 'independent_accuracy_proven': False,
            'last_historical_session': str(raw['SPY'].index.max()), 'elapsed_seconds': time.monotonic()-start,
            'elapsed_scope': 'additional bounded completion only; original attempts exceeded 15-minute target',
            'candidates': {h: {'name': r['locked_candidate'], 'sha256': r['candidate_sha256']} for h, r in reports.items()},
            'prospective_requirement': 'All 30 predictions fixed after lock, before next execution; 252 new complete sessions, unchanged thresholds, lower block accuracy CI >=.90 plus positive paired gains vs canonical/majority; no retuning'}
    write_json(out / 'FUTURE_LOCK.json', lock)
    canonical = json.loads((out / 'canonical-reproduction.json').read_text())
    lines = ['# Final bounded ML campaign evidence', '', '**90% independently proven target NOT achieved; NO promotion.**', '',
        'Primary h2 and h1 full grids retained unchanged; h3–5 use the preregistered runtime-only subset. The <=15-minute total target was missed; see audit execution-history.json for aggregate time.', '',
        '## Primary: two sessions, full 30-symbol universe, 80,670 outer OOF predictions',
        '|Method|Accuracy|Balanced accuracy|Macro F1|ECE|Brier|95% date-block accuracy CI|', '|---|---|---|---|---|---|---|']
    for name in ('selected_policy', 'majority', 'heuristic', 'random_uniform_draw', 'shuffled_labels'):
        m = reports['2']['metrics'][name]
        lines.append(f"|{name}|{m['accuracy']:.4f}|{m['balanced_accuracy']:.4f}|{m['macro_f1']:.4f}|{m['ece']:.4f}|{m['brier']:.4f}|{m['accuracy_ci95_date_block20']}|")
    lines += [f"\nSelected-minus-majority paired accuracy CI: {reports['2']['paired_selected_minus_majority_ci95']}. NEUTRAL recall is zero. No credible accuracy improvement.", '',
              '## All horizons', '|Horizon|Selected-policy OOF accuracy|Macro F1|Isolated final inner-selected candidate|Canonical reproduced accuracy|Exact original dataset hash|', '|---|---|---|---|---|---|']
    for h in ('1', '2', '3', '4', '5'):
        r, m, c = reports[h], reports[h]['metrics']['selected_policy'], canonical[h]
        lines.append(f"|{h}|{m['accuracy']:.4f}|{m['macro_f1']:.4f}|{r['locked_candidate']}|{c['original_34_symbol_tail']['accuracy']:.6f}|{c['exact_dataset_hash_match']}|")
    lines += ['', '## Evidence and limitations',
              '- report-{1..5}d.json: full descriptive rankings, nested decisions, per-class/symbol/trailing-regime metrics, coverage, calibration and 20-date block CIs. Primary ablations in report-2d.json; secondary ablations skipped by budget amendment.',
              '- dataset-*.parquet and oof-*.parquet: reproducible row-level evidence. candidate-*.joblib: trusted-local experimental artifacts, NEVER promoted. HASHES.json binds all final files.',
              '- canonical-reproduction.json: exact original 34-symbol snapshot hashes and 48–52% ONNX reproduction, plus 30-app subset. previous-work.json inventories all prior experiments/ensembles without overwriting them.',
              '- Initial real context downloads (XLK/XLF/XLE/VIX) and raw HTTP hashes/access UTC remain in the earliest run referenced by RESUME.json; supplemental audit preserves access metadata and verifies cached context equality.',
              '- All historical windows are previously accessible validation, not independent tests. Outer folds do not train on their labels; final configuration is chosen using a separate inner temporal split, NOT outer ranking.',
              '- Past-only same-close joins and train-only preprocessing; actual per-symbol forward label-end purge plus one-session embargo; feature prefix and future-bar perturbation checks pass (leakage.json). This is conditional on frozen downloaded bars, not certified vendor revision PIT.',
              '- Current survivor universe, revised split/dividend-adjusted stock history, incomplete corporate-action/constituent archives. Context quote closes are not certified historical as-of records. No fabricated fundamentals/news: licensed timestamped archives unavailable, families blocked.',
              '- Features known after close are usable next execution; unchanged close-to-close labels are NOT next-open executable returns. No P&L or trading recommendation claim.',
              '- Historical class imbalance includes only ~4.7% NEUTRAL at h2, yet retaining every class is mandatory. Symbol/regime diagnostics replace inapplicable demographic fairness slices; no personal data used.',
              '- Existing train.walk_forward_scores uses calendar-day gaps and lacks explicit label-end purge; evaluate.py chooses majority using evaluation labels; Phase-1 stack selection scores its own meta-training rows. These files are preserved; campaign avoids these mechanisms.',
              '- Previous ensemble calibration/stacking collapsed toward majority; fixed equal-vote tested here, no hindsight weight/meta tuning. Candidate probability calibration remains limited; ECE/Brier reported, confidence never relabeled success rate.',
              '- Date-block intervals are reused-validation, conditional and not selection-adjusted. Runtime promotion requires credible independently collected post-lock improvement; FUTURE_LOCK.json freezes hashes and prospective requirements.',
              '- audit/AUDIT.md and JSONs add frozen canonical/V2 same-row comparisons, exact commands/exits, source hashes, data quality and feature usefulness. Missing SAST scanners and absence of independent subagent review are disclosed there.',
              '- No DB writes, deploy, commits/pushes, runtime model/UI changes. Every previous model/dataset/experiment/release fingerprint unchanged. Failed/interrupted attempts retained.']
    with (out / 'REPORT.md').open('x') as fh:
        fh.write('\n'.join(lines) + '\n')
    write_json(out / 'HASHES.json', {str(p.relative_to(out)): sha(p) for p in sorted(out.rglob('*')) if p.is_file()})
    print(f'FINISHED {out / "REPORT.md"}', flush=True)


if __name__ == '__main__':
    main()
