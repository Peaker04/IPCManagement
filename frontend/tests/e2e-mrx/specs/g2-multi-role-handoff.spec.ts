import { test, expect } from '../fixtures/mrxTest';

test.describe('@G2-RBAC Multi-Role Handoff & Security Boundaries', () => {
  test('Bếp trưởng bị chặn không thể truy cập trạm Kho (RoleGuard redirect to /forbidden)', async ({ beptruongPage }) => {
    await beptruongPage.goto('/warehouse?view=mrx-daily');
    await beptruongPage.waitForTimeout(1500);

    // Bếp trưởng không có quyền Kho -> RoleGuard lập tức đá về /forbidden
    expect(beptruongPage.url()).toContain('/forbidden');
    await expect(beptruongPage.getByRole('heading', { name: /Truy cập bị từ chối/i })).toBeVisible();

    // Nhưng Bếp trưởng truy cập đúng trạm Bếp /chef thì hợp lệ
    await beptruongPage.goto('/chef?view=mrx-cooking');
    await beptruongPage.waitForSelector('header', { timeout: 15000 });
    expect(beptruongPage.url()).toContain('/chef?view=mrx-cooking');
  });

  test('Thủ kho bị chặn không thể truy cập trạm Thực đơn MRX (RoleGuard redirect to /forbidden)', async ({ thukhoPage }) => {
    await thukhoPage.goto('/weekly-menu?view=mrx-batch');
    await thukhoPage.waitForTimeout(1500);

    // Thủ kho không có quyền Thực đơn -> RoleGuard đá về /forbidden
    expect(thukhoPage.url()).toContain('/forbidden');
    await expect(thukhoPage.getByRole('heading', { name: /Truy cập bị từ chối/i })).toBeVisible();

    // Nhưng Thủ kho truy cập đúng trạm Kho /warehouse thì hợp lệ
    await thukhoPage.goto('/warehouse?view=mrx-daily');
    await thukhoPage.waitForSelector('header', { timeout: 15000 });
    expect(thukhoPage.url()).toContain('/warehouse?view=mrx-daily');
  });

  test('Điều phối viên bị chặn không thể truy cập trạm Đối soát (RoleGuard redirect to /forbidden)', async ({ dieuphoiPage }) => {
    await dieuphoiPage.goto('/reconciliation');
    await dieuphoiPage.waitForTimeout(1500);

    // Điều phối viên không có quyền Quản lý/Đối soát -> RoleGuard đá về /forbidden
    expect(dieuphoiPage.url()).toContain('/forbidden');
    await expect(dieuphoiPage.getByRole('heading', { name: /Truy cập bị từ chối/i })).toBeVisible();

    // Nhưng Điều phối viên truy cập đúng trạm Điều phối lô thì hợp lệ
    await dieuphoiPage.goto('/weekly-menu?view=mrx-batch');
    await dieuphoiPage.waitForSelector('header', { timeout: 15000 });
    expect(dieuphoiPage.url()).toContain('/weekly-menu?view=mrx-batch');
  });

  test('Quản trị viên / Quản lý có toàn quyền thẩm định trên mọi trạm', async ({ adminPage }) => {
    await adminPage.goto('/reconciliation');
    await adminPage.waitForSelector('header', { timeout: 15000 });
    await expect(adminPage.getByRole('heading', { name: 'Đối soát nguyên liệu' })).toBeVisible();

    await adminPage.goto('/weekly-menu?view=mrx-batch');
    await adminPage.waitForSelector('header', { timeout: 15000 });
    await expect(adminPage.getByRole('heading', { name: 'Chuẩn bị lô đối soát' })).toBeVisible();

    await adminPage.goto('/warehouse?view=mrx-daily');
    await adminPage.waitForSelector('header', { timeout: 15000 });
    await expect(adminPage.getByRole('heading', { name: 'Xuất kho nguyên liệu theo ngày' })).toBeVisible();
  });
});
