import { SlidersHorizontal } from 'lucide-react';
import { OperationalFrame } from '@/components/common';
import { AdvancedDisplaySettings } from '../components/AdvancedDisplaySettings';

export default function AdvancedDisplaySettingsPage() {
  return (
    <OperationalFrame
      eyebrow="Quản trị hệ thống"
      title="Thiết lập nâng cao"
      description="Tùy chỉnh khu vực và tab hiển thị cho giao diện của Admin. Không thay đổi quyền, dữ liệu hoặc quy trình nghiệp vụ."
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
