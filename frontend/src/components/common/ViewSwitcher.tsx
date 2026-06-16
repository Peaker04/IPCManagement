/**
 * ViewSwitcher — Shared tab-switcher component
 *
 * Replaces the duplicated ipc-view-switcher markup that was
 * copy-pasted across 6+ pages (Warehouse, Purchasing, Approval,
 * AdminData, WeeklyMenu, ChefDashboard).
 */

import { cn } from '@/lib/utils'

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
  return (
    <div
      className={cn('ipc-view-switcher', compact && 'is-compact')}
      role="tablist"
      aria-label={ariaLabel}
    >
      {tabs.map((tab) => (
        <button
          key={tab.id}
          id={`${tab.id}-tab`}
          type="button"
          role="tab"
          aria-selected={activeTab === tab.id}
          aria-controls={`${tab.id}-panel`}
          className={activeTab === tab.id ? 'is-active' : undefined}
          onClick={() => onTabChange(tab.id)}
        >
          {tab.label}
        </button>
      ))}
    </div>
  )
}
