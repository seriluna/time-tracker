const { test, expect } = require('@playwright/test');

test.beforeEach(async ({ page }) => {
  page.on('pageerror', error => console.log('PAGEERROR:', error.message));
  page.on('console', message => {
    if (message.type() === 'error') console.log('CONSOLE ERROR:', message.text());
  });
  await page.goto('/');
});

test('앱 초기화와 핵심 DOM 확인', async ({ page }) => {
  await expect(page.getByRole('heading', { name: '시간 기록', exact: true })).toBeVisible();
  await expect(page.locator('#entryForm')).toBeVisible();
  await expect(page.locator('#day')).toHaveValue(/\d{4}-\d{2}-\d{2}/);
  await expect(page.locator('#name')).toBeVisible();
  await expect(page.locator('#entries')).toBeVisible();
  await expect(page.locator('#undoLastChange')).toBeDisabled();
});

test('기록 저장 후 목록과 합계에 반영', async ({ page }) => {
  await page.locator('#name').fill('자동 테스트 운동');
  await page.locator('#start').fill('09:00');
  await page.locator('#end').fill('10:00');
  await page.locator('#entryForm button[type="submit"]').click();
  await expect(page.locator('#entries')).toContainText('자동 테스트 운동');
  await expect(page.locator('#actual')).toHaveText('1시간 0분');
  await expect(page.locator('#count')).toHaveText('1');
});

test('기록이 새로고침 후에도 저장됨', async ({ page }) => {
  await page.locator('#name').fill('저장 확인 기록');
  await page.locator('#entryForm button[type="submit"]').click();
  await page.reload();
  await expect(page.locator('#entries')).toContainText('저장 확인 기록');
  await expect(page.locator('#actual')).toHaveText('1시간 0분');
});

test('겹치는 실제 기록은 중복 저장하지 않음', async ({ page }) => {
  await page.locator('#name').fill('첫 번째 기록');
  await page.locator('#entryForm button[type="submit"]').click();
  await expect(page.locator('#entries')).toContainText('첫 번째 기록');

  page.once('dialog', dialog => dialog.accept());
  await page.locator('#name').fill('겹치는 기록');
  await page.locator('#start').fill('09:30');
  await page.locator('#end').fill('10:30');
  await page.locator('#entryForm button[type="submit"]').click();

  await expect(page.locator('#entries')).toContainText('첫 번째 기록');
  await expect(page.locator('#entries')).not.toContainText('겹치는 기록');
  await expect(page.locator('#count')).toHaveText('1');
});

test('할 일 추가, 완료 체크 및 새로고침 유지', async ({ page }) => {
  await page.locator('[data-tab="todo"]').click();
  await expect(page.locator('#todoPanel')).toBeVisible();
  await page.locator('#todoText').fill('자동 테스트 할 일');
  await page.locator('#todoForm button[type="submit"]').click();
  await expect(page.locator('#todos')).toContainText('자동 테스트 할 일');

  await page.locator('#todos input[type="checkbox"]').check();
  await expect(page.locator('#todos .todo')).toHaveClass(/done/);
  await page.reload();
  await page.locator('[data-tab="todo"]').click();
  await expect(page.locator('#todos .todo')).toHaveClass(/done/);
});

test('실행 취소로 직전 기록 추가를 되돌림', async ({ page }) => {
  await page.locator('#name').fill('취소 대상 기록');
  await page.locator('#entryForm button[type="submit"]').click();
  await expect(page.locator('#entries')).toContainText('취소 대상 기록');
  await expect(page.locator('#undoLastChange')).toBeEnabled();

  page.once('dialog', dialog => dialog.accept());
  await page.locator('#undoLastChange').click();
  await expect(page.locator('#entries')).not.toContainText('취소 대상 기록');
  await expect(page.locator('#count')).toHaveText('0');
});

test('오늘 24시간이 세로 타임라인으로 표시됨', async ({ page }) => {
  await expect(page.locator('#dayTimeline')).toBeVisible();
  await expect(page.locator('.timeline-hour')).toHaveCount(24);
  await expect(page.locator('.timeline-hour').first()).toContainText('00:00');
  await expect(page.locator('.timeline-hour').last()).toContainText('23:00');
});

test('타임라인의 더하기 버튼으로 해당 시간 기록을 바로 시작', async ({ page }) => {
  await page.locator('[data-add-hour="14"]').click();
  const form = page.locator('.timeline-quick-form');
  await expect(form).toBeVisible();
  await expect(form.locator('.timeline-quick-start')).toHaveValue('14:00');
  await expect(form.locator('.timeline-quick-end')).toHaveValue('15:00');
  await expect(form.locator('.timeline-quick-name')).toBeFocused();
});
test('작은 모바일 화면에서 가로 넘침이 없음', async ({ page }) => {
  await page.setViewportSize({ width: 360, height: 800 });
  await page.reload();
  const sizes = await page.evaluate(() => ({
    viewport: document.documentElement.clientWidth,
    content: document.documentElement.scrollWidth,
  }));
  expect(sizes.content).toBeLessThanOrEqual(sizes.viewport);
});

test('타임라인의 기록을 눌러 수정 폼으로 이동', async ({ page }) => {
  await page.locator('#name').fill('타임라인 수정 테스트');
  await page.locator('#start').fill('14:00');
  await page.locator('#end').fill('15:00');
  await page.locator('#entryForm button[type="submit"]').click();
  await page.locator('[data-timeline-entry]').filter({ hasText: '타임라인 수정 테스트' }).click();
  await expect(page.locator('#name')).toHaveValue('타임라인 수정 테스트');
  await expect(page.locator('#saveEntry')).toHaveText('수정 저장');
  await page.locator('#name').fill('수정 완료');
  await page.locator('#entryForm button[type="submit"]').click();
  await expect(page.locator('#entries')).toContainText('수정 완료');
  await expect(page.locator('#entries')).not.toContainText('타임라인 수정 테스트');
});

test('시간 칸에서 인라인으로 기록 추가', async ({ page }) => {
  await page.locator('[data-add-hour="14"]').click();
  const form=page.locator('.timeline-quick-form');
  await expect(form).toBeVisible();
  await form.locator('.timeline-quick-name').fill('인라인 빠른 기록');
  await form.getByRole('button', { name: '저장' }).click();
  await expect(page.locator('#entries')).toContainText('인라인 빠른 기록');
  await expect(page.locator('[data-timeline-entry]').filter({hasText:'인라인 빠른 기록'})).toBeVisible();
});

test('기록 삭제 후 개수와 합계가 갱신됨', async ({ page }) => {
  await page.locator('#name').fill('삭제할 기록');
  await page.locator('#start').fill('09:00');
  await page.locator('#end').fill('10:00');
  await page.locator('#entryForm button[type="submit"]').click();

  await expect(page.locator('#actual')).toHaveText('1시간 0분');
  await expect(page.locator('#count')).toHaveText('1');

  await page.locator('[data-del]').click();

  await expect(page.locator('#entries')).not.toContainText('삭제할 기록');
  await expect(page.locator('#actual')).toHaveText('0분');
  await expect(page.locator('#count')).toHaveText('0');
});

test('계획 시간과 실제 시간이 따로 합산됨', async ({ page }) => {
  await page.locator('#name').fill('실제 업무');
  await page.locator('#start').fill('09:00');
  await page.locator('#end').fill('10:00');
  await page.locator('#kind').selectOption('actual');
  await page.locator('#entryForm button[type="submit"]').click();

  await page.locator('#name').fill('계획 업무');
  await page.locator('#start').fill('10:00');
  await page.locator('#end').fill('11:00');
  await page.locator('#kind').selectOption('planned');
  await page.locator('#entryForm button[type="submit"]').click();

  await expect(page.locator('#actual')).toHaveText('1시간 0분');
  await expect(page.locator('#planned')).toHaveText('1시간 0분');
  await expect(page.locator('#count')).toHaveText('2');
});

test('날짜를 바꾸면 선택한 날짜의 기록만 표시됨', async ({ page }) => {
  const today = await page.locator('#day').inputValue();
  await page.locator('#name').fill('오늘 기록');
  await page.locator('#entryForm button[type="submit"]').click();
  await expect(page.locator('#entries')).toContainText('오늘 기록');

  const previous = await page.evaluate(value => {
    const d = new Date(value + 'T12:00:00');
    d.setDate(d.getDate() - 1);
    const pad = n => String(n).padStart(2, '0');
    return d.getFullYear() + '-' + pad(d.getMonth() + 1) + '-' + pad(d.getDate());
  }, today);
  await page.locator('#day').fill(previous);
  await expect(page.locator('#entries')).not.toContainText('오늘 기록');
  await expect(page.locator('#count')).toHaveText('0');

  await page.locator('#day').fill(today);
  await expect(page.locator('#entries')).toContainText('오늘 기록');
});

test('잘못된 JSON 백업은 거부하고 기존 기록을 유지함', async ({ page }) => {
  await page.locator('#name').fill('기존 기록 유지');
  await page.locator('#entryForm button[type="submit"]').click();
  await expect(page.locator('#entries')).toContainText('기존 기록 유지');

  await page.locator('.tools-menu').locator('summary').click();
  await page.locator('#importFile').setInputFiles({
    name: 'invalid-backup.json',
    mimeType: 'application/json',
    buffer: Buffer.from('{"entries":[{"broken":true}],"todos":[]}', 'utf8'),
  });

  await expect(page.locator('#importPreview')).toContainText('백업 파일 형식이 올바르지 않거나 데이터에 오류가 있습니다');
  await expect(page.locator('#entries')).toContainText('기존 기록 유지');
  await expect(page.locator('#count')).toHaveText('1');
});

test('유효한 JSON 백업 복원은 현재 데이터를 백업 데이터로 교체함', async ({ page }) => {
  await page.locator('#name').fill('복원 전 기록');
  await page.locator('#entryForm button[type="submit"]').click();

  const date = await page.locator('#day').inputValue();
  const backup = {
    entries: [{
      id: 'backup-entry-1',
      date,
      name: '복원된 기록',
      start: '13:00',
      end: '14:00',
      kind: 'actual',
      cat: '테스트',
      note: '',
    }],
    todos: [],
  };

  await page.locator('.tools-menu').locator('summary').click();
  await page.locator('#importFile').setInputFiles({
    name: 'valid-backup.json',
    mimeType: 'application/json',
    buffer: Buffer.from(JSON.stringify(backup), 'utf8'),
  });
  await expect(page.locator('#importPreview')).toContainText('백업 파일 검증 완료');

  page.once('dialog', dialog => dialog.accept());
  await page.locator('#confirmImport').click();

  await expect(page.locator('#entries')).toContainText('복원된 기록');
  await expect(page.locator('#entries')).not.toContainText('복원 전 기록');
  await expect(page.locator('#actual')).toHaveText('1시간 0분');

  await page.reload();
  await expect(page.locator('#entries')).toContainText('복원된 기록');
  await expect(page.locator('#entries')).not.toContainText('복원 전 기록');
  await expect(page.locator('#actual')).toHaveText('1시간 0분');
});

test('정상 날짜와 시간이 포함된 백업을 검증함', async ({ page }) => {
  const date = await page.locator('#day').inputValue();
  const backup = {
    entries: [{
      id: 'valid-date-time-entry',
      date,
      name: '정상 날짜 시간 기록',
      start: '13:00',
      end: '14:00',
      kind: 'actual',
      cat: '테스트',
      note: '',
    }],
    todos: [],
  };

  await page.locator('.tools-menu').locator('summary').click();
  await page.locator('#importFile').setInputFiles({
    name: 'valid-date-time-backup.json',
    mimeType: 'application/json',
    buffer: Buffer.from(JSON.stringify(backup), 'utf8'),
  });

  await expect(page.locator('#importPreview')).toContainText('백업 파일 검증 완료');
});

test('잘못된 날짜와 시간의 백업은 거부함', async ({ page }) => {
  const backup = {
    entries: [{
      id: 'invalid-date-time-entry',
      date: '2026-02-30',
      name: '잘못된 날짜 기록',
      start: '25:00',
      end: '26:00',
      kind: 'actual',
      cat: '테스트',
      note: '',
    }],
    todos: [],
  };

  await page.locator('.tools-menu').locator('summary').click();
  await page.locator('#importFile').setInputFiles({
    name: 'invalid-date-time-backup.json',
    mimeType: 'application/json',
    buffer: Buffer.from(JSON.stringify(backup), 'utf8'),
  });

  await expect(page.locator('#importPreview')).toContainText('백업 파일 형식이 올바르지 않거나 데이터에 오류가 있습니다');
});



test('복원 확인을 취소하면 기존 기록을 그대로 유지함', async ({ page }) => {
  await page.locator('#name').fill('취소 후에도 유지할 기록');
  await page.locator('#start').fill('09:00');
  await page.locator('#end').fill('10:00');
  await page.locator('#entryForm button[type="submit"]').click();

  const date = await page.locator('#day').inputValue();
  const backup = {
    entries: [{
      id: 'cancelled-restore-entry',
      date,
      name: '복원되면 안 되는 기록',
      start: '13:00',
      end: '14:00',
      kind: 'actual',
      cat: '테스트',
      note: '',
    }],
    todos: [],
  };

  await page.locator('.tools-menu').locator('summary').click();
  await page.locator('#importFile').setInputFiles({
    name: 'cancelled-restore-backup.json',
    mimeType: 'application/json',
    buffer: Buffer.from(JSON.stringify(backup), 'utf8'),
  });
  await expect(page.locator('#importPreview')).toContainText('백업 파일 검증 완료');

  page.once('dialog', dialog => dialog.dismiss());
  await page.locator('#confirmImport').click();

  await expect(page.locator('#entries')).toContainText('취소 후에도 유지할 기록');
  await expect(page.locator('#entries')).not.toContainText('복원되면 안 되는 기록');
  await expect(page.locator('#actual')).toHaveText('1시간 0분');
  await expect(page.locator('#count')).toHaveText('1');
});

test('CSV 내보내기가 기록과 함께 다운로드됨', async ({ page }) => {
  await page.locator('#name').fill('CSV 내보내기 테스트 기록');
  await page.locator('#start').fill('09:00');
  await page.locator('#end').fill('10:00');
  await page.locator('#entryForm button[type="submit"]').click();

  await page.locator('.tools-menu').locator('summary').click();
  const downloadPromise = page.waitForEvent('download');
  await page.locator('#csvExport').click();
  const download = await downloadPromise;

  expect(download.suggestedFilename()).toMatch(/^time-tracker-.*-.*\.csv$/);
  const stream = await download.createReadStream();
  let csv = '';
  for await (const chunk of stream) csv += chunk.toString('utf8');
  expect(csv).toContain('CSV 내보내기 테스트 기록');
  expect(csv).toContain('시간(분)');
});
