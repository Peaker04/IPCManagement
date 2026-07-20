import { Edit, Upload } from 'lucide-react'
import { CommandBar, FieldRow } from '@/components/common'
import { formatBomTierLabel } from '../../weeklyMenuPlanning'
import type { CoordinationCustomerOption } from '../../../coordination/coordinationApi'

type CommandProps = {
  customers: CoordinationCustomerOption[]
  selectedCustomerId: string
  weekStartDate: string
  isCustomerLoading: boolean
  isImporting: boolean
  onEdit: () => void
  onImport: () => void
  onExport: () => void
  onCustomerChange: (customerId: string) => void
  onWeekChange: (weekStartDate: string) => void
}

export const WeeklyMenuCommandBar = ({
  customers,
  selectedCustomerId,
  weekStartDate,
  isCustomerLoading,
  isImporting,
  onEdit,
  onImport,
  onExport,
  onCustomerChange,
  onWeekChange,
}: CommandProps) => (
  <CommandBar actions={<>
    <button type="button" onClick={onEdit} className="ipc-button ipc-button-ghost font-semibold whitespace-nowrap">
      <Edit size={14} className="text-[var(--ipc-slate-500)]" />
      Chỉnh sửa thực đơn
    </button>
    <button type="button" onClick={onImport} disabled={isImporting} className="ipc-button ipc-button-ghost font-semibold whitespace-nowrap">
      <Upload size={14} className="text-[var(--ipc-slate-500)]" />
      {isImporting ? 'Đang nhập...' : 'Nhập Excel'}
    </button>
    <button type="button" onClick={onExport} className="ipc-button ipc-button-success whitespace-nowrap">
      Xuất báo cáo gửi kho
    </button>
  </>}>
    <FieldRow label="Khách hàng">
      <select value={selectedCustomerId} onChange={(event) => onCustomerChange(event.target.value)} className="ipc-select min-w-[200px]" disabled={isCustomerLoading}>
        <option value="">Chọn khách hàng</option>
        {customers.map((customer) => (
          <option key={customer.customerId} value={customer.customerId}>
            {customer.customerCode} - {customer.customerName}
          </option>
        ))}
      </select>
    </FieldRow>
    <FieldRow label="Tuần bắt đầu">
      <input type="date" value={weekStartDate} onChange={(event) => onWeekChange(event.target.value)} className="ipc-input" />
    </FieldRow>
  </CommandBar>
)

export const WeeklyMenuPricingContext = ({
  menuPrice,
  menuPriceSource,
}: {
  menuPrice: number
  menuPriceSource: string
}) => (
  <div className="mt-3 grid gap-3 rounded-md border border-slate-200 bg-slate-50/70 p-3 shadow-sm lg:grid-cols-3">
    <FieldRow label="Định mức BOM cố định" className="[&_.ipc-field-label]:min-h-[18px]">
      <div className="ipc-input flex h-10 items-center justify-between bg-white text-sm font-semibold text-blue-700">
        <span>{formatBomTierLabel(menuPrice)}</span>
        <span className="rounded border border-blue-100 bg-blue-50 px-2 py-0.5 text-[11px] font-bold uppercase text-blue-600">Đang dùng</span>
      </div>
    </FieldRow>
    <FieldRow label="Nguồn định mức" className="[&_.ipc-field-label]:min-h-[18px]">
      <div className="ipc-input flex h-10 items-center bg-white text-sm font-semibold text-slate-800">{menuPriceSource}</div>
    </FieldRow>
    <FieldRow label="BOM áp dụng" className="[&_.ipc-field-label]:min-h-[18px]">
      <div className="ipc-input flex h-10 items-center bg-white text-sm font-semibold text-emerald-700">Theo tier cố định, 100%</div>
    </FieldRow>
  </div>
)
