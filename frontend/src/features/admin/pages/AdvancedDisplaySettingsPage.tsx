import { OperationalFrame } from '@/components/common';
import { AdvancedDisplaySettings } from '../components/AdvancedDisplaySettings';
import { SystemOperationModeSettings } from '../components/SystemOperationModeSettings';

export default function AdvancedDisplaySettingsPage() {
  return (
    <OperationalFrame>
      <SystemOperationModeSettings />
      <AdvancedDisplaySettings />
    </OperationalFrame>
  );
}
