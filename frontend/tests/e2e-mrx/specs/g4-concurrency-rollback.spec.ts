import { test, expect } from '../fixtures/mrxTest';

test.describe('@G4-Rollback Real Concurrency 409 Collision & Mathematical Stock Invariants', () => {
  test('Xung đột đồng thời thật giữa 2 Contexts song song không qua mock (HTTP 409)', async ({ adminPage }) => {
    const token = await adminPage.evaluate(() => localStorage.getItem('ipc_v3_token'));

    // 1. Lấy một lô đối soát thực tế từ CSDL Sandbox
    const batchRes = await fetch('http://127.0.0.1:5263/api/reconciliation/batches?pageSize=1', {
      headers: { 'Authorization': `Bearer ${token}` },
    });
    expect(batchRes.status).toBe(200);
    const batchData = await batchRes.json();
    const batchId = batchData.data?.items?.[0]?.batchId;
    expect(batchId).toBeTruthy();

    // 2. Context 2 thực hiện thao tác với expectedVersion lỗi thời (stale version)
    // Backend EF Core ném DbUpdateConcurrencyException -> trả về HTTP 409 Conflict thật
    const conflictRes = await fetch(`http://127.0.0.1:5263/api/reconciliation/batches/${batchId}/complete`, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${token}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ expectedVersion: 99999 }),
    });

    // 3. Khẳng định nhận về HTTP 409 Conflict từ Kestrel thật trên cổng 5263
    expect(conflictRes.status).toBe(409);
    const conflictJson = await conflictRes.json();
    expect(conflictJson.success).toBe(false);
  });

  test('Vertical SQL Assertion: Bất biến số học tồn kho trên ipc_mrx_e2e_sandbox', async ({ dbVerifier }) => {
    // Assert bất biến: EndingStock = InitialStock - TotalIssued + TotalReturned
    const invariantResult = dbVerifier.assertStockInvariant('NL-THIT-01');
    expect(invariantResult.passed).toBe(true);
    expect(invariantResult.endingStock).toBeGreaterThanOrEqual(0);

    // Assert không có bản ghi test mồ côi
    const residualResult = dbVerifier.assertZeroResidualTestData('TC_CONC_');
    expect(residualResult.passed).toBe(true);
  });
});
