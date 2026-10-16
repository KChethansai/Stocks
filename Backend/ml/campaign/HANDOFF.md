# MarketForge ML decision — 2026-10-10

No candidate promoted; canonical release canonical-20261009-01 retained. Primary 2-session three-class common-panel validation: descriptive best 51.6673% versus training-majority 51.6276%; paired gain inconclusive. Nested macro-F1-selected policy accuracy 47.6794%. No independent future test; Phase 1 90% target remains unachieved.

Authoritative evidence: Backend/ml/campaign/FINAL_REPORT.md and timestamped directories referenced there. Future lock 2026-10-10T04:16:43.089265Z requires prospective full-universe predictions; no collector is running. Historical downloads/old holdouts are validation only. Review verified preserved artifacts and metrics.

Offline evaluation now chooses training-only majority and conservatively purges per-symbol forward windows, including ragged panels. Raw/latest updates refuse real directories and replace symlinks atomically. Regressions: python modules test_evaluation_integrity, test_ml_safety, test_campaign. Semgrep/CodeQL unavailable; legacy yfinance/Stooq transport limits remain unresolved. No commits, deploys or production writes.
