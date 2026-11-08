import { ViewSwitcher } from '@/components/common';
import { MRX_QUANTITY_TAB_LABEL } from '@/lib/reconciliationLifecyclePresentation';
import type { SystemOperationMode } from '@/lib/systemOperationTypes';
import type { WeeklyMenuView } from '../model/types';

type Props = { mode: SystemOperationMode; views: WeeklyMenuView[]; activeView: WeeklyMenuView; onViewChange: (view: WeeklyMenuView) => void };
type Group = { id: string; label: string; views: Array<[WeeklyMenuView, string]> };

const groups: Group[] = [
  { id: 'authoring', label: 'Soạn kế hoạch', views: [['schedule', 'Kế hoạch tuần']] },
  { id: 'execution', label: 'Thực thi tuần', views: [['demand', 'Nhu cầu'], ['production-plan', 'Kế hoạch sản xuất'], ['purchase-summary', 'Tổng quan bàn giao cả tuần']] },
  { id: 'analysis', label: 'Phân tích', views: [['cost', 'Giá vốn tuần'], ['dish-materials', 'Định mức theo món']] },
];

export function WeeklyMenuNavigation({ mode, views, activeView, onViewChange }: Props) {
  if (mode === 'MATERIAL_RECONCILIATION') return <ViewSwitcher ariaLabel="Chọn góc nhìn kế hoạch tuần"
    tabs={[{ id: 'schedule', label: 'Kế hoạch tuần' }, { id: 'demand', label: MRX_QUANTITY_TAB_LABEL }].filter((tab) => views.includes(tab.id as WeeklyMenuView))}
    activeTab={activeView} onTabChange={(id) => onViewChange(id as WeeklyMenuView)} />;

  const visibleGroups = groups.map((group) => ({ ...group, views: group.views.filter(([view]) => views.includes(view)) })).filter((group) => group.views.length > 0);
  const activeGroup = visibleGroups.find((group) => group.views.some(([view]) => view === activeView)) ?? visibleGroups[0];
  const tabs = activeGroup?.views.map(([id, label]) => ({ id, label })) ?? [];

  return <div className="space-y-2" aria-label="Điều hướng kế hoạch tuần theo tác vụ">
    <ViewSwitcher compact ariaLabel="Chọn nhóm tác vụ kế hoạch tuần"
      tabs={visibleGroups.map((group) => ({ id: `weekly-group-${group.id}`, label: group.label }))}
      activeTab={`weekly-group-${activeGroup?.id ?? ''}`}
      onTabChange={(id) => { const view = visibleGroups.find((group) => `weekly-group-${group.id}` === id)?.views[0]?.[0]; if (view) onViewChange(view); }} />
    <ViewSwitcher compact ariaLabel={`Chọn tác vụ trong nhóm ${activeGroup?.label}`}
      tabs={tabs} activeTab={activeView} onTabChange={(id) => onViewChange(id as WeeklyMenuView)} />
  </div>;
}
