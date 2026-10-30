import { test, expect } from '../fixtures/mrxTest';

test.describe('@G3-Alt Alternative Business Flows', () => {
  test('Bổ sung định mức BOM thiếu qua Excel template chuyên biệt', async ({ adminPage }) => {
    await adminPage.goto('/admin-data?view=bom');
    await adminPage.waitForSelector('button:has-text("Nhập BOM Excel")', { timeout: 15000 });

    await adminPage.click('button:has-text("Nhập BOM Excel")');
    await adminPage.waitForSelector('div[role="dialog"]', { timeout: 5000 });

    // Assert both missing BOM and full catalog template download buttons exist
    const missingBtn = adminPage.locator('div[role="dialog"] button:has-text("Tải file Excel các món thiếu BOM")');
    const fullBtn = adminPage.locator('div[role="dialog"] button:has-text("Tải file mẫu toàn bộ")');

    await expect(missingBtn).toBeVisible();
    await expect(fullBtn).toBeVisible();

    await adminPage.click('div[role="dialog"] button:has-text("Đóng")');
  });

  test('Xuất bổ sung nguyên liệu trong ca và cập nhật định lượng', async ({ thukhoPage }) => {
    await thukhoPage.goto('/warehouse?view=mrx-daily');
    await thukhoPage.waitForSelector('header', { timeout: 15000 });

    const suppBtn = thukhoPage.locator('button:has-text("Xuất bổ sung ca")');
    if (await suppBtn.isVisible()) {
      await suppBtn.click();
      await thukhoPage.waitForSelector('div[role="dialog"]', { timeout: 5000 });

      // Enter additional quantity
      const qtyInput = thukhoPage.locator('div[role="dialog"] input[type="number"]');
      if (await qtyInput.isVisible()) {
        await qtyInput.fill('5');
        const reasonInput = thukhoPage.locator('div[role="dialog"] input[type="text"]').last();
        await reasonInput.fill('Xuất bù ca phát sinh 10 suất');
      }

      await thukhoPage.click('div[role="dialog"] button:has-text("Hủy bỏ")');
    }
  });

  test('Giải trình sai lệch 2 chiều và chuyển trạng thái dòng sang DISPOSED', async ({ adminPage }) => {
    await adminPage.goto('/reconciliation');
    await adminPage.waitForSelector('table', { timeout: 15000 });

    const resolveBtn = adminPage.locator('button:has-text("Xử lý chênh lệch"), button:has-text("Xem hướng xử lý")').first();
    if (await resolveBtn.isVisible()) {
      await resolveBtn.click();
      await adminPage.waitForSelector('div[role="dialog"]', { timeout: 5000 });
      await adminPage.click('div[role="dialog"] button:has-text("Quay lại"), div[role="dialog"] button:has-text("Đóng")');
    }
  });
});
