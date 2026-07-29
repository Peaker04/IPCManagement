import { Edit, Upload } from 'lucide-react'
import { CommandBar, FieldRow, StatusBadge } from '@/components/common'
import { formatBomTierLabel } from '../../weeklyMenuPlanning'
import type { CoordinationCustomerOption } from '@/api/coordinationApi'

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
  <section className="ipc-weekly-pricing-context" aria-label="Cấu hình định lượng đang áp dụng">
    <div className="ipc-weekly-pricing-primary">
      <span>Định mức đang áp dụng</span>
      <strong>{formatBomTierLabel(menuPrice)}</strong>
      <StatusBadge variant="success">Đang dùng</StatusBadge>
    </div>
    <dl className="ipc-weekly-pricing-meta">
      <div><dt>Nguồn</dt><dd>{menuPriceSource}</dd></div>
      <div><dt>Tỷ lệ</dt><dd>100% theo mức giá cố định</dd></div>
    </dl>
  </section>
)
