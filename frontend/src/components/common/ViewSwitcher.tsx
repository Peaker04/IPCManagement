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
  label: string
}

interface ViewSwitcherProps {
  tabs: ViewTab[]
  activeTab: string
  onTabChange: (tabId: string) => void
  /** Use compact variant (smaller padding, for inline contexts) */
  compact?: boolean
  /** Accessible label for the tablist */
  ariaLabel: string
}

export function ViewSwitcher({
  tabs,
  activeTab,
  onTabChange,
  compact = false,
  ariaLabel,
}: ViewSwitcherProps) {
  const tabRefs = useRef<Array<HTMLButtonElement | null>>([])

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
      className={cn('ipc-view-switcher', compact && 'is-compact')}
      role="tablist"
      aria-label={ariaLabel}
      aria-orientation="horizontal"
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
        >
          {tab.label}
        </button>
      ))}
    </div>
  )
}
