import { useEffect, useState, useMemo } from 'react';
import { Modal } from '../../components/ui/modal';
import { Button } from '../../components/ui/button';
import { Input } from '../../components/ui/input';
import { Select } from '../../components/ui/select';
import { InlineBanner } from '../../components/ui/inline-banner';
import { weeklyMenuApi, type WeeklyMenuData } from '../../api/weeklyMenuApi';
import { adminApi, type DishItem } from '../../api/adminApi';
import { toIsoDate } from '../../utils/dates';

interface WeeklyScheduleEditorModalProps {
  isOpen: boolean;
  onClose: () => void;
  data: WeeklyMenuData;
  onSaveSuccess: () => void;
}

const SLOT_OPTIONS = [
  { value: 'morningSavory', label: 'Mặn ca sáng' },
  { value: 'morningVegetarian', label: 'Chay ca sáng' },
  { value: 'afternoonSavory', label: 'Mặn ca chiều' },
  { value: 'afternoonVegetarian', label: 'Chay ca chiều' },
  { value: 'side', label: 'Món phụ / Canh / Xào' },
];

export function WeeklyScheduleEditorModal({
  isOpen,
  onClose,
  data,
  onSaveSuccess,
}: WeeklyScheduleEditorModalProps) {
  const [activeTab, setActiveTab] = useState<'servings' | 'dishes'>('servings');
  const [dishes, setDishes] = useState<DishItem[]>([]);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [feedback, setFeedback] = useState<{ type: 'success' | 'error'; message: string } | null>(null);

  // Initialize base servingsMap from current productionPlans
  const baseServingsMap = useMemo(() => {
    const map: Record<string, string> = {};
    for (const plan of data.productionPlans) {
      if (plan.serviceDate) {
        const key = `${plan.serviceDate}|${plan.shiftName}`;
        map[key] = String(plan.plannedServings);
      }
    }
    return map;
  }, [data.productionPlans]);

  // Draft overrides
  const [draftServingsMap, setDraftServingsMap] = useState<Record<string, string>>({});
  const servingsMap = useMemo(() => ({ ...baseServingsMap, ...draftServingsMap }), [baseServingsMap, draftServingsMap]);

  // Single dish slot update state
  const [selectedDate, setSelectedDate] = useState(() => data.scheduleDays[0]?.dateStr || '');
  const [selectedShift, setSelectedShift] = useState<'MORNING' | 'AFTERNOON'>('MORNING');
  const [selectedSlot, setSelectedSlot] = useState('morningSavory');
  const [selectedDishId, setSelectedDishId] = useState('');

  // Load available dishes from catalog
  useEffect(() => {
    if (!isOpen) return;
    let ignore = false;
    adminApi.getDishes({ pageSize: 100 })
      .then((res) => {
        if (ignore) return;
        const items = res?.items ?? [];
        setDishes(items);
        if (items.length > 0 && !selectedDishId) {
          setSelectedDishId(items[0].dishId);
        }
      })
      .catch(() => {});
    return () => { ignore = true; };
  }, [isOpen, selectedDishId]);

  const handleSaveServings = async () => {
    setIsSubmitting(true);
    setFeedback(null);
    try {
      // Loop through all schedule days and shifts to save
      for (const day of data.scheduleDays) {
        // Robust ISO date derivation
        const isoDate = toIsoDate(day.dateStr);
        const morningKey = `${day.dateStr}|MORNING`;
        const afternoonKey = `${day.dateStr}|AFTERNOON`;

        const morningServings = Number(servingsMap[morningKey]);
        if (morningServings > 0) {
          await weeklyMenuApi.upsertQuickServings({
            customerId: data.customerId,
            serviceDate: isoDate,
            shiftName: 'MORNING',
            servings: morningServings,
            complete: true,
          });
        }

        const afternoonServings = Number(servingsMap[afternoonKey]);
        if (afternoonServings > 0) {
          await weeklyMenuApi.upsertQuickServings({
            customerId: data.customerId,
            serviceDate: isoDate,
            shiftName: 'AFTERNOON',
            servings: afternoonServings,
            complete: true,
          });
        }
      }

      setFeedback({ type: 'success', message: 'Đã lưu và chốt số suất ăn thành công.' });
      onSaveSuccess();
    } catch (err: unknown) {
      setFeedback({
        type: 'error',
        message: err instanceof Error ? err.message : 'Không thể lưu số suất ăn.',
      });
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleUpdateDishSlot = async () => {
    if (!selectedDishId || !selectedDate) return;
    setIsSubmitting(true);
    setFeedback(null);
    try {
      const isoDate = toIsoDate(selectedDate);

      await weeklyMenuApi.bulkUpdateWeeklyMenu({
        customerId: data.customerId,
        slots: [{
          serviceDate: isoDate,
          shiftName: selectedShift,
          slotType: selectedSlot,
          dishId: selectedDishId,
        }],
      });

      setFeedback({ type: 'success', message: 'Đã cập nhật món ăn vào lịch tuần thành công.' });
      onSaveSuccess();
    } catch (err: unknown) {
      setFeedback({
        type: 'error',
        message: err instanceof Error ? err.message : 'Không thể cập nhật món ăn vào lịch.',
      });
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title="Chỉnh sửa lịch thực đơn & số suất tuần"
      description={`Khách hàng: ${data.customerName} · Tuần: ${data.weekStartDate}`}
      footer={
        <div className="flex items-center justify-between w-full">
          <div className="text-xs text-slate-500">
            {activeTab === 'servings' ? 'Số suất sẽ được đồng bộ ngay sang Kế hoạch sản xuất' : 'Món mới sẽ cập nhật trực tiếp vào ma trận thực đơn'}
          </div>
          <div className="flex items-center gap-2">
            <Button variant="outline" size="sm" onClick={onClose} disabled={isSubmitting}>
              Đóng
            </Button>
            {activeTab === 'servings' ? (
              <Button variant="default" size="sm" onClick={handleSaveServings} disabled={isSubmitting}>
                {isSubmitting ? 'Đang lưu…' : 'Lưu & chốt số suất'}
              </Button>
            ) : (
              <Button variant="default" size="sm" onClick={handleUpdateDishSlot} disabled={isSubmitting || !selectedDishId}>
                {isSubmitting ? 'Đang lưu…' : 'Cập nhật món'}
              </Button>
            )}
          </div>
        </div>
      }
    >
      <div className="space-y-4">
        {/* Navigation Tabs */}
        <div className="flex border-b border-slate-200">
          <button
            type="button"
            onClick={() => { setActiveTab('servings'); setFeedback(null); }}
            className={`px-4 py-2 text-sm font-semibold border-b-2 cursor-pointer transition-colors ${
              activeTab === 'servings'
                ? 'border-slate-900 text-slate-900'
                : 'border-transparent text-slate-500 hover:text-slate-800'
            }`}
          >
            1. Cập nhật số suất ca
          </button>
          <button
            type="button"
            onClick={() => { setActiveTab('dishes'); setFeedback(null); }}
            className={`px-4 py-2 text-sm font-semibold border-b-2 cursor-pointer transition-colors ${
              activeTab === 'dishes'
                ? 'border-slate-900 text-slate-900'
                : 'border-transparent text-slate-500 hover:text-slate-800'
            }`}
          >
            2. Đổi món ăn theo ca
          </button>
        </div>

        {feedback && (
          <InlineBanner
            variant={feedback.type === 'success' ? 'success' : 'error'}
            onClose={() => setFeedback(null)}
          >
            {feedback.message}
          </InlineBanner>
        )}

        {activeTab === 'servings' && (
          <div className="space-y-3">
            <p className="text-xs text-slate-600">
              Nhập số lượng suất ăn kế hoạch cho từng ngày. Sau khi lưu, hệ thống sẽ tự động hoàn tất tính toán định lượng nhu cầu nguyên liệu.
            </p>
            <div className="border border-slate-200 rounded overflow-hidden">
              <table className="w-full text-left text-sm border-collapse">
                <thead className="bg-slate-50 border-b border-slate-200 text-xs font-semibold text-slate-600">
                  <tr>
                    <th className="p-2.5">Ngày phục vụ</th>
                    <th className="p-2.5 text-right w-40">Số suất Ca 1 (Sáng)</th>
                    <th className="p-2.5 text-right w-40">Số suất Ca 2 (Chiều)</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {data.scheduleDays.map((day) => {
                    const morningKey = `${day.dateStr}|MORNING`;
                    const afternoonKey = `${day.dateStr}|AFTERNOON`;
                    return (
                      <tr key={day.dateStr} className="hover:bg-slate-50/50">
                        <td className="p-2.5 font-medium text-slate-900 text-xs">
                          <span className="font-semibold block">{day.dayName}</span>
                          <span className="font-mono text-slate-500">{day.dateStr}</span>
                        </td>
                        <td className="p-2.5 text-right">
                          <Input
                            type="number"
                            min="0"
                            aria-label={`Số suất ${day.dayName} Ca sáng`}
                            value={servingsMap[morningKey] || ''}
                            onChange={(e) => setDraftServingsMap((curr) => ({ ...curr, [morningKey]: e.target.value }))}
                            className="h-8 text-right font-mono text-sm"
                            placeholder="100"
                          />
                        </td>
                        <td className="p-2.5 text-right">
                          <Input
                            type="number"
                            min="0"
                            aria-label={`Số suất ${day.dayName} Ca chiều`}
                            value={servingsMap[afternoonKey] || ''}
                            onChange={(e) => setDraftServingsMap((curr) => ({ ...curr, [afternoonKey]: e.target.value }))}
                            className="h-8 text-right font-mono text-sm"
                            placeholder="0"
                          />
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </div>
        )}

        {activeTab === 'dishes' && (
          <div className="space-y-4">
            <p className="text-xs text-slate-600">
              Chọn ngày, ca và vị trí món cần thay đổi. Món ăn mới sẽ được cập nhật trực tiếp vào thực đơn tuần đã lưu.
            </p>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">Ngày phục vụ</label>
                <Select
                  aria-label="Chọn ngày đổi món"
                  value={selectedDate}
                  onChange={(e) => setSelectedDate(e.target.value)}
                  options={data.scheduleDays.map((d) => ({ value: d.dateStr, label: `${d.dayName} (${d.dateStr})` }))}
                  className="h-9 w-full font-medium text-sm"
                />
              </div>
              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">Ca sản xuất</label>
                <Select
                  aria-label="Chọn ca đổi món"
                  value={selectedShift}
                  onChange={(e) => setSelectedShift(e.target.value as 'MORNING' | 'AFTERNOON')}
                  options={[
                    { value: 'MORNING', label: 'Ca 1 (Sáng)' },
                    { value: 'AFTERNOON', label: 'Ca 2 (Chiều)' },
                  ]}
                  className="h-9 w-full font-medium text-sm"
                />
              </div>
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">Vị trí món ăn</label>
              <Select
                aria-label="Chọn vị trí món ăn"
                value={selectedSlot}
                onChange={(e) => setSelectedSlot(e.target.value)}
                options={SLOT_OPTIONS}
                className="h-9 w-full font-medium text-sm"
              />
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">Món ăn thay thế từ danh mục</label>
              <Select
                aria-label="Chọn món ăn thay thế"
                value={selectedDishId}
                onChange={(e) => setSelectedDishId(e.target.value)}
                options={dishes.map((d) => ({
                  value: d.dishId,
                  label: `${d.dishName} (${d.dishCode || d.dishId.slice(0, 8)})`,
                }))}
                className="h-9 w-full font-medium text-sm"
              />
            </div>
          </div>
        )}
      </div>
    </Modal>
  );
}
