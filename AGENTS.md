# Time Tracker Development Rules

## Product priorities
1. Preserve existing user data and working features.
2. Keep the GitHub Pages static deployment and localStorage architecture unless user evidence justifies a change.
3. Improve the core flow: open app → record time quickly → review the day → use analysis.
4. Prefer the smallest change that solves a verified user problem.
5. Do not build speculative features or add paid services/backend infrastructure without a clear need.

## Before changing code
- Read `PROJECT_PROGRESS.md` and the relevant source/tests.
- Inspect the current branch, latest main commit, open PRs, and relevant CI status.
- State the specific user problem, files likely to change, and data/compatibility risks.
- Do not overwrite unrelated changes or reset stored data.
- Keep changes on a feature/chore branch and use a pull request; do not commit feature work directly to main.

## Data safety
- The existing localStorage key is `time-tracker-v1`; current shape is `{ entries: [], todos: [] }`.
- Do not rename the key, change the schema, or clear records without a migration plan and explicit approval.
- Keep JSON backup/restore and CSV export working.
- Any import/restore change must preserve current data if validation or cancellation fails.
- Avoid sending personal time records to external services.

## Implementation and tests
- Add or update regression tests for each behavior change.
- Run JavaScript syntax checks and the browser regression suite available in the repository.
- Review test output; never claim a test passed unless it actually ran and passed.
- If a test fails: record the exact failing test and output, distinguish app defects from test/environment failures, inspect the root cause, and make a minimal fix only when supported by evidence.
- Retry a failing test after a meaningful fix. Do not repeatedly rerun unchanged failures.
- After a bounded investigation, mark the task BLOCKED with evidence and continue only with independent, safe work that does not depend on the failing change.
- Never merge a PR with failing required tests, unresolved data-loss risk, or unreviewed conflicts.
- A green test suite is necessary but not sufficient: inspect the diff and check related flows.

## PR, merge, and deployment
- Before merge, verify PR is open, its head SHA is current, required tests are green, and mergeability is clean.
- Never infer that a PR merged from a merge SHA field alone; verify `merged=true` or inspect the resulting main commit.
- After merge, verify the main commit and GitHub Pages workflow. Do not call deployment complete while it is queued/in progress or failed.
- When possible, check the deployed site after the Pages workflow succeeds.
- Do not automatically merge solely because CI is green; inspect the change and data risk first.

## Continue-work protocol
At the beginning of every resumed work session:
1. Read `PROJECT_PROGRESS.md`.
2. Check main, open PRs, and the latest relevant GitHub Actions runs.
3. Reconcile the progress file with actual GitHub state; GitHub state wins if they differ.
4. Select the highest-priority unblocked task.
5. Make one small, reviewable change, add tests, and open/update a PR.
6. If a task is blocked, document the evidence and move to an independent next task.
7. Update `PROJECT_PROGRESS.md` in the same PR as meaningful workflow changes, or in a small follow-up PR.

## Reporting
Report only verified facts using:
- Goal
- Changes
- Verification
- Deployment
- Data safety
- Product value
- Next step

This file guides coding agents when they are invoked. It does not by itself run an agent continuously or grant it permission to merge/deploy.
