const { test, expect } = require('@playwright/test');

test.beforeEach(async ({ page }) => {
  page.on('pageerror', error => console.log('PAGEERROR:', error.message));
  page.on('console', message => {
    if (message.type() === 'error') console.log('CONSOLE ERROR:', message.text());
  });
  await page.goto('/');
  await page.locator('#entryAdvancedFields').evaluate(el => { el.open = true; });
});


test('구조적으로 잘못된 시간 기록은 원본을 보존하고 안전 모드로 전환함', async ({ page }) => {
  const raw = JSON.stringify({ entries: [null], todos: [] });
  await page.evaluate(value => localStorage.setItem('time-tracker-v1', value), raw);
  await page.reload();
  await page.locator('.tools-menu summary').click();

  await expect(page.locator('#storageHealthStatus')).toContainText('읽기 전용 안전 모드');
  await page.locator('#name').fill('잘못된 저장 데이터 위에 쓰기 시도');
  page.once('dialog', dialog => dialog.accept());
  await page.locator('#entryForm button[type="submit"]').click();
  await expect.poll(() => page.evaluate(() => localStorage.getItem('time-tracker-v1'))).toBe(raw);
});

test('구조적으로 잘못된 할 일은 원본을 보존하고 안전 모드로 전환함', async ({ page }) => {
  const raw = JSON.stringify({ entries: [], todos: [{ id: 'bad-todo', date: '2026-10-29', text: '잘못된 할 일', done: '아니오' }] });
  await page.evaluate(value => localStorage.setItem('time-tracker-v1', value), raw);
  await page.reload();
  await page.locator('.tools-menu summary').click();

  await expect(page.locator('#storageHealthStatus')).toContainText('읽기 전용 안전 모드');
  // Close the sticky backup menu before interacting with the Todo panel.
  await page.locator('.tools-menu summary').click();
  await page.locator('[data-tab="todo"]').click();
  await page.locator('#todoText').fill('잘못된 저장 데이터 위에 쓰기 시도');
  page.once('dialog', dialog => dialog.accept());
  await page.locator('#todoForm button[type="submit"]').click();
  await expect.poll(() => page.evaluate(() => localStorage.getItem('time-tracker-v1'))).toBe(raw);
});


test('손상된 기존 저장 데이터는 덮어쓰지 않고 안전한 백업 복원을 허용함', async ({ page }) => {
  const corruptRaw = '{"entries":[';
  await page.evaluate(raw => localStorage.setItem('time-tracker-v1', raw), corruptRaw);
  await page.reload();
  await page.locator('.tools-menu summary').click();

  await expect(page.locator('#storageHealthStatus')).toContainText('읽기 전용 안전 모드');
  await expect(page.locator('#importPreview')).toContainText('기존 저장 데이터를 읽지 못했습니다');

  // Attempt a normal write while in safe mode; the corrupt original must remain byte-for-byte unchanged.
  await page.locator('#name').fill('안전 모드에서 저장 시도');
  page.once('dialog', dialog => dialog.accept());
  await page.locator('#entryForm button[type="submit"]').click();
  await expect.poll(() => page.evaluate(() => localStorage.getItem('time-tracker-v1'))).toBe(corruptRaw);
  await expect(page.locator('#storageHealthStatus')).toContainText('읽기 전용 안전 모드');

  const downloadPromise = page.waitForEvent('download');
  await page.locator('#downloadCorruptOriginal').click();
  const download = await downloadPromise;
  expect(download.suggestedFilename()).toMatch(/^time-tracker-corrupted-original-.*\.json$/);
  const stream = await download.createReadStream();
  let original = '';
  for await (const chunk of stream) original += chunk.toString('utf8');
  expect(original).toBe(corruptRaw);

  await page.locator('#importFile').setInputFiles({
    name: 'recovery-backup.json',
    mimeType: 'application/json',
    buffer: Buffer.from(JSON.stringify({ entries: [], todos: [] }), 'utf8'),
  });
  await expect(page.locator('#importPreview')).toContainText('백업 파일 검증 완료');
  if (!(await page.locator('#confirmImport').isVisible())) await page.locator('.tools-menu summary').click();
  page.once('dialog', dialog => dialog.accept());
  await page.locator('#confirmImport').click();

  const saved = await page.evaluate(() => ({
    raw: localStorage.getItem('time-tracker-v1'),
    data: JSON.parse(localStorage.getItem('time-tracker-v1')),
  }));
  expect(saved.raw).not.toBe(corruptRaw);
  expect(saved.data).toEqual({ entries: [], todos: [] });
  await expect(page.locator('#storageHealthStatus')).not.toContainText('읽기 전용 안전 모드');
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


test('직전 저장 상태 복구는 최신 자동 백업이 아닌 이전 데이터 상태를 복원함', async ({ page }) => {
  await page.locator('#name').fill('먼저 저장한 기록');
  await page.locator('#entryForm button[type="submit"]').click();
  await page.locator('#name').fill('나중에 추가한 기록');
  await page.locator('#entryForm button[type="submit"]').click();
  await expect(page.locator('#entries')).toContainText('나중에 추가한 기록');

  await page.locator('.tools-menu summary').click();
  page.once('dialog', dialog => dialog.accept());
  await page.locator('#restorePreviousBackup').click();

  await expect(page.locator('#entries')).toContainText('먼저 저장한 기록');
  await expect(page.locator('#entries')).not.toContainText('나중에 추가한 기록');
  const saved = await page.evaluate(() => JSON.parse(localStorage.getItem('time-tracker-v1')));
  expect(saved.entries).toHaveLength(1);
  expect(saved.entries[0].name).toBe('먼저 저장한 기록');
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
  await page.locator('#entryAdvancedFields').evaluate(el => { el.open = true; });
  await page.locator('#kind').selectOption('actual');
  await page.locator('#entryForm button[type="submit"]').click();

  await page.locator('#name').fill('계획 업무');
  await page.locator('#start').fill('10:00');
  await page.locator('#end').fill('11:00');
  await page.locator('#entryAdvancedFields').evaluate(el => { el.open = true; });
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

test('서로 다른 날짜의 기록은 날짜 이동과 새로고침 후에도 각각 유지됨', async ({ page }) => {
  const firstDate = await page.locator('#day').inputValue();
  const secondDate = await page.evaluate(value => {
    const d = new Date(value + 'T12:00:00');
    d.setDate(d.getDate() - 2);
    const pad = n => String(n).padStart(2, '0');
    return d.getFullYear() + '-' + pad(d.getMonth() + 1) + '-' + pad(d.getDate());
  }, firstDate);

  await page.locator('#name').fill('첫 번째 날짜 기록');
  await page.locator('#start').fill('09:00');
  await page.locator('#end').fill('10:00');
  await page.locator('#entryForm button[type="submit"]').click();

  await page.locator('#day').fill(secondDate);
  await expect(page.locator('#entries')).not.toContainText('첫 번째 날짜 기록');
  await page.locator('#name').fill('두 번째 날짜 기록');
  await page.locator('#start').fill('11:00');
  await page.locator('#end').fill('12:00');
  await page.locator('#entryForm button[type="submit"]').click();
  await expect(page.locator('#entries')).toContainText('두 번째 날짜 기록');

  await page.reload();
  // The app opens on today's date after reload; verify both dated records remain stored.
  const savedAfterReload = await page.evaluate(() => JSON.parse(localStorage.getItem('time-tracker-v1')));
  expect(savedAfterReload.entries).toHaveLength(2);
  expect(savedAfterReload.entries.find(entry => entry.name === '첫 번째 날짜 기록').date).toBe(firstDate);
  expect(savedAfterReload.entries.find(entry => entry.name === '두 번째 날짜 기록').date).toBe(secondDate);

  await page.locator('#day').fill(secondDate);
  await expect(page.locator('#entries')).toContainText('두 번째 날짜 기록');
  await expect(page.locator('#entries')).not.toContainText('첫 번째 날짜 기록');

  await page.locator('#day').fill(firstDate);
  await expect(page.locator('#entries')).toContainText('첫 번째 날짜 기록');
  await expect(page.locator('#entries')).not.toContainText('두 번째 날짜 기록');

  const saved = await page.evaluate(() => JSON.parse(localStorage.getItem('time-tracker-v1')));
  expect(saved.entries).toHaveLength(2);
  expect(saved.entries.find(entry => entry.name === '첫 번째 날짜 기록').date).toBe(firstDate);
  expect(saved.entries.find(entry => entry.name === '두 번째 날짜 기록').date).toBe(secondDate);
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

test('JSON 문법이 깨진 백업은 거부하고 기존 기록을 유지함', async ({ page }) => {
  await page.locator('#name').fill('문법 오류 후에도 유지할 기록');
  await page.locator('#entryForm button[type="submit"]').click();
  await expect(page.locator('#entries')).toContainText('문법 오류 후에도 유지할 기록');

  await page.locator('.tools-menu').locator('summary').click();
  await page.locator('#importFile').setInputFiles({
    name: 'malformed-backup.json',
    mimeType: 'application/json',
    buffer: Buffer.from('{"entries":[', 'utf8'),
  });

  await expect(page.locator('#importPreview')).toContainText('백업 파일 형식이 올바르지 않거나 데이터에 오류가 있습니다');
  await expect(page.locator('#entries')).toContainText('문법 오류 후에도 유지할 기록');
  await expect(page.locator('#count')).toHaveText('1');

  const saved = await page.evaluate(() => JSON.parse(localStorage.getItem('time-tracker-v1')));
  expect(saved.entries).toHaveLength(1);
  expect(saved.entries[0].name).toBe('문법 오류 후에도 유지할 기록');
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

test('JSON 백업 다운로드에 시간 기록과 할 일이 모두 포함됨', async ({ page }) => {
  await page.locator('#name').fill('JSON 백업 시간 기록');
  await page.locator('#start').fill('08:00');
  await page.locator('#end').fill('09:00');
  await page.locator('#entryForm button[type="submit"]').click();

  await page.locator('[data-tab="todo"]').click();
  await page.locator('#todoText').fill('JSON 백업 할 일');
  await page.locator('#todoForm button[type="submit"]').click();

  await page.locator('.tools-menu').locator('summary').click();
  const downloadPromise = page.waitForEvent('download');
  await page.locator('#export').click();
  const download = await downloadPromise;

  expect(download.suggestedFilename()).toMatch(/^time-tracker-backup-.*\.json$/);
  const stream = await download.createReadStream();
  let raw = '';
  for await (const chunk of stream) raw += chunk.toString('utf8');
  const backup = JSON.parse(raw);
  expect(backup.entries).toHaveLength(1);
  expect(backup.entries[0].name).toBe('JSON 백업 시간 기록');
  expect(backup.todos).toHaveLength(1);
  expect(backup.todos[0].text).toBe('JSON 백업 할 일');
});

test('JSON 백업 복원 시 시간 기록과 할 일을 함께 복원하고 새로고침 후 유지함', async ({ page }) => {
  await page.locator('#name').fill('복원 전 시간 기록');
  await page.locator('#entryForm button[type="submit"]').click();
  await page.locator('[data-tab="todo"]').click();
  await page.locator('#todoText').fill('복원 전 할 일');
  await page.locator('#todoForm button[type="submit"]').click();

  const date = await page.locator('#day').inputValue();
  const backup = {
    entries: [{
      id: 'mixed-restore-entry',
      date,
      name: '복원된 시간 기록',
      start: '13:00',
      end: '14:00',
      kind: 'actual',
      cat: '테스트',
      note: '',
    }],
    todos: [{
      id: 'mixed-restore-todo',
      date,
      text: '복원된 할 일',
      done: false,
      category: 'personal',
      subtasks: [{ id: 'mixed-restore-subtask', text: '하위 작업 확인', done: true }],
    }],
  };

  await page.locator('.tools-menu').locator('summary').click();
  await page.locator('#importFile').setInputFiles({
    name: 'mixed-entries-todos-backup.json',
    mimeType: 'application/json',
    buffer: Buffer.from(JSON.stringify(backup), 'utf8'),
  });
  await expect(page.locator('#importPreview')).toContainText('백업 파일 검증 완료');

  page.once('dialog', dialog => dialog.accept());
  await page.locator('#confirmImport').click();

  await expect(page.locator('#entries')).toContainText('복원된 시간 기록');
  await expect(page.locator('#entries')).not.toContainText('복원 전 시간 기록');
  await page.locator('[data-tab="todo"]').click();
  const restoredTodo = page.locator('#todos .todo').filter({ hasText: '복원된 할 일' });
  await expect(restoredTodo).toBeVisible();
  await expect(page.locator('#todos')).not.toContainText('복원 전 할 일');

  let saved = await page.evaluate(() => JSON.parse(localStorage.getItem('time-tracker-v1')));
  expect(saved.entries).toHaveLength(1);
  expect(saved.todos).toHaveLength(1);
  expect(saved.todos[0].subtasks).toEqual([{ id: 'mixed-restore-subtask', text: '하위 작업 확인', done: true }]);

  await page.reload();
  await expect(page.locator('#entries')).toContainText('복원된 시간 기록');
  await page.locator('[data-tab="todo"]').click();
  const afterReload = page.locator('#todos .todo').filter({ hasText: '복원된 할 일' });
  await expect(afterReload).toBeVisible();
  await afterReload.locator('details[data-subtask-children$="|root"] > summary').click();
  await expect(afterReload.locator('input[data-subtask-check]')).toBeChecked();

  saved = await page.evaluate(() => JSON.parse(localStorage.getItem('time-tracker-v1')));
  expect(saved.entries[0].name).toBe('복원된 시간 기록');
  expect(saved.todos[0].text).toBe('복원된 할 일');
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

test('선택한 기간의 시간 기록과 할 일만 CSV로 내보냄', async ({ page }) => {
  await page.locator('#day').fill('2026-10-01');
  await page.locator('#name').fill('기간 안의 기록');
  await page.locator('#entryForm button[type="submit"]').click();

  await page.locator('#day').fill('2026-10-20');
  await page.locator('#name').fill('기간 밖의 기록');
  await page.locator('#entryForm button[type="submit"]').click();

  await page.locator('[data-tab="todo"]').click();
  await page.locator('#day').fill('2026-10-05');
  await page.locator('#todoText').fill('기간 안의 할 일');
  await page.locator('#todoForm button[type="submit"]').click();
  await page.locator('#day').fill('2026-10-20');
  await page.locator('#todoText').fill('기간 밖의 할 일');
  await page.locator('#todoForm button[type="submit"]').click();

  await page.locator('.tools-menu summary').click();
  await page.locator('#csvStart').fill('2026-10-01');
  await page.locator('#csvEnd').fill('2026-10-10');
  const downloadPromise = page.waitForEvent('download');
  await page.locator('#csvExport').click();
  const download = await downloadPromise;
  expect(download.suggestedFilename()).toBe('time-tracker-2026-10-01-2026-10-10.csv');

  const stream = await download.createReadStream();
  let csv = '';
  for await (const chunk of stream) csv += chunk.toString('utf8');
  expect(csv).toContain('기간 안의 기록');
  expect(csv).toContain('기간 안의 할 일');
  expect(csv).not.toContain('기간 밖의 기록');
  expect(csv).not.toContain('기간 밖의 할 일');
});

test('CSV 내보내기는 쉼표와 따옴표가 포함된 활동명을 올바르게 이스케이프함', async ({ page }) => {
  const activity = 'CSV "검증", 운동';
  await page.locator('#name').fill(activity);
  await page.locator('#start').fill('09:00');
  await page.locator('#end').fill('10:00');
  await page.locator('#entryForm button[type="submit"]').click();

  await page.locator('.tools-menu summary').click();
  const downloadPromise = page.waitForEvent('download');
  await page.locator('#csvExport').click();
  const download = await downloadPromise;
  const stream = await download.createReadStream();
  let csv = '';
  for await (const chunk of stream) csv += chunk.toString('utf8');

  expect(csv).toContain('"CSV ""검증"", 운동"');
});

test('CSV 시작일이 종료일보다 늦으면 다운로드를 차단함', async ({ page }) => {
  await page.locator('.tools-menu summary').click();
  await page.locator('#csvStart').fill('2026-10-20');
  await page.locator('#csvEnd').fill('2026-10-01');
  page.once('dialog', dialog => {
    expect(dialog.message()).toContain('시작일은 종료일보다 늦을 수 없습니다');
    dialog.accept();
  });
  const downloads = [];
  page.on('download', download => downloads.push(download));
  await page.locator('#csvExport').click();
  await expect(page.locator('#csvRangeStatus')).not.toContainText('CSV 다운로드를 시작했습니다.');
  expect(downloads).toHaveLength(0);
});

test('분류는 추천 항목을 선택하거나 사용자 지정 값을 입력할 수 있음', async ({ page }) => {
  await expect(page.locator('#cat')).toHaveAttribute('list', 'categorySuggestions');
  await expect(page.locator('#categorySuggestions option')).toHaveCount(9);
  await page.locator('#cat').fill('나만의 분류');
  await page.locator('#name').fill('분류 테스트');
  await page.locator('#entryForm button[type="submit"]').click();
  await expect(page.locator('#entries')).toContainText('나만의 분류');
});

test('새 기록 시간은 선택 날짜의 마지막 기록 종료 시각을 기준으로 설정됨', async ({ page }) => {
  await page.locator('#name').fill('첫 기록');
  await page.locator('#start').fill('09:00');
  await page.locator('#end').fill('10:30');
  await page.locator('#entryForm button[type="submit"]').click();
  await page.locator('#name').fill('두 번째 기록');
  await expect(page.locator('#start')).toHaveValue('10:30');
  await expect(page.locator('#end')).toHaveValue('11:30');
});


test('새 기록 기본 시간은 같은 종류의 늦은 기록과 겹치지 않음', async ({ page }) => {
  await page.locator('#name').fill('늦은 기록');
  await page.locator('#start').fill('23:00');
  await page.locator('#end').fill('23:59');
  await page.locator('#entryForm button[type="submit"]').click();

  await page.locator('#name').fill('다음 기록');
  await expect(page.locator('#start')).toHaveValue('09:00');
  await expect(page.locator('#end')).toHaveValue('10:00');
});

test('날짜를 바꾸면 해당 날짜 기록을 기준으로 새 기록 시간이 다시 설정됨', async ({ page }) => {
  const day = page.locator('#day');
  const selected = await day.inputValue();
  await page.locator('#name').fill('오늘 기록');
  await page.locator('#start').fill('13:00');
  await page.locator('#end').fill('14:00');
  await page.locator('#entryForm button[type="submit"]').click();

  const nextDate = new Date(selected + 'T12:00:00');
  nextDate.setDate(nextDate.getDate() - 1);
  const prior = [nextDate.getFullYear(), String(nextDate.getMonth() + 1).padStart(2, '0'), String(nextDate.getDate()).padStart(2, '0')].join('-');
  await day.fill(prior);
  await expect(page.locator('#start')).toHaveValue('09:00');
  await expect(page.locator('#end')).toHaveValue('10:00');
});

test('실제 기록의 기본 시간은 계획 기록과 겹쳐도 허용되는 종류별 규칙을 따름', async ({ page }) => {
  await page.locator('#name').fill('계획 기록');
  await page.locator('#entryAdvancedFields').evaluate(el => { el.open = true; });
  await page.locator('#kind').selectOption('planned');
  await page.locator('#start').fill('09:00');
  await page.locator('#end').fill('10:00');
  await page.locator('#entryForm button[type="submit"]').click();

  await page.locator('#name').fill('실제 기록');
  await page.locator('#entryAdvancedFields').evaluate(el => { el.open = true; });
  await page.locator('#kind').selectOption('actual');
  await expect(page.locator('#start')).toHaveValue('09:00');
  await expect(page.locator('#end')).toHaveValue('10:00');
});

test('수정 폼에서 취소하면 기록을 삭제하지 않음', async ({ page }) => {
  await page.locator('#name').fill('취소할 기록');
  await page.locator('#entryForm button[type="submit"]').click();
  await page.locator('[data-edit]').click();
  await expect(page.locator('#deleteEditingEntry')).toBeVisible();
  await page.locator('#cancelEdit').click();
  await expect(page.locator('#entries')).toContainText('취소할 기록');
  await expect(page.locator('#deleteEditingEntry')).toBeHidden();
});

test('수정 폼에서 삭제하면 확인 후 기록과 합계가 갱신됨', async ({ page }) => {
  await page.locator('#name').fill('폼에서 삭제할 기록');
  await page.locator('#start').fill('09:00');
  await page.locator('#end').fill('10:00');
  await page.locator('#entryForm button[type="submit"]').click();
  await page.locator('[data-edit]').click();
  await expect(page.locator('#deleteEditingEntry')).toBeVisible();

  page.once('dialog', dialog => dialog.accept());
  await page.locator('#deleteEditingEntry').click();

  await expect(page.locator('#entries')).not.toContainText('폼에서 삭제할 기록');
  await expect(page.locator('#actual')).toHaveText('0분');
  await expect(page.locator('#count')).toHaveText('0');
  await expect(page.locator('#deleteEditingEntry')).toBeHidden();
});


test('24시간 타임라인은 분 단위 실제/계획 구간과 합계를 표시', async ({ page }) => {
  await page.locator('#name').fill('실제 25분');
  await page.locator('#start').fill('09:15');
  await page.locator('#end').fill('09:40');
  await page.locator('#entryAdvancedFields').evaluate(el => { el.open = true; });
  await page.locator('#kind').selectOption('actual');
  await page.locator('#entryForm button[type="submit"]').click();

  await page.locator('#name').fill('계획 30분');
  await page.locator('#start').fill('09:45');
  await page.locator('#end').fill('10:15');
  await page.locator('#entryAdvancedFields').evaluate(el => { el.open = true; });
  await page.locator('#kind').selectOption('planned');
  await page.locator('#entryForm button[type="submit"]').click();

  await expect(page.locator('#timelineTotal')).toHaveText('실제 25분 · 계획 30분');
  const actual = page.locator('.timeline-segment[data-kind="actual"][data-start-minute="555"][data-end-minute="580"]');
  const planned = page.locator('.timeline-segment[data-kind="planned"][data-start-minute="585"][data-end-minute="600"]');
  await expect(actual).toHaveCount(1);
  await expect(planned).toHaveCount(1);
  await expect(page.locator('.timeline-segment[data-kind="planned"][data-start-minute="600"][data-end-minute="615"]')).toHaveCount(1);
  await expect(actual).toHaveCSS('background-color', 'rgb(80, 89, 168)');
  await expect(planned).toHaveCSS('background-color', 'rgb(197, 139, 49)');
});


test('타임라인 필터는 실제/계획 구간을 구분하고 전체 합계는 유지', async ({ page }) => {
  await page.locator('#name').fill('필터 실제 기록');
  await page.locator('#start').fill('09:10');
  await page.locator('#end').fill('09:30');
  await page.locator('#entryAdvancedFields').evaluate(el => { el.open = true; });
  await page.locator('#kind').selectOption('actual');
  await page.locator('#entryForm button[type="submit"]').click();

  await page.locator('#name').fill('필터 계획 기록');
  await page.locator('#start').fill('09:40');
  await page.locator('#end').fill('10:00');
  await page.locator('#entryAdvancedFields').evaluate(el => { el.open = true; });
  await page.locator('#kind').selectOption('planned');
  await page.locator('#entryForm button[type="submit"]').click();

  await page.locator('[data-timeline-filter="actual"]').click();
  await expect(page.locator('[data-timeline-entry]')).toHaveCount(1);
  await expect(page.locator('[data-timeline-entry]')).toContainText('필터 실제 기록');
  await expect(page.locator('[data-timeline-filter="actual"]')).toHaveAttribute('aria-pressed', 'true');
  await expect(page.locator('#timelineTotal')).toHaveText('실제 20분 · 계획 20분');

  await page.locator('[data-timeline-filter="planned"]').click();
  await expect(page.locator('[data-timeline-entry]')).toHaveCount(1);
  await expect(page.locator('[data-timeline-entry]')).toContainText('필터 계획 기록');

  await page.locator('[data-timeline-filter="all"]').click();
  await expect(page.locator('[data-timeline-entry]')).toHaveCount(2);
});


test('날짜 기록 복사 후 다른 날짜에 붙여넣으면 종류·분류·메모와 저장 데이터가 유지됨', async ({ page }) => {
  const day = page.locator('#day');
  const sourceDate = await day.inputValue();

  await page.locator('#name').fill('복사할 운동');
  await page.locator('#start').fill('09:00');
  await page.locator('#end').fill('10:00');
  await page.locator('#entryAdvancedFields').evaluate(el => { el.open = true; });
  await page.locator('#kind').selectOption('planned');
  await page.locator('#cat').fill('건강');
  await page.locator('#note').fill('테스트 메모');
  await page.locator('#entryForm button[type="submit"]').click();

  await page.locator('#copyDayEntries').click();
  await expect(page.locator('#copyDayStatus')).toContainText('1개를 복사했어요');

  const date = new Date(sourceDate + 'T12:00:00');
  date.setDate(date.getDate() - 1);
  const targetDate = [date.getFullYear(), String(date.getMonth() + 1).padStart(2, '0'), String(date.getDate()).padStart(2, '0')].join('-');
  await day.fill(targetDate);

  page.on('dialog', dialog => dialog.accept());
  await page.locator('#pasteDayEntries').click();

  const target = page.locator('#entries .entry');
  await expect(target).toContainText('복사할 운동');
  await expect(target).toContainText('계획');
  await expect(target).toContainText('건강');
  await expect(target).toContainText('테스트 메모');

  const saved = await page.evaluate(() => JSON.parse(localStorage.getItem('time-tracker-v1')));
  expect(saved.entries).toHaveLength(2);
  expect(saved.entries.filter(entry => entry.date === sourceDate)).toHaveLength(1);
  expect(saved.entries.filter(entry => entry.date === targetDate)).toHaveLength(1);
  expect(saved.entries.find(entry => entry.date === targetDate)).toMatchObject({
    name: '복사할 운동',
    start: '09:00',
    end: '10:00',
    kind: 'planned',
    cat: '건강',
    note: '테스트 메모'
  });

  await page.reload();
  await expect(page.locator('#entries')).toContainText('복사할 운동');
});

test('붙여넣기 대상 날짜에 같은 종류의 시간이 겹치면 기존 데이터를 변경하지 않음', async ({ page }) => {
  const day = page.locator('#day');
  const sourceDate = await day.inputValue();

  await page.locator('#name').fill('복사 원본');
  await page.locator('#start').fill('09:00');
  await page.locator('#end').fill('10:00');
  await page.locator('#entryForm button[type="submit"]').click();
  await page.locator('#copyDayEntries').click();

  const date = new Date(sourceDate + 'T12:00:00');
  date.setDate(date.getDate() - 1);
  const targetDate = [date.getFullYear(), String(date.getMonth() + 1).padStart(2, '0'), String(date.getDate()).padStart(2, '0')].join('-');
  await day.fill(targetDate);
  await page.locator('#name').fill('기존 대상 기록');
  await page.locator('#start').fill('09:30');
  await page.locator('#end').fill('10:30');
  await page.locator('#entryForm button[type="submit"]').click();

  const before = await page.evaluate(() => localStorage.getItem('time-tracker-v1'));
  page.on('dialog', dialog => dialog.dismiss());
  await page.locator('#pasteDayEntries').click();
  await expect(page.locator('#copyDayStatus')).toContainText('복사');
  await expect(page.locator('#entries')).toContainText('기존 대상 기록');
  await expect(page.locator('#entries')).not.toContainText('복사 원본');

  const after = await page.evaluate(() => localStorage.getItem('time-tracker-v1'));
  expect(after).toBe(before);
});


test('이전 날짜의 미완료 할 일은 이후 날짜에도 표시되고 완료하면 미뤄진 목록에서 사라짐', async ({ page }) => {
  await page.locator('[data-tab="todo"]').click();
  const day = page.locator('#day');
  const sourceDate = await day.inputValue();

  await page.locator('#todoText').fill('미완료 이월 테스트');
  await page.locator('#todoForm button[type="submit"]').click();
  await expect(page.locator('#todos')).toContainText('미완료 이월 테스트');

  const next = new Date(sourceDate + 'T12:00:00');
  next.setDate(next.getDate() + 1);
  const nextDate = [next.getFullYear(), String(next.getMonth() + 1).padStart(2, '0'), String(next.getDate()).padStart(2, '0')].join('-');
  await day.fill(nextDate);

  await expect(page.locator('#todos')).toContainText('미완료 이월 테스트');
  await expect(page.locator('#todos')).toContainText('원래 날짜 ' + sourceDate);
  await page.locator('#todos input[data-check]').click();
  await expect(page.locator('#todos')).not.toContainText('미완료 이월 테스트');

  await day.fill(sourceDate);
  await expect(page.locator('#todos')).toContainText('미완료 이월 테스트');
  await expect(page.locator('#todos input[data-check]')).toBeChecked();
  await page.reload();
  await day.fill(nextDate);
  await expect(page.locator('#todos')).not.toContainText('미완료 이월 테스트');
});

test('Todo 빠른 입력은 간결하게 표시하고 세부 설정은 접어서 제공함', async ({ page }) => {
  await page.locator('[data-tab="todo"]').click();
  await expect(page.locator('#todoText')).toBeVisible();
  await expect(page.locator('#todoSubmit')).toBeVisible();
  await expect(page.locator('#todoOptions')).not.toHaveAttribute('open', '');
  await expect(page.locator('#todoCategory')).toBeHidden();
  await expect(page.locator('#todoImportance')).toBeHidden();

  await page.locator('#todoOptions summary').click();
  await expect(page.locator('#todoCategory')).toBeVisible();
  await expect(page.locator('#todoImportance')).toBeVisible();
  await expect(page.locator('#todoOptionsSummary')).toContainText('업무');
  await expect(page.locator('#todoOptionsSummary')).toContainText('높음');
});

test('Todo 분류와 중요도 선택은 다음 입력 및 새로고침 후에도 기억함', async ({ page }) => {
  await page.locator('[data-tab="todo"]').click();
  await page.locator('#todoOptions').evaluate(el => { el.open = true; });
  await page.locator('#todoCategory').selectOption('personal');
  await page.locator('#todoImportance').selectOption('high');
  await page.locator('#todoText').fill('기본 설정 저장 테스트');
  await page.locator('#todoSubmit').click();

  await expect(page.locator('#todoOptions')).not.toHaveAttribute('open', '');
  await page.reload();
  await page.locator('[data-tab="todo"]').click();
  await expect(page.locator('#todoCategory')).toBeHidden();
  await page.locator('#todoOptions summary').click();
  await expect(page.locator('#todoCategory')).toHaveValue('personal');
  await expect(page.locator('#todoImportance')).toHaveValue('high');

  await page.locator('#todoOptions summary').click();
  await page.locator('#todoText').fill('기억한 기본 설정으로 추가');
  await page.locator('#todoSubmit').click();
  const saved = await page.evaluate(() => JSON.parse(localStorage.getItem('time-tracker-v1')));
  expect(saved.todos.find(todo => todo.text === '기억한 기본 설정으로 추가')).toMatchObject({ category: 'personal', importance: 'high' });
});

test('Todo 수정 진입 시 세부 설정이 열리고 취소하면 마지막 기본 설정으로 복귀함', async ({ page }) => {
  await page.locator('[data-tab="todo"]').click();
  await page.locator('#todoOptions').evaluate(el => { el.open = true; });
  await page.locator('#todoCategory').selectOption('personal');
  await page.locator('#todoImportance').selectOption('low');
  await page.locator('#todoText').fill('수정 화면 확인');
  await page.locator('#todoSubmit').click();

  await page.locator('[data-todo-edit]').click();
  await expect(page.locator('#todoOptions')).toHaveAttribute('open', '');
  await expect(page.locator('#todoCategory')).toHaveValue('personal');
  await expect(page.locator('#todoImportance')).toHaveValue('low');
  await page.locator('#cancelTodoEdit').click();
  await expect(page.locator('#todoOptions')).not.toHaveAttribute('open', '');
  await expect(page.locator('#todoText')).toHaveValue('');
  await page.locator('#todoOptions summary').click();
  await expect(page.locator('#todoCategory')).toHaveValue('personal');
  await expect(page.locator('#todoImportance')).toHaveValue('low');
});

test('할 일 분류를 저장하고 마지막 분류를 다음 입력에도 기억함', async ({ page }) => {
  await page.locator('[data-tab="todo"]').click();
  const sourceDate = await page.locator('#day').inputValue();
  await page.locator('#todoOptions').evaluate(el => { el.open = true; });
  await page.locator('#todoCategory').selectOption('personal');
  await page.locator('#todoText').fill('개인 할 일 분류 테스트');
  await page.locator('#todoForm button[type="submit"]').click();
  await expect(page.locator('#todos')).toContainText('개인 할 일 분류 테스트');
  await expect(page.locator('#todos')).toContainText('개인');
  let saved = await page.evaluate(() => JSON.parse(localStorage.getItem('time-tracker-v1')));
  expect(saved.todos.find(todo => todo.text === '개인 할 일 분류 테스트')).toMatchObject({ date: sourceDate, category: 'personal', done: false });

  await page.reload();
  await page.locator('[data-tab="todo"]').click();
  await expect(page.locator('#todoCategory')).toHaveValue('personal');
  await page.locator('#todoText').fill('기억한 분류 할 일');
  await page.locator('#todoForm button[type="submit"]').click();
  saved = await page.evaluate(() => JSON.parse(localStorage.getItem('time-tracker-v1')));
  expect(saved.todos.find(todo => todo.text === '기억한 분류 할 일').category).toBe('personal');
});


test('할 일 하위 작업을 추가하고 완료 상태를 새로고침 후에도 보존함', async ({ page }) => {
  await page.locator('[data-tab="todo"]').click();
  await page.locator('#todoText').fill('프로젝트 준비');
  await page.locator('#todoForm button[type="submit"]').click();
  const todo = page.locator('#todos .todo').filter({ hasText: '프로젝트 준비' });
  await todo.locator('details[data-subtask-children$="|root"] > summary').click();
  await todo.locator('input[data-subtask-input]').fill('자료 정리');
  await todo.locator('button[data-subtask-add]').click();
  await expect(todo.locator('.todo-subtask-list')).toContainText('자료 정리');
  const check = todo.locator('input[data-subtask-check]');
  await check.click();
  let saved = await page.evaluate(() => JSON.parse(localStorage.getItem('time-tracker-v1')));
  expect(saved.todos.find(x => x.text === '프로젝트 준비').subtasks).toMatchObject([{ text: '자료 정리', done: true }]);
  await page.reload();
  await page.locator('[data-tab="todo"]').click();
  const restored = page.locator('#todos .todo').filter({ hasText: '프로젝트 준비' });
  await restored.locator('details.todo-subtasks > summary').first().click();
  await expect(restored.locator('input[data-subtask-check]').first()).toBeChecked();
});


test('주간·월간 분류 분석은 해당 기간의 계획과 실제 시간을 분류별로 합산함', async ({ page }) => {
  await page.locator('#name').fill('운동 실제');
  await page.locator('#start').fill('09:00');
  await page.locator('#end').fill('10:00');
  await page.locator('#entryAdvancedFields').evaluate(el => { el.open = true; });
  await page.locator('#kind').selectOption('actual');
  await page.locator('#cat').fill('운동');
  await page.locator('#entryForm button[type="submit"]').click();

  await page.locator('#name').fill('업무 계획');
  await page.locator('#start').fill('10:00');
  await page.locator('#end').fill('10:30');
  await page.locator('#entryAdvancedFields').evaluate(el => { el.open = true; });
  await page.locator('#kind').selectOption('planned');
  await page.locator('#cat').fill('업무');
  await page.locator('#entryForm button[type="submit"]').click();

  await page.locator('[data-tab="stats"]').click();
  const breakdown = page.locator('#periodCategoryStats');
  await expect(breakdown).toContainText('이번 주 분류별 시간');
  await expect(breakdown).toContainText('이번 달 분류별 시간');
  await expect(breakdown).toContainText('운동');
  await expect(breakdown).toContainText('실제 1시간');
  await expect(breakdown).toContainText('업무');
  await expect(breakdown).toContainText('계획 30분');
});


test('이전 형식의 Todo 백업은 하위 작업 필드 없이도 복원됨', async ({ page }) => {
  const date = await page.locator('#day').inputValue();
  const backup = {
    entries: [],
    todos: [{
      id: 'legacy-todo-1',
      date,
      text: '이전 형식 할 일',
      done: false,
      category: 'work',
    }],
  };

  await page.locator('.tools-menu').locator('summary').click();
  await page.locator('#importFile').setInputFiles({
    name: 'legacy-todo-backup.json',
    mimeType: 'application/json',
    buffer: Buffer.from(JSON.stringify(backup), 'utf8'),
  });
  await expect(page.locator('#importPreview')).toContainText('백업 파일 검증 완료');

  page.once('dialog', dialog => dialog.accept());
  await page.locator('#confirmImport').click();
  await page.locator('[data-tab="todo"]').click();
  await expect(page.locator('#todos')).toContainText('이전 형식 할 일');
  await expect(page.locator('#todos .todo-subtasks summary')).toContainText('하위 작업 (0)');

  await page.reload();
  await page.locator('[data-tab="todo"]').click();
  await expect(page.locator('#todos')).toContainText('이전 형식 할 일');
  const saved = await page.evaluate(() => JSON.parse(localStorage.getItem('time-tracker-v1')));
  expect(saved.todos[0]).not.toHaveProperty('subtasks');
});

test('CSV 내보내기에 Todo 하위 작업과 완료 상태가 포함됨', async ({ page }) => {
  await page.locator('[data-tab="todo"]').click();
  await page.locator('#todoText').fill('CSV 하위 작업 테스트');
  await page.locator('#todoForm button[type="submit"]').click();

  const todo = page.locator('#todos .todo').filter({ hasText: 'CSV 하위 작업 테스트' });
  await todo.locator('details[data-subtask-children$="|root"] > summary').click();
  await todo.locator('input[data-subtask-input]').fill('자료 정리');
  await todo.locator('button[data-subtask-add]').click();
  const stored = await page.evaluate(() => JSON.parse(localStorage.getItem('time-tracker-v1')));
  const rootId = stored.todos.find(x => x.text === 'CSV 하위 작업 테스트').id;
  const childId = stored.todos.find(x => x.id === rootId).subtasks[0].id;
  await page.locator(`[data-subtask-children="${rootId}|${childId}"]`).evaluate(el => { el.open = true; });
  await page.locator(`[data-subtask-input="${rootId}|${childId}"]`).fill('하위 조사');
  await page.locator(`[data-subtask-add="${rootId}|${childId}"]`).click();
  await todo.locator('input[data-subtask-check]').first().check();

  const downloadPromise = page.waitForEvent('download');
  await page.locator('.tools-menu').locator('summary').click();
  await page.locator('#csvExport').click();
  const download = await downloadPromise;
  const stream = await download.createReadStream();
  let csv = '';
  for await (const chunk of stream) csv += chunk.toString('utf8');
  expect(csv).toContain('CSV 하위 작업 테스트');
  expect(csv).toContain('[완료] 자료 정리');
  expect(csv).toContain('[완료] 하위 조사');
});


test('반복 템플릿으로 선택한 요일에 계획을 생성하고 새로고침 후 유지함', async ({ page }) => {
  await page.locator('.advanced-panel').evaluate(el => { el.open = true; });
  await page.locator('#templateName').fill('평일 운동 반복');
  await page.locator('#templateActivity').fill('운동');
  await page.locator('#templateStart').fill('07:00');
  await page.locator('#templateEnd').fill('08:00');
  await page.locator('#templateForm button[type="submit"]').click();
  await page.locator('[data-template-check]').check();

  await page.locator('#repeatStart').fill('2026-10-26');
  await page.locator('#repeatEnd').fill('2026-10-30');
  page.once('dialog', dialog => dialog.accept());
  await page.locator('#generateRepeat').click();

  const generatedCount = () => page.evaluate(() => {
    const data = JSON.parse(localStorage.getItem('time-tracker-v1') || '{"entries":[]}');
    return data.entries.filter(entry => entry.note === '반복 일정: 평일 운동 반복').length;
  });
  await expect.poll(generatedCount).toBe(5);
  await expect(page.locator('#repeatGroups')).toContainText('평일 운동 반복');

  await page.reload();
  await expect(page.locator('#repeatGroups')).toContainText('평일 운동 반복');
  await expect.poll(generatedCount).toBe(5);
});

test('반복 일정 생성 시 기존 계획과 시간이 겹치면 기존 데이터를 보존함', async ({ page }) => {
  await page.locator('.advanced-panel').evaluate(el => { el.open = true; });
  await page.locator('#day').fill('2026-10-26');
  await page.locator('#name').fill('기존 계획');
  await page.locator('#start').fill('07:00');
  await page.locator('#end').fill('08:00');
  await page.locator('#entryAdvancedFields').evaluate(el => { el.open = true; });
  await page.locator('#kind').selectOption('planned');
  await page.locator('#entryForm button[type="submit"]').click();
  await expect(page.locator('#entries')).toContainText('기존 계획');

  await page.locator('#templateName').fill('겹치는 반복');
  await page.locator('#templateActivity').fill('반복 운동');
  await page.locator('#templateStart').fill('07:30');
  await page.locator('#templateEnd').fill('08:30');
  await page.locator('#templateKind').selectOption('planned');
  await page.locator('#templateForm button[type="submit"]').click();
  await page.locator('[data-template-check]').check();
  await page.locator('#repeatStart').fill('2026-10-26');
  await page.locator('#repeatEnd').fill('2026-10-30');

  page.once('dialog', dialog => dialog.accept());
  await page.locator('#generateRepeat').click();

  await expect(page.locator('#entries')).toContainText('기존 계획');
  await expect(page.locator('#entries')).not.toContainText('반복 운동');
  await expect(page.locator('#entries .entry')).toHaveCount(1);
});

test('반복 일정 묶음 삭제는 해당 묶음만 제거함', async ({ page }) => {
  await page.locator('.advanced-panel').evaluate(el => { el.open = true; });
  await page.locator('#templateName').fill('삭제 대상 반복');
  await page.locator('#templateActivity').fill('계획 운동');
  await page.locator('#templateStart').fill('07:00');
  await page.locator('#templateEnd').fill('08:00');
  await page.locator('#templateKind').selectOption('planned');
  await page.locator('#templateForm button[type="submit"]').click();
  await page.locator('[data-template-check]').check();
  await page.locator('#repeatStart').fill('2026-10-26');
  await page.locator('#repeatEnd').fill('2026-10-27');

  page.once('dialog', dialog => dialog.accept());
  await page.locator('#generateRepeat').click();
  await expect(page.locator('#repeatGroups')).toContainText('삭제 대상 반복');

  page.once('dialog', dialog => dialog.accept());
  await page.locator('[data-delete-repeat="삭제 대상 반복"]').click();

  await expect(page.locator('#repeatGroups')).not.toContainText('삭제 대상 반복');
  await expect(page.locator('#entries')).not.toContainText('계획 운동');
  await expect(page.locator('#entries .entry')).toHaveCount(0);
});


test('전체 기간 선택은 기록과 할 일의 가장 이른 날부터 가장 늦은 날까지 설정하고 수정 가능함', async ({ page }) => {
  await page.evaluate(() => {
    localStorage.setItem('time-tracker-v1', JSON.stringify({
      entries: [
        { id: 'range-entry-1', date: '2026-08-12', name: '이른 기록', start: '09:00', end: '10:00', kind: 'actual', cat: '', note: '' },
        { id: 'range-entry-2', date: '2026-10-21', name: '늦은 기록', start: '10:00', end: '11:00', kind: 'actual', cat: '', note: '' }
      ],
      todos: [
        { id: 'range-todo-1', date: '2026-08-10', text: '가장 이른 할 일', done: false },
        { id: 'range-todo-2', date: '2026-10-25', text: '가장 늦은 할 일', done: false }
      ]
    }));
  });
  await page.reload();
  await page.locator('.tools-menu').locator('summary').click();

  await expect(page.locator('#csvExport')).toHaveText('CSV 다운로드');
  await page.locator('#selectAllCsvRange').click();
  await expect(page.locator('#csvStart')).toHaveValue('2026-08-10');
  await expect(page.locator('#csvEnd')).toHaveValue('2026-10-25');
  await expect(page.locator('#csvRangeStatus')).toContainText('날짜를 수정해 범위를 좁힐 수 있습니다.');

  await page.locator('#csvStart').fill('2026-09-01');
  await expect(page.locator('#csvStart')).toHaveValue('2026-09-01');
  const downloadPromise = page.waitForEvent('download');
  await page.locator('#csvExport').click();
  const download = await downloadPromise;
  expect(download.suggestedFilename()).toBe('time-tracker-2026-09-01-2026-10-25.csv');
});

test('백업 도구는 CSV, JSON 백업, 파일 복원 순서로 배치됨', async ({ page }) => {
  await page.locator('.tools-menu').locator('summary').click();
  const order = await page.locator('.tools-content').evaluate(el => {
    const csv = el.querySelector('.csv-range');
    const actions = el.querySelector('.backup-actions');
    const auto = el.querySelector('.auto-backup-panel');
    return [csv, actions, auto].map(node => [...el.children].indexOf(node));
  });
  expect(order[0]).toBeLessThan(order[1]);
  expect(order[1]).toBeLessThan(order[2]);
  await expect(page.locator('#export')).toHaveText('JSON 백업 다운로드');
  await expect(page.locator('#importBtn')).toHaveText('백업 파일 복원');
});


test('저장 공간 오류가 나면 기존 기록을 덮어쓰지 않고 오류를 알림', async ({ page }) => {
  const original = {
    entries: [
      { id: 'preserve-entry', date: await page.locator('#day').inputValue(), name: '기존 보존 기록', start: '09:00', end: '10:00', kind: 'actual', cat: '', note: '' }
    ],
    todos: []
  };
  const originalRaw = JSON.stringify(original);
  await page.evaluate(raw => localStorage.setItem('time-tracker-v1', raw), originalRaw);
  await page.reload();

  await page.evaluate(() => {
    const originalSetItem = Storage.prototype.setItem;
    Storage.prototype.setItem = function(key, value) {
      if (key === 'time-tracker-v1') throw new DOMException('Quota exceeded', 'QuotaExceededError');
      return originalSetItem.call(this, key, value);
    };
  });

  await page.locator('#name').fill('저장 실패 테스트 기록');
  await page.locator('#start').fill('10:00');
  await page.locator('#end').fill('11:00');
  page.once('dialog', dialog => dialog.accept());
  await page.locator('#entryForm button[type="submit"]').click();

  await expect.poll(() => page.evaluate(() => localStorage.getItem('time-tracker-v1'))).toBe(originalRaw);
  await expect(page.locator('#storageHealthStatus')).toContainText('최근 저장 오류');
  await expect(page.locator('#entries')).toContainText('기존 보존 기록');
});


test('연간 요약은 선택한 연도의 월별 계획·실제 시간과 기록일만 집계함', async ({ page }) => {
  await page.evaluate(() => {
    localStorage.setItem('time-tracker-v1', JSON.stringify({
      entries: [
        { id: 'year-actual-jan', date: '2026-01-05', name: '1월 실제', start: '09:00', end: '10:00', kind: 'actual', cat: '업무', note: '' },
        { id: 'year-planned-jan', date: '2026-01-05', name: '1월 계획', start: '10:00', end: '11:30', kind: 'planned', cat: '업무', note: '' },
        { id: 'year-actual-mar', date: '2026-03-12', name: '3월 실제', start: '13:00', end: '14:00', kind: 'actual', cat: '운동', note: '' },
        { id: 'other-year', date: '2025-12-20', name: '이전 연도', start: '08:00', end: '18:00', kind: 'actual', cat: '기타', note: '' }
      ],
      todos: []
    }));
  });
  await page.reload();
  await page.locator('#day').fill('2026-03-12');
  await page.locator('[data-tab="stats"]').click();

  const yearly = page.locator('#yearStats');
  await expect(yearly).toContainText('2026년 계획 1시간 30분 · 실제 2시간 0분 · 133%');
  await expect(yearly).toContainText('실제 기록한 날짜');
  await expect(yearly).toContainText('2일');
  await expect(yearly.locator('.periodrow')).toHaveCount(14);
  await expect(yearly.locator('.periodrow').nth(2)).toContainText('01월');
  await expect(yearly.locator('.periodrow').nth(2)).toContainText('계획 1시간 30분 · 실제 1시간 0분 · 67%');
  await expect(yearly).not.toContainText('10시간');
});


test('중복 ID가 포함된 JSON 백업은 거부하고 기존 기록과 할 일을 유지함', async ({ page }) => {
  await page.locator('#name').fill('중복 ID 테스트 전 기존 기록');
  await page.locator('#entryForm button[type="submit"]').click();
  await page.locator('[data-tab="todo"]').click();
  await expect(page.locator('#todoPanel')).toBeVisible();
  await page.locator('#todoText').fill('중복 ID 테스트 전 기존 할 일');
  await page.locator('#todoForm button[type="submit"]').click();

  const originalRaw = await page.evaluate(() => localStorage.getItem('time-tracker-v1'));
  const date = await page.locator('#day').inputValue();
  const backup = {
    entries: [{
      id: 'duplicate-backup-id',
      date,
      name: '복원되면 안 되는 기록',
      start: '13:00',
      end: '14:00',
      kind: 'actual',
      cat: '',
      note: '',
    }],
    todos: [{
      id: 'duplicate-backup-id',
      date,
      text: '복원되면 안 되는 할 일',
      done: false,
    }],
  };

  await page.locator('.tools-menu').locator('summary').click();
  await page.locator('#importFile').setInputFiles({
    name: 'duplicate-id-backup.json',
    mimeType: 'application/json',
    buffer: Buffer.from(JSON.stringify(backup), 'utf8'),
  });

  await expect(page.locator('#importPreview')).toContainText('백업 파일 형식이 올바르지 않거나 데이터에 오류가 있습니다');
  await expect(page.locator('#entries')).toContainText('중복 ID 테스트 전 기존 기록');
  await expect(page.locator('#entries')).not.toContainText('복원되면 안 되는 기록');
  await expect(page.locator('#todos')).toContainText('중복 ID 테스트 전 기존 할 일');
  await expect(page.locator('#todos')).not.toContainText('복원되면 안 되는 할 일');
  await expect.poll(() => page.evaluate(() => localStorage.getItem('time-tracker-v1'))).toBe(originalRaw);
});


test('기록 수정과 삭제 결과가 새로고침 후에도 유지됨', async ({ page }) => {
  await page.locator('#name').fill('수정 전 기록');
  await page.locator('#start').fill('14:00');
  await page.locator('#end').fill('15:00');
  await page.locator('#entryForm button[type="submit"]').click();

  await page.locator('[data-timeline-entry]').filter({ hasText: '수정 전 기록' }).click();
  await page.locator('#name').fill('수정 후 기록');
  await page.locator('#entryForm button[type="submit"]').click();
  await page.reload();

  await expect(page.locator('#entries')).toContainText('수정 후 기록');
  await expect(page.locator('#entries')).not.toContainText('수정 전 기록');
  await expect(page.locator('#count')).toHaveText('1');

  await page.locator('[data-del]').click();
  await page.reload();

  await expect(page.locator('#entries')).not.toContainText('수정 후 기록');
  await expect(page.locator('#count')).toHaveText('0');
  const saved = await page.evaluate(() => JSON.parse(localStorage.getItem('time-tracker-v1')));
  expect(saved.entries).toHaveLength(0);
});


test('서로 맞닿는 시간 기록은 겹침으로 오인하지 않고 둘 다 저장함', async ({ page }) => {
  await page.locator('#name').fill('연속 기록 A');
  await page.locator('#start').fill('09:00');
  await page.locator('#end').fill('10:00');
  await page.locator('#entryForm button[type="submit"]').click();
  await expect(page.locator('#entries')).toContainText('연속 기록 A');

  await page.locator('#name').fill('연속 기록 B');
  await page.locator('#start').fill('10:00');
  await page.locator('#end').fill('11:00');
  await page.locator('#entryForm button[type="submit"]').click();

  await expect(page.locator('#entries')).toContainText('연속 기록 A');
  await expect(page.locator('#entries')).toContainText('연속 기록 B');
  await expect(page.locator('#count')).toHaveText('2');
  await expect(page.locator('#actual')).toHaveText('2시간 0분');

  const saved = await page.evaluate(() => JSON.parse(localStorage.getItem('time-tracker-v1')));
  expect(saved.entries).toHaveLength(2);
  expect(saved.entries.map(entry => [entry.start, entry.end])).toEqual([
    ['09:00', '10:00'],
    ['10:00', '11:00'],
  ]);
});


test('타임라인 +는 해당 시간대의 마지막 종료 시각부터 시작하고 종류 필터를 반영함', async ({ page }) => {
  await page.locator('#day').fill('2026-10-29');
  await page.locator('#name').fill('계획 6시');
  await page.locator('#start').fill('06:00');
  await page.locator('#end').fill('06:20');
  await page.locator('#entryAdvancedFields').evaluate(el => { el.open = true; });
  await page.locator('#kind').selectOption('planned');
  page.once('dialog', dialog => dialog.accept());
  await page.locator('#entryForm button[type="submit"]').click();
  await page.locator('[data-timeline-filter="planned"]').click();
  await page.locator('[data-add-hour="06"]').click();
  await expect(page.locator('.timeline-quick-start')).toHaveValue('06:20');
  await page.locator('.timeline-quick-name').fill('계획 이어서');
  await page.locator('.timeline-quick-end').fill('06:40');
  page.once('dialog', dialog => dialog.accept());
  await page.locator('.timeline-quick-actions button[type="submit"]').click();
  await expect(page.locator('#entries')).toContainText('계획 이어서');
  const saved = await page.evaluate(() => JSON.parse(localStorage.getItem('time-tracker-v1')));
  expect(saved.entries.find(x => x.name === '계획 이어서').kind).toBe('planned');
  expect(saved.entries.find(x => x.name === '계획 이어서').start).toBe('06:20');
});

test('전체 타임라인 +에서는 계획/실제를 선택할 수 있고 서로 다른 종류의 겹침은 허용함', async ({ page }) => {
  await page.locator('#day').fill('2026-10-29');
  await page.locator('#name').fill('실제 기록');
  await page.locator('#start').fill('09:00');
  await page.locator('#end').fill('10:00');
  await page.locator('#entryAdvancedFields').evaluate(el => { el.open = true; });
  await page.locator('#kind').selectOption('actual');
  page.once('dialog', dialog => dialog.accept());
  await page.locator('#entryForm button[type="submit"]').click();
  await page.locator('[data-timeline-filter="all"]').click();
  await page.locator('[data-add-hour="09"]').click();
  await expect(page.locator('.timeline-quick-kind')).toBeVisible();
  await page.locator('.timeline-quick-name').fill('겹치는 계획');
  await page.locator('.timeline-quick-kind').selectOption('planned');
  await page.locator('.timeline-quick-start').fill('09:00');
  await page.locator('.timeline-quick-end').fill('10:00');
  page.once('dialog', dialog => dialog.accept());
  await page.locator('.timeline-quick-actions button[type="submit"]').click();
  await expect(page.locator('#entries')).toContainText('겹치는 계획');
  const saved = await page.evaluate(() => JSON.parse(localStorage.getItem('time-tracker-v1')));
  expect(saved.entries.filter(x => x.start === '09:00' && x.end === '10:00')).toHaveLength(2);
});

test('할 일 수정, 중요도 우선순위, 완료 날짜 및 전체 필터가 작동함', async ({ page }) => {
  await page.locator('[data-tab="todo"]').click();
  await page.locator('#todoOptions').evaluate(el => { el.open = true; });
  await page.locator('#todoText').fill('낮은 우선순위');
  await page.locator('#todoImportance').selectOption('low');
  await page.locator('#todoForm button[type="submit"]').click();
  await page.locator('#todoOptions').evaluate(el => { el.open = true; });
  await page.locator('#todoText').fill('중요한 할 일');
  await page.locator('#todoImportance').selectOption('high');
  await page.locator('#todoForm button[type="submit"]').click();
  await expect(page.locator('#todos .todo').first()).toContainText('중요한 할 일');
  await page.locator('[data-todo-edit]').first().click();
  await page.locator('#todoText').fill('수정한 중요한 할 일');
  await page.locator('#todoSubmit').click();
  await expect(page.locator('#todos')).toContainText('수정한 중요한 할 일');
  const high = page.locator('#todos .todo').filter({ hasText: '수정한 중요한 할 일' });
  await high.locator('[data-check]').check();
  await expect(high).toContainText('완료일');
  await page.locator('[data-todo-filter="done"]').click();
  await expect(page.locator('#todos')).toContainText('수정한 중요한 할 일');
  await page.locator('[data-todo-filter="open"]').click();
  await expect(page.locator('#todos')).toContainText('낮은 우선순위');
  await expect(page.locator('#todos')).not.toContainText('수정한 중요한 할 일');
});

test('선택한 템플릿을 지정한 기간에 적용함', async ({ page }) => {
  await page.locator('.advanced-panel').evaluate(el => { el.open = true; });
  await page.locator('#templateName').fill('기간 템플릿');
  await page.locator('#templateActivity').fill('운동 계획');
  await page.locator('#templateStart').fill('07:00');
  await page.locator('#templateEnd').fill('08:00');
  await page.locator('#templateKind').selectOption('planned');
  await page.locator('#templateForm button[type="submit"]').click();
  await page.locator('[data-template-check]').check();
  await page.locator('#templateApplyStart').fill('2026-10-29');
  await page.locator('#templateApplyEnd').fill('2026-10-30');
  page.once('dialog', dialog => dialog.accept());
  await page.locator('#batchTemplates').click();
  const saved = await page.evaluate(() => JSON.parse(localStorage.getItem('time-tracker-v1')));
  expect(saved.entries.filter(x => x.name === '운동 계획')).toHaveLength(2);
  expect(saved.entries.filter(x => x.name === '운동 계획').map(x => x.date).sort()).toEqual(['2026-10-29','2026-10-30']);
});


test('할 일 완료·미완료 전체를 목록 또는 날짜별로 보고 수정·삭제 버튼 크기가 같음', async ({ page }) => {
  await page.evaluate(() => {
    localStorage.setItem('time-tracker-v1', JSON.stringify({
      entries: [],
      todos: [
        { id: 'done-older', date: '2026-10-25', text: '완료 과거', done: true, doneAt: '2026-10-28', importance: 'high' },
        { id: 'done-newer', date: '2026-10-26', text: '완료 최근', done: true, doneAt: '2026-10-29', importance: 'medium' },
        { id: 'open-older', date: '2026-10-25', text: '미완료 과거', done: false, importance: 'high' },
        { id: 'open-newer', date: '2026-10-29', text: '미완료 최근', done: false, importance: 'low' }
      ]
    }));
  });
  await page.reload();
  await page.locator('[data-tab="todo"]').click();

  await page.locator('[data-todo-filter="done"]').click();
  await page.locator('[data-todo-view="date"]').click();
  await expect(page.locator('#todos .todo-date-group')).toHaveCount(2);
  await expect(page.locator('#todos')).toContainText('완료일 2026-10-29');
  await expect(page.locator('#todos')).toContainText('완료일 2026-10-28');
  await expect(page.locator('#todos')).toContainText('완료 최근');
  await expect(page.locator('#todos')).not.toContainText('미완료 최근');

  await page.locator('[data-todo-filter="open"]').click();
  await expect(page.locator('#todos .todo-date-group')).toHaveCount(2);
  await expect(page.locator('#todos')).toContainText('할 일 날짜 2026-10-29');
  await expect(page.locator('#todos')).toContainText('할 일 날짜 2026-10-25');
  await expect(page.locator('#todos')).toContainText('미완료 최근');
  await expect(page.locator('#todos .todo label').filter({ hasText: /^완료 최근/ })).toHaveCount(0);

  await page.locator('[data-todo-view="list"]').click();
  await expect(page.locator('#todos .todo-date-group')).toHaveCount(0);
  const sizes = await page.locator('#todos .todo').first().evaluate(el => {
    const edit = el.querySelector('[data-todo-edit]').getBoundingClientRect();
    const del = el.querySelector('[data-todo-del]').getBoundingClientRect();
    return { editWidth: edit.width, deleteWidth: del.width, editHeight: edit.height, deleteHeight: del.height };
  });
  expect(sizes.editWidth).toBe(sizes.deleteWidth);
  expect(sizes.editHeight).toBe(sizes.deleteHeight);
});


test('Todo 하위 작업은 여러 단계로 추가·수정·완료·삭제되고 새로고침 후 유지됨', async ({ page }) => {
  await page.locator('[data-tab="todo"]').click();
  await page.locator('#todoText').fill('프로젝트 준비');
  await page.locator('#todoSubmit').click();
  const root = await page.evaluate(() => JSON.parse(localStorage.getItem('time-tracker-v1')).todos.find(x => x.text === '프로젝트 준비').id);

  await page.locator('.todo-subtasks').first().evaluate(el => { el.open = true; });
  await page.locator(`[data-subtask-input="${root}|root"]`).fill('자료 조사');
  await page.locator(`[data-subtask-add="${root}|root"]`).click();
  let saved = await page.evaluate(() => JSON.parse(localStorage.getItem('time-tracker-v1')));
  const parent = saved.todos.find(x => x.id === root).subtasks[0].id;

  await page.locator(`[data-subtask-children="${root}|${parent}"]`).evaluate(el => { el.open = true; });
  await page.locator(`[data-subtask-input="${root}|${parent}"]`).fill('경쟁 제품 정리');
  await page.locator(`[data-subtask-add="${root}|${parent}"]`).click();
  saved = await page.evaluate(() => JSON.parse(localStorage.getItem('time-tracker-v1')));
  const child = saved.todos.find(x => x.id === root).subtasks[0].subtasks[0].id;

  await page.locator(`[data-subtask-children="${root}|${child}"]`).evaluate(el => { el.open = true; });
  await page.locator(`[data-subtask-input="${root}|${child}"]`).fill('가격 비교');
  await page.locator(`[data-subtask-add="${root}|${child}"]`).click();
  saved = await page.evaluate(() => JSON.parse(localStorage.getItem('time-tracker-v1')));
  const grandchild = saved.todos.find(x => x.id === root).subtasks[0].subtasks[0].subtasks[0].id;
  const childDetails = page.locator(`[data-subtask-children="${root}|${child}"]`);
  await expect(page.locator(`[data-subtask-input="${root}|${child}"]`)).toBeVisible();
  await childDetails.locator(':scope > summary').click();
  await expect(page.locator(`[data-subtask-input="${root}|${child}"]`)).toBeHidden();
  await childDetails.locator(':scope > summary').click();
  await expect(page.locator(`[data-subtask-input="${root}|${child}"]`)).toBeVisible();

  await page.locator(`[data-subtask-check="${root}|${grandchild}"]`).check();
  saved = await page.evaluate(() => JSON.parse(localStorage.getItem('time-tracker-v1')));
  expect(saved.todos.find(x => x.id === root).subtasks[0].subtasks[0].subtasks[0].done).toBe(true);
  page.once('dialog', dialog => dialog.accept('시장 가격 비교'));
  await page.locator(`[data-subtask-edit="${root}|${child}"]`).click();
  await expect(page.locator('#todos')).toContainText('시장 가격 비교');
  await expect(page.locator('#todos')).toContainText('가격 비교');

  page.once('dialog', dialog => dialog.accept());
  await page.locator(`[data-subtask-del="${root}|${grandchild}"]`).click();
  await page.reload();
  await page.locator('[data-tab="todo"]').click();
  await expect(page.locator('#todos')).toContainText('시장 가격 비교');
  await expect(page.locator(`[data-subtask-check="${root}|${grandchild}"]`)).toHaveCount(0);

  saved = await page.evaluate(() => JSON.parse(localStorage.getItem('time-tracker-v1')));
  const persisted = saved.todos.find(x => x.id === root).subtasks[0].subtasks[0];
  expect(persisted.text).toBe('시장 가격 비교');
  expect(persisted.subtasks).toEqual([]);
});

test('기존 1단계 subtasks 데이터는 변경 없이 읽고 하위 단계 추가 후에도 보존됨', async ({ page }) => {
  const legacy = {
    entries: [],
    todos: [{
      id: 'legacy-root',
      date: await page.locator('#day').inputValue(),
      text: '기존 할 일',
      done: false,
      subtasks: [{ id: 'legacy-child', text: '기존 하위 작업', done: true }]
    }]
  };
  await page.evaluate(data => localStorage.setItem('time-tracker-v1', JSON.stringify(data)), legacy);
  await page.reload();
  await page.locator('[data-tab="todo"]').click();
  await expect(page.locator('#todos')).toContainText('기존 하위 작업');
  await page.locator('[data-subtask-children="legacy-root|root"]').evaluate(el => { el.open = true; });
  await page.locator('[data-subtask-children="legacy-root|legacy-child"]').evaluate(el => { el.open = true; });
  await page.locator('[data-subtask-input="legacy-root|legacy-child"]').fill('새로운 2단계 작업');
  await page.locator('[data-subtask-add="legacy-root|legacy-child"]').click();
  await page.reload();
  await page.locator('[data-tab="todo"]').click();
  await expect(page.locator('#todos')).toContainText('기존 하위 작업');
  await expect(page.locator('#todos')).toContainText('새로운 2단계 작업');
  const saved = await page.evaluate(() => JSON.parse(localStorage.getItem('time-tracker-v1')));
  expect(saved.todos[0].subtasks[0].done).toBe(true);
  expect(saved.todos[0].subtasks[0].subtasks[0].text).toBe('새로운 2단계 작업');
});

test('중첩 Todo 백업은 복원되고 하위 작업 ID 중복 백업은 거부하며 기존 데이터를 보존함', async ({ page }) => {
  const date = await page.locator('#day').inputValue();
  const original = { entries: [], todos: [{ id: 'keep-root', date, text: '보존할 할 일', done: false }] };
  await page.evaluate(data => localStorage.setItem('time-tracker-v1', JSON.stringify(data)), original);
  await page.reload();
  await page.locator('.tools-menu summary').click();

  const invalid = {
    entries: [],
    todos: [{
      id: 'duplicate-root',
      date,
      text: '중복 ID 백업',
      done: false,
      subtasks: [{ id: 'same-id', text: '부모 하위 작업', done: false, subtasks: [{ id: 'same-id', text: '중첩 하위 작업', done: false }] }]
    }]
  };
  await page.locator('#importFile').setInputFiles({
    name: 'duplicate-nested-todo.json',
    mimeType: 'application/json',
    buffer: Buffer.from(JSON.stringify(invalid), 'utf8')
  });
  await expect(page.locator('#importPreview')).toContainText('백업 파일 형식이 올바르지 않거나 데이터에 오류가 있습니다');
  await expect.poll(() => page.evaluate(() => JSON.parse(localStorage.getItem('time-tracker-v1')).todos[0].text)).toBe('보존할 할 일');

  const valid = {
    entries: [],
    todos: [{
      id: 'nested-root',
      date,
      text: '복원할 계층 할 일',
      done: false,
      subtasks: [{ id: 'nested-child-1', text: '1단계', done: false, subtasks: [{ id: 'nested-child-2', text: '2단계', done: true, subtasks: [{ id: 'nested-child-3', text: '3단계', done: false }] }] }]
    }]
  };
  await page.locator('#importFile').setInputFiles({
    name: 'nested-todo.json',
    mimeType: 'application/json',
    buffer: Buffer.from(JSON.stringify(valid), 'utf8')
  });
  await expect(page.locator('#importPreview')).toContainText('백업 파일 검증 완료');
  page.once('dialog', dialog => dialog.accept());
  await page.locator('#confirmImport').click();
  await page.reload();
  await page.locator('[data-tab="todo"]').click();
  await expect(page.locator('#todos')).toContainText('복원할 계층 할 일');
  await expect(page.locator('#todos')).toContainText('3단계');
  const saved = await page.evaluate(() => JSON.parse(localStorage.getItem('time-tracker-v1')));
  expect(saved.todos[0].subtasks[0].subtasks[0].subtasks[0].text).toBe('3단계');
});


test('Todo 예상 소요시간은 저장·수정·삭제되고 하위 작업 완료율로 진행률을 계산함', async ({ page }) => {
  await page.locator('[data-tab="todo"]').click();
  await page.locator('#todoText').fill('보고서 작성');
  await page.locator('#todoOptions').evaluate(el => { el.open = true; });
  await page.locator('#todoEstimate').fill('90');
  expect(await page.locator('#todoForm').evaluate(form => form.checkValidity())).toBe(true);
  await page.locator('#todoForm').evaluate(form => form.requestSubmit());

  let saved = await page.evaluate(() => JSON.parse(localStorage.getItem('time-tracker-v1')));
  const todoId = saved.todos.find(x => x.text === '보고서 작성').id;
  expect(saved.todos.find(x => x.id === todoId).estimatedMinutes).toBe(90);

  const todo = page.locator('#todos .todo').filter({ hasText: '보고서 작성' });
  await todo.locator('.todo-subtasks').evaluate(el => { el.open = true; });
  await page.locator(`[data-subtask-input="${todoId}|root"]`).fill('초안 작성');
  await page.locator(`[data-subtask-add="${todoId}|root"]`).click();
  await page.locator(`[data-subtask-input="${todoId}|root"]`).fill('최종 검토');
  await page.locator(`[data-subtask-add="${todoId}|root"]`).click();

  await expect(todo.locator('.todo-progress')).toContainText('진행률 0% · 완료 0/2');
  await todo.locator('input[data-subtask-check]').first().check();
  await expect(todo.locator('.todo-progress')).toContainText('진행률 50% · 완료 1/2');
  await todo.locator('input[data-subtask-check]').nth(1).check();
  await expect(todo.locator('.todo-progress')).toContainText('진행률 100% · 완료 2/2');
  await expect(todo).toContainText('예상 1시간 30분');

  await page.reload();
  await page.locator('[data-tab="todo"]').click();
  const restored = page.locator('#todos .todo').filter({ hasText: '보고서 작성' });
  await expect(restored).toContainText('예상 1시간 30분');
  await expect(restored.locator('.todo-progress')).toContainText('진행률 100% · 완료 2/2');

  await restored.locator('[data-todo-edit]').click();
  await expect(page.locator('#todoEstimate')).toHaveValue('90');
  await page.locator('#todoEstimate').fill('120');
  await page.locator('#todoSubmit').click();
  saved = await page.evaluate(() => JSON.parse(localStorage.getItem('time-tracker-v1')));
  expect(saved.todos.find(x => x.id === todoId).estimatedMinutes).toBe(120);

  const downloadPromise = page.waitForEvent('download');
  await page.locator('.tools-menu summary').click();
  await page.locator('#csvExport').click();
  const download = await downloadPromise;
  const stream = await download.createReadStream();
  let csv = '';
  for await (const chunk of stream) csv += chunk.toString('utf8');
  expect(csv).toContain('예상 소요시간(분)');
  expect(csv).toContain('120');
  expect(csv).toContain('100');
});

test('Todo 예상 소요시간을 비우면 선택 필드가 제거되고 잘못된 백업 값은 기존 데이터를 보존하며 거부함', async ({ page }) => {
  await page.locator('[data-tab="todo"]').click();
  await page.locator('#todoText').fill('예상 시간 수정 테스트');
  await page.locator('#todoOptions').evaluate(el => { el.open = true; });
  await page.locator('#todoEstimate').fill('45');
  expect(await page.locator('#todoForm').evaluate(form => form.checkValidity())).toBe(true);
  await page.locator('#todoForm').evaluate(form => form.requestSubmit());
  let saved = await page.evaluate(() => JSON.parse(localStorage.getItem('time-tracker-v1')));
  const todoId = saved.todos.find(x => x.text === '예상 시간 수정 테스트').id;

  await page.locator(`[data-todo-edit="${todoId}"]`).click();
  await page.locator('#todoEstimate').fill('');
  await page.locator('#todoSubmit').click();
  saved = await page.evaluate(() => JSON.parse(localStorage.getItem('time-tracker-v1')));
  expect(saved.todos.find(x => x.id === todoId)).not.toHaveProperty('estimatedMinutes');

  await page.locator('.tools-menu summary').click();
  const invalid = {
    entries: [],
    todos: [{ id: 'invalid-estimate', date: await page.locator('#day').inputValue(), text: '잘못된 예상 시간', done: false, estimatedMinutes: 0 }]
  };
  await page.locator('#importFile').setInputFiles({
    name: 'invalid-todo-estimate.json',
    mimeType: 'application/json',
    buffer: Buffer.from(JSON.stringify(invalid), 'utf8')
  });
  await expect(page.locator('#importPreview')).toContainText('백업 파일 형식이 올바르지 않거나 데이터에 오류가 있습니다');
  await expect.poll(() => page.evaluate(() => JSON.parse(localStorage.getItem('time-tracker-v1')).todos[0].text)).toBe('예상 시간 수정 테스트');
});


test('중첩 하위 작업 진행률은 가장 깊은 작업만 집계해 부모 작업을 중복 계산하지 않음', async ({ page }) => {
  const date = await page.locator('#day').inputValue();
  const fixture = {
    entries: [],
    todos: [{
      id: 'progress-root',
      date,
      text: '중첩 진행률 확인',
      done: false,
      subtasks: [
        {
          id: 'progress-parent',
          text: '자료 조사',
          done: false,
          subtasks: [
            { id: 'progress-leaf-1', text: '자료 수집', done: false },
            { id: 'progress-leaf-2', text: '자료 정리', done: false }
          ]
        },
        { id: 'progress-leaf-3', text: '보고서 작성', done: false }
      ]
    }]
  };
  await page.evaluate(data => localStorage.setItem('time-tracker-v1', JSON.stringify(data)), fixture);
  await page.reload();
  await page.locator('[data-tab="todo"]').click();

  const todo = page.locator('#todos .todo').filter({ hasText: '중첩 진행률 확인' });
  await expect(todo.locator('.todo-progress')).toContainText('진행률 0% · 완료 0/3');
  await page.locator('[data-subtask-children="progress-root|root"]').evaluate(el => { el.open = true; });
  await page.locator('[data-subtask-children="progress-root|progress-parent"]').evaluate(el => { el.open = true; });

  await page.locator('[data-subtask-check="progress-root|progress-leaf-1"]').check();
  await expect(todo.locator('.todo-progress')).toContainText('진행률 33% · 완료 1/3');
  await page.locator('[data-subtask-check="progress-root|progress-leaf-2"]').check();
  await expect(todo.locator('.todo-progress')).toContainText('진행률 67% · 완료 2/3');
  await page.locator('[data-subtask-check="progress-root|progress-leaf-3"]').check();
  await expect(todo.locator('.todo-progress')).toContainText('진행률 100% · 완료 3/3');
});


test('하위 작업 전체 완료 시 모든 상위 Todo가 자동 완료되고 미완료로 바꾸면 완료일과 함께 되돌아감', async ({ page }) => {
  const date = await page.locator('#day').inputValue();
  const fixture = {
    entries: [],
    todos: [{
      id: 'auto-root',
      date,
      text: '프로젝트 전체',
      done: false,
      subtasks: [
        {
          id: 'auto-parent',
          text: '자료 조사',
          done: false,
          subtasks: [
            { id: 'auto-leaf-1', text: '자료 수집', done: false },
            { id: 'auto-leaf-2', text: '자료 정리', done: false }
          ]
        },
        { id: 'auto-leaf-3', text: '보고서 작성', done: false }
      ]
    }]
  };
  await page.evaluate(data => localStorage.setItem('time-tracker-v1', JSON.stringify(data)), fixture);
  await page.reload();
  await page.locator('[data-tab="todo"]').click();
  const getSaved = () => page.evaluate(() => JSON.parse(localStorage.getItem('time-tracker-v1')));
  const openTree = async () => {
    await page.locator('[data-subtask-children="auto-root|root"]').evaluate(el => { el.open = true; });
    await page.locator('[data-subtask-children="auto-root|auto-parent"]').evaluate(el => { el.open = true; });
  };
  await openTree();

  await page.locator('[data-subtask-check="auto-root|auto-leaf-1"]').check();
  let saved = await getSaved();
  expect(saved.todos[0].done).toBe(false);
  expect(saved.todos[0].subtasks[0].done).toBe(false);

  await page.locator('[data-subtask-check="auto-root|auto-leaf-2"]').check();
  saved = await getSaved();
  expect(saved.todos[0].subtasks[0].done).toBe(true);
  expect(saved.todos[0].subtasks[0].doneAt).toBe(date);
  expect(saved.todos[0].done).toBe(false);

  await page.locator('[data-subtask-check="auto-root|auto-leaf-3"]').check();
  saved = await getSaved();
  expect(saved.todos[0].done).toBe(true);
  expect(saved.todos[0].doneAt).toBe(date);
  expect(saved.todos[0].subtasks[0].doneAt).toBe(date);

  await page.locator('[data-subtask-check="auto-root|auto-leaf-1"]').uncheck();
  saved = await getSaved();
  expect(saved.todos[0].done).toBe(false);
  expect(saved.todos[0]).not.toHaveProperty('doneAt');
  expect(saved.todos[0].subtasks[0].done).toBe(false);
  expect(saved.todos[0].subtasks[0]).not.toHaveProperty('doneAt');
  expect(saved.todos[0].subtasks[1].done).toBe(true);

  await page.locator('[data-subtask-check="auto-root|auto-parent"]').check();
  saved = await getSaved();
  expect(saved.todos[0].subtasks[0].done).toBe(true);
  expect(saved.todos[0].subtasks[0].subtasks.every(x => x.done)).toBe(true);
  expect(saved.todos[0].done).toBe(true);
  expect(saved.todos[0].doneAt).toBe(date);

  await page.reload();
  saved = await getSaved();
  expect(saved.todos[0].done).toBe(true);
  expect(saved.todos[0].subtasks[0].doneAt).toBe(date);
});

test('상위 Todo를 직접 완료하거나 취소하면 모든 중첩 하위 작업 상태가 함께 변경됨', async ({ page }) => {
  const date = await page.locator('#day').inputValue();
  const fixture = {
    entries: [],
    todos: [{
      id: 'cascade-root',
      date,
      text: '상위 작업 직접 제어',
      done: false,
      subtasks: [{
        id: 'cascade-parent',
        text: '하위 묶음',
        done: false,
        subtasks: [{ id: 'cascade-leaf', text: '세부 작업', done: false }]
      }]
    }]
  };
  await page.evaluate(data => localStorage.setItem('time-tracker-v1', JSON.stringify(data)), fixture);
  await page.reload();
  await page.locator('[data-tab="todo"]').click();
  await page.locator('[data-check="cascade-root"]').check();
  let saved = await page.evaluate(() => JSON.parse(localStorage.getItem('time-tracker-v1')));
  expect(saved.todos[0].done).toBe(true);
  expect(saved.todos[0].subtasks[0].done).toBe(true);
  expect(saved.todos[0].subtasks[0].subtasks[0].done).toBe(true);
  expect(saved.todos[0].doneAt).toBe(date);

  await page.locator('[data-check="cascade-root"]').uncheck();
  saved = await page.evaluate(() => JSON.parse(localStorage.getItem('time-tracker-v1')));
  expect(saved.todos[0].done).toBe(false);
  expect(saved.todos[0]).not.toHaveProperty('doneAt');
  expect(saved.todos[0].subtasks[0].done).toBe(false);
  expect(saved.todos[0].subtasks[0]).not.toHaveProperty('doneAt');
  expect(saved.todos[0].subtasks[0].subtasks[0].done).toBe(false);
});


test('Todo 제외는 데이터를 삭제하지 않고 별도 필터에서 복원할 수 있음', async ({ page }) => {
  await page.locator('[data-tab="todo"]').click();
  await page.locator('#todoText').fill('보관할 작업');
  await page.locator('#todoSubmit').click();
  const before = await page.evaluate(() => JSON.parse(localStorage.getItem('time-tracker-v1')));
  const todoId = before.todos.find(x => x.text === '보관할 작업').id;

  await page.locator('[data-todo-exclude="' + todoId + '"]').click();
  let saved = await page.evaluate(() => JSON.parse(localStorage.getItem('time-tracker-v1')));
  expect(saved.todos).toHaveLength(1);
  expect(saved.todos[0].excluded).toBe(true);
  await expect(page.locator('#todos')).not.toContainText('보관할 작업');

  await page.locator('[data-todo-filter="excluded"]').click();
  await expect(page.locator('#todos')).toContainText('보관할 작업');
  await page.reload();
  await page.locator('[data-tab="todo"]').click();
  await page.locator('[data-todo-filter="excluded"]').click();
  await expect(page.locator('#todos')).toContainText('보관할 작업');
  await page.locator('[data-todo-restore="' + todoId + '"]').click();
  saved = await page.evaluate(() => JSON.parse(localStorage.getItem('time-tracker-v1')));
  expect(saved.todos).toHaveLength(1);
  expect(saved.todos[0]).not.toHaveProperty('excluded');
  await page.locator('[data-todo-filter="all"]').click();
  await expect(page.locator('#todos')).toContainText('보관할 작업');
});

test('Todo에서 예상 시간을 기본값으로 계획을 만들고 링크를 보존하며 계획 시간만 중복 방지함', async ({ page }) => {
  const date = await page.locator('#day').inputValue();
  await page.evaluate(date => localStorage.setItem('time-tracker-v1', JSON.stringify({
    entries: [
      { id: 'existing-plan', date, name: '기존 계획', start: '09:00', end: '10:00', kind: 'planned' },
      { id: 'overlap-actual', date, name: '실제 기록', start: '10:00', end: '11:00', kind: 'actual' }
    ],
    todos: [{ id: 'linked-todo', date, text: '제안서 작성', done: false, estimatedMinutes: 75 }]
  })), date);
  await page.reload();
  await page.locator('[data-tab="todo"]').click();
  page.once('dialog', dialog => dialog.accept());
  await page.locator('[data-todo-plan="linked-todo"]').click();

  let saved = await page.evaluate(() => JSON.parse(localStorage.getItem('time-tracker-v1')));
  const plan = saved.entries.find(x => x.todoId === 'linked-todo');
  expect(plan).toMatchObject({ date, name: '제안서 작성', start: '10:00', end: '11:15', kind: 'planned', todoId: 'linked-todo' });
  expect(saved.entries.find(x => x.id === 'overlap-actual')).toBeTruthy();
  await expect(page.locator('#todos')).toContainText('연결 계획 1개');

  await page.reload();
  saved = await page.evaluate(() => JSON.parse(localStorage.getItem('time-tracker-v1')));
  expect(saved.entries.find(x => x.todoId === 'linked-todo')).toBeTruthy();

  await page.locator('[data-tab="record"]').click();
  await page.locator('[data-edit="' + plan.id + '"]').click();
  await page.locator('#entryAdvancedFields').evaluate(el => { el.open = true; });
  await page.locator('#kind').selectOption('actual');
  await page.locator('#start').fill('11:00');
  await page.locator('#end').fill('12:15');
  await page.locator('#saveEntry').click();
  saved = await page.evaluate(() => JSON.parse(localStorage.getItem('time-tracker-v1')));
  const converted = saved.entries.find(x => x.id === plan.id);
  expect(converted.kind).toBe('actual');
  expect(converted).not.toHaveProperty('todoId');
  expect(saved.todos.find(x => x.id === 'linked-todo')).toBeTruthy();
});

test('연결된 Todo 삭제 시 계획 기록은 보존하고 연결만 해제하며 잘못된 링크 백업은 거부함', async ({ page }) => {
  const date = await page.locator('#day').inputValue();
  await page.evaluate(date => localStorage.setItem('time-tracker-v1', JSON.stringify({
    entries: [{ id: 'linked-plan', date, name: '독립 보존 계획', start: '08:00', end: '09:00', kind: 'planned', todoId: 'delete-todo' }],
    todos: [{ id: 'delete-todo', date, text: '삭제할 Todo', done: false }]
  })), date);
  await page.reload();
  await page.locator('[data-tab="todo"]').click();
  page.once('dialog', dialog => dialog.accept());
  await page.locator('[data-todo-del="delete-todo"]').click();
  let saved = await page.evaluate(() => JSON.parse(localStorage.getItem('time-tracker-v1')));
  expect(saved.todos).toHaveLength(0);
  expect(saved.entries).toHaveLength(1);
  expect(saved.entries[0].name).toBe('독립 보존 계획');
  expect(saved.entries[0]).not.toHaveProperty('todoId');

  const invalid = { entries: [{ id: 'bad-plan', date, name: '잘못된 연결', start: '08:00', end: '09:00', kind: 'planned', todoId: 'missing-todo' }], todos: [] };
  await page.evaluate(data => {
    const file = new File([JSON.stringify(data)], 'invalid-link.json', { type: 'application/json' });
    const input = document.querySelector('#importFile');
    const transfer = new DataTransfer();
    transfer.items.add(file);
    input.files = transfer.files;
    input.dispatchEvent(new Event('change', { bubbles: true }));
  }, invalid);
  await expect(page.locator('#importPreview')).toContainText('데이터에 오류');
  saved = await page.evaluate(() => JSON.parse(localStorage.getItem('time-tracker-v1')));
  expect(saved.entries[0].name).toBe('독립 보존 계획');
});


test('예상 시간이 없는 Todo는 60분 계획을 만들고 24시간 초과 예상은 안전하게 거부함', async ({ page }) => {
  const date = await page.locator('#day').inputValue();
  await page.evaluate(date => localStorage.setItem('time-tracker-v1', JSON.stringify({
    entries: [],
    todos: [
      { id: 'default-duration', date, text: '시간 미설정 작업', done: false },
      { id: 'too-long-duration', date, text: '장시간 작업', done: false, estimatedMinutes: 1440 }
    ]
  })), date);
  await page.reload();
  await page.locator('[data-tab="todo"]').click();

  page.once('dialog', dialog => dialog.accept());
  await page.locator('[data-todo-plan="default-duration"]').click();
  let saved = await page.evaluate(() => JSON.parse(localStorage.getItem('time-tracker-v1')));
  expect(saved.entries.find(x => x.todoId === 'default-duration')).toMatchObject({
    start: '09:00', end: '10:00', kind: 'planned'
  });

  page.once('dialog', dialog => dialog.accept());
  await page.locator('[data-todo-plan="too-long-duration"]').click();
  saved = await page.evaluate(() => JSON.parse(localStorage.getItem('time-tracker-v1')));
  expect(saved.entries.filter(x => x.todoId === 'too-long-duration')).toHaveLength(0);
});


test('Todo 템플릿은 예상 시간과 중첩 하위 작업을 저장하고 새 ID로 선택 날짜에 불러옴', async ({ page }) => {
  const today = await page.locator('#day').inputValue();
  await page.evaluate(date => localStorage.setItem('time-tracker-v1', JSON.stringify({
    entries: [],
    todos: [{
      id: 'template-source',
      date,
      text: '주간 리포트',
      done: true,
      doneAt: date,
      category: 'work',
      importance: 'high',
      estimatedMinutes: 90,
      subtasks: [{
        id: 'template-parent',
        text: '데이터 수집',
        done: true,
        subtasks: [{ id: 'template-leaf', text: '매출 정리', done: true }]
      }]
    }]
  })), today);
  await page.reload();
  await page.locator('[data-tab="todo"]').click();

  page.once('dialog', dialog => dialog.accept('주간 리포트 템플릿'));
  await page.locator('[data-todo-template-save="template-source"]').click();
  await expect(page.locator('#todoTemplates')).toContainText('주간 리포트 템플릿');
  const templateStore = await page.evaluate(() => JSON.parse(localStorage.getItem('time-tracker-todo-templates')));
  expect(templateStore).toHaveLength(1);
  expect(templateStore[0]).toMatchObject({
    name: '주간 리포트 템플릿',
    text: '주간 리포트',
    category: 'work',
    importance: 'high',
    estimatedMinutes: 90
  });
  expect(templateStore[0].subtasks[0].subtasks[0].text).toBe('매출 정리');

  await page.locator('#day').fill('2026-11-05');
  await page.locator('[data-todo-template-load="' + templateStore[0].id + '"]').click();
  const saved = await page.evaluate(() => JSON.parse(localStorage.getItem('time-tracker-v1')));
  expect(saved.todos).toHaveLength(2);
  const loaded = saved.todos.find(x => x.date === '2026-11-05');
  expect(loaded).toMatchObject({
    text: '주간 리포트',
    done: false,
    category: 'work',
    importance: 'high',
    estimatedMinutes: 90
  });
  expect(loaded).not.toHaveProperty('doneAt');
  expect(loaded.subtasks[0].done).toBe(false);
  expect(loaded.subtasks[0].subtasks[0].done).toBe(false);
  expect(loaded.id).not.toBe('template-source');
  expect(loaded.subtasks[0].id).not.toBe('template-parent');
  expect(loaded.subtasks[0].subtasks[0].id).not.toBe('template-leaf');
  expect(saved.todos.find(x => x.id === 'template-source').done).toBe(true);
  expect(await page.evaluate(() => localStorage.getItem('time-tracker-v1'))).toContain('주간 리포트');
});

test('Todo 템플릿은 새로고침 후 유지되고 삭제해도 기존 Todo 데이터는 변경하지 않음', async ({ page }) => {
  await page.locator('[data-tab="todo"]').click();
  await page.locator('#todoText').fill('반복 업무');
  await page.locator('#todoSubmit').click();
  const todoId = await page.evaluate(() => JSON.parse(localStorage.getItem('time-tracker-v1')).todos[0].id);
  page.once('dialog', dialog => dialog.accept('반복 업무 템플릿'));
  await page.locator('[data-todo-template-save="' + todoId + '"]').click();
  await page.reload();
  await page.locator('[data-tab="todo"]').click();
  await expect(page.locator('#todoTemplates')).toContainText('반복 업무 템플릿');
  const templateId = await page.evaluate(() => JSON.parse(localStorage.getItem('time-tracker-todo-templates'))[0].id);
  page.once('dialog', dialog => dialog.accept());
  await page.locator('[data-todo-template-del="' + templateId + '"]').click();
  await expect(page.locator('#todoTemplates')).not.toContainText('반복 업무 템플릿');
  const saved = await page.evaluate(() => JSON.parse(localStorage.getItem('time-tracker-v1')));
  expect(saved.todos).toHaveLength(1);
  expect(saved.todos[0].text).toBe('반복 업무');
});

test('손상된 Todo 템플릿 저장 데이터는 덮어쓰지 않고 기존 시간 기록과 Todo를 보존함', async ({ page }) => {
  await page.evaluate(() => {
    localStorage.setItem('time-tracker-v1', JSON.stringify({
      entries: [],
      todos: [{ id: 'safe-existing-todo', date: document.querySelector('#day').value, text: '기존 데이터', done: false }]
    }));
    localStorage.setItem('time-tracker-todo-templates', '{broken json');
  });
  await page.reload();
  await page.locator('[data-tab="todo"]').click();
  await expect(page.locator('#todoTemplates')).toContainText('올바르지 않아 읽기 전용');
  const before = await page.evaluate(() => localStorage.getItem('time-tracker-todo-templates'));
  page.once('dialog', dialog => dialog.accept('새 템플릿'));
  await page.locator('[data-todo-template-save="safe-existing-todo"]').click();
  const after = await page.evaluate(() => localStorage.getItem('time-tracker-todo-templates'));
  expect(after).toBe(before);
  const saved = await page.evaluate(() => JSON.parse(localStorage.getItem('time-tracker-v1')));
  expect(saved.todos[0].text).toBe('기존 데이터');
});


test('Todo 분류·중요도 필터를 조합하고 하위 작업 이름으로 검색할 수 있음', async ({ page }) => {
  const date = await page.locator('#day').inputValue();
  await page.evaluate(date => localStorage.setItem('time-tracker-v1', JSON.stringify({
    entries: [],
    todos: [
      { id: 'filter-work-high', date, text: '주간 보고서', done: false, category: 'work', importance: 'high', subtasks: [{ id: 'filter-child', text: '매출 데이터 확인', done: false }] },
      { id: 'filter-work-low', date, text: '자료 정리', done: false, category: 'work', importance: 'low' },
      { id: 'filter-personal-high', date, text: '운동 계획', done: false, category: 'personal', importance: 'high' },
      { id: 'filter-personal-low', date, text: '여행 예약', done: false, category: 'personal', importance: 'low' }
    ]
  })), date);
  await page.reload();
  await page.locator('[data-tab="todo"]').click();

  await page.locator('[data-todo-category-filter="personal"]').click();
  await page.locator('#todoImportanceFilter').selectOption('high');
  await expect(page.locator('#todos .todo')).toHaveCount(1);
  await expect(page.locator('#todos')).toContainText('운동 계획');
  await expect(page.locator('#todoFilterSummary')).toHaveText('표시 1 / 4개');

  await page.locator('[data-todo-category-filter="all"]').click();
  await page.locator('#todoImportanceFilter').selectOption('all');
  await page.locator('#todoSearch').fill('매출 데이터');
  await expect(page.locator('#todos .todo')).toHaveCount(1);
  await expect(page.locator('#todos')).toContainText('주간 보고서');
  await expect(page.locator('#todoFilterSummary')).toHaveText('표시 1 / 4개');
  await page.locator('#todoSearch').fill('없는 검색어');
  await expect(page.locator('#todos .todo')).toHaveCount(0);
  await expect(page.locator('#todoFilterSummary')).toHaveText('표시 0 / 4개');
});

test('각 중첩 하위 작업 그룹에 해당 단계의 진행률을 표시하고 완료 변경 시 갱신함', async ({ page }) => {
  const date = await page.locator('#day').inputValue();
  await page.evaluate(date => localStorage.setItem('time-tracker-v1', JSON.stringify({
    entries: [],
    todos: [{
      id: 'progress-root',
      date,
      text: '전체 프로젝트',
      done: false,
      subtasks: [
        {
          id: 'progress-parent',
          text: '시장 조사',
          done: false,
          subtasks: [
            { id: 'progress-leaf-a', text: '경쟁사 분석', done: true },
            { id: 'progress-leaf-b', text: '가격 조사', done: false }
          ]
        },
        { id: 'progress-leaf-c', text: '결과 요약', done: false }
      ]
    }]
  })), date);
  await page.reload();
  await page.locator('[data-tab="todo"]').click();

  await expect(page.locator('[data-subtask-progress="progress-root|progress-parent"]')).toHaveText('진행률 50% · 완료 1/2');
  const root = page.locator('#todos .todo').filter({ hasText: '전체 프로젝트' });
  await expect(root.locator('.todo-progress')).toContainText('진행률 33% · 완료 1/3');

  await page.locator('[data-subtask-children="progress-root|root"]').evaluate(el => { el.open = true; });
  await page.locator('[data-subtask-children="progress-root|progress-parent"]').evaluate(el => { el.open = true; });
  await page.locator('[data-subtask-check="progress-root|progress-leaf-b"]').check();
  await expect(page.locator('[data-subtask-progress="progress-root|progress-parent"]')).toHaveText('진행률 100% · 완료 2/2');
  await expect(root.locator('.todo-progress')).toContainText('진행률 67% · 완료 2/3');
});


test('Step 8 통합 흐름: Todo 작성부터 하위 작업·계획 연결·제외 복원·JSON/CSV 백업까지 보존', async ({ page }) => {
  const date = await page.locator('#day').inputValue();
  await page.locator('[data-tab="todo"]').click();

  await page.locator('#todoText').fill('고객 제안서 준비');
  await page.locator('#todoOptions').evaluate(el => { el.open = true; });
  await page.locator('#todoCategory').selectOption('personal');
  await page.locator('#todoImportance').selectOption('high');
  await page.locator('#todoEstimate').fill('45');
  await page.locator('#todoSubmit').click();

  let saved = await page.evaluate(() => JSON.parse(localStorage.getItem('time-tracker-v1')));
  const todoId = saved.todos.find(x => x.text === '고객 제안서 준비').id;
  await page.locator('[data-subtask-children="' + todoId + '|root"]').evaluate(el => { el.open = true; });
  await page.locator('[data-subtask-input="' + todoId + '|root"]').fill('시장 자료');
  await page.locator('[data-subtask-add="' + todoId + '|root"]').click();
  saved = await page.evaluate(() => JSON.parse(localStorage.getItem('time-tracker-v1')));
  const subtaskId = saved.todos.find(x => x.id === todoId).subtasks[0].id;
  await page.locator('[data-subtask-children="' + todoId + '|' + subtaskId + '"]').evaluate(el => { el.open = true; });
  await page.locator('[data-subtask-input="' + todoId + '|' + subtaskId + '"]').fill('경쟁사 비교');
  await page.locator('[data-subtask-add="' + todoId + '|' + subtaskId + '"]').click();

  page.once('dialog', dialog => dialog.accept());
  await page.locator('[data-todo-plan="' + todoId + '"]').click();
  saved = await page.evaluate(() => JSON.parse(localStorage.getItem('time-tracker-v1')));
  const plan = saved.entries.find(x => x.todoId === todoId);
  expect(plan).toMatchObject({ date, name: '고객 제안서 준비', start: '09:00', end: '09:45', kind: 'planned' });
  expect(saved.todos.find(x => x.id === todoId).subtasks[0].subtasks[0].text).toBe('경쟁사 비교');

  await page.locator('[data-todo-exclude="' + todoId + '"]').click();
  await page.locator('[data-todo-filter="excluded"]').click();
  await expect(page.locator('#todos')).toContainText('고객 제안서 준비');
  await page.locator('[data-todo-restore="' + todoId + '"]').click();
  await page.locator('[data-todo-filter="all"]').click();

  await page.locator('.tools-menu').evaluate(el => { el.open = true; });
  const jsonDownloadPromise = page.waitForEvent('download');
  await page.locator('#export').click();
  const jsonDownload = await jsonDownloadPromise;
  const jsonStream = await jsonDownload.createReadStream();
  let jsonText = '';
  for await (const chunk of jsonStream) jsonText += chunk.toString('utf8');
  const backup = JSON.parse(jsonText);
  expect(backup.entries.find(x => x.todoId === todoId)).toBeTruthy();
  expect(backup.todos.find(x => x.id === todoId).subtasks[0].subtasks[0].text).toBe('경쟁사 비교');

  page.once('dialog', dialog => dialog.accept());
  await page.locator('[data-todo-del="' + todoId + '"]').click();
  saved = await page.evaluate(() => JSON.parse(localStorage.getItem('time-tracker-v1')));
  expect(saved.todos.some(x => x.id === todoId)).toBe(false);

  await page.locator('#importFile').setInputFiles({
    name: 'step8-roundtrip.json',
    mimeType: 'application/json',
    buffer: Buffer.from(jsonText, 'utf8'),
  });
  await expect(page.locator('#importPreview')).toContainText('백업 파일 검증 완료');
  page.once('dialog', dialog => dialog.accept());
  await page.locator('#confirmImport').click();
  saved = await page.evaluate(() => JSON.parse(localStorage.getItem('time-tracker-v1')));
  expect(saved.todos.find(x => x.id === todoId).subtasks[0].subtasks[0].text).toBe('경쟁사 비교');
  expect(saved.entries.find(x => x.todoId === todoId)).toBeTruthy();

  const csvDownloadPromise = page.waitForEvent('download');
  await page.locator('#csvExport').click();
  const csvDownload = await csvDownloadPromise;
  const csvStream = await csvDownload.createReadStream();
  let csvText = '';
  for await (const chunk of csvStream) csvText += chunk.toString('utf8');
  expect(csvText).toContain('연결 Todo');
  expect(csvText).toContain('고객 제안서 준비');
});

test('Step 8 모바일 Todo 화면은 320px에서도 필터·검색·템플릿·중첩 작업 가로 넘침이 없음', async ({ page }) => {
  const date = await page.locator('#day').inputValue();
  await page.evaluate(date => {
    localStorage.setItem('time-tracker-v1', JSON.stringify({
      entries: [{ id: 'mobile-plan', date, name: '모바일 계획', start: '09:00', end: '10:00', kind: 'planned', todoId: 'mobile-todo' }],
      todos: [{
        id: 'mobile-todo',
        date,
        text: '모바일 화면에서 확인할 매우 긴 프로젝트 할 일 이름입니다',
        done: false,
        category: 'personal',
        importance: 'high',
        estimatedMinutes: 90,
        subtasks: [{
          id: 'mobile-parent',
          text: '중첩된 하위 작업도 화면 안에 표시되어야 합니다',
          done: false,
          subtasks: [{ id: 'mobile-leaf', text: '매우 긴 하위 작업 이름이 모바일 화면에서 잘리는지 확인합니다', done: false }]
        }]
      }]
    }));
    localStorage.setItem('time-tracker-todo-templates', JSON.stringify([{
      id: 'mobile-template',
      name: '모바일에서 불러올 템플릿 이름',
      text: '모바일 프로젝트 템플릿',
      category: 'personal',
      importance: 'high',
      estimatedMinutes: 90,
      subtasks: [{ text: '템플릿 하위 작업' }]
    }]));
  }, date);
  await page.setViewportSize({ width: 320, height: 740 });
  await page.reload();
  await page.locator('[data-tab="todo"]').click();
  await page.locator('[data-subtask-children="mobile-todo|root"]').evaluate(el => { el.open = true; });
  await page.locator('[data-subtask-children="mobile-todo|mobile-parent"]').evaluate(el => { el.open = true; });

  const sizes = await page.evaluate(() => ({
    viewport: document.documentElement.clientWidth,
    document: document.documentElement.scrollWidth,
    body: document.body.scrollWidth,
    todoPanel: document.querySelector('#todoPanel').scrollWidth,
    todos: document.querySelector('#todos').scrollWidth
  }));
  expect(sizes.document).toBeLessThanOrEqual(sizes.viewport);
  expect(sizes.body).toBeLessThanOrEqual(sizes.viewport);
  expect(sizes.todoPanel).toBeLessThanOrEqual(sizes.viewport);
  expect(sizes.todos).toBeLessThanOrEqual(sizes.viewport);

  await page.locator('[data-todo-filter="excluded"]').click();
  await page.locator('#todoSearch').fill('모바일');
  const filteredSizes = await page.evaluate(() => ({
    viewport: document.documentElement.clientWidth,
    document: document.documentElement.scrollWidth
  }));
  expect(filteredSizes.document).toBeLessThanOrEqual(filteredSizes.viewport);
});


test('Todo 분류 필터를 상태 필터와 별도로 항상 표시하고 선택 결과를 갱신함', async ({ page }) => {
  const date = await page.locator('#day').inputValue();
  await page.evaluate(date => localStorage.setItem('time-tracker-v1', JSON.stringify({
    entries: [],
    todos: [
      { id: 'category-visible-work', date, text: '업무 할 일', done: false, category: 'work' },
      { id: 'category-visible-personal', date, text: '개인 할 일', done: false, category: 'personal' }
    ]
  })), date);
  await page.reload();
  await page.locator('[data-tab="todo"]').click();

  await expect(page.locator('[data-todo-category-filter]')).toHaveCount(3);
  await expect(page.locator('#todos .todo')).toHaveCount(2);
  await page.locator('[data-todo-category-filter="work"]').click();
  await expect(page.locator('#todos .todo')).toHaveCount(1);
  await expect(page.locator('#todos')).toContainText('업무 할 일');
  await expect(page.locator('#todos')).not.toContainText('개인 할 일');
  await expect(page.locator('[data-todo-category-filter="work"]')).toHaveAttribute('aria-pressed', 'true');

  await page.locator('[data-todo-category-filter="personal"]').click();
  await expect(page.locator('#todos')).toContainText('개인 할 일');
  await expect(page.locator('#todos')).not.toContainText('업무 할 일');

  await page.locator('[data-todo-category-filter="all"]').click();
  await expect(page.locator('#todos .todo')).toHaveCount(2);
});

test('시간 입력 필드는 한국어 기기에서도 24시간 표시 로캘을 사용함', async ({ page }) => {
  for (const selector of ['#start', '#end', '#templateStart', '#templateEnd']) {
    await expect(page.locator(selector)).toHaveAttribute('type', 'time');
    await expect(page.locator(selector)).toHaveAttribute('lang', 'en-GB');
  }
  await page.locator('#start').fill('05:00');
  await page.locator('#end').fill('17:25');
  await expect(page.locator('#start')).toHaveValue('05:00');
  await expect(page.locator('#end')).toHaveValue('17:25');
});


test('Life by Design 아침 계획과 저녁 회고를 입력 즉시 날짜별 자동 저장하고 새로고침 후 복원함', async ({ page }) => {
  const date = await page.locator('#day').inputValue();
  await expect(page.locator('#lifeByDesign')).toBeVisible();
  await page.locator('#ld-morning-identity').fill('차분하고 집중력 있는 사람');
  await page.locator('#ld-morning-priority').fill('핵심 프로젝트 완성');
  await page.locator('#ld-evening-bestChoice').fill('중요한 일부터 실행했다');
  await page.locator('#ld-satisfaction').selectOption('4');
  const stored = await page.evaluate(() => JSON.parse(localStorage.getItem('time-tracker-daily-design-v1')));
  expect(stored[date].morning.identity).toBe('차분하고 집중력 있는 사람');
  expect(stored[date].morning.priority).toBe('핵심 프로젝트 완성');
  expect(stored[date].evening.bestChoice).toBe('중요한 일부터 실행했다');
  expect(stored[date].evening.satisfaction).toBe(4);
  await page.reload();
  await expect(page.locator('#ld-morning-identity')).toHaveValue('차분하고 집중력 있는 사람');
  await expect(page.locator('#ld-evening-bestChoice')).toHaveValue('중요한 일부터 실행했다');
  await expect(page.locator('#ld-satisfaction')).toHaveValue('4');
});

test('Life by Design 날짜를 바꾸면 날짜별 입력이 분리되고 기존 날짜 기록을 다시 불러옴', async ({ page }) => {
  const date = await page.locator('#day').inputValue();
  await page.locator('#ld-morning-joy').fill('오늘의 작은 즐거움');
  const nextDate = await page.evaluate(value => { const d=new Date(value+'T12:00:00');d.setDate(d.getDate()+1);return d.getFullYear()+'-'+String(d.getMonth()+1).padStart(2,'0')+'-'+String(d.getDate()).padStart(2,'0'); }, date);
  await page.locator('#day').fill(nextDate);
  await expect(page.locator('#ld-morning-joy')).toHaveValue('');
  await page.locator('#ld-morning-joy').fill('다음 날의 즐거움');
  await page.locator('#day').fill(date);
  await expect(page.locator('#ld-morning-joy')).toHaveValue('오늘의 작은 즐거움');
  const stored = await page.evaluate(() => JSON.parse(localStorage.getItem('time-tracker-daily-design-v1')));
  expect(stored[date].morning.joy).toBe('오늘의 작은 즐거움');
  expect(stored[nextDate].morning.joy).toBe('다음 날의 즐거움');
});

test('Life by Design 자동 백업 및 JSON 내보내기에 dailyDesign을 포함함', async ({ page }) => {
  await page.locator('#ld-evening-learning').fill('오늘 배운 점');
  await expect.poll(() => page.evaluate(() => JSON.parse(localStorage.getItem('time-tracker-auto-backup-v1') || '{}').dailyDesign)).not.toBeUndefined();
  const downloadPromise = page.waitForEvent('download');
  await page.locator('.tools-menu summary').click();
  await page.locator('#export').click();
  const download = await downloadPromise;
  const stream = await download.createReadStream();
  let raw = '';
  for await (const chunk of stream) raw += chunk.toString('utf8');
  expect(JSON.parse(raw).dailyDesign[await page.locator('#day').inputValue()].evening.learning).toBe('오늘 배운 점');
});

test('기존 형식의 JSON 백업 복원은 아침 계획과 저녁 회고를 삭제하지 않음', async ({ page }) => {
  const date = await page.locator('#day').inputValue();
  await page.locator('#ld-morning-identity').fill('기존 회고 보존 확인');
  await page.locator('.tools-menu summary').click();
  await page.locator('#importFile').setInputFiles({
    name: 'legacy-backup.json',
    mimeType: 'application/json',
    buffer: Buffer.from(JSON.stringify({ entries: [], todos: [] }), 'utf8'),
  });
  await expect(page.locator('#importPreview')).toContainText('백업 파일 검증 완료');
  page.once('dialog', dialog => dialog.accept());
  await page.locator('#confirmImport').click();
  await expect(page.locator('#ld-morning-identity')).toHaveValue('기존 회고 보존 확인');
  const stored = await page.evaluate(() => JSON.parse(localStorage.getItem('time-tracker-daily-design-v1')));
  expect(stored[date].morning.identity).toBe('기존 회고 보존 확인');
});

test('Life by Design은 320px 모바일 화면에서 가로 넘침이 없음', async ({ page }) => {
  await page.setViewportSize({ width: 320, height: 740 });
  await page.reload();
  const sizes = await page.evaluate(() => ({ viewport: document.documentElement.clientWidth, document: document.documentElement.scrollWidth }));
  expect(sizes.document).toBeLessThanOrEqual(sizes.viewport);
  await expect(page.locator('#lifeByDesign')).toBeVisible();
});


test('Life by Design 자동 저장은 기존 time-tracker-v1 시간 기록과 Todo를 변경하지 않음', async ({ page }) => {
  const date = await page.locator('#day').inputValue();
  const original = {
    entries: [{ id: 'keep-entry', date, name: '기존 기록', start: '08:00', end: '09:00', kind: 'actual' }],
    todos: [{ id: 'keep-todo', date, text: '기존 할 일', done: false }]
  };
  await page.evaluate(value => localStorage.setItem('time-tracker-v1', JSON.stringify(value)), original);
  await page.reload();
  const before = await page.evaluate(() => localStorage.getItem('time-tracker-v1'));
  await page.locator('#ld-morning-priority').fill('새로운 하루의 핵심');
  const after = await page.evaluate(() => localStorage.getItem('time-tracker-v1'));
  expect(after).toBe(before);
  expect(JSON.parse(after)).toEqual(original);
});

test('새 형식의 JSON 백업 복원은 Life by Design 데이터도 검증 후 복원함', async ({ page }) => {
  const date = await page.locator('#day').inputValue();
  await page.locator('#ld-morning-identity').fill('복원 전 데이터');
  await page.locator('.tools-menu summary').click();
  const backup = {
    entries: [],
    todos: [],
    dailyDesign: { [date]: { morning: { identity: '백업에서 복원된 정체성' }, evening: { satisfaction: 5 } } }
  };
  await page.locator('#importFile').setInputFiles({
    name: 'life-design-backup.json',
    mimeType: 'application/json',
    buffer: Buffer.from(JSON.stringify(backup), 'utf8'),
  });
  await expect(page.locator('#importPreview')).toContainText('백업 파일 검증 완료');
  page.once('dialog', dialog => dialog.accept());
  await page.locator('#confirmImport').click();
  await expect(page.locator('#ld-morning-identity')).toHaveValue('백업에서 복원된 정체성');
  await expect(page.locator('#ld-satisfaction')).toHaveValue('5');
});

test('잘못된 dailyDesign 백업은 거부하고 기존 회고와 시간 기록을 보존함', async ({ page }) => {
  const date = await page.locator('#day').inputValue();
  await page.locator('#ld-morning-identity').fill('보존할 기존 회고');
  const before = await page.evaluate(() => localStorage.getItem('time-tracker-v1'));
  await page.locator('.tools-menu summary').click();
  await page.locator('#importFile').setInputFiles({
    name: 'invalid-life-design-backup.json',
    mimeType: 'application/json',
    buffer: Buffer.from(JSON.stringify({ entries: [], todos: [], dailyDesign: { [date]: { morning: { unexpected: 'invalid' } } } }), 'utf8'),
  });
  await expect(page.locator('#importPreview')).toContainText('백업 파일 형식이 올바르지 않거나');
  expect(await page.evaluate(() => localStorage.getItem('time-tracker-v1'))).toBe(before);
  expect(await page.evaluate(value => JSON.parse(localStorage.getItem('time-tracker-daily-design-v1'))[value].morning.identity, date)).toBe('보존할 기존 회고');
});


test('잘못된 달력 날짜가 포함된 dailyDesign 백업은 거부하고 기존 데이터를 보존함', async ({ page }) => {
  const date = await page.locator('#day').inputValue();
  await page.locator('#ld-morning-identity').fill('날짜 검증 전 기존 데이터');
  const backup = {
    entries: [],
    todos: [],
    dailyDesign: { '2026-02-31': { morning: { identity: '존재하지 않는 날짜' } } }
  };
  await page.locator('.tools-menu summary').click();
  await page.locator('#importFile').setInputFiles({
    name: 'invalid-calendar-date-backup.json',
    mimeType: 'application/json',
    buffer: Buffer.from(JSON.stringify(backup), 'utf8'),
  });
  await expect(page.locator('#importPreview')).toContainText('백업 파일 형식이 올바르지 않거나');
  const stored = await page.evaluate(value => JSON.parse(localStorage.getItem('time-tracker-daily-design-v1'))[value].morning.identity, date);
  expect(stored).toBe('날짜 검증 전 기존 데이터');
});

test('Life by Design 원본이 손상된 경우 시간 기록 저장이 기존 자동 백업의 회고 데이터를 덮어쓰지 않음', async ({ page }) => {
  const preserved = { '2026-11-09': { morning: { priority: '복구 가능한 기존 회고' }, evening: {} } };
  const corruptRaw = '{"2026-11-09":';
  await page.evaluate(({ backup, corrupt }) => {
    localStorage.setItem('time-tracker-auto-backup-v1', JSON.stringify({ entries: [], todos: [], dailyDesign: backup }));
    localStorage.setItem('time-tracker-daily-design-v1', corrupt);
  }, { backup: preserved, corrupt: corruptRaw });
  await page.reload();
  await page.locator('#name').fill('손상 데이터 상태에서 저장');
  await page.locator('#entryForm button[type="submit"]').click();

  const state = await page.evaluate(() => ({
    backup: JSON.parse(localStorage.getItem('time-tracker-auto-backup-v1')),
    dailyRaw: localStorage.getItem('time-tracker-daily-design-v1'),
  }));
  expect(state.backup.dailyDesign).toEqual(preserved);
  expect(state.dailyRaw).toBe(corruptRaw);
});


test('Todo 기존 항목 편집에서 날짜·내용·분류·중요도·예상 시간을 변경하고 새로고침 후 유지함', async ({ page }) => {
  const initialDate = '2026-11-08';
  const updatedDate = '2026-11-07';
  await page.locator('#day').fill(initialDate);
  await page.locator('[data-tab="todo"]').click();
  await page.locator('#todoText').fill('날짜 수정 전');
  await page.locator('#todoForm button[type="submit"]').click();
  const todoId = await page.evaluate(() => JSON.parse(localStorage.getItem('time-tracker-v1')).todos[0].id);
  await page.locator('[data-todo-edit="' + todoId + '"]').click();
  await expect(page.locator('#todoDateField')).toBeVisible();
  await page.locator('#todoText').fill('날짜 수정 완료');
  await page.locator('#todoDate').fill(updatedDate);
  await page.locator('#todoCategory').selectOption('personal');
  await page.locator('#todoImportance').selectOption('high');
  await page.locator('#todoEstimate').fill('75');
  await page.locator('#todoForm button[type="submit"]').click();
  await page.reload();
  const saved = await page.evaluate(id => JSON.parse(localStorage.getItem('time-tracker-v1')).todos.find(x => x.id === id), todoId);
  expect(saved).toMatchObject({ date: updatedDate, text: '날짜 수정 완료', category: 'personal', importance: 'high', estimatedMinutes: 75 });
  await page.locator('#day').fill(initialDate);
  await page.locator('#todoText').fill('새로 추가한 할 일');
  await page.locator('#todoForm button[type="submit"]').click();
  const nextTodo = await page.evaluate(() => JSON.parse(localStorage.getItem('time-tracker-v1')).todos.find(x => x.text === '새로 추가한 할 일'));
  expect(nextTodo.date).toBe(initialDate);
});

test('시간 기록 템플릿을 수정하고 변경 사항은 새로고침 후 유지됨', async ({ page }) => {
  await page.locator('.advanced-panel summary').click();
  await page.locator('#templateName').fill('기존 템플릿');
  await page.locator('#templateActivity').fill('기존 활동');
  await page.locator('#templateStart').fill('07:00');
  await page.locator('#templateEnd').fill('08:00');
  await page.locator('#templateForm button[type="submit"]').click();
  const id = await page.evaluate(() => JSON.parse(localStorage.getItem('time-tracker-templates'))[0].id);
  await page.locator('[data-edit-template="' + id + '"]').click();
  await page.locator('#templateName').fill('수정 템플릿');
  await page.locator('#templateActivity').fill('수정 활동');
  await page.locator('#templateStart').fill('08:00');
  await page.locator('#templateEnd').fill('09:30');
  await page.locator('#templateForm button[type="submit"]').click();
  await page.reload();
  const saved = await page.evaluate(id => JSON.parse(localStorage.getItem('time-tracker-templates')).find(x => x.id === id), id);
  expect(saved).toMatchObject({ name: '수정 템플릿', activity: '수정 활동', start: '08:00', end: '09:30' });
});

test('Todo 템플릿의 이름·내용·속성을 수정하고 하위 작업 구조를 보존함', async ({ page }) => {
  await page.evaluate(() => {
    localStorage.setItem('time-tracker-todo-templates', JSON.stringify([{
      id: 'editable-template', name: '원본 템플릿', text: '원본 작업', category: 'work', importance: 'medium',
      estimatedMinutes: 30, subtasks: [{ text: '하위 작업', subtasks: [{ text: '중첩 작업' }] }]
    }]));
  });
  await page.reload();
  page.once('dialog', dialog => dialog.accept('수정 템플릿 이름'));
  page.once('dialog', dialog => dialog.accept('수정된 작업'));
  page.once('dialog', dialog => dialog.accept('personal'));
  page.once('dialog', dialog => dialog.accept('high'));
  page.once('dialog', dialog => dialog.accept('90'));
  page.once('dialog', dialog => dialog.accept('수정된 하위 작업'));
  page.once('dialog', dialog => dialog.accept('수정된 중첩 작업'));
  await page.locator('[data-todo-template-edit="editable-template"]').click();
  const saved = await page.evaluate(() => JSON.parse(localStorage.getItem('time-tracker-todo-templates'))[0]);
  expect(saved).toMatchObject({
    name: '수정 템플릿 이름', text: '수정된 작업', category: 'personal', importance: 'high', estimatedMinutes: 90,
    subtasks: [{ text: '수정된 하위 작업', subtasks: [{ text: '수정된 중첩 작업' }] }]
  });
});
