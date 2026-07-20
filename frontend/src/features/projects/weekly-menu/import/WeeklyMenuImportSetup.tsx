import { Download } from 'lucide-react'
import { FieldRow } from '@/components/common'
import { BOM_PRICE_TIERS, formatBomTierLabel, normalizeBomPriceTier } from '../../weeklyMenuPlanning'
import { formatFileSize } from '../model/formatters'
import type { WeeklyMenuImportWorkflow } from './useWeeklyMenuImport'

export function WeeklyMenuImportSetup({ workflow }: { workflow: WeeklyMenuImportWorkflow }) {
  const { state, customers, selectedCustomer, fileInputRef, status, actions } = workflow
  const fileMeta = state.selectedFile ? `${state.selectedFile.name} • ${formatFileSize(state.selectedFile.size)}` : 'Chưa chọn file Excel'

  return (
    <>
      <div className="rounded-md border border-slate-200 bg-slate-50 p-4">
        <div className="grid grid-cols-1 items-start gap-4 md:grid-cols-[minmax(220px,1fr)_minmax(165px,190px)_minmax(210px,240px)_minmax(250px,1.25fr)_130px]">
          <FieldRow label="Khách hàng" hint="Chọn khách hàng trong file" className="[&_.ipc-field-label]:min-h-[34px]">
            <select
              aria-label="Khách hàng"
              value={state.draftCustomerId}
              onChange={(event) => actions.selectDraftCustomer(event.target.value)}
              className="ipc-select h-9 min-h-9"
              disabled={status.isCustomerLoading || customers.length === 0}
            >
              <option value="">Chọn khách hàng</option>
              {customers.map((customer) => (
                <option key={customer.customerId} value={customer.customerId}>
                  {customer.customerCode} - {customer.customerName}
                </option>
              ))}
              {customers.length === 0 && <option value="">Chưa có khách hàng</option>}
            </select>
          </FieldRow>
          <FieldRow label="Tuần bắt đầu" hint="Chọn thứ 2 của tuần" className="[&_.ipc-field-label]:min-h-[34px]">
            <input
              aria-label="Tuần bắt đầu"
              type="date"
              value={state.weekStartDate}
              onChange={(event) => actions.selectWeek(event.target.value)}
              className="ipc-input h-9 min-h-9"
            />
          </FieldRow>
          <FieldRow label="Định mức BOM" hint="Chọn tier cho file" className="[&_.ipc-field-label]:min-h-[34px]">
            <select
              aria-label="Định mức BOM"
              value={state.priceTierAmount}
              onChange={(event) => actions.selectPriceTier(normalizeBomPriceTier(Number(event.target.value)))}
              className="ipc-select h-9 min-h-9"
              disabled={status.isImporting}
            >
              {BOM_PRICE_TIERS.map((tier) => <option key={tier} value={tier}>{formatBomTierLabel(tier)}</option>)}
            </select>
          </FieldRow>
          <FieldRow label="File Excel" hint="Chọn file thực đơn" className="[&_.ipc-field-label]:min-h-[34px]">
            <input
              id="weekly-menu-import-file"
              ref={fileInputRef}
              type="file"
              accept=".xlsx,.xlsm,.xls"
              onChange={(event) => actions.selectFile(event.target.files?.[0] ?? null)}
              className="sr-only"
              aria-describedby="weekly-menu-import-file-meta"
              disabled={status.isImporting}
            />
            <div className="grid grid-cols-1 gap-2 sm:grid-cols-[minmax(0,1fr)_minmax(0,1fr)]">
              <button
                type="button"
                onClick={() => void actions.downloadWeeklyMenuTemplate()}
                disabled={status.isDownloadingTemplate || status.isImporting || !selectedCustomer}
                className="ipc-button ipc-button-ghost h-9 min-h-9 w-full justify-center gap-2 px-3 py-0"
              >
                <Download size={16} />
                {status.isDownloadingTemplate ? 'Đang tải...' : 'Tải mẫu theo khách'}
              </button>
              <button
                type="button"
                onClick={() => fileInputRef.current?.click()}
                disabled={status.isImporting}
                className="ipc-button ipc-button-ghost h-9 min-h-9 w-full justify-center px-3 py-0"
              >
                Chọn file Excel
              </button>
            </div>
          </FieldRow>
          <div className="flex flex-col gap-1.5 md:pt-10">
            <button
              type="button"
              onClick={actions.addJob}
              disabled={status.isImporting || !state.selectedFile || !selectedCustomer}
              className="ipc-button ipc-button-primary h-9 min-h-9 w-full whitespace-nowrap px-3 py-0"
            >
              Thêm file
            </button>
          </div>
        </div>
        <div className="mt-3 flex min-h-8 flex-wrap items-center justify-between gap-3 border-t border-slate-200 pt-3">
          <button type="button" onClick={actions.toggleQuickCustomer} className="ipc-button ipc-button-ghost ipc-button-bounded" disabled={status.isImporting}>
            {state.isQuickCustomerFormOpen ? 'Đóng thêm khách hàng' : 'Thêm khách hàng mới'}
          </button>
          <span id="weekly-menu-import-file-meta" className="text-xs font-medium text-slate-500">{fileMeta}</span>
        </div>
      </div>

      {state.isQuickCustomerFormOpen && (
        <div className="grid grid-cols-1 gap-4 rounded-md border border-blue-200 bg-blue-50/60 p-4 md:grid-cols-[180px_minmax(220px,1fr)_auto]">
          <FieldRow label="Mã khách hàng" hint="VD: ANV, DAV">
            <input type="text" value={state.quickCustomerCode} onChange={(event) => actions.setQuickCustomerCode(event.target.value.toUpperCase())} className="ipc-input" placeholder="ANV" disabled={status.isCreatingCustomer} />
          </FieldRow>
          <FieldRow label="Tên khách hàng" hint="Tên đơn vị sẽ hiển thị trong danh sách">
            <input type="text" value={state.quickCustomerName} onChange={(event) => actions.setQuickCustomerName(event.target.value)} className="ipc-input" placeholder="Tên khách hàng" disabled={status.isCreatingCustomer} />
          </FieldRow>
          <div className="flex items-end">
            <button type="button" onClick={() => void actions.createQuickCustomer()} className="ipc-button ipc-button-primary w-full whitespace-nowrap" disabled={status.isCreatingCustomer || !state.quickCustomerCode.trim() || !state.quickCustomerName.trim()}>
              {status.isCreatingCustomer ? 'Đang tạo...' : 'Tạo và chọn'}
            </button>
          </div>
        </div>
      )}
    </>
  )
}
