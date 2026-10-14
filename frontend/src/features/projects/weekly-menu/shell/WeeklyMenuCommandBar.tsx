import { CommandBar, FieldRow } from '@/components/common'
import { Input } from '@/components/ui/input'
import type { CoordinationCustomerOption } from '@/api/coordinationApi'

type CommandProps = {
  customers: CoordinationCustomerOption[]
  selectedCustomerId: string
  weekStartDate: string
  isCustomerLoading: boolean
  onExport?: () => void
  onCustomerChange: (customerId: string) => void
  onWeekChange: (weekStartDate: string) => void
  pricing?: React.ReactNode
}

export const WeeklyMenuCommandBar = ({
  customers,
  selectedCustomerId,
  weekStartDate,
  isCustomerLoading,
  onExport,
  onCustomerChange,
  onWeekChange,
  pricing,
}: CommandProps) => (
  /* Publish command ('Xuất bản tuần') is owned by WeeklyScheduleCommandBar on the schedule view. */
  <CommandBar actions={onExport && (
    <button type="button" onClick={onExport} className="ipc-button ipc-button-secondary min-h-8 h-8 px-3 text-xs font-semibold inline-flex items-center gap-1.5 rounded-[var(--ipc-radius-sm,2px)]">
      <span>Xuất báo cáo gửi kho</span>
    </button>
  )}>
    <FieldRow label="Khách hàng">
      <select
        aria-label="Khách hàng"
        value={selectedCustomerId}
        onChange={(event) => onCustomerChange(event.target.value)}
        disabled={isCustomerLoading}
        className="ipc-native-control min-h-8 h-8 min-w-[220px] rounded-[var(--ipc-radius-sm,2px)] border border-slate-300 bg-white px-2.5 text-xs text-slate-900 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-blue-600 transition-colors shadow-2xs"
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
