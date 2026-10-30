import { test, expect } from '../fixtures/mrxTest';
import path from 'node:path';

const TEMPLATE_FILE = path.resolve('backend/tests/IPCManagement.Api.Tests/Fixtures/weekly-menu-template-ANV-canonical-25k.xlsx');

test.describe('@G1-Golden MRX Golden Path Lifecycle (Horizontal & Vertical)', () => {
  test('Chuỗi Golden Path liên hoàn: Lập lô -> Đóng băng -> Bàn giao -> Kho xuất -> Bếp nhận -> Đối soát khóa sổ', async ({
    dieuphoiPage,
    thukhoPage,
    beptruongPage,
    adminPage,
    dbVerifier,
  }) => {
    // =========================================================================
    // CHẶNG 1: Điều phối viên lập thực đơn, xuất bản và tạo lô đối soát
    // =========================================================================
    console.log('[G1-GOLDEN] Chặng 1: Điều phối viên lập thực đơn...');
    await dieuphoiPage.goto('/weekly-menu?view=mrx-batch&weekStartDate=2026-07-20');
    await dieuphoiPage.waitForSelector('header', { timeout: 15000 });

    // Mở modal Nhập thực đơn Excel
    const importBtn = dieuphoiPage.getByRole('button', { name: 'Nhập thực đơn Excel', exact: true }).first();
    await importBtn.click();
    await dieuphoiPage.waitForSelector('div[role="dialog"]', { timeout: 10000 });

    const custSelect = dieuphoiPage.locator('select#import-customer-select');
    await custSelect.selectOption({ label: 'ANV - AMANN' });

    const weekInp = dieuphoiPage.locator('input[aria-label="Tuần bắt đầu nhập"]');
    await weekInp.fill('20/07/2026');
    await weekInp.press('Enter');

    // Nạp file Excel 25k chuẩn
    await dieuphoiPage.setInputFiles('input[type="file"]', TEMPLATE_FILE);
    const tier25k = dieuphoiPage.locator('button[role="radio"]:has-text("25.000")');
    if (await tier25k.isVisible()) {
      await tier25k.click();
    }

    await dieuphoiPage.click('button:has-text("Xem trước")');
    await dieuphoiPage.waitForSelector('text=Kết quả phân tích file', { timeout: 15000 });
    await dieuphoiPage.click('button:has-text("Xác nhận nhập")');
    await dieuphoiPage.waitForSelector('div[role="dialog"]', { state: 'detached', timeout: 20000 });

    // Xuất bản thực đơn tuần nếu ở trạng thái DRAFT
    await dieuphoiPage.waitForTimeout(1000);
    const publishBtn = dieuphoiPage.locator('header button:has-text("Xuất bản thực đơn tuần")');
    if (await publishBtn.isVisible()) {
      await publishBtn.click();
      await dieuphoiPage.waitForTimeout(2000);
    }

    // Kiểm tra định lượng
    const checkBtn = dieuphoiPage.locator('header button:has-text("Kiểm tra định lượng")');
    if (await checkBtn.isVisible()) {
      await checkBtn.click();
      await dieuphoiPage.waitForTimeout(1500);
    }

    // Tạo lô nháp
    const createDraftBtn = dieuphoiPage.locator('header button:has-text("Tạo lô nháp")');
    if (await createDraftBtn.isVisible()) {
      await createDraftBtn.click();
      await dieuphoiPage.waitForTimeout(1500);
    }

    // Đóng băng lô
    const freezeBtn = dieuphoiPage.locator('header button:has-text("Đóng băng lô")');
    if (await freezeBtn.isVisible()) {
      await freezeBtn.click();
      await dieuphoiPage.waitForTimeout(1500);
    }

    // Bàn giao sang Kho
    const transferBtn = dieuphoiPage.locator('header button:has-text("Chuyển sang Kho")');
    if (await transferBtn.isVisible()) {
      await transferBtn.click();
      await dieuphoiPage.waitForTimeout(1500);
    }

    // Lấy batchId vừa được bàn giao
    const createdBatchId = await dieuphoiPage.evaluate(async () => {
      const token = localStorage.getItem('ipc_v3_token');
      const res = await fetch('/api/reconciliation/batches?pageSize=5', {
        headers: { Authorization: `Bearer ${token}` },
      });
      const data = await res.json();
      return data.data?.items?.[0]?.batchId || '';
    });

    console.log(`[G1-GOLDEN] Created Batch ID: ${createdBatchId}`);
    expect(createdBatchId).toBeTruthy();

    // =========================================================================
    // CHẶNG 2: Thủ kho xuất kho định lượng
    // =========================================================================
    console.log('[G1-GOLDEN] Chặng 2: Thủ kho xuất kho định lượng...');
    await thukhoPage.goto(`/warehouse?view=mrx-daily&batchId=${createdBatchId}&date=2026-07-20`);
    await thukhoPage.waitForSelector('header', { timeout: 15000 });

    const fillAllBtn = thukhoPage.locator('header button:has-text("Điền đủ toàn bộ")');
    if (await fillAllBtn.isVisible()) {
      await fillAllBtn.click();
      const submitBtn = thukhoPage.locator('header button:has-text("Xác nhận xuất kho")');
      await submitBtn.click();
      await thukhoPage.waitForTimeout(1000);
    }

    // =========================================================================
    // CHẶNG 3: Bếp trưởng kiểm tra phiếu nấu
    // =========================================================================
    console.log('[G1-GOLDEN] Chặng 3: Bếp trưởng kiểm tra phiếu nấu...');
    await beptruongPage.goto(`/chef?view=mrx-cooking&batchId=${createdBatchId}`);
    await beptruongPage.waitForSelector('header', { timeout: 15000 });
    await expect(beptruongPage.getByRole('heading', { name: 'Phiếu nấu theo lô' })).toBeVisible();

    // =========================================================================
    // CHẶNG 4: Quản lý đối soát và kiểm tra bảng điều khiển
    // =========================================================================
    console.log('[G1-GOLDEN] Chặng 4: Quản lý đối soát...');
    await adminPage.goto(`/reconciliation?batchId=${createdBatchId}`);
    await adminPage.waitForSelector('header', { timeout: 15000 });
    await expect(adminPage.getByRole('heading', { name: 'Đối soát nguyên liệu' })).toBeVisible();

    // =========================================================================
    // CHẶNG 5: Vertical SQL Invariant Assertion trên Database Sandbox
    // =========================================================================
    console.log('[G1-GOLDEN] Chặng 5: Vertical SQL Assertion...');
    const rows = dbVerifier.query<{ Status: string; Version: string }>(
      `SELECT Status, Version FROM reconciliationbatches ORDER BY CreatedAt DESC LIMIT 1;`
    );

    expect(rows.length).toBe(1);
    expect(['TRANSFERRED', 'IN_PROGRESS', 'READY', 'COMPLETED']).toContain(rows[0].Status);
    console.log(`[G1-GOLDEN] Verified Batch Status in DB: ${rows[0].Status}, Version: ${rows[0].Version}`);
  });
});
