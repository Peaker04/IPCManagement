import { describe, expect, it } from 'vitest';

import { ROUTES } from '@/lib/routeConfig';
import { formatDataQualityCopy, formatLegacyDispositionStatus, formatLegacyLineType, formatReconciliationDisposition, formatWorkflowStatus, getWorkflowContextForPath, ownerToLaneId, routeByLaneId, toneFromStatus } from '@/lib/workflowConfig';

describe('workflowConfig', () => {
  it('maps Vietnamese operational status text to alert tones', () => {
    expect(toneFromStatus('Thiếu BOM')).toBe('danger');
    expect(toneFromStatus('Không đủ tồn kho')).toBe('danger');
    expect(toneFromStatus('Chưa đồng bộ dữ liệu')).toBe('neutral');
    expect(toneFromStatus('Đã gửi bếp')).toBe('neutral');
    expect(toneFromStatus('')).toBe('neutral');
  });

  it('uses readable concise labels for technical workflow statuses (Rule S1.2, S1.7)', () => {
    expect(formatWorkflowStatus('PENDING')).toBe('Chờ duyệt');
    expect(formatWorkflowStatus('SENTTOWAREHOUSE')).toBe('Đã xuất kho');
    expect(formatWorkflowStatus('ordered')).toBe('Đã đặt hàng');
    expect(formatWorkflowStatus('resolved')).toBe('Hoàn tất');
    expect(formatWorkflowStatus('reopened')).toBe('Đang mở');
    expect(formatWorkflowStatus('PARTIALLY_RECEIVED')).toBe('Nhận một phần');
    expect(formatWorkflowStatus('SUBMITTED')).toBe('Chờ duyệt');
    expect(formatWorkflowStatus('')).toBe('Chưa cập nhật');
    expect(formatWorkflowStatus('RAW_BACKEND_STATUS')).toBe('Chưa cập nhật');
  });

  it('keeps lineage reconciliation codes out of user-facing reports', () => {
    expect(formatReconciliationDisposition('LEGACY_LINEAGE_RECONCILIATION_REQUIRED')).toBe('Cần quyết định');
    expect(formatLegacyLineType('ISSUE_LINE')).toBe('Dòng xuất kho');
    expect(formatLegacyDispositionStatus('PENDING_MANAGER_REVIEW')).toBe('Chờ Quản lý duyệt');
  });

  it('replaces storage implementation vocabulary in data-quality copy', () => {
    expect(formatDataQualityCopy('Currentstock / Cá chua')).toBe('tồn kho hiện tại / Cá chua');
    expect(formatDataQualityCopy('Current stock 10 Kilogram không khớp ledger. Đối chiếu stock movements.'))
      .toBe('tồn kho hiện tại 10 kg không khớp sổ kho. Đối chiếu bút toán kho.');
    expect(formatDataQualityCopy('Chưa có contract hiệu lực; publish contract trước khi chốt BOM.'))
      .toBe('Chưa có hợp đồng hiệu lực; công bố hợp đồng trước khi chốt BOM.');
  });

  it('maps paths to canonical owners and titles', () => {
    expect(getWorkflowContextForPath(ROUTES.MEAL_ORDERS).lane.owner).toBe('Điều phối ca');
    expect(getWorkflowContextForPath(ROUTES.WEEKLY_MENU).lane.owner).toBe('Kế hoạch định lượng');
    expect(getWorkflowContextForPath(ROUTES.CHEF_DASHBOARD).lane.owner).toBe('Bếp trưởng ca');
    expect(getWorkflowContextForPath(ROUTES.WAREHOUSE).lane.owner).toBe('Kho nguyên liệu');
    expect(getWorkflowContextForPath(ROUTES.PURCHASING).lane.owner).toBe('Nhân sự thu mua');
    expect(getWorkflowContextForPath(ROUTES.APPROVALS).lane.owner).toBe('Quản lí vận hành');
    expect(getWorkflowContextForPath(ROUTES.ADMIN_DATA).lane.owner).toBe('Quản trị dữ liệu');
  });

  it('resolves lane id from owner variants', () => {
    expect(ownerToLaneId('Bếp trưởng')).toBe('kitchen');
    expect(ownerToLaneId('Thủ kho')).toBe('warehouse');
    expect(ownerToLaneId('Admin dữ liệu')).toBe('admin');
  });

  it('provides route lookup by lane id', () => {
    expect(routeByLaneId.coordination).toBe(ROUTES.MEAL_ORDERS);
    expect(routeByLaneId.kitchen).toBe(ROUTES.CHEF_DASHBOARD);
  });
});
