import { useMemo, useState } from 'react';
import { Eye, EyeOff, RotateCcw, SlidersHorizontal } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { SectionPanel, StatusBadge, useToast } from '@/components/common';
import {
  defaultNavigationPreferences,
  readNavigationPreferences,
  resetNavigationPreferences,
  defaultAdminTabPreferences,
  readAdminTabPreferences,
  writeAdminTabPreferences,
  writeNavigationPreferences,
  type NavigationPreferenceKey,
} from '@/lib/navigationPreferences';

const items: ReadonlyArray<{ key: NavigationPreferenceKey; label: string; description: string }> = [
  { key: 'dashboard', label: 'Tổng quan', description: 'Bàn điều hành và cảnh báo trong ngày.' },
  { key: 'weekly-menu', label: 'Thực đơn tuần', description: 'Kế hoạch sản xuất và định lượng.' },
  { key: 'meal-orders', label: 'Điều phối suất ăn', description: 'Số suất và lịch phục vụ.' },
  { key: 'approvals', label: 'Duyệt vận hành', description: 'Hàng chờ cần phê duyệt.' },
  { key: 'purchasing', label: 'Thu mua', description: 'Đề xuất và chứng từ mua.' },
  { key: 'warehouse', label: 'Kho nguyên liệu', description: 'Nhập, xuất và xử lý chênh lệch.' },
  { key: 'chef-dashboard', label: 'Bếp trưởng', description: 'Checklist và xác nhận bếp.' },
  { key: 'reports', label: 'Báo cáo vận hành', description: 'Báo cáo biến động và đối chiếu.' },
  { key: 'admin-data', label: 'Quản trị dữ liệu', description: 'BOM, tồn kho và nhật ký.' },
  { key: 'approval-rules', label: 'Thiết lập quy trình duyệt', description: 'Quy tắc và thời hạn phê duyệt.' },
];
const adminTabs = [
  ['bom-import', 'BOM theo đơn giá'], ['contracts', 'Hợp đồng'], ['cleanup', 'Dữ liệu lỗi'],
  ['inventory', 'Tồn kho'], ['statistics', 'Thống kê'], ['audit', 'Nhật ký thay đổi'], ['employees', 'Nhân viên'],
] as const;

export function AdvancedDisplaySettings() {
  const { toast } = useToast();
  const [preferences, setPreferences] = useState(() => readNavigationPreferences());
  const [tabPreferences, setTabPreferences] = useState(() => readAdminTabPreferences());
  const visibleCount = useMemo(() => Object.values(preferences).filter(Boolean).length, [preferences]);
  const update = (key: NavigationPreferenceKey) => {
    const next = { ...preferences, [key]: !preferences[key] };
    if (Object.values(next).every((value) => !value)) return;
    setPreferences(next);
    writeNavigationPreferences(next);
  };
  const reset = () => {
    setPreferences({ ...defaultNavigationPreferences });
    resetNavigationPreferences();
    setTabPreferences({ ...defaultAdminTabPreferences });
    writeAdminTabPreferences(defaultAdminTabPreferences);
    toast({ title: 'Đã hiện lại toàn bộ khu vực', variant: 'success' });
  };

  return (
    <SectionPanel title="Thiết lập nâng cao" icon={<SlidersHorizontal size={18} />}>
      <div className="space-y-4 p-4">
        <div className="flex flex-wrap items-start justify-between gap-3 rounded-md bg-slate-50 p-3">
          <div>
            <p className="font-semibold text-slate-800">Tùy chỉnh khu vực hiển thị</p>
            <p className="mt-1 text-xs text-slate-600">Chỉ ẩn khỏi menu và tab để màn hình gọn hơn. Quyền truy cập, dữ liệu và Golden path không thay đổi.</p>
          </div>
          <div className="flex items-center gap-2">
            <StatusBadge variant="neutral">{visibleCount}/{items.length} khu vực đang hiện</StatusBadge>
            <Button type="button" size="xs" variant="outline" onClick={reset}><RotateCcw size={13} /> Hiện tất cả</Button>
          </div>
        </div>
        <div className="grid gap-2 md:grid-cols-2">
          {items.map((item) => {
            const visible = preferences[item.key];
            return (
              <button key={item.key} type="button" onClick={() => update(item.key)} aria-pressed={visible} className="flex min-w-0 items-start gap-3 rounded-md border border-slate-200 bg-white p-3 text-left transition-colors hover:border-slate-300 hover:bg-slate-50">
                <span className="mt-0.5 shrink-0 text-slate-500" aria-hidden="true">{visible ? <Eye size={16} /> : <EyeOff size={16} />}</span>
                <span className="min-w-0 flex-1"><span className="block font-semibold text-slate-800">{item.label}</span><span className="mt-0.5 block text-xs text-slate-500">{item.description}</span></span>
                <span className="shrink-0 text-xs font-semibold text-slate-600">{visible ? 'Đang hiện' : 'Đang ẩn'}</span>
              </button>
            );
          })}
        </div>
        <div className="border-t border-slate-200 pt-4">
          <p className="mb-2 font-semibold text-slate-800">Tab trong Quản trị dữ liệu</p>
          <div className="grid gap-2 md:grid-cols-2">
            {adminTabs.map(([key, label]) => {
              const visible = tabPreferences[key];
              return <button key={key} type="button" onClick={() => {
                const next = { ...tabPreferences, [key]: !visible };
                if (Object.values(next).every((value) => !value)) return;
                setTabPreferences(next);
                writeAdminTabPreferences(next);
              }} aria-pressed={visible} className="flex items-center justify-between rounded-md border border-slate-200 bg-white px-3 py-2 text-left text-sm hover:bg-slate-50">
                <span>{label}</span><span className="text-xs text-slate-500">{visible ? 'Đang hiện' : 'Đang ẩn'}</span>
              </button>;
            })}
          </div>
        </div>
      </div>
    </SectionPanel>
  );
}
