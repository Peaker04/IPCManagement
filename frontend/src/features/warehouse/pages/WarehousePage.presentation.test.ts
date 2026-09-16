import { describe, expect, it } from 'vitest';
import warehousePageSource from './WarehousePage.tsx?raw';
import warehousePurchaseOrdersPanelSource from './WarehousePurchaseOrdersPanel.tsx?raw';
import { formatIssueCandidateLabel } from '../warehouseIssueAllocation';

describe('WarehousePage presentation', () => {
  it('describes an issue candidate in user language before its document code', () => {
    expect(
      formatIssueCandidateLabel({
        requestDate: '2026-08-10',
        requestScope: 'MORNING',
        actionableLineCount: 48,
        materialRequestCode: 'MR-20260810-ANV',
        customerName: 'An Vui',
        customerCode: 'ANV',
      }),
    ).toBe('An Vui (ANV) · Ngày 10/08/2026 · Ca sáng · 48 nhóm nguyên liệu · Chứng từ MR-20260810-ANV');
  });

  it('keeps issue date/shift context through creation and preserves retry state on failure', () => {
    expect(warehousePageSource).toContain('shiftName: issueShiftName(selectedIssueCandidate.requestScope)');
    expect(warehousePageSource.match(/materialRequestId: selectedIssueCandidate\.materialRequestId/g)).toHaveLength(4);
    expect(warehousePageSource).toContain('if (!issueCommandId) setIssueCommandId');
    expect(warehousePageSource).not.toContain("selectWarehouseView('exceptions');");
  });

  it('derives the Warehouse inbox from the existing documents query without the four-query dashboard overview', () => {
    expect(warehousePageSource).not.toContain('useWorkflowOverview');
    expect(warehousePageSource).toContain('buildRoleInbox(workflowDocuments, [], [])');
    expect(warehousePageSource).toContain("activeView === 'demand' ? 100 : 20");
    expect(warehousePageSource).toContain("{ skip: activeView === 'exceptions' }");
    expect(warehousePageSource).toContain("roleInboxItems.filter((item) => item.laneId === 'warehouse')");
    expect(warehousePageSource).toContain('isWorkflowDocumentError');
    expect(warehousePageSource).toContain('refetchWorkflowDocuments');
  });

  it('does not mount a false-empty purchase-order table behind its load error', () => {
    expect(warehousePageSource).toContain('{isReceivingView && !isPurchaseOrderError && <WarehousePurchaseOrdersPanel');
  });

  it('lets long purchase-order identifiers size their column instead of overflowing fixed cells', () => {
    expect(warehousePurchaseOrdersPanelSource).toContain('ipc-data-table min-w-[1060px] !table-auto');
    expect(warehousePurchaseOrdersPanelSource).not.toContain('ipc-data-table min-w-[1060px] table-fixed');
  });
});
