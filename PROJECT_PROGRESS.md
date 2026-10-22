# Time Tracker — Persisted Development Progress

Last reconciled: 2026-10-14 (Asia/Shanghai)

## Product guardrails
- Static GitHub Pages app; localStorage only; no backend or paid API for MVP.
- Existing localStorage key: `time-tracker-v1`; shape: `{ entries: [], todos: [] }`.
- Preserve existing entries, JSON backup/restore, CSV export, and current core flows.
- Use small branches and PRs. Verify CI, merge status, and Pages deployment independently.

## Current verified repository state
- Repository: https://github.com/seriluna/time-tracker
- Production site: https://seriluna.github.io/time-tracker/
- PR #7 backup/restore and CSV safety improvements are merged.
- PR #8 category suggestions/default entry times merged at `ae11fe4ad0d7fe0a2ce38a9afc6e8643cdc882e6`; browser tests and Pages deployment passed.
- PR #9 added `AGENTS.md` and this progress file; merged at `1cd0ecd7d1ca268bc44d87361fedf6f1bf4fa784`.
- PR #10 edit-form delete action merged at `e63368d283a9a88373c1e898fd80bcceb24bccf4`.
- PR #11 minute-level timeline visualization is included in main at `0a03d29371519ce3eaa64fbbcca5b49a74b9e446`.
- PR #12 timeline filter (all/actual/planned) merged at `d9f56dc45b14d9a7d9d10bde16f55ceb58837ce8`; browser tests run `38461063706` and Pages deployment run `38461062931` passed.
- PR #13 default-entry time edge cases merged at `7fec8019aa1a57cbd35aa05e2dd27d98cf821fff`. It finds a non-overlapping same-kind default slot and recalculates defaults when the selected date changes outside edit mode. Tests cover a late-day record, date changes, and planned-vs-actual overlap.
- Main browser regression run `38461470164` passed for PR #13 merge SHA.
- GitHub Pages deployment run `38461469706` passed for PR #13 merge SHA.
- No new user-data schema or localStorage migration was introduced by PR #13.

## Task queue (priority order)
Status labels: TODO / IN_PROGRESS / BLOCKED / DONE. Update only when verified.

1. [DONE] Default-entry time edge cases: selected-date changes, planned vs actual, late-day records, and same-kind overlap avoidance. PR #13: https://github.com/seriluna/time-tracker/pull/13
2. [DONE] Edit-form delete action; retain safe cancel/delete behavior. PR #10: https://github.com/seriluna/time-tracker/pull/10
3. [DONE] Minute-level timeline visualization. PR #11: https://github.com/seriluna/time-tracker/pull/11
4. [DONE] Timeline filters for all/actual/planned and mobile layout. PR #12: https://github.com/seriluna/time-tracker/pull/12
5. [TODO] Date copy/paste reliability: inspect implementation and tests first; ensure copied entries preserve intended date/time/type/category and cannot silently create same-kind overlaps. Keep existing data untouched.
6. [TODO] Todo date defaults, completed checkbox, and incomplete old-todo placement.
7. [TODO] Todo categories/subcategories and collapsible details.
8. [TODO] Todo date views and recurrence.
9. [TODO] Category and period statistics.
10. [TODO] Regression review, production verification, and data-safety checks.

## Blocked-task policy
- Do not mark a task DONE when tests fail or verification is missing.
- Record failing test name, exact failure, root-cause hypothesis, and attempted fix.
- After a bounded investigation, move to the next independent task if it can be developed safely without depending on the failure.
- Do not merge failing or unsafe changes to main. Keep blocked work in its PR or close it with a clear explanation.

## Continuous-work reality
- These files preserve instructions and progress when an AI coding agent is invoked again.
- GitHub Actions can run tests/deploy workflows, but cannot autonomously plan and write new code without a separately configured coding agent and its authorized credentials.
- Do not add API keys to source files or commit secrets. Any agent automation must be scoped, reviewable, budget-limited, and must not bypass PR review or tests.
