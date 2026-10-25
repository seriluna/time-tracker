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
- Main SHA: `7c5b5e01ab3386ec8dd082a5ad66a316c110e1d7` (PR #25 merged; malformed JSON backup preservation test added).
- PR #21 added regression tests for restoring a legacy Todo backup without a `subtasks` property and exporting Todo subtask completion status in CSV; merged to main at `56371ef37811fb02d70deaf80804d361dd7d07b8`.
- PR #22 reconciled this progress file with PR #21, recorded automated verification vs. physical-device checks, and clarified the Step 9 scope; PR #22 merged at `5aa98f08cbf6d3e08bfbb20c7d44d923eeb7c4cb` after browser tests run `40048616600` passed.
- Main browser test run `40049048984` and Pages deployment run `40049047758` passed for pre-PR #23 SHA `5aa98f08cbf6d3e08bfbb20c7d44d923eeb7c4cb`.
- PR #23 `test: cover repeat schedule safety and lifecycle` merged at `b4b940a7321887d5efa764902c85d6c106bf18ab`. PR-head browser test run `40050588266` passed; post-merge main browser test run `40050709567` and Pages deployment run `40050708830` both passed at the merge SHA.
- PR #24 documentation reconciliation merged at `f892203b37245abc36dc7c53aa2d4d0c7b322194`; its browser test run `40084698441` passed.
- PR #25 added a regression test ensuring syntactically malformed JSON backup import is rejected without changing existing records/localStorage. PR test run `40085095269` passed; merged at `7c5b5e01ab3386ec8dd082a5ad66a316c110e1d7`. Post-merge main browser test run `40085533578` and Pages deployment run `40085532938` both passed.
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
8. [DONE] Step 9: repeat schedule regression coverage; PR #23 merged after repeat generation + reload persistence, overlap protection, and repeat-group deletion tests passed. PR-head run `40050588266` and post-merge main run `40050709567` passed.
9. [DONE] Step 10: weekly/monthly category totals for planned and actual time; PR #19.
10. [IN_PROGRESS] Step 11: automated regression and GitHub Pages deployment verification passed at SHA `7c5b5e01ab3386ec8dd082a5ad66a316c110e1d7` (browser run `40085533578`; Pages run `40085532938`). Physical-device mobile checks still outstanding.
11. [IN_PROGRESS] Step 12: strengthen backup/data safety coverage. PR #25 adds malformed-JSON rejection + existing-record preservation; mixed-data backup round-trip and physical-device checks remain to review.

## Step 11 regression review (2026-10-24)
- Reviewed the current Playwright suite: CRUD and save/reload, overlapping actual records, planned/actual totals, date navigation, JSON backup validation and restore/cancel preservation, CSV download, copy/paste safety, Todo completion/category/subtasks persistence, overdue Todo behavior, period category summaries, and 360px viewport overflow are covered.
- Main browser test run `40047433596` passed at SHA `950c65f2f6c32a3ee47da416388d8edb3b96131e`.
- Main browser test run `40047870707` passed at SHA `56371ef37811fb02d70deaf80804d361dd7d07b8`, including PR #21 compatibility/export regression cases.
- GitHub Pages deployment run `40047432993` passed at SHA `950c65f2f6c32a3ee47da416388d8edb3b96131e`.
- GitHub Pages deployment run `40047870286` passed at SHA `56371ef37811fb02d70deaf80804d361dd7d07b8`.
- Automated regression and deployment verification passed for SHA `56371ef37811fb02d70deaf80804d361dd7d07b8`; follow-up main test/deploy runs for later merges are tracked above.
- Latest post-merge browser test run `40085533578` and Pages deployment run `40085532938` both passed for SHA `7c5b5e01ab3386ec8dd082a5ad66a316c110e1d7`, including the new malformed JSON backup preservation regression.
- Manual checks on physical mobile devices have not been performed; automated viewport test is not a substitute.

## Step 9 review notes
- Existing app code already includes repeat templates and repeat groups for planned entries with the note prefix `반복 일정: `.
- Do not recreate recurrence functionality. Review the existing UI and tests for a specific usability or reliability gap before changing behavior.
- Identified a concrete verification gap: no repeat-schedule tests were present in `tests/app.spec.js`. PR #23 adds tests for weekday generation and reload persistence, overlap protection preserving existing plans, and deletion of only the selected repeat group. Application behavior is unchanged. PR #23 merged at `b4b940a7321887d5efa764902c85d6c106bf18ab` after its latest head run `40050588266` passed and the post-merge browser test `40050709567` and Pages deployment `40050708830` both passed.
- Initial PR #23 CI run `40049131805` reported 37 passed and 3 repeat-schedule tests timed out because the advanced settings `<details>` section was collapsed, leaving its controls inaccessible. Updated all three tests to open `.advanced-panel` before interacting; commit `2702b3260b18e561219841f0a2561b78387a8613` opened the panel in tests. Review also caught that the overlap fixture created its existing entry on the default current date rather than the repeat range; the fixture now sets `#day` to `2026-10-26` before adding the existing plan. Commit `55327ba723d2c17ecc4f7522687ae22228d5ac67` contains this test-fixture correction. The latest failure showed 39 passing tests and one assertion expecting five entries in the currently selected day view, although generated plans span five dates. Updated the test to count the five repeat-group records directly in localStorage and verify they remain after reload. New test commit `cf5e65e1d0238f6eb2238b89a08d3e9666d129b1`; latest PR head also included the progress update. Browser test run `40050588266` passed on the latest PR head; PR #23 was then merged and post-merge browser/deployment checks both passed.

## Blocked-task policy
- Do not mark a task DONE when tests fail or verification is missing.
- Record failing test name, exact failure, root-cause hypothesis, and attempted fix.
- After a bounded investigation, move to the next independent task if it can be developed safely without depending on the failure.
- Do not merge failing or unsafe changes to main. Keep blocked work in its PR or close it with a clear explanation.

## Continuous-work reality
- These files preserve instructions and progress when an AI coding agent is invoked again.
- GitHub Actions can run tests/deploy workflows, but cannot autonomously plan and write new code without a separately configured coding agent and its authorized credentials.
- Do not add API keys to source files or commit secrets. Any agent automation must be scoped, reviewable, budget-limited, and must not bypass PR review or tests.


## Backup safety follow-up (2026-10-24)
- Existing coverage already includes malformed-shaped backup rejection, valid JSON restore replacing current data, invalid date/time rejection, canceling restore without changing existing data, CSV download, and legacy Todo backup compatibility.
- Added a focused test for syntactically malformed JSON (`'{"entries":['`) to assert import validation error, unchanged visible entry count, and unchanged `time-tracker-v1` localStorage entry. PR #25 test run `40085095269` passed.
- PR #25 merged at `7c5b5e01ab3386ec8dd082a5ad66a316c110e1d7`; post-merge browser test `40085533578` and Pages deployment `40085532938` passed.
- Remaining checks: inspect backup export coverage and mixed entries+Todo restore round-trip coverage; physical mobile-device verification remains outstanding. No app code or actual user data was modified by PR #25.


## Reconciliation update (2026-10-25)
- Current main SHA after PR #34: `c3cff0d69e00329f4c47f380c952a4f82e1f0b40`.
- PR #31 added safe-mode protection for malformed/invalid stored data and a recovery path; merged to main at `59af7380f9da92cf25e296e52ca74df802e316da`.
- PR #32 added regression coverage that ordinary writes remain blocked in corrupted-data safe mode; merged at `e898810c2cade101192047e8483c2f41b3243366`.
- PR #33 added CSV escaping and invalid date-range regression tests; merged at `0029d0a80768fe0695d7b83615abe3bec6484c74`.
- PR #34 added a multi-date persistence regression test. The first draft incorrectly expected the selected date to persist across reload; investigation confirmed the app intentionally defaults to today on reload. The test was corrected to verify both dates remain stored and that each record appears when its date is selected. No app code or stored-data schema changed.
- PR #34 merged at `c3cff0d69e00329f4c47f380c952a4f82e1f0b40`; post-merge browser test run [40165603074](https://github.com/seriluna/time-tracker/actions/runs/40165603074) passed and GitHub Pages deployment run [40165602920](https://github.com/seriluna/time-tracker/actions/runs/40165602920) passed for the same SHA.
- The automated 360px viewport test remains a regression check, not a substitute for hands-on testing on a physical mobile device.
- Next practical check: on a real phone, add/edit/delete a record, change dates, reload the app, and verify JSON backup download/restore and CSV export. Do not claim physical-device verification until actually performed.


## Reconciliation update (2026-10-25, latest review)
- Latest commit observed in the repository commit search: `7a422be47f37008c9e5cfeea266157f91ad3b865` (storage-write failure handling and regression coverage). This is newer than the previous progress entry's `c3cff0d` reference.
- Reviewed `tests/app.spec.js` and the backup/import logic in `app.js`. Existing tests already cover JSON backup export including both entries and todos, mixed entries+todos restore, todo subtask completion preservation, reload persistence after restore, malformed/invalid backup rejection, cancellation preservation, corrupted-storage recovery, and storage-write failure protection. No duplicate test or app-code change is justified by this review.
- Confirmed the previously supplied browser workflow run [40184408868](https://github.com/seriluna/time-tracker/actions/runs/40184408868) completed successfully, including JavaScript syntax and Playwright browser regression steps.
- Confirmed the previously supplied Pages workflow run [40184408401](https://github.com/seriluna/time-tracker/actions/runs/40184408401) completed successfully, including build and deploy jobs. These are verified run results, but this review did not independently establish that either run was triggered by the latest SHA `7a422be`; do not describe them as post-merge verification for that SHA without checking run metadata.
- Open-PR search did not return a reliable authoritative snapshot of current PR states; do not infer that there are no open PRs from that result alone.
- Physical Android device checks remain outstanding. The automated 360px viewport test is not a substitute for manual mobile verification.
- Next: verify the workflow run commit SHA and current PR state with an authoritative repository/Actions listing when available; complete the physical-device checklist. Do not add duplicate backup tests unless a concrete gap is found.
