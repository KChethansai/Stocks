# Runtime-only secondary-horizon amendment

Written before the amended secondary experiments. Original protocol, objective,
30-symbol coverage, three-class thresholds, purge/embargo, inner selection,
outer OOF, controls and no-promotion contract remain unchanged.

The original full grid completed horizons 2 and 1 but consumed over ten minutes
in the resumed process (PID 25891: elapsed 10:27, CPU 10:10). Initial canonical
reproduction had also consumed time. Interrupted the pending horizon-3 fit to
bound further compute. Target <=15 minutes is already missed; report this rather
than silently claim compliance. Interrupted evidence is retained, not overwritten.

For remaining SECONDARY horizons 3, 4, 5 only: subset the originally frozen grid
to V1 logistic C=.1, V2 tree7, full tree7, full tree15 and fixed equal vote.
Do not redo or change primary horizon 2 or completed horizon 1. Primary feature
ablations already completed. Secondary ablations are not repeated under budget.
No parameter invented from observed scores. Rank still inner-only macro-F1,
with all outer ranks descriptive. Maximum additional process wall 240 seconds.
If not complete by that bound, retain partial results and report remaining gaps.

Reuse existing exact canonical reproduction, verified prefix/future perturbation
checks and cached full-date-panel features. Verify input fingerprints unchanged.
No new download, no production changes, no independent-test claim. Final frozen
model and data hashes still require prospective post-lock observations.
