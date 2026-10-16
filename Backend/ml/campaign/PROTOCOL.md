# Pre-registration: bounded ML optimization campaign

Written before any new campaign experiment. The runner copies and hashes this
protocol into an exclusive UTC timestamped run directory before fetching or fitting.

## Fixed contract
- Primary: 2 trading sessions; secondary: sessions 1, 3, 4, 5.
- All 30 `data.APP_TICKERS`, all three classes, no abstention or neutral exclusion.
- Labels unchanged: close(t+h)/close(t)-1 > .001 UP, < -.001 DOWN, else NEUTRAL.
- Close-known features describe t and are usable only after t's close, next
  execution. This predicts close-to-close direction, NOT executable next-open P&L.
- Every previously accessible historical snapshot and holdout is validation.
  New downloads of OLD observations are also validation, not independent tests.
- Objective >=90% independently proven full-coverage accuracy: NOT established
  by this campaign. No runtime promotion, regardless of historical score.

## Frozen experiment and selection design
- Seed 7, CPU only, one numerical thread, target <=900 seconds wall compute.
- Use installed sklearn/LightGBM/ONNX libraries, no dependency installation.
- Common full-universe date panel after all symbols have 30 valid observations;
  report excluded early dates and invalid/missing rows. No candidate-specific drops.
- Three expanding outer validation folds (four equal chronological chunks).
  Purge horizon sessions AND one-session embargo from training before each boundary.
  Verify actual per-symbol label-end timestamp precedes validation start.
- Within each outer training period: chronological 80/20 inner selection with
  same purge/embargo; scalers/imputers fit inner train only. Rank inner macro-F1.
- Frozen grid: standardized regularized logistic C=.1 and 1; LightGBM 80 trees,
  7 and 15 leaves, min child 100, learning rate .05, reg_lambda=5. V1, V2,
  full context, and leave-one-new-family-out fixed LightGBM ablations.
- Fixed equal-weight V2/full-context tree vote is justified as variance control;
  no meta-learner or weight tuning. Included in inner selection, never selected
  from outer scores. Outer results of individual configurations are descriptive.
- Report selected-policy outer OOF as validation; refit final candidate chosen
  by one last inner temporal split on full history, not by outer ranking.
- Majority learned from training labels; seeded random uniform predictions;
  literal app heuristic via the existing JS scorer on recorded close histories;
  canonical ONNX and existing V2 ONNX on matched rows where feasible. Frozen
  historical artifacts on OOF periods may have trained on those periods: flag
  as contaminated descriptive, NOT honest OOF comparisons.
- Canonical reproduction uses original snapshots, 34-symbol original split and
  full 30-symbol app subset, matching metadata data hash before claiming exactness.

## Signal hypotheses and timing
- Existing SPY/QQQ/DIA/IWM plus modest Yahoo XLK/XLF/XLE and ^VIX downloads,
  request no bars newer than existing snapshot. Save access UTC, request URL,
  raw response hash and bar dates. Public accessibility is not a redistribution
  license; research-only local use, Yahoo/exchange terms require separate review.
- Context: trailing ETF returns and volatility, sector ETF relative return;
  volume/liquidity: trailing relative volume, dollar turnover, Amihud proxy;
  regime: trailing SPY trend/volatility, cross-sectional breadth, VIX if available.
- Backward as-of joins only with explicit same-close availability assumption,
  no backward fill; missing-context indicators plus train-only median imputation.
  Date stamps do not prove historical publication latency or revision state.
- No fabricated fundamentals/news/PIT signals. No historical filing/news archives
  or timestamped vendor license: report blocked. Adjusted bars are retrospectively
  revised; current 30-name universe is survivor-biased, not historical constituents.

## Checks, reporting and independent lock
- Shuffled training labels control for every horizon (fixed full-context tree).
- Perturb future stock/context bars; prior feature vectors must be unchanged.
- Tests: label boundaries, purging/session gaps, as-of availability, metric
  calibration and block CI determinism; existing Python and JS feature parity.
- Accuracy, balanced accuracy, macro-F1, per-class recall, confusion, ECE and
  multiclass Brier; per-symbol/per-regime metrics and label proportions.
- 95% accuracy intervals: moving 20-date block bootstrap, 500 seeded replicates,
  keeping all symbols on each date together. Paired selected-policy/majority
  accuracy difference CI. These are conditional validation intervals, not
  multiple-selection-corrected or independent proof.
- Freeze runner/protocol/data/artifact hashes and model choice at completion.
  Independent confirmation: collect all 30 symbols' predictions prospectively
  before next execution after lock, wait h sessions for labels, no tuning;
  minimum 252 complete sessions, fixed 20-date block bootstrap, require lower
  95% accuracy bound >=90% and positive paired improvement vs canonical and
  majority. Even this requires stable data provenance and execution timing.
- Artifacts are exclusive, timestamped, content-hashed and never overwritten by
  reruns. Canonical/previous artifacts are fingerprinted before and after.
