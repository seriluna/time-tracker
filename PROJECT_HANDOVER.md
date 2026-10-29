# Time Tracker — Project Handover

> 목적: 이 문서만으로도 새 대화창이나 다른 개발자가 프로젝트의 목적, 현재 상태, 제약, 다음 작업을 이해하고 안전하게 이어갈 수 있도록 합니다.
> 마지막 확인 기준: 2026-10-13 (대화에서 확인한 GitHub 저장소 상태 기준)

## 1. 프로젝트 개요

- 저장소: https://github.com/seriluna/time-tracker
- 공개 앱: https://seriluna.github.io/time-tracker/
- 기본 브랜치: `main`
- 형태: 정적 웹앱 / PWA
- 언어: HTML, CSS, Vanilla JavaScript
- 데이터: 브라우저 localStorage. 현재 서버 계정이나 클라우드 동기화는 없음.
- 핵심 UX: 첫 화면에서 오늘 00:00–23:00을 세로로 훑고, 시간대별 `+` 버튼을 눌러 해당 시간 칸에서 바로 활동을 추가하며, 기존 타임라인 항목을 눌러 수정.

## 2. 핵심 파일

| 경로 | 역할 |
|---|---|
| `index.html` | 앱 구조, 날짜·기록·할 일·도구 UI |
| `style.css` | 모바일 우선 레이아웃과 타임라인 스타일 |
| `app.js` | 기록 CRUD, 시간 계산, localStorage, 타임라인 및 빠른 입력 |
| `manifest.json` | PWA 이름·시작 경로·표시 모드 |
| `sw.js` | 정적 파일 캐시 및 오프라인 fallback. 현재 캐시 버전은 `time-tracker-v25` |
| `icon.svg` | PWA 아이콘 |
| `package.json` | Playwright 테스트 의존성 및 `npm test` |
| `playwright.config.js` | 테스트 서버와 브라우저 설정 |
| `tests/app.spec.js` | 핵심 흐름의 브라우저 회귀 테스트 |
| `.github/workflows/test.yml` | main push, pull request, 수동 실행 시 자동 검사 |
| `README.md` | 앱 사용 및 개발 시작 안내 |
| `TESTING.md` | 자동·수동 테스트 절차 |

## 3. 현재 확인된 기능

- 날짜별 시간 기록 추가·수정·삭제
- 실제/계획 기록 유형, 활동 분류와 메모 필드
- 기록 기간과 합계 표시
- 같은 날짜·같은 종류의 시간이 겹치는 기록 방지
- 할 일 추가 및 완료 체크
- 직전 변경 실행 취소
- JSON 백업·복원 및 CSV 내보내기 관련 UI
- 저장 상태 점검 및 이전 자동 백업 관련 UI
- 24시간 세로 타임라인, 시간대별 인라인 빠른 입력, 타임라인 항목 클릭 수정
- PWA manifest와 service worker

기능 목록은 코드에 구현된 흐름을 바탕으로 정리한 것이며, 모든 항목이 실제 Android 기기에서 검증되었다는 뜻은 아닙니다.

## 4. 자동 테스트 상태

최근 확인한 실행: https://github.com/seriluna/time-tracker/actions/runs/38311282000

확인 결과:
- GitHub Actions: Success
- `node --check app.js`: 성공
- Playwright 브라우저 회귀 테스트: 성공
- 빠른 입력 테스트는 이전 테스트가 일반 폼의 `#start`를 확인해 실패했었고, UI에 맞춰 `.timeline-quick-start`와 `.timeline-quick-end`를 확인하도록 맞춘 뒤 성공함.

자동 테스트 성공은 실제 Android 설치, 오프라인 실행, 모든 백업/복원 상황까지 보장하지 않습니다.

## 5. 데이터와 안전 주의사항

- 실제 기록은 브라우저 localStorage에 보관됩니다.
- 브라우저 저장 데이터 삭제, 브라우저 변경, 기기 변경 시 기록이 사라질 수 있습니다.
- 민감한 실제 사용자 기록을 테스트 fixture나 Git 커밋에 포함하지 마세요.
- 테스트는 새 Playwright browser context를 사용해야 합니다.
- 백업 파일에는 개인적인 시간 기록이 포함될 수 있으므로 공개 저장소에 올리지 마세요.
- 서비스 워커가 오래된 UI를 표시할 수 있습니다. UI 정적 파일 변경 시 캐시 버전과 파일 목록을 확인하고, 설치된 PWA에서 업데이트를 검증하세요.
- 자정 넘어가는 활동은 현재 시작·종료 검증 규칙과 맞지 않을 수 있으므로 별도 요구사항으로 검토해야 합니다.

## 6. 알려진 검증 과제

1. Android Chrome에서 설치·실행 및 좁은 화면 레이아웃을 실제 확인.
2. PWA 업데이트와 service worker 캐시 갱신 확인.
3. JSON 백업 복원, 잘못된 파일, 손상 데이터, 이전 백업 복구를 자동 테스트로 추가.
4. 기록 삭제 및 수정 흐름의 테스트 범위를 점검.
5. 날짜 경계와 자정을 넘는 기록의 정책을 결정.
6. 브랜치별 PR을 사용하는 개발 절차를 확립하고 GitHub branch protection / required checks 설정을 검토.
7. 프로젝트 문서가 변경될 때 이 파일도 함께 갱신.

## 7. 권장 개발 절차

1. 이 문서와 관련 파일을 읽고 현재 상태를 확인.
2. 하나의 작은 작업과 완료 기준을 정함.
3. 가능하면 기능 브랜치에서 수정하고, 작업 내용을 커밋.
4. `npm test` 및 필요 시 수동 테스트 실행.
5. Pull Request에서 변경 사항·테스트 결과·위험을 설명.
6. 통과 및 검토 후 병합하고 실제 서비스 상태를 확인.
7. README, 이 문서, TESTING.md를 갱신.

현재 GitHub branch protection 설정이 실제로 켜져 있는지는 별도 확인이 필요합니다. 문서에 설정이 활성화되었다고 가정하지 마세요.

## 8. 다음 작업 순서

- [ ] 문서 초안 검토 및 README/TESTING와 일치 여부 확인
- [ ] Android 실제 기기 점검
- [ ] 백업·복원 회귀 테스트 보강
- [ ] GitHub 기능 브랜치 + PR 흐름과 branch protection 설정 검토
- [ ] 최종 PWA 오프라인/업데이트 점검

## 9. 다음 대화창에 붙여 넣을 시작 문구

이 저장소의 `PROJECT_HANDOVER.md`, `README.md`, `TESTING.md`를 먼저 읽고 현재 상태를 확인해. 앱은 Time Tracker 프로젝트만 다룬다. 관련 없는 저장소는 변경하지 않는다. 기존 코드나 설정을 수정하기 전에 작업 범위와 위험을 먼저 설명하고 승인받는다. 수정 후 자동 테스트와 실제 검증 여부를 구분해서 보고하며, 확인하지 않은 항목을 성공했다고 말하지 않는다.


## Current handover update (2026-10-25)
- Latest commit observed in repository history: `7a422be47f37008c9e5cfeea266157f91ad3b865` (storage-write failure handling and regression coverage). Treat this as the latest observed commit, while confirming the current default-branch HEAD before starting future code changes.
- Backup safety review: `tests/app.spec.js` already tests JSON export of both `entries` and `todos`, mixed-data restore, subtask completion preservation, reload persistence, malformed/invalid backup rejection, cancel preservation, corrupted-storage recovery, and write-failure protection. Avoid duplicate tests unless a concrete missing case is identified.
- Browser run [40184408868](https://github.com/seriluna/time-tracker/actions/runs/40184408868) and Pages deployment run [40184408401](https://github.com/seriluna/time-tracker/actions/runs/40184408401) were confirmed successful at the job level. Their exact tested/deployed commit SHA was not independently confirmed during this review.
- Manual Android checks remain incomplete: CRUD, date navigation, reload persistence, JSON download/restore, CSV export, and mobile interactions. Do not claim physical-device verification until performed.
- Preserve existing `time-tracker-v1` storage key and `{ entries: [], todos: [] }` shape. No live user data was changed during this review.


## Post-merge status update (2026-10-25)
- PR #37 was merged into `main` at `a77e2397f7ae6c3cc6e579b4965defbf3f623052`. It updates only `PROJECT_PROGRESS.md` and `PROJECT_HANDOVER.md`; app behavior and stored data format are unchanged.
- PR-head browser workflow [40185750669](https://github.com/seriluna/time-tracker/actions/runs/40185750669) passed, including JavaScript syntax check and Playwright browser regression tests.
- Post-merge GitHub Pages deployment for the merge SHA was not independently confirmed. The public site inspection attempt was blocked, so deployment status remains unverified rather than assumed successful.
- Continue with deployment verification and physical Android checks; automated viewport tests do not substitute for a real device.

## Annual analysis work (2026-10-25)
- User reported that the mobile checklist had no issues. Treat this as user-reported, not as an independently witnessed physical-device test.
- The current feature branch `feat/yearly-time-summary` adds annual planned/actual summaries and monthly rows to the Analysis tab, plus a Playwright regression test and service-worker cache bump (`time-tracker-v28`).
- Do not merge or claim deployment until PR CI and post-merge deployment are checked. Existing localStorage key/schema and user data remain unchanged.


## Annual summary post-merge status (2026-10-25)
- PR #39 adds annual planned/actual totals, recorded-day count, average actual time per recorded day, and monthly rows for the selected year. It is merged into `main` at `50e6a532beb8e4fe164fe3b15659654e52b8dbee`.
- Browser workflow [40203257295](https://github.com/seriluna/time-tracker/actions/runs/40203257295) passed after correcting test expectations to match the UI duration format.
- Confirmed the `main` branch contains the annual summary markup and `time-tracker-v28` service-worker cache version.
- Live GitHub Pages deployment was not independently verified; check the Pages workflow run or public site before claiming deployment complete.
- No storage key/schema migration or user data deletion occurred. Physical Android checks are not independently verified; distinguish user-reported checks from assistant-performed tests.


## Live annual-summary confirmation (2026-10-29)
- User confirmed that the public Time Tracker site shows the annual summary: https://seriluna.github.io/time-tracker/.
- This is direct user confirmation of visible live UI, not an independently observed browser session or a Pages workflow-to-SHA verification.
- PR #39 remains merged at `50e6a532beb8e4fe164fe3b15659654e52b8dbee`; browser regression run [40203257295](https://github.com/seriluna/time-tracker/actions/runs/40203257295) passed.
- Storage key `time-tracker-v1` and data shape `{ entries: [], todos: [] }` remain unchanged; no migration or deletion occurred.
- Next step: prioritize deployed core-flow reliability validation over new feature work: add/edit/delete records, switch dates, reload and confirm persistence, then test JSON backup/restore and CSV export. Record physical-device checks as user-reported unless directly witnessed; automated viewport tests are not a physical-device substitute.


## Structural storage validation follow-up (2026-10-29)
- New PR: structurally invalid localStorage records are rejected before rendering, including invalid entry/Todo shapes and duplicate top-level IDs. Existing safe mode keeps the raw original available for download and blocks normal writes.
- Regression tests cover malformed entry and Todo objects; service-worker cache is bumped to `time-tracker-v29`.
- Do not merge until PR browser tests pass. No migration, storage key change, or live user data modification.
- After merge, confirm the deployed app and prioritize remaining real-device core-flow checks rather than adding unrelated features.
