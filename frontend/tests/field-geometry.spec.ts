import { expect, test } from '@playwright/test';

const viewports = [
  { width: 1366, height: 768 },
  { width: 1440, height: 900 },
  { width: 1920, height: 1080 },
];

test('quotation seam oracle rejects the saved gap-2 and error-margin regression', async ({ page }) => {
  await page.setViewportSize({ width: 1366, height: 768 });
  await page.goto('/tests/fixtures/field-geometry.html');
  await page.locator('[data-quotation-ingredient-field]').evaluate((element) => {
    element.classList.remove('gap-1');
    element.classList.add('gap-2');
  });
  const controlTopDelta = await page.evaluate(() => Math.abs(
    document.querySelector<HTMLElement>('#quotation-ingredient-search')!.getBoundingClientRect().top
      - document.querySelector<HTMLElement>('#quotation-ingredient')!.getBoundingClientRect().top,
  ));
  expect(controlTopDelta).toBeGreaterThan(1);
  await page.getByRole('button', { name: 'Đổi trạng thái lỗi' }).click();
  await page.locator('#quotation-ingredient-error').evaluate((element) => element.classList.add('mt-1'));
  const errorGap = await page.evaluate(() => {
    const control = document.querySelector<HTMLElement>('#quotation-ingredient')!;
    const error = document.querySelector<HTMLElement>('#quotation-ingredient-error')!;
    return error.getBoundingClientRect().top - control.getBoundingClientRect().bottom;
  });
  expect(errorGap).toBeGreaterThan(4);
});

for (const viewport of viewports) {
  test(`field anatomy and paired alignment at ${viewport.width}x${viewport.height}`, async ({ page }) => {
    await page.setViewportSize(viewport);
    await page.goto('/tests/fixtures/field-geometry.html');

    const anatomy = await page.evaluate(() => {
      const token = Number.parseFloat(getComputedStyle(document.documentElement).getPropertyValue('--ipc-space-1'));
      const search = document.querySelector<HTMLElement>('#search-description')!.closest<HTMLElement>('.ipc-search-field')!;
      const searchChildren = [...search.children] as HTMLElement[];
      const searchControl = search.querySelector<HTMLElement>('.ipc-search-field__control')!;
      const searchDescription = search.querySelector<HTMLElement>('.ipc-search-field__description')!;
      const field = document.querySelector<HTMLElement>('#quantity')!.closest<HTMLElement>('.ipc-field-row')!;
      const input = document.querySelector<HTMLElement>('#quantity')!;
      const description = [...field.querySelectorAll<HTMLElement>('p')].find((item) => item.textContent?.includes('Nhập số lượng'))!;
      return {
        token,
        searchOrder: searchChildren.map((child) => child.className),
        searchControlToDescription: searchDescription.getBoundingClientRect().top - searchControl.getBoundingClientRect().bottom,
        fieldControlToDescription: description.getBoundingClientRect().top - input.getBoundingClientRect().bottom,
      };
    });
    expect(anatomy.searchOrder).toEqual(['ipc-search-field__label', 'ipc-search-field__control', 'ipc-search-field__description']);
    expect(anatomy.searchControlToDescription).toBeCloseTo(anatomy.token, 0);
    expect(anatomy.fieldControlToDescription).toBeCloseTo(anatomy.token, 0);

    const paired = await page.evaluate(() => {
      const searchLabel = document.querySelector<HTMLElement>('#quotation-ingredient-search')!.closest('.ipc-search-field')!.querySelector<HTMLElement>('.ipc-search-field__label')!;
      const searchControl = document.querySelector<HTMLElement>('#quotation-ingredient-search')!;
      const manual = document.querySelector<HTMLElement>('[data-quotation-ingredient-field]')!;
      const manualLabel = manual.querySelector<HTMLElement>('label')!;
      const manualControl = document.querySelector<HTMLElement>('#quotation-ingredient')!;
      const icon = document.querySelector<HTMLElement>('#quotation-ingredient-search')!.closest('.ipc-search-field__control')!.querySelector<HTMLElement>('svg')!;
      const iconRect = icon.getBoundingClientRect();
      const controlRect = searchControl.getBoundingClientRect();
      return {
        labelBaselineDelta: Math.abs(searchLabel.getBoundingClientRect().bottom - manualLabel.getBoundingClientRect().bottom),
        controlTopDelta: Math.abs(controlRect.top - manualControl.getBoundingClientRect().top),
        controlBottomDelta: Math.abs(controlRect.bottom - manualControl.getBoundingClientRect().bottom),
        iconContained: iconRect.left >= controlRect.left && iconRect.right <= controlRect.right && iconRect.top >= controlRect.top && iconRect.bottom <= controlRect.bottom,
        iconCenterDelta: Math.abs((iconRect.top + iconRect.bottom) / 2 - (controlRect.top + controlRect.bottom) / 2),
        documentOverflow: Math.max(0, document.documentElement.scrollWidth - innerWidth),
      };
    });
    expect(paired.labelBaselineDelta).toBeLessThanOrEqual(1);
    expect(paired.controlTopDelta).toBeLessThanOrEqual(1);
    expect(paired.controlBottomDelta).toBeLessThanOrEqual(1);
    expect(paired.iconContained).toBe(true);
    expect(paired.iconCenterDelta).toBeLessThanOrEqual(1);
    expect(paired.documentOverflow).toBe(0);

    await page.getByRole('button', { name: 'Đổi trạng thái lỗi' }).click();
    const validation = await page.evaluate(() => {
      const input = document.querySelector<HTMLElement>('#quantity')!;
      const error = document.querySelector<HTMLElement>('#quantity-error')!;
      const select = document.querySelector<HTMLElement>('#quotation-ingredient')!;
      const selectError = document.querySelector<HTMLElement>('#quotation-ingredient-error')!;
      return {
        inputErrorGap: error.getBoundingClientRect().top - (error.previousElementSibling as HTMLElement).getBoundingClientRect().bottom,
        selectErrorGap: selectError.getBoundingClientRect().top - select.getBoundingClientRect().bottom,
        inputDescriptionIds: input.getAttribute('aria-describedby'),
        selectDescriptionIds: select.getAttribute('aria-describedby'),
        overlaps: error.getBoundingClientRect().top < input.getBoundingClientRect().bottom || selectError.getBoundingClientRect().top < select.getBoundingClientRect().bottom,
      };
    });
    expect(validation.inputErrorGap).toBeCloseTo(anatomy.token, 0);
    expect(validation.selectErrorGap).toBeCloseTo(anatomy.token, 0);
    expect(validation.inputDescriptionIds).toBe('quantity-error');
    expect(validation.selectDescriptionIds).toBe('quotation-ingredient-error');
    expect(validation.overlaps).toBe(false);

    const wrapped = await page.evaluate(() => {
      const section = document.querySelector<HTMLElement>('section[aria-label="Nhãn dài"]')!;
      const fields = [...section.querySelectorAll<HTMLElement>('[data-wrapped-row] > .ipc-field-row')];
      const first = fields[0];
      const second = fields[1];
      const label = first.querySelector<HTMLElement>('label')!;
      const control = first.querySelector<HTMLElement>('input')!;
      const guidance = first.querySelector<HTMLElement>('p')!;
      const nextRow = document.querySelector<HTMLElement>('#next-row')!.closest<HTMLElement>('.ipc-field-row')!;
      const inside = (child: DOMRect, owner: DOMRect) => child.left >= owner.left && child.right <= owner.right && child.top >= owner.top && child.bottom <= owner.bottom;
      return {
        labelWrapped: label.getBoundingClientRect().height > Number.parseFloat(getComputedStyle(label).lineHeight),
        labelInside: inside(label.getBoundingClientRect(), first.getBoundingClientRect()),
        controlInside: inside(control.getBoundingClientRect(), first.getBoundingClientRect()),
        guidanceInside: inside(guidance.getBoundingClientRect(), first.getBoundingClientRect()),
        guidanceGap: guidance.getBoundingClientRect().top - control.getBoundingClientRect().bottom,
        fieldsOverlap: first.getBoundingClientRect().right > second.getBoundingClientRect().left,
        nextRowAfterTallest: nextRow.getBoundingClientRect().top >= Math.max(first.getBoundingClientRect().bottom, second.getBoundingClientRect().bottom),
      };
    });
    expect(wrapped.labelWrapped).toBe(true);
    expect(wrapped.labelInside).toBe(true);
    expect(wrapped.controlInside).toBe(true);
    expect(wrapped.guidanceInside).toBe(true);
    expect(wrapped.guidanceGap).toBeCloseTo(anatomy.token, 0);
    expect(wrapped.fieldsOverlap).toBe(false);
    expect(wrapped.nextRowAfterTallest).toBe(true);

    const toolbar = page.getByRole('searchbox', { name: 'Tìm dòng nguyên liệu' });
    await expect(toolbar).toBeVisible();
    const hiddenLabel = toolbar.locator('xpath=..').locator('xpath=..').locator('span').first();
    await expect(hiddenLabel).toHaveClass(/sr-only/);
    await expect(toolbar).toHaveCSS('height', '36px');
  });
}
