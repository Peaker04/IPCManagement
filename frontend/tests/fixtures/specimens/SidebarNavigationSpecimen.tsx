import React, { useState, useEffect, useRef, useMemo } from 'react';
import {
  LayoutDashboard,
  Calendar,
  FileText,
  Factory,
  ArrowRightLeft,
  DollarSign,
  Layers,
  Truck,
  Warehouse,
  PackagePlus,
  PackageMinus,
  AlertTriangle,
  BookOpen,
  ShoppingCart,
  ShoppingBag,
  PlusCircle,
  FileSpreadsheet,
  ChefHat,
  Clock,
  FileCheck,
  CheckSquare,
  FileEdit,
  BarChart3,
  TrendingDown,
  PieChart,
  ListOrdered,
  Archive,
  Scale,
  Settings,
  Calculator,
  FileSignature,
  Boxes,
  Users,
  Workflow,
  ChevronDown,
  X,
  ShieldCheck,
  KeyRound,
  PanelLeftClose,
  PanelLeftOpen,
  Sparkles,
  Info,
} from 'lucide-react';

export type NavDisplayMode = 'expanded' | 'rail' | 'drawer';
export type UserRole = 'ADMIN' | 'CHEF' | 'WAREHOUSE' | 'DISPATCHER';

export interface NavLeafItem {
  id: string;
  path: string;
  label: string;
  stressLabel?: string;
  icon: React.ComponentType<{ className?: string; size?: number }>;
  allowedRoles: UserRole[];
  badge?: string | number;
}

export interface NavGroupItem {
  id: string;
  title: string;
  stressTitle?: string;
  icon: React.ComponentType<{ className?: string; size?: number }>;
  children: NavLeafItem[];
}

export type NavHierarchyItem =
  | { type: 'standalone'; item: NavLeafItem }
  | { type: 'group'; group: NavGroupItem };

export const CANONICAL_HIERARCHY: NavHierarchyItem[] = [
  // Standalone L1: Bàn điều hành hôm nay
  {
    type: 'standalone',
    item: {
      id: 'dashboard',
      path: '/dashboard',
      label: 'Bàn điều hành hôm nay',
      stressLabel: 'Bàn điều hành tổng quan chỉ số vận hành hôm nay',
      icon: LayoutDashboard,
      allowedRoles: ['ADMIN', 'CHEF', 'WAREHOUSE', 'DISPATCHER'],
    },
  },

  // 1. Kế hoạch & Điều phối (7 children)
  {
    type: 'group',
    group: {
      id: 'planning',
      title: 'Kế hoạch & Điều phối',
      stressTitle: 'Kế hoạch sản xuất & Điều phối tổng thể',
      icon: Calendar,
      children: [
        {
          id: 'weekly-menu',
          path: '/planning/weekly-menu',
          label: 'Kế hoạch tuần',
          stressLabel: 'Kế hoạch thực đơn & cơ cấu suất ăn theo tuần',
          icon: Calendar,
          allowedRoles: ['ADMIN', 'DISPATCHER', 'CHEF'],
        },
        {
          id: 'material-demand',
          path: '/planning/material-demand',
          label: 'Nhu cầu nguyên liệu',
          stressLabel: 'Nhu cầu nguyên vật liệu tính toán tự động theo BOM',
          icon: FileText,
          allowedRoles: ['ADMIN', 'DISPATCHER', 'CHEF'],
        },
        {
          id: 'production-plans',
          path: '/planning/production-plans',
          label: 'Kế hoạch sản xuất',
          stressLabel: 'Kế hoạch sản xuất ca nấu chính theo định mức',
          icon: Factory,
          allowedRoles: ['ADMIN', 'DISPATCHER', 'CHEF'],
        },
        {
          id: 'weekly-handover',
          path: '/planning/weekly-handover',
          label: 'Bàn giao tuần',
          stressLabel: 'Tổng hợp bàn giao nguyên liệu tuần cho bếp',
          icon: ArrowRightLeft,
          allowedRoles: ['ADMIN', 'DISPATCHER'],
        },
        {
          id: 'food-cost',
          path: '/planning/food-cost',
          label: 'Giá vốn tuần',
          stressLabel: 'Đối soát & kiểm tra giá vốn định mức tuần',
          icon: DollarSign,
          allowedRoles: ['ADMIN', 'DISPATCHER'],
        },
        {
          id: 'dish-bom',
          path: '/planning/dish-bom',
          label: 'Định mức theo món',
          stressLabel: 'Định mức kỹ thuật khay ăn & tiêu hao theo món',
          icon: Layers,
          allowedRoles: ['ADMIN', 'DISPATCHER', 'CHEF'],
        },
        {
          id: 'meal-orders',
          path: '/coordination/meal-orders',
          label: 'Điều phối suất ăn',
          stressLabel: 'Điều phối số lượng suất ăn theo hợp đồng đối tác',
          icon: Truck,
          allowedRoles: ['ADMIN', 'DISPATCHER'],
        },
      ],
    },
  },

  // 2. Kho nguyên liệu (4 children)
  {
    type: 'group',
    group: {
      id: 'warehouse',
      title: 'Kho nguyên liệu',
      stressTitle: 'Kho nguyên vật liệu & Luân chuyển hàng',
      icon: Warehouse,
      children: [
        {
          id: 'warehouse-receiving',
          path: '/warehouse/receiving',
          label: 'Nhập kho NCC',
          stressLabel: 'Nhập kho nguyên liệu từ nhà cung cấp theo đơn',
          icon: PackagePlus,
          allowedRoles: ['ADMIN', 'WAREHOUSE'],
        },
        {
          id: 'warehouse-issuing',
          path: '/warehouse/issuing',
          label: 'Xuất kho sản xuất',
          stressLabel: 'Xuất kho nguyên liệu phục vụ ca chế biến của bếp',
          icon: PackageMinus,
          allowedRoles: ['ADMIN', 'WAREHOUSE'],
        },
        {
          id: 'warehouse-exceptions',
          path: '/warehouse/exceptions',
          label: 'Xử lý ngoại lệ',
          stressLabel: 'Xử lý ngoại lệ chênh lệch, hao hụt & hàng lỗi hỏng',
          icon: AlertTriangle,
          allowedRoles: ['ADMIN', 'WAREHOUSE'],
          badge: 3,
        },
        {
          id: 'warehouse-ledger',
          path: '/warehouse/stock-ledger',
          label: 'Tra cứu & Sổ kho',
          stressLabel: 'Tra cứu thẻ kho, tồn kho khả dụng & sổ nhật ký',
          icon: BookOpen,
          allowedRoles: ['ADMIN', 'WAREHOUSE'],
        },
      ],
    },
  },

  // 3. Thu mua vật tư (3 children)
  {
    type: 'group',
    group: {
      id: 'purchasing',
      title: 'Thu mua vật tư',
      stressTitle: 'Thu mua vật tư & Cung ứng định kỳ',
      icon: ShoppingCart,
      children: [
        {
          id: 'routine-purchasing',
          path: '/purchasing/routine-orders',
          label: 'Đơn mua định kỳ',
          stressLabel: 'Đơn đặt hàng mua vật tư định kỳ theo lịch trình',
          icon: ShoppingBag,
          allowedRoles: ['ADMIN', 'WAREHOUSE'],
        },
        {
          id: 'supplemental-purchasing',
          path: '/purchasing/supplemental',
          label: 'Mua hàng bổ sung',
          stressLabel: 'Mua hàng bổ sung khẩn cấp theo yêu cầu ca nấu',
          icon: PlusCircle,
          allowedRoles: ['ADMIN', 'WAREHOUSE'],
        },
        {
          id: 'supplier-quotes',
          path: '/purchasing/supplier-quotes',
          label: 'Báo giá nhà cung cấp',
          stressLabel: 'Quản lý bảng báo giá & so sánh giá nhà cung cấp',
          icon: FileSpreadsheet,
          allowedRoles: ['ADMIN'],
        },
      ],
    },
  },

  // 4. Bếp & Chế biến (2 children)
  {
    type: 'group',
    group: {
      id: 'kitchen',
      title: 'Bếp & Chế biến',
      stressTitle: 'Bếp & Quy trình chế biến công nghiệp',
      icon: ChefHat,
      children: [
        {
          id: 'production-shifts',
          path: '/chef/production-shifts',
          label: 'Ca sản xuất',
          stressLabel: 'Điều hành ca nấu, chia suất & bàn giao khay ăn',
          icon: Clock,
          allowedRoles: ['ADMIN', 'CHEF'],
        },
        {
          id: 'handover-documents',
          path: '/chef/handover-documents',
          label: 'Chứng từ bàn giao',
          stressLabel: 'Biên bản nhận nguyên liệu & trả lại kho cuối ca',
          icon: FileCheck,
          allowedRoles: ['ADMIN', 'CHEF'],
        },
      ],
    },
  },

  // 5. Duyệt vận hành (2 children)
  {
    type: 'group',
    group: {
      id: 'approvals',
      title: 'Duyệt vận hành',
      stressTitle: 'Duyệt vận hành & Phê duyệt biến động',
      icon: CheckSquare,
      children: [
        {
          id: 'approval-documents',
          path: '/approvals/documents',
          label: 'Duyệt chứng từ',
          stressLabel: 'Hàng đợi phê duyệt chứng từ nhập xuất kho & mua hàng',
          icon: CheckSquare,
          allowedRoles: ['ADMIN', 'CHEF', 'DISPATCHER'],
          badge: 5,
        },
        {
          id: 'approval-menu-amendments',
          path: '/approvals/menu-amendments',
          label: 'Duyệt điều chỉnh thực đơn',
          stressLabel: 'Duyệt đề xuất thay đổi món ăn & bù trừ chi phí',
          icon: FileEdit,
          allowedRoles: ['ADMIN', 'CHEF', 'DISPATCHER'],
        },
      ],
    },
  },

  // 6. Báo cáo vận hành (5 children)
  {
    type: 'group',
    group: {
      id: 'reports',
      title: 'Báo cáo vận hành',
      stressTitle: 'Báo cáo số liệu vận hành & Phân tích chi phí',
      icon: BarChart3,
      children: [
        {
          id: 'report-price-variance',
          path: '/reports/price-variance',
          label: 'Biến động giá',
          stressLabel: 'Báo cáo phân tích biến động giá nguyên vật liệu',
          icon: TrendingDown,
          allowedRoles: ['ADMIN', 'DISPATCHER'],
        },
        {
          id: 'report-material-demand',
          path: '/reports/material-demand',
          label: 'Nhu cầu vật tư',
          stressLabel: 'Báo cáo tổng hợp nhu cầu vật tư qua các chu kỳ',
          icon: PieChart,
          allowedRoles: ['ADMIN', 'DISPATCHER'],
        },
        {
          id: 'report-procurement',
          path: '/reports/procurement-progress',
          label: 'Tiến độ mua sắm',
          stressLabel: 'Báo cáo tiến độ giao hàng & tỷ lệ đáp ứng của NCC',
          icon: ListOrdered,
          allowedRoles: ['ADMIN', 'DISPATCHER'],
        },
        {
          id: 'report-stock-movements',
          path: '/reports/inventory-movements',
          label: 'Tồn kho & Luân chuyển',
          stressLabel: 'Báo cáo xuất nhập tồn & tốc độ quay vòng kho',
          icon: Archive,
          allowedRoles: ['ADMIN', 'DISPATCHER', 'WAREHOUSE'],
        },
        {
          id: 'report-consumption',
          path: '/reports/consumption-variance',
          label: 'Tiêu hao thực tế',
          stressLabel: 'So sánh tiêu hao thực tế so với định mức BOM',
          icon: Scale,
          allowedRoles: ['ADMIN', 'DISPATCHER', 'CHEF'],
        },
      ],
    },
  },

  // 7. Quản trị hệ thống (5 children)
  {
    type: 'group',
    group: {
      id: 'admin',
      title: 'Quản trị hệ thống',
      stressTitle: 'Quản trị cấu hình, dữ liệu nguồn & phân quyền',
      icon: Settings,
      children: [
        {
          id: 'admin-bom',
          path: '/admin/bom-pricing',
          label: 'BOM & Định mức giá',
          stressLabel: 'Công thức BOM tiêu chuẩn & bảng giá tham chiếu',
          icon: Calculator,
          allowedRoles: ['ADMIN'],
        },
        {
          id: 'admin-contracts',
          path: '/admin/customer-contracts',
          label: 'Hợp đồng khách hàng',
          stressLabel: 'Hồ sơ hợp đồng cung cấp suất ăn & đơn giá',
          icon: FileSignature,
          allowedRoles: ['ADMIN'],
        },
        {
          id: 'admin-inventory-master',
          path: '/admin/inventory-admin',
          label: 'Quản trị tồn kho',
          stressLabel: 'Cấu hình kho bãi, nhóm vật tư & hạn mức an toàn',
          icon: Boxes,
          allowedRoles: ['ADMIN'],
        },
        {
          id: 'admin-rbac',
          path: '/admin/rbac-users',
          label: 'Nhân viên & Phân quyền',
          stressLabel: 'Danh sách tài khoản, vai trò & phân quyền truy cập',
          icon: Users,
          allowedRoles: ['ADMIN'],
        },
        {
          id: 'admin-workflows',
          path: '/admin/approval-workflows',
          label: 'Quy trình phê duyệt',
          stressLabel: 'Quy tắc định tuyến phê duyệt chứng từ tự động',
          icon: Workflow,
          allowedRoles: ['ADMIN'],
        },
      ],
    },
  },

  // DEMO GROUP: Single-child Auto-promotion demonstration
  {
    type: 'group',
    group: {
      id: 'shift-utilities',
      title: 'Tiện ích trực ca',
      stressTitle: 'Tiện ích ghi nhận thông số trực ca',
      icon: Sparkles,
      children: [
        {
          id: 'shift-notes',
          path: '/utilities/shift-notes',
          label: 'Ghi chú ca nấu',
          stressLabel: 'Sổ ghi chú nhanh tình hình bàn giao ca nấu',
          icon: Sparkles,
          allowedRoles: ['CHEF', 'DISPATCHER', 'ADMIN'],
        },
      ],
    },
  },
];

export interface ProcessedHierarchyNode {
  type: 'l1-link' | 'disclosure-group';
  id: string;
  label: string;
  path?: string;
  icon: React.ComponentType<{ className?: string; size?: number }>;
  badge?: string | number;
  isAutoPromoted?: boolean;
  children?: NavLeafItem[];
}

export function resolveHierarchy(
  hierarchy: NavHierarchyItem[],
  role: UserRole,
  isStressTest: boolean
): ProcessedHierarchyNode[] {
  const result: ProcessedHierarchyNode[] = [];

  for (const entry of hierarchy) {
    if (entry.type === 'standalone') {
      if (entry.item.allowedRoles.includes(role)) {
        result.push({
          type: 'l1-link',
          id: entry.item.id,
          label: isStressTest && entry.item.stressLabel ? entry.item.stressLabel : entry.item.label,
          path: entry.item.path,
          icon: entry.item.icon,
          badge: entry.item.badge,
        });
      }
    } else {
      const accessibleChildren = entry.group.children.filter((child) =>
        child.allowedRoles.includes(role)
      );

      if (accessibleChildren.length === 0) {
        continue;
      }

      if (accessibleChildren.length === 1) {
        const onlyChild = accessibleChildren[0];
        result.push({
          type: 'l1-link',
          id: `promoted-${entry.group.id}`,
          label: isStressTest && onlyChild.stressLabel ? onlyChild.stressLabel : `${entry.group.title}: ${onlyChild.label}`,
          path: onlyChild.path,
          icon: entry.group.icon,
          badge: onlyChild.badge,
          isAutoPromoted: true,
        });
      } else {
        result.push({
          type: 'disclosure-group',
          id: entry.group.id,
          label: isStressTest && entry.group.stressTitle ? entry.group.stressTitle : entry.group.title,
          icon: entry.group.icon,
          children: accessibleChildren,
        });
      }
    }
  }

  return result;
}

export function SidebarNavigationSpecimen() {
  const [mode, setMode] = useState<NavDisplayMode>('expanded');
  const [role, setRole] = useState<UserRole>('ADMIN');
  const [activePath, setActivePath] = useState<string>('/planning/weekly-menu');
  const [isStressTest, setIsStressTest] = useState<boolean>(false);
  const [expandedGroups, setExpandedGroups] = useState<Set<string>>(() => new Set(['planning']));
  const [activeFlyoutGroupId, setActiveFlyoutGroupId] = useState<string | null>(null);
  const [isDrawerOpen, setIsDrawerOpen] = useState<boolean>(false);

  const drawerTriggerRef = useRef<HTMLButtonElement | null>(null);
  const drawerContainerRef = useRef<HTMLDivElement | null>(null);
  const drawerCloseBtnRef = useRef<HTMLButtonElement | null>(null);

  const resolvedNodes = useMemo(
    () => resolveHierarchy(CANONICAL_HIERARCHY, role, isStressTest),
    [role, isStressTest]
  );

  useEffect(() => {
    for (const node of resolvedNodes) {
      if (node.type === 'disclosure-group' && node.children) {
        const containsActive = node.children.some((child) => child.path === activePath);
        if (containsActive) {
          setExpandedGroups((prev) => {
            const next = new Set(prev);
            next.add(node.id);
            return next;
          });
        }
      }
    }
  }, [activePath, resolvedNodes]);

  const closeDrawer = () => {
    setIsDrawerOpen(false);
    drawerTriggerRef.current?.focus();
  };

  // Accessible Focus Trap & Escape key for Modal Drawer
  useEffect(() => {
    if (!isDrawerOpen) return;

    // Initial focus enters drawer
    const focusTimer = setTimeout(() => {
      drawerCloseBtnRef.current?.focus();
    }, 30);

    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        e.preventDefault();
        closeDrawer();
        return;
      }

      if (e.key === 'Tab') {
        if (!drawerContainerRef.current) return;
        const focusables = drawerContainerRef.current.querySelectorAll<HTMLElement>(
          'button, [href], input, select, textarea, [tabindex]:not([tabindex="-1"])'
        );
        if (focusables.length === 0) return;
        const first = focusables[0];
        const last = focusables[focusables.length - 1];

        if (e.shiftKey) {
          if (document.activeElement === first) {
            e.preventDefault();
            last.focus();
          }
        } else {
          if (document.activeElement === last) {
            e.preventDefault();
            first.focus();
          }
        }
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => {
      clearTimeout(focusTimer);
      window.removeEventListener('keydown', handleKeyDown);
    };
  }, [isDrawerOpen]);

  const toggleGroup = (groupId: string) => {
    setExpandedGroups((prev) => {
      const next = new Set(prev);
      if (next.has(groupId)) {
        next.delete(groupId);
      } else {
        next.add(groupId);
      }
      return next;
    });
  };

  const renderNavList = (isInsideDrawer = false) => (
    <nav
      aria-label="Điều hướng chính IPCManagement"
      className="flex-1 overflow-y-auto px-2 py-3 space-y-1 text-slate-700 select-none"
    >
      <ul role="list" className="space-y-1">
        {resolvedNodes.map((node) => {
          if (node.type === 'l1-link') {
            const isActive = activePath === node.path;
            const Icon = node.icon;
            return (
              <li key={node.id}>
                <a
                  href={node.path}
                  onClick={(e) => {
                    e.preventDefault();
                    if (node.path) setActivePath(node.path);
                    if (isInsideDrawer) setIsDrawerOpen(false);
                  }}
                  aria-current={isActive ? 'page' : undefined}
                  title={node.label}
                  className={`
                    relative group flex items-center gap-3 px-3 py-2 rounded-[3px] text-xs font-medium transition-colors
                    focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#2d7acf] focus-visible:ring-offset-1
                    ${
                      isActive
                        ? 'bg-[#f0f5fc] text-[#164e87] font-semibold before:absolute before:left-0 before:top-1.5 before:bottom-1.5 before:w-[3px] before:bg-[#164e87] before:rounded-r'
                        : 'text-slate-700 hover:bg-slate-100 hover:text-slate-900'
                    }
                  `}
                >
                  <Icon
                    size={18}
                    className={`shrink-0 ${isActive ? 'text-[#164e87]' : 'text-slate-500 group-hover:text-slate-700'}`}
                  />
                  <span className="min-w-0 flex-1 truncate">
                    {node.label}
                  </span>
                  {node.isAutoPromoted && (
                    <span
                      title="Tự động nâng cấp thành L1 do chỉ có 1 con"
                      className="shrink-0 text-xs font-semibold px-1.5 py-0.2 rounded bg-blue-50 text-blue-700 border border-blue-200"
                    >
                      L1
                    </span>
                  )}
                  {node.badge !== undefined && (
                    <span className="shrink-0 ml-auto px-1.5 py-0.2 text-xs font-bold rounded bg-amber-100 text-amber-900 border border-amber-300">
                      {node.badge}
                    </span>
                  )}
                </a>
              </li>
            );
          }

          const isExpanded = expandedGroups.has(node.id);
          const hasActiveChild =
            node.children?.some((child) => child.path === activePath) ?? false;
          const isAncestorActive = !isExpanded && hasActiveChild;
          const GroupIcon = node.icon;
          const listId = `subnav-list-${node.id}`;

          return (
            <li key={node.id} className="space-y-0.5">
              <button
                type="button"
                aria-expanded={isExpanded}
                aria-controls={listId}
                onClick={() => toggleGroup(node.id)}
                className={`
                  relative w-full flex items-center gap-3 px-3 py-2 rounded-[3px] text-xs font-medium text-left transition-colors cursor-pointer
                  focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#2d7acf] focus-visible:ring-offset-1
                  ${
                    isAncestorActive
                      ? 'bg-slate-50 text-[#164e87] font-semibold'
                      : 'text-slate-700 hover:bg-slate-100 hover:text-slate-900'
                  }
                `}
              >
                {isAncestorActive && (
                  <span
                    title="Phân hệ đang chứa trang active"
                    className="absolute left-1 top-1/2 -translate-y-1/2 w-1.5 h-1.5 rounded-full bg-[#164e87]"
                  />
                )}
                <GroupIcon
                  size={18}
                  className={`shrink-0 ${
                    hasActiveChild ? 'text-[#164e87]' : 'text-slate-500'
                  }`}
                />
                <span className="min-w-0 flex-1 truncate">
                  {node.label}
                </span>

                {isAncestorActive && (
                  <span className="shrink-0 text-xs font-semibold px-1 py-0.2 bg-blue-100 text-blue-800 rounded">
                    Active
                  </span>
                )}

                <ChevronDown
                  size={16}
                  className={`shrink-0 text-slate-400 transition-transform duration-200 ${
                    isExpanded ? 'rotate-180 text-slate-600' : ''
                  }`}
                />
              </button>

              {isExpanded && node.children && (
                <ul
                  id={listId}
                  role="list"
                  className="pl-6 pr-1 py-0.5 space-y-0.5 border-l border-slate-200 ml-5"
                >
                  {node.children.map((child) => {
                    const isChildActive = activePath === child.path;
                    const ChildIcon = child.icon;
                    const displayLabel =
                      isStressTest && child.stressLabel ? child.stressLabel : child.label;

                    return (
                      <li key={child.id}>
                        <a
                          href={child.path}
                          onClick={(e) => {
                            e.preventDefault();
                            setActivePath(child.path);
                            if (isInsideDrawer) setIsDrawerOpen(false);
                          }}
                          aria-current={isChildActive ? 'page' : undefined}
                          title={displayLabel}
                          className={`
                            relative group flex items-center gap-2 px-2.5 py-1.5 rounded-[3px] text-xs transition-colors
                            focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#2d7acf] focus-visible:ring-offset-1
                            ${
                              isChildActive
                                ? 'bg-[#f0f5fc] text-[#164e87] font-semibold before:absolute before:left-[-1px] before:top-1 before:bottom-1 before:w-[3px] before:bg-[#164e87] before:rounded-r'
                                : 'text-slate-600 hover:bg-slate-100 hover:text-slate-900'
                            }
                          `}
                        >
                          <ChildIcon
                            size={14}
                            className={`shrink-0 ${
                              isChildActive ? 'text-[#164e87]' : 'text-slate-400 group-hover:text-slate-600'
                            }`}
                          />
                          <span className="min-w-0 flex-1 truncate">
                            {displayLabel}
                          </span>
                          {child.badge !== undefined && (
                            <span className="shrink-0 ml-auto px-1.5 py-0.2 text-xs font-bold rounded bg-amber-100 text-amber-900 border border-amber-300">
                              {child.badge}
                            </span>
                          )}
                        </a>
                      </li>
                    );
                  })}
                </ul>
              )}
            </li>
          );
        })}
      </ul>
    </nav>
  );

  return (
    <div
      data-testid="sidebar-navigation-specimen-root"
      className="flex flex-col h-[650px] bg-slate-50 border border-slate-200 rounded-[3px] overflow-hidden"
    >
      {/* Control Toolbar */}
      <header className="bg-white border-b border-slate-200 px-4 py-2.5 flex flex-wrap items-center justify-between gap-3 text-xs">
        <div className="flex items-center gap-2">
          <span className="font-bold text-slate-900">Mẫu phẩm Sidebar Navigation</span>
          <span className="px-2 py-0.5 rounded bg-blue-50 text-blue-800 font-mono text-xs">
            Shallow Hierarchy (&le; 2 Levels)
          </span>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          {/* Mode Switcher */}
          <div className="flex items-center bg-slate-100 rounded p-0.5 border border-slate-200">
            <button
              type="button"
              onClick={() => {
                setMode('expanded');
                setIsDrawerOpen(false);
              }}
              className={`px-2 py-1 rounded font-medium ${mode === 'expanded' && !isDrawerOpen ? 'bg-white text-blue-900 font-semibold' : 'text-slate-600'}`}
            >
              Expanded (~272px)
            </button>
            <button
              type="button"
              onClick={() => {
                setMode('rail');
                setIsDrawerOpen(false);
              }}
              className={`px-2 py-1 rounded font-medium ${mode === 'rail' && !isDrawerOpen ? 'bg-white text-blue-900 font-semibold' : 'text-slate-600'}`}
            >
              Icon Rail (~60px)
            </button>
            {mode === 'rail' && (
              <button
                type="button"
                data-testid="toggle-rail-flyout"
                onClick={() => setActiveFlyoutGroupId((prev) => (prev ? null : 'planning'))}
                className="px-2 py-1 rounded border border-blue-300 bg-blue-50 text-blue-800 text-xs font-semibold cursor-pointer"
              >
                {activeFlyoutGroupId ? 'Đóng Flyout' : 'Mở Flyout Kế hoạch'}
              </button>
            )}
            <button
              type="button"
              ref={drawerTriggerRef}
              onClick={() => setIsDrawerOpen(true)}
              className={`px-2 py-1 rounded font-medium ${isDrawerOpen ? 'bg-white text-blue-900 font-semibold' : 'text-slate-600'}`}
            >
              Drawer (Mobile)
            </button>
          </div>

          {/* Role selector */}
          <div className="flex items-center gap-1 pl-2 border-l border-slate-200">
            <KeyRound size={13} className="text-slate-500" />
            <select
              value={role}
              onChange={(e) => setRole(e.target.value as UserRole)}
              className="bg-white border border-slate-300 rounded px-1.5 py-0.5 text-xs text-slate-800"
            >
              <option value="ADMIN">Admin (Toàn quyền)</option>
              <option value="CHEF">Bếp trưởng</option>
              <option value="WAREHOUSE">Thủ kho</option>
              <option value="DISPATCHER">Điều phối</option>
            </select>
          </div>

          {/* Stress toggle */}
          <button
            type="button"
            onClick={() => setIsStressTest((v) => !v)}
            className={`px-2 py-1 rounded border text-xs font-medium ${isStressTest ? 'bg-amber-100 border-amber-300 text-amber-900 font-bold' : 'bg-white border-slate-300 text-slate-700'}`}
          >
            {isStressTest ? '✓ Nhãn dài (Stress)' : 'Nhãn chuẩn'}
          </button>
        </div>
      </header>

      {/* Main Workspace Frame */}
      <div className="flex-1 flex overflow-hidden relative">
        {/* Render Sidebar or Rail */}
        {mode === 'rail' ? (
          <div className="w-[60px] shrink-0 bg-white border-r border-slate-200 flex flex-col items-center py-3 select-none">
            <div className="w-8 h-8 rounded bg-[#164e87] text-white flex items-center justify-center mb-3">
              <ChefHat size={18} />
            </div>
            <nav aria-label="Icon Rail" className="flex-1 w-full space-y-1.5 px-1">
              {resolvedNodes.map((node) => {
                const Icon = node.icon;
                const isActive = node.type === 'l1-link' && activePath === node.path;
                return (
                  <div key={node.id} className="relative flex justify-center">
                    <button
                      type="button"
                      title={node.label}
                      onClick={() => {
                        if (node.type === 'l1-link' && node.path) {
                          setActivePath(node.path);
                          setActiveFlyoutGroupId(null);
                        } else {
                          setActiveFlyoutGroupId((prev) => (prev === node.id ? null : node.id));
                        }
                      }}
                      className={`w-9 h-9 rounded flex items-center justify-center ${
                        isActive ? 'bg-[#f0f5fc] text-[#164e87]' : 'text-slate-600 hover:bg-slate-100'
                      }`}
                    >
                      <Icon size={18} />
                    </button>
                    {/* Flyout for group */}
                    {activeFlyoutGroupId === node.id && node.children && (
                      <div
                        data-testid="rail-flyout-container"
                        className="absolute left-[54px] top-0 z-50 w-64 bg-white rounded-[3px] border border-slate-300 p-2.5 shadow-xl"
                      >
                        <div className="flex items-center justify-between pb-1.5 border-b border-slate-100 text-xs font-bold text-slate-800">
                          <span>{node.label}</span>
                          <button
                            type="button"
                            aria-label="Đóng flyout"
                            onClick={() => setActiveFlyoutGroupId(null)}
                            className="p-0.5 rounded text-slate-400 hover:text-slate-700 hover:bg-slate-100"
                          >
                            <X size={13} />
                          </button>
                        </div>
                        <ul className="space-y-1 mt-1 text-xs">
                          {node.children.map((c) => (
                            <li key={c.id}>
                              <button
                                type="button"
                                onClick={() => {
                                  setActivePath(c.path);
                                  setActiveFlyoutGroupId(null);
                                }}
                                className={`w-full text-left px-2 py-1 rounded truncate transition-colors ${
                                  activePath === c.path
                                    ? 'bg-blue-50 text-[#164e87] font-semibold'
                                    : 'text-slate-600 hover:bg-slate-50'
                                }`}
                              >
                                {c.label}
                              </button>
                            </li>
                          ))}
                        </ul>
                      </div>
                    )}
                  </div>
                );
              })}
            </nav>
            <button
              type="button"
              onClick={() => setMode('expanded')}
              className="p-1.5 rounded text-slate-400 hover:bg-slate-100"
              title="Mở rộng"
            >
              <PanelLeftOpen size={16} />
            </button>
          </div>
        ) : (
          <aside className="w-[272px] shrink-0 bg-white border-r border-slate-200 flex flex-col h-full select-none">
            <div className="h-12 px-3.5 border-b border-slate-200 flex items-center justify-between">
              <div className="flex items-center gap-2">
                <div className="w-7 h-7 rounded bg-[#164e87] text-white flex items-center justify-center">
                  <ChefHat size={16} />
                </div>
                <span className="font-bold text-xs text-slate-900">IPC System</span>
              </div>
              <button
                type="button"
                onClick={() => setMode('rail')}
                className="p-1 rounded text-slate-400 hover:bg-slate-100"
                title="Thu gọn thành rail"
              >
                <PanelLeftClose size={15} />
              </button>
            </div>
            {renderNavList(false)}
            <div className="p-2.5 border-t border-slate-200 bg-slate-50 text-xs text-slate-600 flex items-center gap-2">
              <div className="w-6 h-6 rounded-full bg-[#164e87] text-white font-bold flex items-center justify-center text-xs">
                {role.charAt(0)}
              </div>
              <span className="truncate font-medium">{role} Role Session</span>
            </div>
          </aside>
        )}

        {/* Content Viewer */}
        <main className="flex-1 p-5 overflow-y-auto bg-slate-50">
          <div className="bg-white rounded border border-slate-200 p-4 space-y-3">
            <div className="flex items-center justify-between border-b border-slate-100 pb-2">
              <span className="text-xs text-slate-500 font-medium">Tuyến đường đang chọn:</span>
              <span className="text-xs font-mono font-semibold text-blue-900 bg-blue-50 px-2 py-0.5 rounded border border-blue-200">
                {activePath}
              </span>
            </div>
            <p className="text-xs text-slate-600">
              Kiểm chứng bất biến: 6 views của Thực đơn tuần đã được phẳng hóa thành các workspace độc lập dưới nhóm <code>Kế hoạch &amp; Điều phối</code>.
              Nhóm chỉ có 1 con (Tiện ích trực ca) tự động nâng cấp thành L1 trực tiếp. Nhóm không có con tự biến mất khỏi DOM.
            </p>
          </div>
        </main>

        {/* Mobile Drawer */}
        {isDrawerOpen && (
          <div
            role="dialog"
            aria-modal="true"
            aria-label="IPC System Drawer"
            className="fixed inset-0 z-50 flex"
          >
            <div
              onClick={closeDrawer}
              className="fixed inset-0 bg-slate-900/50 backdrop-blur-xs"
              aria-hidden="true"
            />
            <div
              ref={drawerContainerRef}
              className="relative w-[272px] bg-white h-full shadow-2xl flex flex-col z-10"
            >
              <div className="h-12 px-4 border-b border-slate-200 flex items-center justify-between">
                <span className="font-bold text-xs text-slate-900">IPC System Drawer</span>
                <button
                  type="button"
                  ref={drawerCloseBtnRef}
                  aria-label="Đóng ngăn kéo"
                  data-testid="drawer-close-btn"
                  onClick={closeDrawer}
                  className="p-1 rounded text-slate-500 hover:text-slate-800 hover:bg-slate-100"
                >
                  <X size={16} />
                </button>
              </div>
              {renderNavList(true)}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

export default SidebarNavigationSpecimen;
