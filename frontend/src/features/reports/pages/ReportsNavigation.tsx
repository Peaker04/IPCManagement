import { QueryErrorAlert, ViewSwitcher } from '@/components/common';
import type { ReportView, ReportsPageModel } from './useReportsPageModel';

type ReportsNavigationProps = {
  model: ReportsPageModel;
};

export function ReportsNavigation({ model }: ReportsNavigationProps) {
  const {
    activeReportState,
    activeView,
    isViewPending,
    priceSubView,
    resetReportPages,
    setRequestedView,
    startViewTransition,
    updateSearchState,
    visibleReportTabs,
  } = model;

  return (
    <>
      <ViewSwitcher
        compact
        ariaLabel="Chọn loại báo cáo vận hành"
        tabs={visibleReportTabs}
        activeTab={`reports-${activeView}`}
        onTabChange={(id) => {
          const nextView = id.replace('reports-', '') as ReportView;
          startViewTransition(() => {
            setRequestedView(nextView);
            resetReportPages();
            updateSearchState({
              view: nextView,
              subview: nextView === 'price' ? priceSubView : undefined,
              page: undefined,
              pageSize: undefined,
            });
          });
        }}
      />

      {activeReportState.isFetching || isViewPending ? (
        <div role="status" aria-live="polite" className="sr-only">
          Đang tải dữ liệu báo cáo cho trang đang xem.
        </div>
      ) : null}

      {activeReportState.isError && (
        <QueryErrorAlert
          title="Không tải được dữ liệu báo cáo"
          isRetrying={activeReportState.isFetching}
          onRetry={activeReportState.refetch}
        >
          Không thể kết luận báo cáo đang trống. Vui lòng kiểm tra kết nối hoặc quyền truy cập rồi thử tải lại.
        </QueryErrorAlert>
      )}
    </>
  );
}
