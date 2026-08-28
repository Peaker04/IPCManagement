import { memo, useCallback, useMemo, useState } from 'react';
import {
  CalendarDays,
  ChefHat,
  ChevronDown,
  ChevronRight,
  ClipboardCheck,
  Database,
  Layers,
  LayoutDashboard,
  RotateCcw,
  Settings,
  ShoppingCart,
  SlidersHorizontal,
  TrendingUp,
  Utensils,
  Warehouse,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { ConfirmDialog, SectionPanel, StatusBadge, useToast } from '@/components/common';
import { cn } from '@/lib/utils';
import { useSystemOperation } from '@/features/system-operation/systemOperationContext';
import { eligibleCapabilityIds, eligiblePageTabs } from '@/features/system-operation/systemOperationEligibility';
import {
  defaultNavigationPreferences,
  readNavigationPreferences,
  resetNavigationPreferences,
  defaultPageTabPreferences,
  pageTabGroups,
  readPageTabPreferences,
  writePageTabPreferences,
  writeNavigationPreferences,
  type NavigationPreferenceKey,
  type PageTabGroupId,
} from '@/lib/navigationPreferences';

interface NavigationItemConfig {
  key: NavigationPreferenceKey;
  label: string;
  description: string;
  icon: React.ComponentType<{ size?: number; className?: string }>;
}

const navigationItems: ReadonlyArray<NavigationItemConfig> = [
  { key: 'dashboard', label: 'Tổng quan', description: 'Bàn điều hành và cảnh báo trong ngày.', icon: LayoutDashboard },
  { key: 'weekly-menu', label: 'Thực đơn tuần', description: 'Kế hoạch sản xuất và định lượng.', icon: CalendarDays },
  { key: 'meal-orders', label: 'Điều phối suất ăn', description: 'Số suất và lịch phục vụ.', icon: Utensils },
  { key: 'approvals', label: 'Duyệt vận hành', description: 'Hàng chờ cần phê duyệt.', icon: ClipboardCheck },
  { key: 'purchasing', label: 'Thu mua', description: 'Đề xuất và chứng từ mua.', icon: ShoppingCart },
  { key: 'warehouse', label: 'Kho nguyên liệu', description: 'Nhập, xuất và xử lý chênh lệch.', icon: Warehouse },
  { key: 'chef-dashboard', label: 'Bếp trưởng', description: 'Checklist và xác nhận bếp.', icon: ChefHat },
  { key: 'reports', label: 'Báo cáo vận hành', description: 'Báo cáo biến động và đối chiếu.', icon: TrendingUp },
  { key: 'admin-data', label: 'Quản trị dữ liệu', description: 'BOM, tồn kho và nhật ký.', icon: Database },
  { key: 'approval-rules', label: 'Thiết lập quy trình duyệt', description: 'Quy tắc và thời hạn phê duyệt.', icon: Settings },
];

const groupIcons: Record<string, React.ComponentType<{ size?: number; className?: string }>> = {
  'weekly-menu': CalendarDays,
  warehouse: Warehouse,
  approvals: ClipboardCheck,
  purchasing: ShoppingCart,
  chef: ChefHat,
  reports: TrendingUp,
  'admin-data': Database,
};

const SwitchIndicator = memo(function SwitchIndicator({ checked }: { checked: boolean }) {
  return (
    <span
      aria-hidden="true"
      className={cn(
        'relative inline-flex h-5 w-9 shrink-0 items-center rounded-full transition-colors duration-150',
        checked ? 'bg-blue-600' : 'bg-slate-300'
      )}
    >
      <span
        className={cn(
          'pointer-events-none block size-3.5 rounded-full bg-white shadow-xs transition-transform duration-150',
          checked ? 'translate-x-4.5' : 'translate-x-0.5'
        )}
      />
    </span>
  );
});

interface NavigationItemCardProps {
  item: NavigationItemConfig;
  visible: boolean;
  onToggle: (key: NavigationPreferenceKey) => void;
}

const NavigationItemCard = memo(function NavigationItemCard({
  item,
  visible,
  onToggle,
}: NavigationItemCardProps) {
  const Icon = item.icon;

  return (
    <button
      type="button"
      role="switch"
      aria-checked={visible}
      aria-label={`${item.label}, ${visible ? 'đang hiện' : 'đang ẩn'}`}
      onClick={() => onToggle(item.key)}
      className={cn(
        'group relative flex w-full cursor-pointer items-center justify-between gap-3 rounded-lg border p-3.5 text-left transition-[background-color,border-color,opacity] duration-150 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-500',
        visible
          ? 'border-slate-200 bg-white shadow-2xs hover:border-slate-300 hover:bg-slate-50/70'
          : 'border-slate-200/80 bg-slate-50/80 hover:bg-slate-100'
      )}
    >
      <div className="flex min-w-0 items-center gap-3">
        <div
          className={cn(
            'flex size-9 shrink-0 items-center justify-center rounded-md border transition-colors',
            visible
              ? 'border-slate-200 bg-slate-100 text-slate-700 group-hover:border-blue-200 group-hover:bg-blue-50 group-hover:text-blue-700'
              : 'border-slate-200 bg-slate-200/60 text-slate-400'
          )}
        >
          <Icon size={18} />
        </div>
        <div className="min-w-0">
          <span
            className={cn(
              'block truncate text-sm font-semibold',
              visible ? 'text-slate-800' : 'text-slate-700 line-through decoration-slate-500'
            )}
          >
            {item.label}
          </span>
          <p className="mt-0.5 truncate text-xs text-slate-500">{item.description}</p>
        </div>
      </div>

      <div className="flex shrink-0 items-center gap-2.5 pl-2">
        <span className={cn('text-xs font-medium', visible ? 'text-slate-700' : 'text-slate-700')}>
          {visible ? 'Đang hiện' : 'Đã ẩn'}
        </span>
        <SwitchIndicator checked={visible} />
      </div>
    </button>
  );
});

interface PageTabItemButtonProps {
  groupLabel: string;
  tabId: string;
  tabLabel: string;
  visible: boolean;
  onToggle: (tabId: string, tabLabel: string) => void;
}

const PageTabItemButton = memo(function PageTabItemButton({
  groupLabel,
  tabId,
  tabLabel,
  visible,
  onToggle,
}: PageTabItemButtonProps) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={visible}
      aria-label={`${groupLabel}, ${tabLabel}, ${visible ? 'đang hiện' : 'đang ẩn'}`}
      onClick={() => onToggle(tabId, tabLabel)}
      className={cn(
        'flex w-full cursor-pointer items-center justify-between gap-2 rounded-md border px-3 py-2 text-left transition-[background-color,border-color,opacity] duration-150 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-500',
        visible
          ? 'border-slate-200 bg-white shadow-2xs hover:border-slate-300 hover:bg-slate-50'
          : 'border-slate-200/70 bg-slate-100/60 hover:bg-slate-100'
      )}
    >
      <span
        className={cn(
          'min-w-0 truncate text-xs font-medium',
          visible ? 'text-slate-800' : 'text-slate-400 line-through'
        )}
      >
        {tabLabel}
      </span>

      <div className="flex shrink-0 items-center gap-2">
        <span className={cn('text-caption', visible ? 'text-slate-600' : 'text-slate-400')}>
          {visible ? 'Hiện' : 'Ẩn'}
        </span>
        <SwitchIndicator checked={visible} />
      </div>
    </button>
  );
});

interface PageTabGroupCardProps {
  group: { id: PageTabGroupId; label: string; description: string; tabs: ReadonlyArray<readonly [string, string]> };
  groupPreferences: Record<string, boolean>;
  isExpanded: boolean;
  onToggleExpand: (groupId: string) => void;
  onToggleTab: (groupId: PageTabGroupId, tabId: string, tabLabel: string) => void;
  onShowAllInGroup: (groupId: PageTabGroupId) => void;
}

const PageTabGroupCard = memo(function PageTabGroupCard({
  group,
  groupPreferences,
  isExpanded,
  onToggleExpand,
  onToggleTab,
  onShowAllInGroup,
}: PageTabGroupCardProps) {
  const Icon = groupIcons[group.id] || Layers;
  const visibleInGroup = useMemo(
    () => group.tabs.filter(([id]) => groupPreferences[id] !== false).length,
    [group.tabs, groupPreferences]
  );
  const totalInGroup = group.tabs.length;
  const allInGroupVisible = visibleInGroup === totalInGroup;

  return (
    <div className="overflow-hidden rounded-lg border border-slate-200 bg-white transition-colors">
      {/* Accordion Header */}
      <div className="flex items-center gap-2 p-3.5 hover:bg-slate-50/80">
        <button
          type="button"
          aria-expanded={isExpanded}
          aria-label={`${isExpanded ? 'Thu gọn' : 'Mở'} nhóm ${group.label}`}
          onClick={() => onToggleExpand(group.id)}
          className="flex min-w-0 flex-1 cursor-pointer select-none items-center justify-between gap-3 text-left focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-500"
        >
          <div className="flex min-w-0 items-center gap-3">
            <div className="flex size-8 shrink-0 items-center justify-center rounded-md border border-slate-200 bg-slate-100 text-slate-600">
              <Icon size={16} />
            </div>
            <div className="min-w-0">
              <span className="block text-sm font-semibold text-slate-800">{group.label}</span>
              <p className="mt-0.5 truncate text-xs text-slate-700">{group.description}</p>
            </div>
          </div>

          <div className="flex shrink-0 items-center gap-3">
            <StatusBadge variant={allInGroupVisible ? 'neutral' : 'warning'}>
              {visibleInGroup}/{totalInGroup} tab đang hiện
            </StatusBadge>
            <span className="text-slate-600 transition-transform duration-150">
              {isExpanded ? <ChevronDown size={18} /> : <ChevronRight size={18} />}
            </span>
          </div>
        </button>
        {!allInGroupVisible && (
          <button
            type="button"
            aria-label={`Hiện tất cả tab của ${group.label}`}
            onClick={() => onShowAllInGroup(group.id)}
            className="hidden shrink-0 rounded px-2 py-1 text-xs font-medium text-blue-700 hover:bg-blue-50 sm:inline-flex"
          >
            Hiện tất cả tab
          </button>
        )}
      </div>

      {/* Accordion Body */}
      {isExpanded && (
        <div className="border-t border-slate-200 bg-slate-50/60 p-3">
          <div className="grid grid-cols-1 gap-2 sm:grid-cols-2 md:grid-cols-3">
            {group.tabs.map(([tabId, tabLabel]) => {
              const isTabVisible = groupPreferences[tabId] !== false;

              return (
                <PageTabItemButton
                  key={tabId}
                  groupLabel={group.label}
                  tabId={tabId}
                  tabLabel={tabLabel}
                  visible={isTabVisible}
                  onToggle={(tId, tLabel) => onToggleTab(group.id, tId, tLabel)}
                />
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
});

export function AdvancedDisplaySettings() {
  const { toast } = useToast();
  const operation = useSystemOperation();
  const eligibleNavigationIds = eligibleCapabilityIds(operation?.mode ?? 'DEFAULT', operation?.capabilities.navigation ?? navigationItems.map((item) => item.key));
  const displayedNavigationItems = navigationItems.filter((item) => eligibleNavigationIds.includes(item.key));
  const displayedPageTabGroups = pageTabGroups.map((group) => ({
    ...group,
    tabs: group.tabs.filter(([id]) => eligiblePageTabs(operation?.mode ?? 'DEFAULT', group.id, operation?.capabilities.pageTabs[group.id] ?? group.tabs.map(([tabId]) => tabId), group.tabs.map(([tabId]) => tabId)).includes(id)),
  })).filter((group) => group.tabs.length > 0);
  const [preferences, setPreferences] = useState(() => readNavigationPreferences());
  const [tabPreferences, setTabPreferences] = useState(() => readPageTabPreferences());
  const [lastChange, setLastChange] = useState('');
  const [isResetConfirmOpen, setIsResetConfirmOpen] = useState(false);
  const [expandedGroups, setExpandedGroups] = useState<Record<string, boolean>>(() =>
    Object.fromEntries(displayedPageTabGroups.map((g) => [g.id, false]))
  );

  const visibleNavCount = useMemo(() => displayedNavigationItems.filter((item) => preferences[item.key]).length, [displayedNavigationItems, preferences]);

  const { totalTabs, totalVisibleTabs } = useMemo(() => {
    let total = 0;
    let visible = 0;
    for (const group of displayedPageTabGroups) {
      total += group.tabs.length;
      visible += group.tabs.filter(([id]) => tabPreferences[group.id]?.[id] !== false).length;
    }
    return { totalTabs: total, totalVisibleTabs: visible };
  }, [displayedPageTabGroups, tabPreferences]);

  const updateNav = useCallback((key: NavigationPreferenceKey) => {
    const isCurrentlyVisible = preferences[key];
    if (isCurrentlyVisible && visibleNavCount <= 1) {
      toast({
        title: 'Không thể ẩn',
        description: 'Phải giữ lại ít nhất 1 khu vực hiển thị trên thanh menu.',
        variant: 'warning',
      });
      return;
    }

    const nextValue = !isCurrentlyVisible;
    const next = { ...preferences, [key]: nextValue };
    setPreferences(next);
    writeNavigationPreferences(next);
    const itemLabel = navigationItems.find((item) => item.key === key)?.label ?? 'Khu vực';
    setLastChange(`${itemLabel}: ${nextValue ? 'đang hiện' : 'đã ẩn'}.`);
  }, [preferences, visibleNavCount, toast]);

  const updateTab = useCallback((groupId: PageTabGroupId, tabKey: string, tabLabel: string) => {
    const groupDef = pageTabGroups.find((g) => g.id === groupId);
    const currentGroup = tabPreferences[groupId] ?? {};
    const isCurrentlyVisible = currentGroup[tabKey] !== false;

    if (isCurrentlyVisible) {
      const visibleCountInGroup = groupDef
        ? groupDef.tabs.filter(([id]) => currentGroup[id] !== false).length
        : 0;

      if (visibleCountInGroup <= 1) {
        toast({
          title: 'Không thể ẩn',
          description: 'Mỗi trang nghiệp vụ phải giữ lại ít nhất 1 tab hiển thị.',
          variant: 'warning',
        });
        return;
      }
    }

    const nextValue = !isCurrentlyVisible;
    const nextGroup = { ...currentGroup, [tabKey]: nextValue };
    const next = { ...tabPreferences, [groupId]: nextGroup };
    setTabPreferences(next);
    writePageTabPreferences(next);
    const groupLabel = groupDef?.label ?? 'Trang';
    setLastChange(`${groupLabel} — ${tabLabel}: ${nextValue ? 'đang hiện' : 'đã ẩn'}.`);
  }, [tabPreferences, toast]);

  const showAllTabsInGroup = useCallback((groupId: PageTabGroupId) => {
    const group = pageTabGroups.find((g) => g.id === groupId);
    if (!group) return;

    const nextGroup = Object.fromEntries(group.tabs.map(([id]) => [id, true]));
    const next = { ...tabPreferences, [groupId]: nextGroup };
    setTabPreferences(next);
    writePageTabPreferences(next);
    toast({ title: `Đã hiện toàn bộ tab của ${group.label}`, variant: 'success' });
  }, [tabPreferences, toast]);

  const toggleGroupExpand = useCallback((groupId: string) => {
    setExpandedGroups((prev) => ({ ...prev, [groupId]: !prev[groupId] }));
  }, []);

  const toggleAllGroups = useCallback((expand: boolean) => {
    setExpandedGroups(Object.fromEntries(displayedPageTabGroups.map((g) => [g.id, expand])));
  }, [displayedPageTabGroups]);

  const resetAll = useCallback(() => {
    setPreferences({ ...defaultNavigationPreferences });
    resetNavigationPreferences();
    setTabPreferences(structuredClone(defaultPageTabPreferences));
    writePageTabPreferences(defaultPageTabPreferences);
    setLastChange('Đã khôi phục toàn bộ khu vực và tab về mặc định.');
    toast({
      title: 'Đã khôi phục mặc định',
      description: 'Tất cả khu vực menu và tab đã được hiển thị đầy đủ.',
      variant: 'success',
    });
  }, [toast]);

  const allGroupsExpanded = useMemo(
    () => displayedPageTabGroups.every((g) => expandedGroups[g.id]),
    [displayedPageTabGroups, expandedGroups]
  );

  return (
    <div className="space-y-6 [&_.text-slate-400]:text-slate-700! [&_.text-slate-500]:text-slate-700!">
      {/* Top Actions & Summary Bar */}
      <div className="flex flex-wrap items-center justify-between gap-3 rounded-lg border border-slate-200 bg-white p-3.5 shadow-2xs">
        <div className="flex flex-wrap items-center gap-2">
          <StatusBadge variant="neutral">{visibleNavCount}/{displayedNavigationItems.length} menu đang bật</StatusBadge>
          <StatusBadge variant={totalVisibleTabs === totalTabs ? 'neutral' : 'warning'}>
            {totalVisibleTabs}/{totalTabs} tab đang bật
          </StatusBadge>
        </div>

        <Button
          type="button"
          size="sm"
          variant="outline"
          onClick={() => setIsResetConfirmOpen(true)}
          className="gap-1.5 font-medium"
        >
          <RotateCcw size={13} /> Khôi phục mặc định
        </Button>
      </div>

      {lastChange && <p className="sr-only" role="status" aria-live="polite">{lastChange}</p>}

      {/* On-demand Confirmation Dialog (M3.1) */}
      {isResetConfirmOpen && (
        <ConfirmDialog
          open={isResetConfirmOpen}
          onOpenChange={setIsResetConfirmOpen}
          title="Khôi phục thiết lập mặc định?"
          description="Toàn bộ các mục trên menu chính và tất cả tab chức năng sẽ được hiển thị lại đầy đủ."
          confirmLabel="Khôi phục mặc định"
          onConfirm={() => {
            resetAll();
            setIsResetConfirmOpen(false);
          }}
        />
      )}

      {/* Section 1: Main Navigation Sidebar */}
      <SectionPanel
        title="Menu điều hướng chính (Thanh bên trái)"
        icon={<SlidersHorizontal size={18} />}
        description="Bật hoặc tắt các khu vực nghiệp vụ hiển thị trên thanh menu chính bên trái màn hình."
      >
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
          {displayedNavigationItems.map((item) => (
            <NavigationItemCard
              key={item.key}
              item={item}
              visible={preferences[item.key]}
              onToggle={updateNav}
            />
          ))}
        </div>
      </SectionPanel>

      {/* Section 2: Page Tabs */}
      <SectionPanel
        title="Tab chức năng theo từng trang"
        icon={<Layers size={18} />}
        description="Mở từng nhóm trang nghiệp vụ để ẩn/hiện các tab chức năng bên trong."
        badge={
          <div className="flex items-center gap-2">
            <Button
              type="button"
              variant="ghost"
              size="xs"
              onClick={() => toggleAllGroups(!allGroupsExpanded)}
              className="text-xs text-slate-600"
            >
              {allGroupsExpanded ? 'Thu gọn tất cả' : 'Mở rộng tất cả'}
            </Button>
          </div>
        }
      >
        <div className="space-y-3">
          {displayedPageTabGroups.map((group) => (
            <PageTabGroupCard
              key={group.id}
              group={group}
              groupPreferences={tabPreferences[group.id] ?? {}}
              isExpanded={!!expandedGroups[group.id]}
              onToggleExpand={toggleGroupExpand}
              onToggleTab={updateTab}
              onShowAllInGroup={showAllTabsInGroup}
            />
          ))}
        </div>
      </SectionPanel>
    </div>
  );
}
