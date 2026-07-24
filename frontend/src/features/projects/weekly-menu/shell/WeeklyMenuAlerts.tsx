import { InlineAlert } from '@/components/common';
import type { WeeklyScheduleFeedback } from '../schedule/types';

interface WeeklyMenuAlertsProps {
  invalidBomTierCount: number;
  menuFeedback: WeeklyScheduleFeedback | null;
  purchaseFeedback: WeeklyScheduleFeedback | null;
  isCatalogLoading: boolean;
  isCatalogError: boolean;
  isCatalogEmpty: boolean;
  isCommittedMenuFetching: boolean;
  hasSelectedCustomer: boolean;
}

export function WeeklyMenuAlerts({
  invalidBomTierCount,
  menuFeedback,
  purchaseFeedback,
  isCatalogLoading,
  isCatalogError,
  isCatalogEmpty,
  isCommittedMenuFetching,
  hasSelectedCustomer,
}: WeeklyMenuAlertsProps) {
  return (
    <>
      {invalidBomTierCount > 0 && (
        <InlineAlert title="Đơn giá chưa khớp mức định lượng" variant="danger">
          Có {invalidBomTierCount} lịch/ca không thuộc mức 25k, 30k hoặc 34k. Hệ thống sẽ chặn tính nhu cầu nguyên liệu để tránh dùng sai định lượng.
        </InlineAlert>
      )}
      {menuFeedback && (
        <InlineAlert title={menuFeedback.title} variant={menuFeedback.variant}>
          {menuFeedback.message}
        </InlineAlert>
      )}
      {purchaseFeedback && (
        <InlineAlert title={purchaseFeedback.title} variant={purchaseFeedback.variant}>
          {purchaseFeedback.message}
        </InlineAlert>
      )}
      {(isCatalogLoading || (isCommittedMenuFetching && hasSelectedCustomer)) && (
        <span className="sr-only" role="status">
          Đang đồng bộ danh mục món, thực đơn khách hàng và định lượng BOM.
        </span>
      )}
      {isCatalogError && (
        <InlineAlert title="Chưa tải được danh mục món ăn" variant="warning">
          Kiểm tra kết nối hệ thống hoặc quyền xem danh mục trước khi phân tích giá vốn.
        </InlineAlert>
      )}
      {isCatalogEmpty && (
        <InlineAlert title="Danh mục món ăn đang trống" variant="warning">
          Chưa có món ăn nào đang hoạt động, nên thực đơn tuần và bảng định lượng chưa thể chọn món.
        </InlineAlert>
      )}
    </>
  );
}
