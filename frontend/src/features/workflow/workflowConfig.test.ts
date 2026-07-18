import { describe, expect, it } from 'vitest';

import { ROUTES } from '@/routes/routeConfig';
import { formatWorkflowStatus, getWorkflowContextForPath, ownerToLaneId, routeByLaneId, toneFromStatus } from './workflowConfig';

describe('workflowConfig', () => {
  it('maps Vietnamese operational status text to alert tones', () => {
    expect(toneFromStatus('Thiếu BOM')).toBe('danger');
    expect(toneFromStatus('Không đủ tồn kho')).toBe('danger');
    expect(toneFromStatus('Chờ dữ liệu backend')).toBe('warning');
    expect(toneFromStatus('Đã gửi bếp')).toBe('success');
    expect(toneFromStatus('')).toBe('neutral');
  });

  it('uses readable labels for technical workflow statuses', () => {
    expect(formatWorkflowStatus('PENDING')).toBe('Đang chờ xử lý');
    expect(formatWorkflowStatus('SENTTOWAREHOUSE')).toBe('Đã gửi kho');
    expect(formatWorkflowStatus('ordered')).toBe('Đã đặt hàng');
    expect(formatWorkflowStatus('resolved')).toBe('Đã xử lý');
    expect(formatWorkflowStatus('reopened')).toBe('Đã mở lại');
    expect(formatWorkflowStatus('')).toBe('Chưa cập nhật');
    expect(formatWorkflowStatus('Trạng thái riêng')).toBe('Trạng thái riêng');
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
