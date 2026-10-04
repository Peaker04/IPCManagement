import { Link, useLocation } from 'react-router-dom'
import { useState, type ReactNode } from 'react'
import { BookOpen, CalendarDays, ChefHat, ChevronDown, Coins, CookingPot, LayoutDashboard, ReceiptText, Utensils } from 'lucide-react'
import { useAppSelector } from '@/app/hooks'
import { ROLE_LABELS, selectCurrentUser } from '@/features/auth'
import { useSystemOperation } from '@/lib/systemOperationContext'

type PlanningView = 'schedule' | 'demand' | 'material-demand' | 'production-plan' | 'purchase-summary' | 'cost' | 'dish-materials'

const planningViews: Record<PlanningView, { label: string; icon: typeof CalendarDays }> = {
  schedule: { label: 'Kế hoạch tuần', icon: CalendarDays },
  demand: { label: 'Nhu cầu nguyên liệu', icon: ReceiptText },
  'material-demand': { label: 'Nhu cầu nguyên liệu', icon: ReceiptText },
  'production-plan': { label: 'Kế hoạch sản xuất', icon: CookingPot },
  'purchase-summary': { label: 'Bàn giao tuần', icon: Utensils },
  cost: { label: 'Giá vốn tuần', icon: Coins },
  'dish-materials': { label: 'Định mức theo món', icon: BookOpen },
}

export function PlanningPreviewShell({ children, activeView = 'schedule' }: { children: ReactNode; activeView?: PlanningView }) {
  const operation = useSystemOperation()
  const location = useLocation()
  const currentUser = useAppSelector(selectCurrentUser)
  const [planningExpanded, setPlanningExpanded] = useState(true)
  const capabilityIds = operation?.capabilities.navigation ?? []
  const availableViews = (operation?.capabilities.pageTabs['weekly-menu'] ?? [])
    .filter((id): id is PlanningView => id in planningViews)
  const financialView: PlanningView | null = availableViews.includes('cost') ? 'cost' : availableViews.includes('dish-materials') ? 'dish-materials' : null
  const planningIds: PlanningView[] = [...availableViews.filter(id => id !== 'cost' && id !== 'dish-materials'), ...(financialView ? [financialView] : [])]
  const canReadPlanning = Boolean(currentUser && (currentUser.isAdminFullAccess || currentUser.role === 'admin' || currentUser.permissions?.some(permission => permission === '*' || permission === 'coordination.read')))

  return (
    <div className="planning-preview-shell flex h-dvh overflow-hidden bg-slate-100" data-testid="planning-preview-shell">
      <aside className="hidden w-[240px] shrink-0 flex-col border-r border-slate-200 bg-white lg:flex">
        <div className="flex h-12 items-center gap-2 border-b border-slate-200 px-3.5">
          <span className="grid size-7 place-items-center rounded-[3px] bg-[#164e87] text-white"><ChefHat size={16} aria-hidden="true" /></span>
          <span className="text-xs font-bold text-slate-900">IPC System</span>
        </div>
        <nav aria-label="Điều hướng chính IPCManagement" className="flex-1 overflow-y-auto px-2 py-3 text-slate-700">
          {capabilityIds.includes('dashboard') && <Link to="/" className="mb-1 flex items-center gap-3 rounded-[3px] px-3 py-2 text-xs font-medium text-slate-700 hover:bg-slate-100"><LayoutDashboard size={18} className="text-slate-500" />Bàn điều hành hôm nay</Link>}
          <div>
            <button type="button" aria-expanded={planningExpanded} aria-controls="preview-group-planning" onClick={() => setPlanningExpanded((open) => !open)} className="flex w-full items-center gap-3 rounded-[3px] px-3 py-2 text-left text-xs font-medium text-slate-700 hover:bg-slate-100 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#2d7acf] focus-visible:ring-offset-1">
              <CalendarDays size={18} className="text-[#164e87]" />
              <span className="min-w-0 flex-1 truncate">Kế hoạch &amp; Điều phối</span>
              <ChevronDown size={15} className={`text-slate-400 transition-transform ${planningExpanded ? 'rotate-180' : ''}`} />
            </button>
            {planningExpanded && <ul id="preview-group-planning" role="list" className="ml-5 space-y-0.5 border-l border-slate-200 py-0.5 pl-6 pr-1">
              {planningIds.map((id) => {
                const item = id === financialView ? { ...planningViews[id], label: 'Giá vốn & định mức' } : planningViews[id]
                const Icon = item.icon
                const active = id === activeView || (id === financialView && (activeView === 'cost' || activeView === 'dish-materials'))
                const previewHref = canReadPlanning && id !== 'material-demand' && (id === 'schedule' || id === 'demand' || operation?.mode === 'DEFAULT') ? `/__kit/planning/${id}${location.search}` : null
                return <li key={id}>{previewHref === null
                  ? <span aria-disabled="true" className="relative flex items-center gap-2 rounded-[3px] px-2.5 py-1.5 text-xs text-slate-500"><Icon size={14} className="text-slate-400" />{item.label}</span>
                  : <Link to={previewHref} aria-current={active ? 'page' : undefined} className={`relative flex items-center gap-2 rounded-[3px] px-2.5 py-1.5 text-xs focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#2d7acf] focus-visible:ring-offset-1 ${active ? 'bg-[#f0f5fc] font-semibold text-[#164e87] before:absolute before:bottom-1 before:left-[-1px] before:top-1 before:w-[3px] before:rounded-r before:bg-[#164e87]' : 'text-slate-600 hover:bg-slate-100'}`}><Icon size={14} className={active ? 'text-[#164e87]' : 'text-slate-400'} />{item.label}</Link>}
                </li>
              })}
            </ul>}
          </div>
          {capabilityIds.includes('meal-orders') && <Link to="/meal-orders" className="mt-1 flex items-center gap-3 rounded-[3px] px-3 py-2 text-xs font-medium text-slate-700 hover:bg-slate-100"><Utensils size={18} className="text-slate-500" />Điều phối suất ăn</Link>}
        </nav>
        {currentUser && <div className="flex items-center gap-2 border-t border-slate-200 bg-slate-50 p-2.5 text-xs text-slate-600">
          <span className="grid size-6 shrink-0 place-items-center rounded-full bg-[#164e87] font-bold text-white">{currentUser.fullName?.charAt(0).toUpperCase() || 'U'}</span>
          <span className="min-w-0"><span className="block truncate font-medium text-slate-800">{currentUser.fullName}</span><span className="block truncate">{ROLE_LABELS[currentUser.role] ?? 'Nhân viên'}</span></span>
        </div>}
      </aside>
      {children}
    </div>
  )
}
