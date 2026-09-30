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
  <CommandBar actions={onExport && (
    <button type="button" onClick={onExport} className="ipc-button ipc-button-secondary min-h-9 px-3 text-sm font-semibold inline-flex items-center gap-1.5">
      <span>Xuất báo cáo gửi kho</span>
    </button>
  )}>
    <FieldRow label="Khách hàng">
      <select aria-label="Khách hàng" value={selectedCustomerId} onChange={(event) => onCustomerChange(event.target.value)} disabled={isCustomerLoading} className="ipc-native-control min-h-9 min-w-[200px] rounded-sm border border-slate-300 bg-white px-3 text-sm text-slate-900 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-blue-600">
        <option value="">Chọn khách hàng</option>
        {customers.map((customer) => <option key={customer.customerId} value={customer.customerId}>{customer.customerCode} - {customer.customerName}</option>)}
      </select>
    </FieldRow>
    <FieldRow label="Tuần bắt đầu">
      <Input aria-label="Tuần bắt đầu" type="date" weekStartOnly value={weekStartDate} onChange={(event) => onWeekChange(event.target.value)} className="h-9 min-h-9 w-40 bg-white text-sm" />
    </FieldRow>
    {pricing}
  </CommandBar>
)
