import { Edit, Send, Upload } from 'lucide-react'
import { CommandBar, FieldRow } from '@/components/common'
import { Input } from '@/components/ui/input'
import type { CoordinationCustomerOption } from '@/api/coordinationApi'

type Props = {
  customers: CoordinationCustomerOption[]
  selectedCustomerId: string
  weekStartDate: string
  isCustomerLoading: boolean
  isImporting: boolean
  canPublish: boolean
  isPublishing: boolean
  onEdit: () => void
  onImport: () => void
  onPublish: () => void
  onCustomerChange: (customerId: string) => void
  onWeekChange: (weekStartDate: string) => void
  pricing?: React.ReactNode
}

export function WeeklyScheduleCommandBar({
  customers,
  selectedCustomerId,
  weekStartDate,
  isCustomerLoading,
  isImporting,
  canPublish,
  isPublishing,
  onEdit,
  onImport,
  onPublish,
  onCustomerChange,
  onWeekChange,
  pricing,
}: Props) {
  return (
    <CommandBar actions={<>
      <button type="button" onClick={onImport} disabled={isImporting} className="ipc-button ipc-button-secondary min-h-8 h-8 px-2.5 text-xs font-semibold inline-flex items-center gap-1.5 rounded-[var(--ipc-radius-sm,2px)]">
        <Upload size={14} aria-hidden="true" />
        <span>{isImporting ? 'Đang nhập...' : 'Nhập Excel'}</span>
      </button>
      <button type="button" onClick={onEdit} disabled={!weekStartDate} className="ipc-button ipc-button-secondary min-h-8 h-8 px-2.5 text-xs font-semibold inline-flex items-center gap-1.5 rounded-[var(--ipc-radius-sm,2px)]">
        <Edit size={14} aria-hidden="true" />
        <span>Chỉnh sửa lịch tuần</span>
      </button>
      {canPublish && <button type="button" onClick={onPublish} disabled={isPublishing} className="ipc-button ipc-button-primary min-h-8 h-8 px-3 text-xs font-semibold inline-flex items-center gap-1.5 rounded-[var(--ipc-radius-sm,2px)]">
        <Send size={14} aria-hidden="true" />
        <span>{isPublishing ? 'Đang xuất bản...' : 'Xuất bản tuần'}</span>
      </button>}
    </>}>
      <FieldRow label="Khách hàng">
        <select
          aria-label="Khách hàng"
          value={selectedCustomerId}
          onChange={(event) => onCustomerChange(event.target.value)}
          disabled={isCustomerLoading}
          className="ipc-native-control min-h-8 h-8 min-w-[200px] rounded-[var(--ipc-radius-sm,2px)] border border-slate-300 bg-white px-2.5 text-xs text-slate-900 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-blue-600 transition-colors shadow-2xs"
        >
          <option value="">Chọn khách hàng</option>
          {customers.map((customer) => <option key={customer.customerId} value={customer.customerId}>{customer.customerCode} - {customer.customerName}</option>)}
        </select>
      </FieldRow>
      <FieldRow label="Tuần bắt đầu">
        <Input
          aria-label="Tuần bắt đầu"
          type="date"
          weekStartOnly
          value={weekStartDate}
          onChange={(event) => onWeekChange(event.target.value)}
          className="h-8 min-h-8 w-36 bg-white text-xs rounded-[var(--ipc-radius-sm,2px)] shadow-2xs"
        />
      </FieldRow>
      {pricing}
    </CommandBar>
  )
}
