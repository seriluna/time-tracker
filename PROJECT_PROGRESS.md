# Time Tracker — Persisted Development Progress

Last reconciled: 2026-10-24 (Asia/Shanghai)

## Product guardrails
- Static GitHub Pages app; localStorage only; no backend or paid API for MVP.
- Existing localStorage key: `time-tracker-v1`; shape: `{ entries: [], todos: [] }`.
- Preserve existing entries, JSON backup/restore, CSV export, and current core flows.
- Use small branches and PRs. Verify CI, merge status, and Pages deployment independently.

## Current verified repository state
- Repository: https://github.com/seriluna/time-tracker
- Production site: https://seriluna.github.io/time-tracker/
- Main SHA: `5aa98f08cbf6d3e08bfbb20c7d44d923eeb7c4cb` (PR #22 merged).
- PR #21 added regression tests for restoring a legacy Todo backup without a `subtasks` property and exporting Todo subtask completion status in CSV; merged to main at `56371ef37811fb02d70deaf80804d361dd7d07b8`.
- PR #22 reconciled this progress file with PR #21, recorded automated verification vs. physical-device checks, and clarified the Step 9 scope; PR #22 merged at `5aa98f08cbf6d3e08bfbb20c7d44d923eeb7c4cb` after browser tests run `40048616600` passed.
- Main browser test run `40049048984` and Pages deployment run `40049047758` for SHA `5aa98f08cbf6d3e08bfbb20c7d44d923eeb7c4cb` were still in progress at last check.
- Main browser test run `40047870707` passed at the current main SHA.
- GitHub Pages deployment run `40047870286` passed at the current main SHA.
- PR #20 documentation reconciliation merged at `950c65f2f6c32a3ee47da416388d8edb3b96131e`; PR browser tests run `40045357515` passed, main browser tests run `40047433596` passed, and Pages deployment run `40047432993` passed.
- PR #19 weekly/monthly category time summaries merged at `2535968fa1adeecf2ae30f6b7a39e914aeed83a6`; PR browser tests run `40040554544` passed, main browser tests run `40045099062` passed, and Pages deployment run `40045099006` passed.
- PR #18 Todo subtasks merged at `8f8bedc49e74b337ceab0d15826042048e6bbde9`; browser tests run `40040363239` and Pages deployment run `40040362701` passed.
- PR #7 backup/restore and CSV safety tests merged.
- PR #8 category/default input improvements merged; browser tests and Pages deployment passed.
- PR #10 edit-form delete action merged.
- PR #11 minute-level daily timeline merged.
- PR #12 planned/actual timeline filters merged.
- PR #13 default-entry-time edge-case fix merged; browser tests and Pages deployment passed.
- PR #15 date copy/paste safety tests merged; browser tests and Pages deployment passed.
- PR #16 overdue incomplete Todo visibility merged; browser tests and Pages deployment passed.
- PR #17 Todo work/personal categories and last-selection persistence merged at `4f6b15aa1bed22e7fd2b3ac0c1cc63c99e3655f4`.
- Todo category is optional on existing records; the last selected category is stored separately in `time-tracker-todo-category`. No existing records were rewritten or deleted by PR #17.

## Task queue (priority order)
Status labels: TODO / IN_PROGRESS / BLOCKED / DONE. Update only when verified.

1. [DONE] Step 2 follow-up: inspect default-time edge cases; PR #13.
2. [DONE] Step 3: edit-form delete action; PR #10.
3. [DONE] Step 4: minute-level daily timeline; PR #11.
4. [DONE] Step 5: planned/actual timeline filters; PR #12.
5. [DONE] Step 6: date copy/paste reliability regression coverage; PR #15.
6. [DONE] Step 7: Todo completion and overdue incomplete Todo visibility; PR #16.
7. [DONE] Step 8: work/personal Todo categories (PR #17) and collapsible subtasks (PR #18).
8. [IN_PROGRESS] Step 9: repeat schedule regression coverage; PR #23 adds tests for generation + reload persistence, overlap safety, and repeat-group deletion. Await CI before merging.
9. [DONE] Step 10: weekly/monthly category totals for planned and actual time; PR #19.
10. [IN_PROGRESS] Step 11: automated regression and production verification complete; physical-device mobile checks still outstanding.

## Step 11 regression review (2026-10-24)
- Reviewed the current Playwright suite: CRUD and save/reload, overlapping actual records, planned/actual totals, date navigation, JSON backup validation and restore/cancel preservation, CSV download, copy/paste safety, Todo completion/category/subtasks persistence, overdue Todo behavior, period category summaries, and 360px viewport overflow are covered.
- Main browser test run `40047433596` passed at SHA `950c65f2f6c32a3ee47da416388d8edb3b96131e`.
- Main browser test run `40047870707` passed at SHA `56371ef37811fb02d70deaf80804d361dd7d07b8`, including PR #21 compatibility/export regression cases.
- GitHub Pages deployment run `40047432993` passed at SHA `950c65f2f6c32a3ee47da416388d8edb3b96131e`.
- GitHub Pages deployment run `40047870286` passed at SHA `56371ef37811fb02d70deaf80804d361dd7d07b8`.
- Automated regression and deployment verification passed for SHA `56371ef37811fb02d70deaf80804d361dd7d07b8`; the follow-up main test/deploy runs for PR #22's merge are tracked above.
- Manual checks on physical mobile devices have not been performed; automated viewport test is not a substitute.

## Step 9 review notes
- Existing app code already includes repeat templates and repeat groups for planned entries with the note prefix `반복 일정: `.
- Do not recreate recurrence functionality. Review the existing UI and tests for a specific usability or reliability gap before changing behavior.
- Identified a concrete verification gap: no repeat-schedule tests were present in `tests/app.spec.js`. PR #23 adds tests for weekday generation and reload persistence, overlap protection preserving existing plans, and deletion of only the selected repeat group. Application behavior is unchanged.

## Blocked-task policy
- Do not mark a task DONE when tests fail or verification is missing.
- Record failing test name, exact failure, root-cause hypothesis, and attempted fix.
- After a bounded investigation, move to the next independent task if it can be developed safely without depending on the failure.
- Do not merge failing or unsafe changes to main. Keep blocked work in its PR or close it with a clear explanation.

## Continuous-work reality
- These files preserve instructions and progress when an AI coding agent is invoked again.
- GitHub Actions can run tests/deploy workflows, but cannot autonomously plan and write new code without a separately configured coding agent and its authorized credentials.
- Do not add API keys to source files or commit secrets. Any agent automation must be scoped, reviewable, budget-limited, and must not bypass PR review or tests.
