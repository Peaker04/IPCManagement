/**
 * ViewSwitcher — Shared tab-switcher component
 *
 * Replaces the duplicated ipc-view-switcher markup that was
 * copy-pasted across 6+ pages (Warehouse, Purchasing, Approval,
 * AdminData, WeeklyMenu, ChefDashboard).
 */

import { cn } from '@/lib/utils'
import { useRef, type KeyboardEvent } from 'react'

export interface ViewTab {
  /** Unique tab identifier (e.g. "warehouse-movement") */
  id: string
  /** Display label (e.g. "Luân chuyển") */
  label: string; uiOwnership?: import('./OperationalFrame').UiOwnershipMarker
}

export interface ViewSwitcherProps {
  tabs: ViewTab[]
  activeTab: string
  onTabChange: (tabId: string) => void
  /** Use compact variant (smaller padding, for inline contexts) */
  compact?: boolean
  /** Accessible label for the tablist */
  ariaLabel: string; uiOwnership?: import('./OperationalFrame').UiOwnershipMarker
  /** Announces and visually stabilizes a deferred/loading view transition. */
  isPending?: boolean
}

export function ViewSwitcher({
  tabs,
  activeTab,
  onTabChange,
  compact = false,
  ariaLabel, uiOwnership,
  isPending = false,
}: ViewSwitcherProps) {
  const tabRefs = useRef<Array<HTMLButtonElement | null>>([])
  const ownershipFor = (tab: ViewTab) => tab.uiOwnership ?? uiOwnership ?? viewOwnershipBindings[`${ariaLabel}\0${tab.id}`]; const activeOwnership = ownershipFor(tabs.find((tab) => tab.id === activeTab) ?? tabs[0])
  const moveFocus = (index: number) => {
    const targetTab = tabs[index]
    const targetButton = tabRefs.current[index]
    if (!targetTab || !targetButton) return

    targetButton.focus({ preventScroll: true })

    const tabList = targetButton.parentElement
    if (tabList) {
      const tabRect = targetButton.getBoundingClientRect()
      const listRect = tabList.getBoundingClientRect()
      if (tabRect.left < listRect.left) tabList.scrollLeft -= listRect.left - tabRect.left
      if (tabRect.right > listRect.right) tabList.scrollLeft += tabRect.right - listRect.right
    }

    if (targetTab.id !== activeTab) onTabChange(targetTab.id)
  }

  const handleKeyDown = (event: KeyboardEvent<HTMLButtonElement>, index: number) => {
    let targetIndex: number | undefined
    if (event.key === 'ArrowRight') targetIndex = (index + 1) % tabs.length
    if (event.key === 'ArrowLeft') targetIndex = (index - 1 + tabs.length) % tabs.length
    if (event.key === 'Home') targetIndex = 0
    if (event.key === 'End') targetIndex = tabs.length - 1
    if (targetIndex === undefined) return

    event.preventDefault()
    moveFocus(targetIndex)
  }

  return (
    <div
      className={cn('ipc-view-switcher', compact && 'is-compact', isPending && 'is-pending')}
      role="tablist"
      aria-label={ariaLabel}
      aria-busy={isPending}
      aria-orientation="horizontal" data-ui-owner={activeOwnership?.ownerId} data-ui-floorplan={activeOwnership?.floorplanId} data-ui-region={activeOwnership?.regionId}
    >
      {tabs.map((tab, index) => (
        <button
          ref={(node) => { tabRefs.current[index] = node }}
          key={tab.id}
          id={`${tab.id}-tab`}
          type="button"
          role="tab"
          aria-selected={activeTab === tab.id}
          aria-controls={`${tab.id}-panel`}
          tabIndex={activeTab === tab.id ? 0 : -1}
          className={cn('ipc-view-tab', activeTab === tab.id && 'is-active')}
          onClick={() => {
            if (tab.id !== activeTab) onTabChange(tab.id)
          }}
          onKeyDown={(event) => handleKeyDown(event, index)}
          data-ui-owner={ownershipFor(tab)?.ownerId}
          data-ui-floorplan={ownershipFor(tab)?.floorplanId}
          data-ui-region={ownershipFor(tab)?.regionId}
        >
          {tab.label}
        </button>
      ))}
    </div>
  )
}

const viewOwnershipBindings: Record<string, import('./OperationalFrame').UiOwnershipMarker> = {
  'Chọn góc nhìn quản trị dữ liệu\0admin-audit': { ownerId: 'uio-1', floorplanId: 'uif-1', regionId: 'uir-1' },
  'Chọn góc nhìn quản trị dữ liệu\0admin-bom-import': { ownerId: 'uio-2', floorplanId: 'uif-2', regionId: 'uir-2' },
  'Chọn góc nhìn quản trị dữ liệu\0admin-cleanup': { ownerId: 'uio-3', floorplanId: 'uif-3', regionId: 'uir-3' },
  'Chọn góc nhìn quản trị dữ liệu\0admin-contracts': { ownerId: 'uio-4', floorplanId: 'uif-4', regionId: 'uir-4' },
  'Chọn góc nhìn quản trị dữ liệu\0admin-employees': { ownerId: 'uio-5', floorplanId: 'uif-5', regionId: 'uir-5' },
  'Chọn góc nhìn quản trị dữ liệu\0admin-inventory': { ownerId: 'uio-6', floorplanId: 'uif-6', regionId: 'uir-6' },
  'Chọn góc nhìn quản trị dữ liệu\0admin-statistics': { ownerId: 'uio-7', floorplanId: 'uif-7', regionId: 'uir-7' },
  'Chọn góc nhìn duyệt vận hành\0approval-history': { ownerId: 'uio-b', floorplanId: 'uif-b', regionId: 'uir-b' },
  'Chọn góc nhìn duyệt vận hành\0approval-queue': { ownerId: 'uio-c', floorplanId: 'uif-c', regionId: 'uir-c' },
  'Chọn góc nhìn bếp trưởng\0chef-documents': { ownerId: 'uio-e', floorplanId: 'uif-e', regionId: 'uir-e' },
  'Chọn góc nhìn bếp trưởng\0chef-production': { ownerId: 'uio-f', floorplanId: 'uif-f', regionId: 'uir-f' },
  'Chọn góc nhìn thu mua\0purchasing-quotations': { ownerId: 'uio-l', floorplanId: 'uif-l', regionId: 'uir-l' },
  'Chọn góc nhìn thu mua\0purchasing-supplemental': { ownerId: 'uio-m', floorplanId: 'uif-m', regionId: 'uir-m' },
  'Chọn góc nhìn thu mua\0purchasing-workflow': { ownerId: 'uio-n', floorplanId: 'uif-n', regionId: 'uir-n' },
  'Chọn loại báo cáo vận hành\0reports-audit': { ownerId: 'uio-u', floorplanId: 'uif-u', regionId: 'uir-u' },
  'Chọn loại báo cáo vận hành\0reports-data-quality': { ownerId: 'uio-v', floorplanId: 'uif-v', regionId: 'uir-v' },
  'Chọn loại báo cáo vận hành\0reports-demand': { ownerId: 'uio-w', floorplanId: 'uif-w', regionId: 'uir-w' },
  'Chọn loại báo cáo vận hành\0reports-kitchen': { ownerId: 'uio-x', floorplanId: 'uif-x', regionId: 'uir-x' },
  'Chọn loại báo cáo vận hành\0reports-movement': { ownerId: 'uio-y', floorplanId: 'uif-y', regionId: 'uir-y' },
  'Chọn loại báo cáo vận hành\0reports-price': { ownerId: 'uio-z', floorplanId: 'uif-z', regionId: 'uir-z' },
  'Chọn loại báo cáo vận hành\0reports-purchase': { ownerId: 'uio-10', floorplanId: 'uif-10', regionId: 'uir-10' },
  'Chọn loại báo cáo vận hành\0reports-stock': { ownerId: 'uio-11', floorplanId: 'uif-11', regionId: 'uir-11' },
  'Chọn loại báo cáo vận hành\0reports-usage': { ownerId: 'uio-12', floorplanId: 'uif-12', regionId: 'uir-12' },
  'Chọn góc nhìn kho\0warehouse-demand': { ownerId: 'uio-14', floorplanId: 'uif-14', regionId: 'uir-14' },
  'Chọn góc nhìn kho\0warehouse-exceptions': { ownerId: 'uio-15', floorplanId: 'uif-15', regionId: 'uir-15' },
  'Chọn góc nhìn kho\0warehouse-movement': { ownerId: 'uio-16', floorplanId: 'uif-16', regionId: 'uir-16' },
  'Chọn góc nhìn kế hoạch tuần\0cost': { ownerId: 'uio-18', floorplanId: 'uif-18', regionId: 'uir-18' },
  'Chọn góc nhìn kế hoạch tuần\0demand': { ownerId: 'uio-19', floorplanId: 'uif-19', regionId: 'uir-19' },
  'Chọn góc nhìn kế hoạch tuần\0dish-materials': { ownerId: 'uio-1a', floorplanId: 'uif-1a', regionId: 'uir-1a' },
  'Chọn góc nhìn kế hoạch tuần\0production-plan': { ownerId: 'uio-1b', floorplanId: 'uif-1b', regionId: 'uir-1b' },
  'Chọn góc nhìn kế hoạch tuần\0purchase-summary': { ownerId: 'uio-1c', floorplanId: 'uif-1c', regionId: 'uir-1c' },
  'Chọn góc nhìn kế hoạch tuần\0schedule': { ownerId: 'uio-1d', floorplanId: 'uif-1d', regionId: 'uir-1d' },
  'Chọn loại báo cáo vận hành\0price-sub-dishGroup': { ownerId: 'uio-p', floorplanId: 'uif-p', regionId: 'uir-p' },
  'Chọn loại báo cáo vận hành\0price-sub-lines': { ownerId: 'uio-q', floorplanId: 'uif-q', regionId: 'uir-q' },
  'Chọn loại báo cáo vận hành\0price-sub-period': { ownerId: 'uio-r', floorplanId: 'uif-r', regionId: 'uir-r' },
  'Chọn loại báo cáo vận hành\0price-sub-supplier': { ownerId: 'uio-s', floorplanId: 'uif-s', regionId: 'uir-s' },
}
