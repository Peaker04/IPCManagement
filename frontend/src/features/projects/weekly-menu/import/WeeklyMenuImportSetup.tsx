import { Download } from 'lucide-react'
import { FieldRow } from '@/components/common'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { BOM_PRICE_TIERS, formatBomTierLabel, normalizeBomPriceTier } from '../../weeklyMenuPlanning'
import { formatFileSize } from '../model/formatters'
import type { WeeklyMenuImportWorkflow } from './useWeeklyMenuImport'

const EMPTY_CUSTOMER_VALUE = '__empty-customer__'
const NO_CUSTOMERS_VALUE = '__no-customers__'

export function WeeklyMenuImportSetup({ workflow }: { workflow: WeeklyMenuImportWorkflow }) {
  const { state, customers, selectedCustomer, fileInputRef, status, actions } = workflow
  const fileMeta = state.selectedFile ? `${state.selectedFile.name} • ${formatFileSize(state.selectedFile.size)}` : 'Chưa chọn file Excel'
  const customerError = state.setupErrors.customer
  const weekError = state.setupErrors.weekStartDate
  const fileError = state.setupErrors.file
  const selectedCustomerLabel = selectedCustomer
    ? `${selectedCustomer.customerCode} - ${selectedCustomer.customerName}`
    : 'Chọn khách hàng'

  return (
    <>
      <div className="rounded-md border border-slate-200 bg-slate-50 p-4">
        <div className="grid min-w-0 grid-cols-1 items-start gap-4 md:grid-cols-2 xl:grid-cols-[minmax(200px,1fr)_180px_210px_minmax(390px,1.6fr)]">
          <FieldRow label="Khách hàng" hint="Chọn khách hàng trong file" className="min-w-0 [&_.ipc-field-label]:min-h-[34px]">
            <Select
              value={state.draftCustomerId || EMPTY_CUSTOMER_VALUE}
              onValueChange={(value) => actions.selectDraftCustomer(value === EMPTY_CUSTOMER_VALUE || value === NO_CUSTOMERS_VALUE || value === null ? '' : value)}
              disabled={status.isCustomerLoading || customers.length === 0}
            >
              <SelectTrigger
                aria-label="Khách hàng"
                aria-invalid={Boolean(customerError) || undefined}
                aria-describedby={customerError ? 'weekly-menu-import-customer-error' : undefined}
                className="h-9 min-h-9 w-full"
              >
                <SelectValue>{selectedCustomerLabel}</SelectValue>
              </SelectTrigger>
              <SelectContent>
                <SelectItem value={EMPTY_CUSTOMER_VALUE}>Chọn khách hàng</SelectItem>
                {customers.map((customer) => (
                  <SelectItem key={customer.customerId} value={customer.customerId}>
                    {customer.customerCode} - {customer.customerName}
                  </SelectItem>
                ))}
                {customers.length === 0 && <SelectItem value={NO_CUSTOMERS_VALUE}>Chưa có khách hàng</SelectItem>}
              </SelectContent>
            </Select>
            {customerError && <p id="weekly-menu-import-customer-error" className="mt-1 text-xs text-red-700"><span className="font-semibold">{customerError.title}</span>{' '}{customerError.message}</p>}
          </FieldRow>
          <FieldRow label="Tuần bắt đầu" hint="Chọn thứ 2 của tuần" className="min-w-0 [&_.ipc-field-label]:min-h-[34px]">
            <Input
              aria-label="Tuần bắt đầu"
              aria-invalid={Boolean(weekError) || undefined}
              aria-describedby={weekError ? 'weekly-menu-import-week-error' : undefined}
              type="date"
              weekStartOnly
              value={state.weekStartDate}
              onChange={(event) => actions.selectWeek(event.target.value)}
              className="h-9 min-h-9"
            />
            {weekError && <p id="weekly-menu-import-week-error" className="mt-1 text-xs text-red-700"><span className="font-semibold">{weekError.title}</span>{' '}{weekError.message}</p>}
          </FieldRow>
          <FieldRow label="Mức giá thực đơn" hint="Chọn mức giá áp dụng cho file" className="min-w-0 [&_.ipc-field-label]:min-h-[34px]">
            <Select
              value={String(state.priceTierAmount)}
              onValueChange={(value) => { if (value !== null) actions.selectPriceTier(normalizeBomPriceTier(Number(value))) }}
              disabled={status.isImporting}
            >
              <SelectTrigger aria-label="Mức giá thực đơn" className="h-9 min-h-9 w-full">
                <SelectValue>{formatBomTierLabel(state.priceTierAmount)}</SelectValue>
              </SelectTrigger>
              <SelectContent>
                {BOM_PRICE_TIERS.map((tier) => <SelectItem key={tier} value={String(tier)}>{formatBomTierLabel(tier)}</SelectItem>)}
              </SelectContent>
            </Select>
          </FieldRow>
          <FieldRow label="File Excel" hint="Chọn file thực đơn" className="min-w-0 [&_.ipc-field-label]:min-h-[34px]">
            <input
              id="weekly-menu-import-file"
              ref={fileInputRef}
              type="file"
              accept=".xlsx,.xlsm,.xls"
              onChange={(event) => actions.selectFile(event.target.files?.[0] ?? null)}
              className="sr-only"
              aria-invalid={Boolean(fileError) || undefined}
              aria-describedby={fileError ? 'weekly-menu-import-file-error weekly-menu-import-file-meta' : 'weekly-menu-import-file-meta'}
              disabled={status.isImporting}
            />
            <div className="flex min-w-0 flex-nowrap gap-2">
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={() => void actions.downloadWeeklyMenuTemplate()}
                disabled={status.isDownloadingTemplate || status.isImporting || !selectedCustomer}
                className="min-w-0 flex-1 justify-center gap-2"
              >
                <Download size={16} />
                {status.isDownloadingTemplate ? 'Đang tải...' : 'Tải mẫu'}
              </Button>
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={() => fileInputRef.current?.click()}
                disabled={status.isImporting}
                className="min-w-0 flex-1 justify-center"
              >
                Chọn file Excel
              </Button>
              <Button
                type="button"
                size="sm"
                onClick={actions.addJob}
                disabled={status.isImporting || !state.selectedFile || !selectedCustomer}
                className="min-w-[92px] shrink-0"
              >
                Thêm file
              </Button>
            </div>
            {fileError && <p id="weekly-menu-import-file-error" className="mt-1 text-xs text-red-700"><span className="font-semibold">{fileError.title}</span>{' '}{fileError.message}</p>}
          </FieldRow>
        </div>
        <div className="mt-3 flex min-h-8 flex-wrap items-center justify-between gap-3 border-t border-slate-200 pt-3">
          <Button type="button" variant="outline" size="xs" textWrap="wrap" onClick={actions.toggleQuickCustomer} disabled={status.isImporting}>
            {state.isQuickCustomerFormOpen ? 'Đóng thêm khách hàng' : 'Thêm khách hàng mới'}
          </Button>
          <span id="weekly-menu-import-file-meta" className="text-xs font-medium text-slate-500">{fileMeta}</span>
        </div>
      </div>

      {state.isQuickCustomerFormOpen && (
        <div className="grid grid-cols-1 gap-4 rounded-md border border-blue-200 bg-blue-50/60 p-4 md:grid-cols-[180px_minmax(220px,1fr)_auto]">
          <FieldRow label="Mã khách hàng" hint="VD: ANV, DAV">
            <Input type="text" value={state.quickCustomerCode} onChange={(event) => actions.setQuickCustomerCode(event.target.value.toUpperCase())} placeholder="ANV" disabled={status.isCreatingCustomer} />
          </FieldRow>
          <FieldRow label="Tên khách hàng" hint="Tên đơn vị sẽ hiển thị trong danh sách">
            <Input type="text" value={state.quickCustomerName} onChange={(event) => actions.setQuickCustomerName(event.target.value)} placeholder="Tên khách hàng" disabled={status.isCreatingCustomer} />
          </FieldRow>
          <div className="flex items-end">
            <Button type="button" size="sm" onClick={() => void actions.createQuickCustomer()} className="w-full" disabled={status.isCreatingCustomer || !state.quickCustomerCode.trim() || !state.quickCustomerName.trim()}>
              {status.isCreatingCustomer ? 'Đang tạo...' : 'Tạo và chọn'}
            </Button>
          </div>
        </div>
      )}
    </>
  )
}
