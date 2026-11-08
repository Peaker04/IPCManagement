import { expect, test, type Locator } from '@playwright/test';

const viewports = [
  { width: 1366, height: 768 },
  { width: 1440, height: 900 },
  { width: 1920, height: 1080 },
];

async function contentGeometry(dialog: Locator) {
  return dialog.evaluate((element) => {
    const owner = element as HTMLElement;
    const style = getComputedStyle(owner);
    const children = [...owner.children] as HTMLElement[];
    const rect = owner.getBoundingClientRect();
    return {
      display: style.display,
      expectedGap: Number.parseFloat(style.rowGap),
      separations: children.slice(1).map((child, index) => child.getBoundingClientRect().top - children[index].getBoundingClientRect().bottom),
      contained: rect.left >= 0 && rect.right <= innerWidth && rect.top >= 0 && rect.bottom <= innerHeight,
      clientHeight: owner.clientHeight,
      scrollHeight: owner.scrollHeight,
      documentOverflow: Math.max(0, document.documentElement.scrollWidth - innerWidth),
    };
  });
}

async function expectSingleEffectiveGap(dialog: Locator) {
  const measured = await contentGeometry(dialog);
  expect(measured.expectedGap).toBeGreaterThan(0);
  expect(['flex', 'grid']).toContain(measured.display);
  expect(measured.separations.length).toBeGreaterThan(0);
  for (const separation of measured.separations) expect(separation).toBeCloseTo(measured.expectedGap, 0);
  expect(measured.contained).toBe(true);
  expect(measured.documentOverflow).toBe(0);
  return measured;
}

for (const viewport of viewports) {
  test(`shared dialog applies one effective content gap at ${viewport.width}x${viewport.height}`, async ({ page }) => {
    await page.setViewportSize(viewport);
    await page.goto('/tests/fixtures/dialog-gap.html?mode=standard');

    const dialogs = [
      page.getByRole('dialog', { name: 'Dialog chuẩn', includeHidden: true }),
      page.getByRole('dialog', { name: 'Xác nhận không có nội dung bổ sung', includeHidden: true }),
      page.getByRole('dialog', { name: 'Xác nhận có nội dung bổ sung', includeHidden: true }),
    ];
    for (const dialog of dialogs) {
      await expect(dialog).toHaveCount(1);
      const measured = await expectSingleEffectiveGap(dialog);
      expect(measured.scrollHeight).toBeLessThanOrEqual(measured.clientHeight + 1);
    }

    const confirm = dialogs[1];
    const visibleActionGap = await confirm.evaluate((element) => {
      const children = [...element.children] as HTMLElement[];
      const action = element.querySelector<HTMLButtonElement>('button');
      return action!.getBoundingClientRect().top - children[0].getBoundingClientRect().bottom;
    });
    const expectedGap = (await contentGeometry(confirm)).expectedGap;
    expect(visibleActionGap).toBeCloseTo(expectedGap, 0);
  });
}

test('long dialog scrolls while focused footer action remains visible', async ({ page }) => {
  await page.setViewportSize({ width: 1366, height: 768 });
  await page.goto('/tests/fixtures/dialog-gap.html?mode=long');
  const dialog = page.getByRole('dialog', { name: 'Dialog nội dung dài' });
  const measured = await contentGeometry(dialog);
  expect(measured.display).toBe('flex');
  expect(measured.expectedGap).toBeGreaterThan(0);
  expect(measured.contained).toBe(true);
  expect(measured.documentOverflow).toBe(0);
  expect(measured.scrollHeight).toBeGreaterThan(measured.clientHeight);
  const action = page.getByRole('button', { name: 'Hoàn tất' });
  await action.focus();
  await expect(action).toBeFocused();
  const focusVisible = await action.evaluate((element) => {
    const rect = element.getBoundingClientRect();
    const dialogRect = element.closest<HTMLElement>('[role="dialog"]')!.getBoundingClientRect();
    return rect.top >= dialogRect.top && rect.bottom <= dialogRect.bottom;
  });
  expect(focusVisible).toBe(true);
});

test('managed fixed-height dialog keeps its dedicated body scroll owner', async ({ page }) => {
  await page.setViewportSize({ width: 1366, height: 768 });
  await page.goto('/tests/fixtures/dialog-gap.html?mode=managed');
  const dialog = page.getByRole('dialog', { name: 'Dialog tự quản bố cục' });
  const measured = await contentGeometry(dialog);
  expect(measured.display).toBe('flex');
  expect(measured.expectedGap).toBe(0);
  expect(measured.scrollHeight).toBeLessThanOrEqual(measured.clientHeight + 1);
  const body = dialog.locator('[data-region="managed-body"]');
  const bodyOverflow = await body.evaluate((element) => ({ clientHeight: element.clientHeight, scrollHeight: element.scrollHeight, overflowY: getComputedStyle(element).overflowY }));
  expect(bodyOverflow.overflowY).toBe('auto');
  expect(bodyOverflow.scrollHeight).toBeGreaterThan(bodyOverflow.clientHeight);
  expect(measured.documentOverflow).toBe(0);
});

test('nested dialog remains the top geometry and Escape owner', async ({ page }) => {
  await page.setViewportSize({ width: 1366, height: 768 });
  await page.goto('/tests/fixtures/dialog-gap.html?mode=nested');
  await page.getByRole('button', { name: 'Mở dialog con' }).click();
  const parent = page.getByRole('dialog', { name: 'Dialog cha', includeHidden: true });
  const child = page.getByRole('dialog', { name: 'Dialog con' });
  await expect(parent).toHaveAttribute('data-depth', '1');
  await expect(child).toHaveAttribute('data-depth', '2');
  await expectSingleEffectiveGap(child);
  await page.keyboard.press('Escape');
  await expect(child).toHaveCount(0);
  await expect(parent).toHaveCount(1);
});
