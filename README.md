# Time Tracker

개인용 하루 시간 기록 웹앱입니다. 오늘의 24시간 타임라인에서 활동을 확인하고, 시간대의 `+` 버튼으로 기록을 빠르게 추가할 수 있습니다.

## 앱 사용하기

- **서비스:** https://seriluna.github.io/time-tracker/
- **플랫폼:** 모바일·데스크톱 웹, Android Chrome의 홈 화면 설치(PWA)
- **언어:** 한국어
- **저장 방식:** 브라우저의 기기 내 저장소(localStorage). 서버 계정 동기화는 제공하지 않습니다.

### Android 설치

1. Chrome에서 위 서비스 주소를 엽니다.
2. Chrome 메뉴에서 **앱 설치** 또는 **홈 화면에 추가**를 선택합니다.
3. 홈 화면 아이콘으로 실행합니다.

브라우저 데이터를 삭제하거나 기기를 변경하면 기록을 잃을 수 있으므로, 앱의 JSON 백업 기능을 정기적으로 사용하세요. 오프라인 사용 가능 여부는 기기에서 직접 확인해야 합니다.

## 개발 및 테스트

필수 환경: Node.js 20 이상, Python 3, npm.

```bash
npm install
npx playwright install --with-deps chromium
npm test
```

테스트는 Playwright와 Python 내장 HTTP 서버를 사용합니다. 자세한 내용은 [TESTING.md](./TESTING.md)를 참고하세요.

## 문서

- [프로젝트 인수인계](./PROJECT_HANDOVER.md)
- [테스트 안내](./TESTING.md)

## 기여 및 변경 절차

작업 전 Issue 또는 작업 설명을 남기고, 변경 범위를 작게 유지하세요. 자동 테스트를 실행하고 결과를 확인한 뒤 Pull Request에서 검토하는 방식을 권장합니다. 현재 기본 브랜치는 `main`입니다. 브랜치 보호 규칙 적용 여부는 GitHub 저장소 설정에서 별도로 확인해야 합니다.
