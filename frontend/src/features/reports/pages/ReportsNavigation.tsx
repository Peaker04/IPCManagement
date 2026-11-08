import { ViewSwitcher } from '@/components/common';
import type { ReportView, ReportsPageModel } from './useReportsPageModel';

type ReportsNavigationProps = { model: ReportsPageModel };
type ReportGroup = { id: string; label: string; views: ReportView[] };

const reportGroups: ReportGroup[] = [
  { id: 'cost', label: 'Chi phí & giá', views: ['price'] },
  { id: 'planning', label: 'Kế hoạch & nhu cầu', views: ['demand', 'purchase'] },
  { id: 'warehouse', label: 'Kho & sử dụng', views: ['stock', 'movement', 'kitchen', 'usage'] },
  { id: 'control', label: 'Kiểm soát', views: ['audit', 'data-quality'] },
];

export function ReportsNavigation({ model }: ReportsNavigationProps) {
  const { activeReportView, activeView, isViewPending, priceSubView, reportSearchByView, resetReportPages, setRequestedView, startViewTransition, updateSearchState, visibleReportTabs } = model;
  const visibleTabsByView = new Map(visibleReportTabs.map((tab) => [tab.id.replace('reports-', '') as ReportView, tab]));
  const visibleGroups = reportGroups.map((group) => ({ ...group, views: group.views.filter((view) => visibleTabsByView.has(view)) })).filter((group) => group.views.length > 0);
  const activeGroup = visibleGroups.find((group) => group.views.includes(activeView)) ?? visibleGroups[0];
  const pending = isViewPending || activeReportView.phase === 'loading' || activeReportView.phase === 'ready' && activeReportView.isRefreshing;
  const openView = (nextView: ReportView) => startViewTransition(() => {
    setRequestedView(nextView);
    resetReportPages();
    updateSearchState({ view: nextView, subview: nextView === 'price' ? priceSubView : undefined, page: undefined, pageSize: undefined, search: reportSearchByView[nextView]?.trim() || undefined });
  });

  return <>
    <div className="space-y-2" aria-label="Điều hướng báo cáo theo tác vụ">
      <ViewSwitcher compact ariaLabel="Chọn nhóm báo cáo vận hành" isPending={pending}
        tabs={visibleGroups.map((group) => ({ id: `report-group-${group.id}`, label: group.label }))}
        activeTab={`report-group-${activeGroup?.id ?? ''}`}
        onTabChange={(id) => { const view = visibleGroups.find((group) => `report-group-${group.id}` === id)?.views[0]; if (view) openView(view); }} />
      <ViewSwitcher compact ariaLabel={`Chọn báo cáo trong nhóm ${activeGroup?.label}`} isPending={pending}
        tabs={(activeGroup?.views.flatMap((view) => {
          const tab = visibleTabsByView.get(view);
          return tab ? [tab] : [];
        }) ?? [])}
        activeTab={`reports-${activeView}`}
        onTabChange={(id) => openView(id.replace('reports-', '') as ReportView)} />
    </div>
    {pending && <div role="status" aria-live="polite" className="sr-only">Đang tải dữ liệu báo cáo cho trang đang xem.</div>}
  </>;
}
