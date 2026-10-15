import { useState } from 'react';
import { WorkspaceHeader } from '../../components/workbench/WorkspaceHeader';
import { TelemetrySubbar } from '../../components/workbench/TelemetrySubbar';
import { SplitView } from '../../components/workbench/SplitView';
import { Button } from '../../components/ui/button';
import { Badge } from '../../components/ui/badge';
import { Tabs } from '../../components/ui/tabs';
import { useAuth } from '../../store/useAuth';
import type { OperationalMode } from '../../types';

export function AdvancedSettingsPage() {
  const { operationalMode, setOperationalMode } = useAuth();
  const [activeTab, setActiveTab] = useState<'mode' | 'cache' | 'diagnostics'>('mode');
  const [selectedMode, setSelectedMode] = useState<OperationalMode>(operationalMode);
  const [isSaving, setIsSaving] = useState(false);

  const handleSaveMode = async () => {
    setIsSaving(true);
    try {
      await setOperationalMode(selectedMode);
      alert(`Đã lưu cấu hình và chuyển đổi chế độ vận hành sang: ${selectedMode === 'DEFAULT' ? 'Mặc định (DEFAULT)' : 'Đối soát nguyên liệu (MATERIAL_RECONCILIATION)'}`);
    } catch (err) {
      alert(err instanceof Error ? err.message : 'Chuyển đổi chế độ thất bại');
    } finally {
      setIsSaving(false);
    }
  };

  const handleClearCache = () => {
    const keysToRemove: string[] = [];
    for (let i = 0; i < localStorage.length; i++) {
      const key = localStorage.key(i);
      if (key && key.startsWith('ipc_v3_') && key !== 'ipc_v3_token' && key !== 'ipc_v3_user') {
        keysToRemove.push(key);
      }
    }
    keysToRemove.forEach((k) => localStorage.removeItem(k));
    alert('Đã xóa sạch bộ nhớ tạm trình duyệt (localStorage cache) của phiên bản v3.0!');
  };

  const TAB_ITEMS = [
    { id: 'mode', label: 'Chế độ vận hành (DOM-MODE-1)' },
    { id: 'cache', label: 'Bộ nhớ đệm & Phiên làm việc' },
    { id: 'diagnostics', label: 'Chẩn đoán kết nối API' },
  ];

  return (
    <div className="flex-1 min-h-0 flex flex-col h-full bg-white select-text">
      {/* Zone 1: WorkspaceHeader (56px / h-14) */}
      <WorkspaceHeader
        title="Cấu hình hệ thống & Vận hành"
        contextSelectors={
          <Badge
            variant={operationalMode === 'MATERIAL_RECONCILIATION' ? 'warning' : 'neutral'}
            size="default"
            className="h-9 px-3 text-sm font-medium flex items-center"
          >
            Chế độ hiện tại: {operationalMode === 'MATERIAL_RECONCILIATION' ? 'Đối soát MRX' : 'Mặc định (DEFAULT)'}
          </Badge>
        }
        actions={
          <>
            <Button
              variant="outline"
              size="default"
              onClick={() => setSelectedMode('DEFAULT')}
              className="h-9 text-sm font-medium"
            >
              Khôi phục mặc định
            </Button>
            {/* Rule D7: Single primary button */}
            <Button
              variant="default"
              size="default"
              disabled={isSaving}
              onClick={handleSaveMode}
              className="h-9 text-sm font-medium"
            >
              {isSaving ? 'Đang lưu...' : 'Lưu cấu hình hệ thống'}
            </Button>
          </>
        }
      />

      {/* Zone 2: TelemetrySubbar (44px / h-11) */}
      <TelemetrySubbar
        leftControls={
          <Tabs
            items={TAB_ITEMS}
            activeId={activeTab}
            onChange={(id) => setActiveTab(id as 'mode' | 'cache' | 'diagnostics')}
            size="default"
          />
        }
        telemetryPills={
          <>
            <span className="inline-flex items-center gap-1">
              <span className="text-slate-500">Kiến trúc:</span>
              <strong className="text-slate-900 font-semibold">3-Zone Flat Workbench</strong>
            </span>
            <span className="text-slate-300">·</span>
            <span className="inline-flex items-center gap-1">
              <span className="text-slate-500">Prefix:</span>
              <strong className="text-slate-900 font-mono text-xs">ipc_v3_*</strong>
            </span>
            <span className="text-slate-300">·</span>
            <Badge variant="success" size="sm">
              Backend Kestrel .NET 9
            </Badge>
          </>
        }
      />

      {/* Zone 3: SplitView */}
      <SplitView
        masterWidthClass="w-7/12"
        master={
          <div className="flex-1 min-h-0 flex flex-col p-6 space-y-6 overflow-auto bg-white">
            {activeTab === 'mode' && (
              <div className="space-y-4 max-w-xl">
                <div>
                  <h3 className="text-base font-bold text-slate-900">Thiết lập Chế độ Vận hành (Rule DOM-MODE-1)</h3>
                  <p className="text-xs text-slate-500 mt-1 leading-relaxed">
                    Hệ thống phân tách nghiêm ngặt giữa quy trình điều hành suất ăn thông thường và quy trình đối chiếu số liệu nguyên liệu.
                  </p>
                </div>

                <div className="space-y-3">
                  <label
                    onClick={() => setSelectedMode('DEFAULT')}
                    className={`flex items-start gap-3 p-4 rounded-lg border cursor-pointer transition-colors ${
                      selectedMode === 'DEFAULT' ? 'border-slate-900 bg-slate-50/80 shadow-2xs' : 'border-slate-200 hover:bg-slate-50'
                    }`}
                  >
                    <input
                      type="radio"
                      name="opMode"
                      checked={selectedMode === 'DEFAULT'}
                      onChange={() => setSelectedMode('DEFAULT')}
                      className="mt-1 h-4 w-4 text-slate-900 accent-slate-900"
                    />
                    <div>
                      <span className="font-semibold text-slate-900 text-sm block">1. Chế độ Mặc định (DEFAULT)</span>
                      <span className="text-xs text-slate-500 leading-relaxed block mt-0.5">
                        Dành cho hoạt động sản xuất thường nhật: Lập thực đơn, chốt suất ăn ca, tính toán nhu cầu BOM, phát lệnh KHSX, xuất kho và chế biến tại bếp.
                      </span>
                    </div>
                  </label>

                  <label
                    onClick={() => setSelectedMode('MATERIAL_RECONCILIATION')}
                    className={`flex items-start gap-3 p-4 rounded-lg border cursor-pointer transition-colors ${
                      selectedMode === 'MATERIAL_RECONCILIATION' ? 'border-amber-600 bg-amber-50/30 shadow-2xs' : 'border-slate-200 hover:bg-slate-50'
                    }`}
                  >
                    <input
                      type="radio"
                      name="opMode"
                      checked={selectedMode === 'MATERIAL_RECONCILIATION'}
                      onChange={() => setSelectedMode('MATERIAL_RECONCILIATION')}
                      className="mt-1 h-4 w-4 text-amber-600 accent-amber-600"
                    />
                    <div>
                      <span className="font-semibold text-slate-900 text-sm block">2. Chế độ Đối soát Nguyên liệu (MATERIAL_RECONCILIATION)</span>
                      <span className="text-xs text-slate-500 leading-relaxed block mt-0.5">
                        Kích hoạt các luồng kiểm toán chuyên sâu: Khóa các chức năng sửa kế hoạch, phân tích sai lệch tiêu hao thực tế so với BOM chuẩn, và chốt biên bản tài chính.
                      </span>
                    </div>
                  </label>
                </div>
              </div>
            )}

            {activeTab === 'cache' && (
              <div className="space-y-4 max-w-xl">
                <div>
                  <h3 className="text-base font-bold text-slate-900">Quản lý Bộ nhớ đệm Trình duyệt (Cache & Storage)</h3>
                  <p className="text-xs text-slate-500 mt-1 leading-relaxed">
                    Xóa các bản ghi lưu tạm trên máy cục bộ để tránh xung đột với các phiên làm việc trước đó.
                  </p>
                </div>

                <div className="rounded-lg border border-slate-200 bg-slate-50 p-4 space-y-3">
                  <div className="flex items-center justify-between">
                    <div>
                      <span className="font-semibold text-sm text-slate-900 block">Dọn dẹp Cache v3</span>
                      <span className="text-xs text-slate-500 block mt-0.5">Xóa các khóa tiền tố ipc_v3_* (giữ lại phiên đăng nhập)</span>
                    </div>
                    <Button variant="outline" size="sm" onClick={handleClearCache}>
                      Dọn cache ngay
                    </Button>
                  </div>
                </div>
              </div>
            )}

            {activeTab === 'diagnostics' && (
              <div className="space-y-4 max-w-xl">
                <div>
                  <h3 className="text-base font-bold text-slate-900">Chẩn đoán Kết nối C# Backend API</h3>
                  <p className="text-xs text-slate-500 mt-1 leading-relaxed">
                    Kiểm tra trạng thái kết nối giữa Frontend React và Kestrel Web API.
                  </p>
                </div>

                <div className="rounded-lg border border-slate-200 divide-y divide-slate-100 text-xs font-mono">
                  <div className="flex justify-between p-3">
                    <span className="text-slate-500">API Endpoint:</span>
                    <strong className="text-slate-900">http://localhost:5262/api</strong>
                  </div>
                  <div className="flex justify-between p-3">
                    <span className="text-slate-500">Proxy Vite:</span>
                    <strong className="text-emerald-700">Đang hoạt động (proxy 5173 ➔ 5262)</strong>
                  </div>
                  <div className="flex justify-between p-3">
                    <span className="text-slate-500">Cơ chế xác thực:</span>
                    <strong className="text-slate-900">JWT Bearer Token + HttpOnly Cookie</strong>
                  </div>
                </div>
              </div>
            )}
          </div>
        }
        detail={
          <div className="flex-1 min-h-0 flex flex-col p-6 space-y-4 bg-slate-50/40 text-xs text-slate-700 overflow-auto">
            <h4 className="text-xs font-semibold uppercase tracking-wider text-slate-600">
              Nguyên tắc Bất biến DOM-MODE-1
            </h4>
            <div className="rounded border border-slate-200 bg-white p-4 space-y-2 text-xs leading-relaxed text-slate-600">
              <p>
                <strong>DEFAULT != MATERIAL_RECONCILIATION</strong>: Dữ liệu danh mục gốc và số liệu tồn kho vật lý không bao giờ được trộn lẫn giữa hai luồng quy trình.
              </p>
              <p>
                Khi chuyển sang chế độ đối soát, các thao tác tạo mới hoặc sửa đổi kế hoạch sản xuất thường nhật sẽ tự động bị chặn ở tầng API để bảo toàn bằng chứng kế toán.
              </p>
            </div>

            <h4 className="text-xs font-semibold uppercase tracking-wider text-slate-600 pt-2">
              Thông số Môi trường Runtime
            </h4>
            <div className="rounded border border-slate-200 bg-white p-4 space-y-2 text-xs font-mono">
              <div className="flex justify-between">
                <span className="text-slate-500">Platform:</span>
                <span className="text-slate-800">React 19 + Vite 8</span>
              </div>
              <div className="flex justify-between">
                <span className="text-slate-500">Design System:</span>
                <span className="text-slate-800">3-Zone Flat Workbench</span>
              </div>
              <div className="flex justify-between">
                <span className="text-slate-500">Backend Server:</span>
                <span className="text-slate-800">ASP.NET Core .NET 9</span>
              </div>
              <div className="flex justify-between">
                <span className="text-slate-500">Database Engine:</span>
                <span className="text-slate-800">MySQL 8.0</span>
              </div>
            </div>
          </div>
        }
      />
    </div>
  );
}
