# Horizon-5 completion registration

User authorizes an additional HARD 300-second compute budget. No h1–4 reruns,
downloads, canonical/runtime edits or model promotion. All acquired data are
historical validation, including any bars acquired recently.

Reuse dataset-5d.parquet from 20261010T035850459829Z. Same all-30-symbol panel,
three-class .001 thresholds, three expanding outer folds, actual label-end
purge plus one session embargo, inner 80/20 temporal selection, train-only
preprocessing, seed 7 and one numerical/CPU thread. Established reduced grid:
v1_lr0.1, v2_tree7, full_tree7, full_tree15 and fixed equal_vote. Same majority,
heuristic, random and shuffled-label controls; rank inner macro-F1 only.

Parent process enforces an absolute deadline including tests/packaging. Reserve
35 seconds for fallback and final verification. Kill the whole compute process
group if the nested attempt exceeds its allocation; retain stdout/stderr and
partial files. Fallback: frozen V1 logistic C=.1 with majority and literal JS
heuristic on the same purged expanding outer dates, no inner model selection.
Label it REDUCED/NON-NESTED, never silently equate it with the primary procedure.

Preserve all three prior run directories, interrupted attempts and old lock.
Write an exclusive timestamped continuation directory, source/data hashes,
execution statuses, combined five-horizon descriptive ranking, final report and
a later FUTURE_LOCK once the new artifact is formed. H1–4 artifact hashes remain
unchanged. Include all prior failed/interrupted histories. Independent 90% target
remains unproven; future observations after the NEW lock are required.
