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
- Main SHA: `4f6b15aa1bed22e7fd2b3ac0c1cc63c99e3655f4`.
- PR #7 backup/restore and CSV safety tests merged.
- PR #8 category/default input improvements merged; browser tests and Pages deployment passed.
- PR #10 edit-form delete action merged.
- PR #11 minute-level daily timeline merged.
- PR #12 planned/actual timeline filters merged.
- PR #13 default-entry-time edge-case fix merged; browser tests and Pages deployment passed.
- PR #15 date copy/paste safety tests merged; browser tests and Pages deployment passed.
- PR #16 overdue incomplete Todo visibility merged; browser tests and Pages deployment passed.
- PR #17 Todo work/personal categories and last-selection persistence merged at `4f6b15aa1bed22e7fd2b3ac0c1cc63c99e3655f4`.
- PR #17 browser regression tests passed: run `38488879036`.
- PR #17 GitHub Pages deployment passed: run `38488878920`.
- Todo category is optional on existing records; the last selected category is stored separately in `time-tracker-todo-category`. No existing records were rewritten or deleted by PR #17.

## Task queue (priority order)
Status labels: TODO / IN_PROGRESS / BLOCKED / DONE. Update only when verified.

1. [DONE] Step 2 follow-up: inspect default-time edge cases; PR #13.
2. [DONE] Step 3: edit-form delete action; PR #10.
3. [DONE] Step 4: minute-level daily timeline; PR #11.
4. [DONE] Step 5: planned/actual timeline filters; PR #12.
5. [DONE] Step 6: date copy/paste reliability regression coverage; PR #15.
6. [DONE] Step 7: Todo completion and overdue incomplete Todo visibility; PR #16.
7. [IN_PROGRESS] Step 8: work/personal Todo categories merged in PR #17; subtask details are being implemented in PR #18.
8. [TODO] Step 9: Todo planning/recurrence UX review; avoid duplicating existing repeat-template functionality.
9. [TODO] Step 10: category and period statistics review.
10. [TODO] Step 11: full regression, data-safety review, mobile checks, and production verification.

## Blocked-task policy
- Do not mark a task DONE when tests fail or verification is missing.
- Record failing test name, exact failure, root-cause hypothesis, and attempted fix.
- After a bounded investigation, move to the next independent task if it can be developed safely without depending on the failure.
- Do not merge failing or unsafe changes to main. Keep blocked work in its PR or close it with a clear explanation.

## Continuous-work reality
- These files preserve instructions and progress when an AI coding agent is invoked again.
- GitHub Actions can run tests/deploy workflows, but cannot autonomously plan and write new code without a separately configured coding agent and its authorized credentials.
- Do not add API keys to source files or commit secrets. Any agent automation must be scoped, reviewable, budget-limited, and must not bypass PR review or tests.
