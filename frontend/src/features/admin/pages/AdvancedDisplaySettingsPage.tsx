import { useSearchParams } from 'react-router-dom';
import { OperationalFrame, ViewSwitcher } from '@/components/common';
import { AdvancedDisplaySettings } from '../components/AdvancedDisplaySettings';
import { SystemOperationModeSettings } from '../components/SystemOperationModeSettings';

type SettingsView = 'operation' | 'display';

export default function AdvancedDisplaySettingsPage() {
  const [searchParams, setSearchParams] = useSearchParams();
  const activeView: SettingsView = searchParams.get('view') === 'display' ? 'display' : 'operation';

  return (
    <OperationalFrame>
      <ViewSwitcher
        compact
        ariaLabel="Chọn tác vụ thiết lập nâng cao"
        tabs={[
          { id: 'advanced-operation', label: 'Chế độ vận hành' },
          { id: 'advanced-display', label: 'Hiển thị & điều hướng' },
        ]}
        activeTab={`advanced-${activeView}`}
        onTabChange={(id) => {
          const next = new URLSearchParams(searchParams);
          next.set('view', id === 'advanced-display' ? 'display' : 'operation');
          setSearchParams(next);
        }}
      />
      {activeView === 'operation' ? <SystemOperationModeSettings /> : <AdvancedDisplaySettings />}
    </OperationalFrame>
  );
}
