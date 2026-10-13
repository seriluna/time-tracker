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
- Main includes PR #8 (`ae11fe4ad0d7fe0a2ce38a9afc6e8643cdc882e6`) and PR #9 (`1cd0ecd7d1ca268bc44d87361fedf6f1bf4fa784`).
- PR #7 backup/restore and CSV safety tests were merged; browser tests and Pages deployment previously passed.
- PR #8 `feat: improve time entry category and defaults` was merged at `ae11fe4ad0d7fe0a2ce38a9afc6e8643cdc882e6`.
- PR #8 CI run `38417170741`: Playwright browser regression tests passed.
- Pages deployment run `38417683568` for PR #8 completed successfully.
- No new user-data schema or localStorage migration was introduced in PR #8.

## Task queue (priority order)
Status labels: TODO / IN_PROGRESS / BLOCKED / DONE. Update only when verified.

1. [TODO] Step 2 follow-up: inspect default-time behavior for edge cases (selected date changes, planned vs actual entries, latest end near 23:59, and entries that overlap). Add tests/fix only if behavior is incorrect.
2. [IN_PROGRESS] Step 3: add delete action to edit form; test cancel and confirmed deletion independently. Current PR: https://github.com/seriluna/time-tracker/pull/10 (update after PR creation).
4. [IN_PROGRESS] Step 5: timeline filters for all/actual/planned and mobile clipping. Current PR: https://github.com/seriluna/time-tracker/pull/12 (update after PR creation).
5. [TODO] Step 6: date copy/paste reliability.
6. [TODO] Step 7: Todo date defaults, completed checkbox, and incomplete old-todo placement.
7. [TODO] Step 8: Todo categories/subcategories and collapsible details.
8. [TODO] Step 9: Todo date views and recurrence.
9. [TODO] Step 10: category and period statistics.
10. [TODO] Step 11: regression review, production verification, and data-safety checks.

## Blocked-task policy
- Do not mark a task DONE when tests fail or verification is missing.
- Record failing test name, exact failure, root-cause hypothesis, and attempted fix.
- After a bounded investigation, move to the next independent task if it can be developed safely without depending on the failure.
- Do not merge failing or unsafe changes to main. Keep blocked work in its PR or close it with a clear explanation.

## Continuous-work reality
- These files preserve instructions and progress when an AI coding agent is invoked again.
- GitHub Actions can run tests/deploy workflows, but cannot autonomously plan and write new code without a separately configured coding agent and its authorized credentials.
- Do not add API keys to source files or commit secrets. Any agent automation must be scoped, reviewable, budget-limited, and must not bypass PR review or tests.
