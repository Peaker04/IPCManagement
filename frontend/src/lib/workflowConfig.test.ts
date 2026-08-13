import { describe, expect, it } from 'vitest';

import { ROUTES } from '@/lib/routeConfig';
import { formatLegacyDispositionStatus, formatLegacyLineType, formatReconciliationDisposition, formatWorkflowStatus, getWorkflowContextForPath, ownerToLaneId, routeByLaneId, toneFromStatus } from '@/lib/workflowConfig';

describe('workflowConfig', () => {
  it('maps Vietnamese operational status text to alert tones', () => {
    expect(toneFromStatus('Thiếu BOM')).toBe('danger');
    expect(toneFromStatus('Không đủ tồn kho')).toBe('danger');
    expect(toneFromStatus('Chưa đồng bộ dữ liệu')).toBe('neutral');
    expect(toneFromStatus('Đã gửi bếp')).toBe('success');
    expect(toneFromStatus('')).toBe('neutral');
  });

  it('uses readable labels for technical workflow statuses', () => {
    expect(formatWorkflowStatus('PENDING')).toBe('Đang chờ xử lý');
    expect(formatWorkflowStatus('SENTTOWAREHOUSE')).toBe('Đã gửi kho');
    expect(formatWorkflowStatus('ordered')).toBe('Đã đặt hàng');
    expect(formatWorkflowStatus('resolved')).toBe('Đã xử lý');
    expect(formatWorkflowStatus('reopened')).toBe('Đã mở lại');
    expect(formatWorkflowStatus('PARTIALLY_RECEIVED')).toBe('Đã nhận một phần');
    expect(formatWorkflowStatus('SUBMITTED')).toBe('Chờ phê duyệt');
    expect(formatWorkflowStatus('')).toBe('Chưa cập nhật');
    expect(formatWorkflowStatus('RAW_BACKEND_STATUS')).toBe('Trạng thái chưa xác định');
  });

  it('keeps lineage reconciliation codes out of user-facing reports', () => {
    expect(formatReconciliationDisposition('LEGACY_LINEAGE_RECONCILIATION_REQUIRED')).toBe('Cần quyết định');
    expect(formatLegacyLineType('ISSUE_LINE')).toBe('Dòng xuất kho');
    expect(formatLegacyDispositionStatus('PENDING_MANAGER_REVIEW')).toBe('Chờ Quản lý duyệt');
  });

  it('routes known owners to workflow lanes and unknown owners to admin', () => {
    expect(ownerToLaneId('Kế hoạch định lượng')).toBe('planning');
    expect(ownerToLaneId('Thu mua')).toBe('purchasing');
    expect(ownerToLaneId('Bếp trưởng')).toBe('kitchen');
    expect(ownerToLaneId('Vai trò mới')).toBe('admin');
    expect(ownerToLaneId()).toBe('admin');
  });

  it('keeps route lookup aligned with workflow context', () => {
    expect(routeByLaneId.planning).toBe(ROUTES.WEEKLY_MENU);

    const context = getWorkflowContextForPath(ROUTES.WEEKLY_MENU);

    expect(context.lane.id).toBe('planning');
    expect(context.lane.nextAction).toBe('Đề xuất mua thêm');
  });
});
