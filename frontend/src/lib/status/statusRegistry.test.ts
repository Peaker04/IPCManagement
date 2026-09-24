import { describe, expect, it } from 'vitest';
import {
  resolveStatus,
  resolveActiveStatus,
  resolvePriceVarianceStatus,
} from './statusRegistry';

describe('statusRegistry', () => {
  it('resolves purchase statuses accurately with domain hint', () => {
    expect(resolveStatus('ORDERED', 'purchase')).toEqual({ label: 'Đã đặt hàng', tone: 'info' });
    expect(resolveStatus('PARTIALLY_RECEIVED', 'purchase')).toEqual({ label: 'Nhận một phần', tone: 'warning' });
    expect(resolveStatus('COMPLETED', 'purchase')).toEqual({ label: 'Hoàn tất', tone: 'success' });
    expect(resolveStatus('CANCELLED', 'purchase')).toEqual({ label: 'Đã hủy', tone: 'danger' });
  });

  it('resolves warehouse statuses accurately', () => {
    expect(resolveStatus('ISSUED', 'warehouse')).toEqual({ label: 'Đã xuất', tone: 'info' });
    expect(resolveStatus('CONFIRMED', 'warehouse')).toEqual({ label: 'Đã ký nhận', tone: 'success' });
    expect(resolveStatus('PENDING_RECEIPT', 'warehouse')).toEqual({ label: 'Chờ nhập', tone: 'warning' });
  });

  it('resolves reconciliation lifecycle and comparison statuses', () => {
    expect(resolveStatus('MATCHED', 'reconciliation')).toEqual({ label: 'Khớp', tone: 'success' });
    expect(resolveStatus('NEEDS_REVIEW', 'reconciliation')).toEqual({ label: 'Cần kiểm tra', tone: 'warning' });
    expect(resolveStatus('SHORTAGE', 'reconciliation')).toEqual({ label: 'Chưa xuất đủ', tone: 'danger' });
    expect(resolveStatus('DISPOSITIONED', 'reconciliation')).toEqual({ label: 'Đã xử lý', tone: 'info' });
  });

  it('resolves chef production statuses', () => {
    expect(resolveStatus('PLANNED', 'chef')).toEqual({ label: 'Kế hoạch', tone: 'neutral' });
    expect(resolveStatus('IN_SERVICE', 'chef')).toEqual({ label: 'Đang phục vụ', tone: 'info' });
    expect(resolveStatus('CLOSED', 'chef')).toEqual({ label: 'Hoàn tất', tone: 'success' });
    expect(resolveStatus('BLOCKED', 'chef')).toEqual({ label: 'Bị chặn', tone: 'danger' });
  });

  it('resolves boolean active/inactive status', () => {
    expect(resolveActiveStatus(true)).toEqual({ label: 'Đang hoạt động', tone: 'success' });
    expect(resolveActiveStatus(false)).toEqual({ label: 'Tạm ngưng', tone: 'neutral' });
    expect(resolveActiveStatus(true, 'Đang hiệu lực', 'Hết hiệu lực')).toEqual({ label: 'Đang hiệu lực', tone: 'success' });
    expect(resolveActiveStatus(false, 'Đang hiệu lực', 'Hết hiệu lực')).toEqual({ label: 'Hết hiệu lực', tone: 'neutral' });
  });

  it('resolves price variance warning correctly', () => {
    expect(resolvePriceVarianceStatus(true, 18)).toEqual({ label: 'Vượt ngưỡng', tone: 'danger' });
    expect(resolvePriceVarianceStatus(false, 5)).toEqual({ label: 'Theo dõi', tone: 'warning' });
    expect(resolvePriceVarianceStatus(false, 0)).toBeNull();
    expect(resolvePriceVarianceStatus(false, -2)).toBeNull();
  });

  it('handles unknown and empty statuses gracefully', () => {
    expect(resolveStatus(undefined)).toEqual({ label: 'Chưa xác định', tone: 'neutral' });
    expect(resolveStatus('')).toEqual({ label: 'Chưa xác định', tone: 'neutral' });
    expect(resolveStatus('Bị từ chối')).toEqual({ label: 'Bị từ chối', tone: 'danger' });
    expect(resolveStatus('Chờ duyệt')).toEqual({ label: 'Chờ duyệt', tone: 'warning' });
  });
});
