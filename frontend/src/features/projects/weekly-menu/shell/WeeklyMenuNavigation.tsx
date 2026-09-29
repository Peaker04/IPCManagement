import { ViewSwitcher } from '@/components/common';
import { MRX_QUANTITY_TAB_LABEL } from '@/lib/reconciliationLifecyclePresentation';
import type { SystemOperationMode } from '@/lib/systemOperationTypes';
import type { WeeklyMenuView } from '../model/types';

type Props = { mode: SystemOperationMode; views: WeeklyMenuView[]; activeView: WeeklyMenuView; onViewChange: (view: WeeklyMenuView) => void };

const labels: Array<[WeeklyMenuView, string]> = [
  ['schedule', 'Kế hoạch tuần'], ['demand', 'Nhu cầu'], ['production-plan', 'Kế hoạch sản xuất'],
  ['purchase-summary', 'Bàn giao tuần'], ['cost', 'Giá vốn tuần'], ['dish-materials', 'Định mức theo món'],
];

export function WeeklyMenuNavigation({ mode, views, activeView, onViewChange }: Props) {
  const tabs = (mode === 'MATERIAL_RECONCILIATION' ? labels.slice(0, 2) : labels)
    .filter(([id]) => views.includes(id))
    .map(([id, label]) => ({ id, label: mode === 'MATERIAL_RECONCILIATION' && id === 'demand' ? MRX_QUANTITY_TAB_LABEL : label }));
  return <ViewSwitcher compact ariaLabel="Chọn góc nhìn kế hoạch tuần" tabs={tabs}
    activeTab={activeView} onTabChange={(id) => onViewChange(id as WeeklyMenuView)} />;
}
