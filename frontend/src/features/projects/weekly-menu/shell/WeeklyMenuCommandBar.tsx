import { Edit, Send, Upload } from 'lucide-react'
import { CommandBar, FieldRow, StatusBadge } from '@/components/common'
import { formatBomTierLabel } from '../../weeklyMenuPlanning'
import type { CoordinationCustomerOption } from '@/api/coordinationApi'

type CommandProps = {
  customers: CoordinationCustomerOption[]
  selectedCustomerId: string
  weekStartDate: string
  isCustomerLoading: boolean
  isImporting: boolean
  canPublish?: boolean
  isPublishing?: boolean
  onEdit: () => void
  onImport: () => void
  onExport?: () => void
  onPublish?: () => void
  onCustomerChange: (customerId: string) => void
  onWeekChange: (weekStartDate: string) => void
}

export const WeeklyMenuCommandBar = ({
  customers,
  selectedCustomerId,
  weekStartDate,
  isCustomerLoading,
  isImporting,
  canPublish,
  isPublishing,
  onEdit,
  onImport,
  onExport,
  onPublish,
  onCustomerChange,
  onWeekChange,
}: CommandProps) => {
  return (
  <CommandBar actions={<>
    <button type="button" onClick={onEdit} className="ipc-button ipc-button-ghost font-semibold whitespace-nowrap">
      <Edit size={14} className="text-[var(--ipc-slate-500)]" />
      Chỉnh sửa thực đơn
    </button>
    <button type="button" onClick={onImport} disabled={isImporting} className="ipc-button ipc-button-ghost font-semibold whitespace-nowrap">
      <Upload size={14} className="text-[var(--ipc-slate-500)]" />
      {isImporting ? 'Đang nhập...' : 'Nhập Excel'}
    </button>
    {canPublish && onPublish && (
      <button type="button" onClick={onPublish} disabled={isPublishing} className="ipc-button ipc-button-primary whitespace-nowrap">
        <Send size={14} aria-hidden="true" />
        {isPublishing ? 'Đang xuất bản...' : 'Xuất bản tuần'}
      </button>
    )}
    {onExport && <button type="button" onClick={onExport} className="ipc-button ipc-button-success whitespace-nowrap">
      Xuất báo cáo gửi kho
    </button>}
  </>}>
    <FieldRow label="Khách hàng">
      <select
        aria-label="Chọn khách hàng"
        value={selectedCustomerId}
        onChange={(event) => onCustomerChange(event.target.value)}
        disabled={isCustomerLoading}
        className="ipc-native-control min-h-9 min-w-[200px] rounded-sm border border-slate-300 bg-white px-3 text-sm text-slate-900 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-blue-600"
      >
        <option value="">Chọn khách hàng</option>
        {customers.map((customer) => (
          <option key={customer.customerId} value={customer.customerId}>
            {customer.customerCode} - {customer.customerName}
          </option>
        ))}
      </select>
    </FieldRow>
    <FieldRow label="Tuần bắt đầu">
      <input
        aria-label="Tuần bắt đầu"
        type="date"
        value={weekStartDate}
        onChange={(event) => onWeekChange(event.target.value)}
        className="ipc-native-control min-h-9 rounded-sm border border-slate-300 bg-white px-3 text-sm text-slate-900 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-blue-600"
      />
    </FieldRow>
  </CommandBar>
  )
}

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
      {menuPrice > 0 ? (
        <StatusBadge variant="success">Đang dùng</StatusBadge>
      ) : (
        <StatusBadge variant="warning">Chưa cấu hình</StatusBadge>
      )}
    </div>
    <dl className="ipc-weekly-pricing-meta">
      <div><dt>Nguồn</dt><dd>{menuPriceSource}</dd></div>
    </dl>
  </section>
)
