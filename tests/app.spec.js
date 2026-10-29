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
  await afterReload.locator('details.todo-subtasks summary').click();
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

test('할 일 분류를 저장하고 마지막 분류를 다음 입력에도 기억함', async ({ page }) => {
  await page.locator('[data-tab="todo"]').click();
  const sourceDate = await page.locator('#day').inputValue();
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
  await todo.locator('details.todo-subtasks summary').click();
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
  await restored.locator('details.todo-subtasks').locator('summary').click();
  await expect(restored.locator('input[data-subtask-check]')).toBeChecked();
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
  await todo.locator('details.todo-subtasks summary').click();
  await todo.locator('input[data-subtask-input]').fill('자료 정리');
  await todo.locator('button[data-subtask-add]').click();
  await todo.locator('input[data-subtask-check]').check();

  const downloadPromise = page.waitForEvent('download');
  await page.locator('.tools-menu').locator('summary').click();
  await page.locator('#csvExport').click();
  const download = await downloadPromise;
  const stream = await download.createReadStream();
  let csv = '';
  for await (const chunk of stream) csv += chunk.toString('utf8');
  expect(csv).toContain('CSV 하위 작업 테스트');
  expect(csv).toContain('[완료] 자료 정리');
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
  await page.locator('#todoText').fill('낮은 우선순위');
  await page.locator('#todoImportance').selectOption('low');
  await page.locator('#todoForm button[type="submit"]').click();
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
