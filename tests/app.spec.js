const { test, expect } = require('@playwright/test');

test.beforeEach(async ({ page }) => {
  await page.goto('/');
  await page.evaluate(() => {
    localStorage.clear();
    sessionStorage.clear();
  });
  await page.reload();
});

test('기록 추가와 시간 합계 계산', async ({ page }) => {
  await expect(page.getByRole('heading', { name: '시간 기록' })).toBeVisible();
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

test('같은 종류의 겹치는 시간 기록은 저장되지 않음', async ({ page }) => {
  await page.locator('#name').fill('첫 번째 기록');
  await page.locator('#entryForm button[type="submit"]').click();

  page.once('dialog', dialog => dialog.accept());
  await page.locator('#name').fill('겹치는 기록');
  await page.locator('#start').fill('09:30');
  await page.locator('#end').fill('10:30');
  await page.locator('#entryForm button[type="submit"]').click();

  await expect(page.locator('#entries')).toContainText('첫 번째 기록');
  await expect(page.locator('#entries')).not.toContainText('겹치는 기록');
  await expect(page.locator('#count')).toHaveText('1');
});

test('할 일 추가와 완료 체크', async ({ page }) => {
  await page.locator('[data-tab="todo"]').click();
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

  page.once('dialog', dialog => dialog.accept());
  await page.locator('#undoLastChange').click();

  await expect(page.locator('#entries')).not.toContainText('취소 대상 기록');
  await expect(page.locator('#count')).toHaveText('0');
});
