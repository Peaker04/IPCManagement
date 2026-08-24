import { Edit, Send, Upload } from 'lucide-react'
import { CommandBar, FieldRow, StatusBadge } from '@/components/common'
import { Input } from '@/components/ui/input'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { formatBomTierLabel } from '../../weeklyMenuPlanning'
import type { CoordinationCustomerOption } from '@/api/coordinationApi'

const EMPTY_CUSTOMER_VALUE = '__empty-customer__'

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
  onExport: () => void
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
  const selectedCustomer = customers.find((customer) => customer.customerId === selectedCustomerId)
  const selectedCustomerLabel = selectedCustomer
    ? `${selectedCustomer.customerCode} - ${selectedCustomer.customerName}`
    : 'Chọn khách hàng'

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
    <button type="button" onClick={onExport} className="ipc-button ipc-button-success whitespace-nowrap">
      Xuất báo cáo gửi kho
    </button>
  </>}>
    <FieldRow label="Khách hàng">
      <Select value={selectedCustomerId || EMPTY_CUSTOMER_VALUE} onValueChange={(value) => onCustomerChange(value === EMPTY_CUSTOMER_VALUE || value === null ? '' : value)} disabled={isCustomerLoading}>
        <SelectTrigger aria-label="Chọn khách hàng" className="min-w-[200px]"><SelectValue>{selectedCustomerLabel}</SelectValue></SelectTrigger>
        <SelectContent>
          <SelectItem value={EMPTY_CUSTOMER_VALUE}>Chọn khách hàng</SelectItem>
          {customers.map((customer) => (
            <SelectItem key={customer.customerId} value={customer.customerId}>
              {customer.customerCode} - {customer.customerName}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
    </FieldRow>
    <FieldRow label="Tuần bắt đầu">
      <Input aria-label="Tuần bắt đầu" type="date" weekStartOnly value={weekStartDate} onChange={(event) => onWeekChange(event.target.value)} className="placeholder:text-slate-600!" />
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
