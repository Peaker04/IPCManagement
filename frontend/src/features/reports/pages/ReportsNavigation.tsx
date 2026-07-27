import { ViewSwitcher } from '@/components/common';
import type { ReportView, ReportsPageModel } from './useReportsPageModel';

type ReportsNavigationProps = {
  model: ReportsPageModel;
};

export function ReportsNavigation({ model }: ReportsNavigationProps) {
  const {
    activeReportView,
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

      {activeReportView.phase === 'loading'
        || activeReportView.phase === 'ready' && activeReportView.isRefreshing
        || isViewPending ? (
        <div role="status" aria-live="polite" className="sr-only">
          Đang tải dữ liệu báo cáo cho trang đang xem.
        </div>
      ) : null}
    </>
  );
}
