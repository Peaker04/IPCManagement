import { SlidersHorizontal } from 'lucide-react';
import { OperationalFrame } from '@/components/common';
import { AdvancedDisplaySettings } from '../components/AdvancedDisplaySettings';

export default function AdvancedDisplaySettingsPage() {
  return (
    <OperationalFrame
      eyebrow="Quản trị hệ thống"
      title="Thiết lập nâng cao"
      description="Chọn khu vực cần dùng thường xuyên trong menu và tab quản trị."
      command={
        <div className="ipc-command-meta">
          <SlidersHorizontal size={16} />
          Chỉ Admin được phép thay đổi thiết lập hiển thị
        </div>
      }
    >
      <AdvancedDisplaySettings />
    </OperationalFrame>
  );
}
