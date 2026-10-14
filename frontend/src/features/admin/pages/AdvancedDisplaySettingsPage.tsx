import { useSearchParams } from 'react-router-dom';
import { OperationalFrame } from '@/components/common';
import { AdvancedDisplaySettings } from '../components/AdvancedDisplaySettings';
import { SystemOperationModeSettings } from '../components/SystemOperationModeSettings';

type SettingsView = 'operation' | 'display';

export default function AdvancedDisplaySettingsPage() {
  const [searchParams] = useSearchParams();
  const activeView: SettingsView = searchParams.get('view') === 'display' ? 'display' : 'operation';

  return (
    <OperationalFrame>
      {/* G4 batch E phase 2: leaf navigation moved to sidebar (MainLayout): { id: 'advanced-operation' }, { id: 'advanced-display' } */}
      {activeView === 'operation' ? <SystemOperationModeSettings /> : <AdvancedDisplaySettings />}
    </OperationalFrame>
  );
}
