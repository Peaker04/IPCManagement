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
        <InlineAlert title="Đơn giá chưa khớp tier BOM" variant="danger">
          Có {invalidBomTierCount} lịch/ca không thuộc 25k, 30k hoặc 34k. Hệ thống sẽ chặn sinh demand để tránh dùng sai định lượng.
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
      {isCatalogLoading && (
        <InlineAlert title="Đang tải catalog món ăn" variant="info">
          Hệ thống đang lấy danh sách món và định lượng BOM từ API.
        </InlineAlert>
      )}
      {isCatalogError && (
        <InlineAlert title="Chưa tải được catalog món ăn" variant="warning">
          Kiểm tra backend hoặc quyền truy cập catalog trước khi phân tích giá vốn.
        </InlineAlert>
      )}
      {isCommittedMenuFetching && hasSelectedCustomer && (
        <InlineAlert title="Đang tải thực đơn khách hàng" variant="info">
          Hệ thống đang lấy menu, KHSX và giá vốn theo khách hàng đang chọn.
        </InlineAlert>
      )}
      {isCatalogEmpty && (
        <InlineAlert title="Catalog món ăn đang trống" variant="warning">
          Chưa có món ăn hoạt động nào từ API, nên thực đơn tuần và bảng định lượng chưa thể chọn món.
        </InlineAlert>
      )}
    </>
  );
}
