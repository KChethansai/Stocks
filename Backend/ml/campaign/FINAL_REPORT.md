# MARKETFORGE — final ML optimization campaign

**TARGET NOT ACHIEVED — PHASE 1 STILL OPEN.** No candidate promoted. Canonical release `canonical-20261009-01` retained unchanged.

## Evidence map and corrections

- Pre-registration: `PROTOCOL.md`; primary task: 2 trading sessions, all 30 app symbols, three classes, unchanged ±0.1% thresholds, no abstention.
- Main evidence: `20261010T035850459829Z/` (A below).
- Completed horizon-5 continuation and combined ranking: `20261010T041446530461Z/` (B below). B supersedes A's incomplete-horizon status; A remains an immutable historical report.
- All observations are reused historical **validation**, including newly downloaded old observations. There is no independent future-test score.
- Independent quant review recomputed saved OOF metrics, boundaries, labels and hashes. Code review approved the campaign conclusions and final evaluation-integrity repairs.
- A's REPORT/AUDIT incorrectly say the user prohibited subagents. The prohibition applied to workers spawning further workers, not the user. Main orchestration used AI-engineer implementation, quant-analyst independent methodology review, reviewer code review and developer evaluation repairs.
- Some original process exit statuses in A's execution history are reconstructed from run state, not original captured receipts. B's subprocess exits and the integration commands below are freshly captured. Do not describe all historical exits as exact receipts.
- Original 900-second campaign target was exceeded: registration-to-lock upper wall was 1,627.6 seconds including debugging/packaging. H5 continuation completed in about 119 seconds under an additional 300-second subprocess budget. Parent packaging is not protected by a complete hard watchdog.

## Results

Primary OOF coverage: 80,670 predictions, 30 symbols on every evaluated date, 100% common-panel coverage. This excludes 17,279 pre-panel/tail rows: not every historical opportunity is covered. Panel spans July 2012–October 2026. No candidate-specific filtering or abstention.

|Primary method|Accuracy|Balanced accuracy|Macro-F1|
|---|---:|---:|---:|
|Best descriptive accuracy, V1 logistic C=1|51.6673%|0.334666|0.239407|
|Training-only majority|51.6276%|0.333333|0.226993|
|Nested inner-selected policy|47.6794%|0.328743|0.320200|
|Existing heuristic|42.9652%|0.336292|0.327312|
|Uniform random draws|33.3011%|0.330912|0.287664|
|Shuffled-label control|51.5309%|0.333723|0.238238|

Best descriptive gain is only 32 correct predictions, +0.0397 percentage points; paired 95% date-block CI is [-0.1246,+0.1692] percentage points. No credible improvement. Nested accuracy CI is [46.6076%,48.9063%]; paired difference versus majority is [-5.5063,-2.4377] percentage points. Rankings are descriptive, not independent model selection. Registered inner selection optimizes macro-F1, not accuracy; the heuristic leads descriptive macro-F1.

|Horizon|Best descriptive model accuracy|Majority accuracy|Nested accuracy|Nested balanced accuracy|Nested macro-F1|ECE|Brier|
|---|---:|---:|---:|---:|---:|---:|---:|
|1|48.8575%|49.1970%|46.9988%|0.335873|0.323633|0.056886|0.572965|
|2|51.6673%|51.6276%|47.6794%|0.328743|0.320200|0.080786|0.564968|
|3|52.6500%|52.7778%|49.9975%|0.335468|0.323456|0.056306|0.546592|
|4|53.5243%|53.6731%|50.6498%|0.332043|0.315578|0.069864|0.544491|
|5|53.9536%|54.1285%|50.5632%|0.328587|0.311566|0.082863|0.546840|

H3–5 use the smaller registered runtime grid. Every nested policy loses accuracy to majority. Final `full_tree15` candidates were chosen in final inner validation and refitted; the nested procedure score is not an independent score for those refitted artifacts.

Canonical original scores reproduced with all five original dataset hashes: 48.4966%, 50.6108%, 50.8753%, 51.9985%, 52.1622%. These use the original evaluation window/universe, not the OOF panel. Matched last-200-session h2 canonical accuracy is 48.70% versus selected policy 46.1167%; this previously inspected comparison cannot prove canonical superiority. Prior V2/ensemble comparisons are in A/previous-work.json and A/audit/frozen-model-comparison.json where available; A/audit/AUDIT.md gives the authoritative paths/results.

## Full ranking, ablations and slices

B/FULL_RANKING.json references all five full per-configuration reports. A/report-2d.json contains the complete 22-method primary ranking, class confusion/recall, every symbol and regime, calibration and intervals; B/nested/report-5d.json completes h5. Those machine-readable reports are the full results, not just selected highlights.

Primary fixed-tree ablations (accuracy / macro-F1): full_tree7 48.3141% / .311390; remove context 49.7223% / .306869; remove liquidity 48.3513% / .311407; remove regime 48.7579% / .312274. Added families do not establish an accuracy edge. Equal-vote ensemble: 49.9678% / .295450. No tuned stacking or temporal network was justified by this signal evidence and CPU budget.

Primary nested recalls: DOWN 40.7667%, NEUTRAL 0%, UP 57.8563%; supports 35,242 / 3,780 / 41,648. NEUTRAL retained, never removed. All nested horizons have zero NEUTRAL recall. Accuracy winner also has zero NEUTRAL recall and only 2.10% DOWN recall, exposing majority-like behavior.

Primary nested symbol accuracy ranges from PFE 44.5891% to TSLA 50.0558%. Regime accuracy: trailing bear 51.2520%, trailing bull 46.5659%, high volatility 51.7903%, low volatility 47.1959%. Full per-class/per-symbol/per-regime details for every horizon/configuration remain in the JSON reports.

## Data, provenance and leakage

Existing adjusted stock OHLCV plus SPY/QQQ/DIA/IWM; new real Yahoo XLK/XLF/XLE/^VIX context, bounded to the existing snapshot. Retrieval UTC, request URLs, raw HTTP hashes and dated bars preserved in source runs referenced by A/RESUME.json. Download accessibility is not a verified redistribution license: local research artifacts only.

Features: trailing market/sector returns and volatility, breadth, volume anomalies, adjusted-price turnover/Amihud proxies and trailing regimes. Adjusted close × volume is not certified historical dollar liquidity. Backward-only as-of joins assume same-close availability and next-execution use; no certified historical publication-latency/revision archive. Current-symbol survivorship and retrospectively revised split/dividend adjustments remain unresolved.

No licensed timestamped historical news/sentiment, filing/fundamental release archive, earnings-event archive or vintage macro integration was implemented. Licensed archives were not available in the local setup; public SEC/vintage-macro acquisition was not exhausted within this bounded campaign, so those sources are **unattempted**, not proven inaccessible. No fabricated inputs substituted. These are data-access/provenance and campaign-scope gaps, not evidence that those signals would deliver 90%.

Three expanding outer folds, train-only preprocessing, nested chronological selection, actual per-symbol label-end purge and session embargo. Independent reviewer rederived labels/windows and matched selected-fold predictions. Future-prefix perturbation tests passed; shuffled-label controls expose class-imbalance effects. Controls cannot certify vendor historical revisions. Date-block CIs retain cross-symbol/date dependence, but are conditional historical intervals, not selection-adjusted future guarantees.

## Repairs and changed files

New campaign source: `ml/python/campaign.py`, `campaign_finish.py`, `campaign_audit.py`, `campaign_h5.py`, `test_campaign.py`; protocol, budget amendment and exclusive timestamped artifacts under `ml/campaign/`; graphify navigation output.

Existing ML-scope repairs: `ml/python/evaluate.py` chooses majority from training labels in learned-class order; `ml/python/train.py` uses session embargo and conservative per-symbol forward-window purge for train→validation, validation→test and walk-forward splits, including sparse panels. Added `ml/python/test_evaluation_integrity.py` with five meaningful regressions. These are offline evaluation changes, not retraining or regenerated baseline artifacts. Existing pre-session edits preserved.

Security follow-up: `campaign.py` now rejects oversized/malformed OHLCV and restricts redirects to approved HTTPS Yahoo query hosts before persistence. `data.py` and `refresh.py` atomically replace the latest symlink and refuse real directories/files; the destructive directory-deletion fallback is removed. `test_ml_safety.py` adds four offline regression checks. These post-campaign infrastructure repairs do not alter saved predictions, data, candidates or original run-code hashes; no new download was performed. Scoped security re-review confirmed these fixes. Legacy yfinance/Stooq transports still lack application byte limits; Stooq lacks an explicit timeout. Those residual acquisition paths were not exercised in final verification.

## Fresh verification matrix

Backend cwd unless stated. Each final command below exited 0.

|Command|Measured result|
|---|---|
|`npm test`|25 selfchecks; 4 JS/Python parity groups|
|`npm run test:phase16`|42 passed, 0 failed; ONNX 1–5; package/install/rollback; fail-closed guards; session resolution; expected corrupt-tar rejection|
|`npm run test:parity`|4 JS groups and 8 Python checks|
|`npm run test:parity:v2`|All fixture cases including gappy serving alignment|
|`npm run test:experiment`|4 experiment-harness checks|
|`npm run release:verify`|5/5 canonical bundles; Node 24.19.0, ORT 1.29.0|
|`.venv/bin/python -m ml.python.test_campaign`|8 checks|
|`.venv/bin/python -m ml.python.test_evaluation_integrity`|5 checks; earlier red reproductions exited 1|
|`.venv/bin/python -m ml.python.test_ml_safety`|4 checks; malformed-array and directory-deletion regressions reproduced before repair|
|`git diff --check`|No whitespace errors|
|`npm run build` in Frontend|Build passed, 1.07 seconds|
|`node --input-type=module -e 'await import("./APIs/MlAPI.js"); const {getModelStatus}=await import("./ml/trainedPredictor.js"); console.log("MlAPI import OK"); console.log(JSON.stringify(await getModelStatus(2),null,2));'`|API import and h2 canonical status passed; no DB request|

Failed/interrupted campaign attempts remain recorded in A/audit/execution-history.json and B/EXECUTION_HISTORY.json: initial datetime failure, interrupted full-grid run, secondary budget exhaustion; H5 completed later. New-family Node parity/ONNX export not performed because candidates failed promotion. No live database/API-endpoint/browser-flow test or actual deployment ran. Frontend verification is build/contract regression, not browser E2E. Semgrep/CodeQL unavailable: static security verification remains **incomplete**, not passed.

## Artifact integrity, future evidence and rollback

Independent review verified 140 existing evidence-manifest entries, 186 preserved original artifact fingerprints and 200 preserved continuation fingerprints. Canonical models unchanged; no commits, pushes, deployments, production DB writes or automatic-trading enablement.

- B/REPORT.md SHA256: `7c3d0dba0169f031d7a026690e6716f82e071d621a89e797a1c0d8df22f8adb3`.
- B/FULL_RANKING.json SHA256: `f3019fc58df794038d49aa24faff783789431c51583db2ad062b809f814cf587`.
- Isolated h2 candidate SHA256: `fc7a9c38b1f3745d1180bec51ba97e8d119c489ea98f94a2680a94569c6d3b2b`.
- B/FUTURE_LOCK.json SHA256: `eab88c546aea9eda62c42163ce6ee153157eba283fd413308347f89fd80b8911`.

Prospective lock: **2026-10-10T04:16:43.089265Z**. A prospective evaluation is not running: collect immutable predictions for every symbol before next execution, wait for actual session labels, accumulate at least 252 new complete sessions under unchanged criteria, then independent reproduction with lower date-block accuracy bound ≥90% and paired gains versus majority/canonical. No retuning against those observations. Present candidates are experimental validation artifacts, not proven improved deployment configurations.

No runtime rollback is needed because nothing was promoted. Existing release recovery: `node ml/modelRelease.js status`, `node ml/modelRelease.js verify`; only if an actual previous release installation must be reverted, use `node ml/modelRelease.js rollback` with its verified retained backup. Do not reset the dirty repository or delete preserved artifacts.

Campaign stops here. Better licensed as-of data and genuinely new prospective evidence are required for stronger claims; neither guarantees the requested threshold.
