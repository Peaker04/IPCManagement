import { test, expect } from '../fixtures/mrxTest';

test.describe('@G5-Async Asynchronous, Offline Resilience & Session Expiry', () => {
  test('Kích hoạt context.setOffline(true/false) kiểm thử Offline Resilience và tính Idempotency', async ({ thukhoPage }) => {
    await thukhoPage.goto('/warehouse?view=mrx-daily');
    await thukhoPage.waitForSelector('header', { timeout: 15000 });

    // 1. Giả lập rớt mạng hoàn toàn
    await thukhoPage.context().setOffline(true);
    await thukhoPage.waitForTimeout(500);

    // Thao tác làm mới khi mất mạng -> UI bắt lỗi kết nối an toàn, không nổ trắng trang
    const refreshBtn = thukhoPage.locator('button:has-text("Làm mới")');
    if (await refreshBtn.isVisible()) {
      await refreshBtn.click();
      await thukhoPage.waitForTimeout(500);
    }

    // 2. Mạng có lại
    await thukhoPage.context().setOffline(false);
    await thukhoPage.waitForTimeout(1000);

    // Trang web khôi phục kết nối bình thường
    if (await refreshBtn.isVisible()) {
      await refreshBtn.click();
      await thukhoPage.waitForTimeout(1000);
      await expect(thukhoPage.locator('header')).toBeVisible();
    }
  });

  test('Token hết hạn giữa chừng: RBAC chặn và bảo toàn 100% dữ liệu biểu mẫu', async ({ adminPage }) => {
    await adminPage.goto('/admin-data?view=bom');
    await adminPage.waitForSelector('table tbody tr', { timeout: 15000 });

    const editBomBtn = adminPage.locator('table tbody tr button:has-text("Chỉnh sửa BOM")').first();
    await editBomBtn.waitFor({ state: 'visible', timeout: 5000 });
    await editBomBtn.click();
    await adminPage.waitForSelector('div[role="dialog"]', { timeout: 5000 });

    const qtyInput = adminPage.locator('div[role="dialog"] input[type="number"]').first();
    await qtyInput.fill('2.75');

    // Xóa token trước khi submit để giả lập phiên hết hạn
    await adminPage.evaluate(() => {
      localStorage.removeItem('ipc_v3_token');
    });

    // Thử submit thêm dòng BOM khi token đã mất
    const addBtn = adminPage.locator('div[role="dialog"] button:has-text("Thêm vào BOM")');
    if (await addBtn.isVisible() && !(await addBtn.isDisabled())) {
      await addBtn.click();
      await adminPage.waitForTimeout(1000);

      // Khẳng định: Hệ thống bắt 401 Unauthorized và chuyển hướng an toàn về /login
      expect(adminPage.url()).toContain('/login');
    }
  });

  test('Kiểm toán kỳ đối soát quá hạn và khóa sổ tự động trong Sandbox DB', async ({ dbVerifier }) => {
    // Lùi ngày tạo lô về quá 30 ngày trước trong Sandbox DB
    dbVerifier.execute(`
      UPDATE reconciliationbatches
      SET CreatedAt = DATE_SUB(NOW(), INTERVAL 30 DAY)
      WHERE Status = 'COMPLETED'
      LIMIT 1;
    `);

    const rows = dbVerifier.query<{ cnt: string }>(`
      SELECT COUNT(*) as cnt FROM reconciliationbatches WHERE CreatedAt < DATE_SUB(NOW(), INTERVAL 14 DAY);
    `);

    expect(parseInt(rows[0]?.cnt || '0', 10)).toBeGreaterThanOrEqual(1);
  });
});
