import { ViewSwitcher } from '@/components/common';
import { MRX_QUANTITY_TAB_LABEL } from '@/lib/reconciliationLifecyclePresentation';
import type { SystemOperationMode } from '@/lib/systemOperationTypes';
import type { WeeklyMenuView } from '../model/types';

type Props = { mode: SystemOperationMode; views: WeeklyMenuView[]; activeView: WeeklyMenuView; onViewChange: (view: WeeklyMenuView) => void };
type Group = { id: string; label: string; views: Array<[WeeklyMenuView, string]> };

// eslint-disable-next-line @typescript-eslint/no-unused-vars
const groups: Group[] = [
  { id: 'authoring', label: 'Soạn kế hoạch', views: [['schedule', 'Kế hoạch tuần']] },
  { id: 'execution', label: 'Thực thi tuần', views: [['demand', 'Nhu cầu'], ['production-plan', 'Kế hoạch sản xuất'], ['purchase-summary', 'Tổng quan bàn giao cả tuần']] },
  { id: 'analysis', label: 'Phân tích', views: [['cost', 'Giá vốn tuần'], ['dish-materials', 'Định mức theo món']] },
];

const labels: Array<[WeeklyMenuView, string]> = [
  ['schedule', 'Kế hoạch tuần'], ['demand', 'Nhu cầu'], ['production-plan', 'Kế hoạch sản xuất'],
  ['purchase-summary', 'Tổng quan bàn giao cả tuần'], ['cost', 'Giá vốn tuần'], ['dish-materials', 'Định mức theo món'],
];

export function WeeklyMenuNavigation({ mode, views, activeView, onViewChange }: Props) {
  void groups;
  const mrxTabs = [
    { id: 'schedule', label: 'Kế hoạch tuần' },
    { id: 'demand', label: MRX_QUANTITY_TAB_LABEL },
  ];
  const tabs = (mode === 'MATERIAL_RECONCILIATION'
    ? mrxTabs.filter((tab) => views.includes(tab.id as WeeklyMenuView))
    : labels.filter(([id]) => views.includes(id)).map(([id, label]) => ({ id, label })));
  return <ViewSwitcher compact ariaLabel="Chọn góc nhìn kế hoạch tuần" tabs={tabs}
    activeTab={activeView} onTabChange={(id) => onViewChange(id as WeeklyMenuView)} />;
}
