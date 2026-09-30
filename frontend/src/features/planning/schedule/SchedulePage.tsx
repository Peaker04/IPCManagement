import { CalendarDays, Edit3, Send, Upload } from 'lucide-react'
import { EmptyState, InlineAlert } from '@/components/common'
import { Input } from '@/components/ui/input'
import { ImportedLayoutMatrix } from '@/features/projects/components/ImportedLayoutMatrix'
import { formatBomTierLabel } from '@/features/projects/weeklyMenuPlanning'
import type { SchedulePageModel } from './schedulePageModel'

type Props = {
  model: SchedulePageModel
  isImporting?: boolean
  isPublishing?: boolean
  onCustomerChange: (customerId: string) => void
  onWeekChange: (weekStartDate: string) => void
  onImport: () => void
  onEdit: () => void
  onPublish: () => void
  onRetry: () => void
}

const lifecycleTone: Record<SchedulePageModel['identity']['lifecycle'], string> = {
  'Chưa khởi tạo': 'border-slate-300 bg-slate-50 text-slate-700',
  'Bản nháp': 'border-amber-200 bg-amber-50 text-amber-900',
  'Đã xuất bản': 'border-teal-200 bg-teal-50 text-teal-800',
}

export function SchedulePage({ model, isImporting = false, isPublishing = false, onCustomerChange, onWeekChange, onImport, onEdit, onPublish, onRetry }: Props) {
  return (
    <main className="min-w-0 flex-1 bg-slate-100 p-6" data-testid="schedule-preview-page">
      <div className="mx-auto flex max-w-[1680px] flex-col gap-4">
        <header className="border-b border-slate-300 pb-4">
          <div>
            <div className="text-xs font-semibold uppercase tracking-wide text-slate-500">Kế hoạch &amp; Điều phối</div>
            <div className="mt-1 flex flex-wrap items-center gap-3">
              <h1 className="text-xl font-bold leading-7 text-slate-950">{model.identity.title}</h1>
              <span className={`rounded-[3px] border px-2 py-1 text-xs font-semibold ${lifecycleTone[model.identity.lifecycle]}`}>{model.identity.lifecycle}</span>
            </div>
            <p className="mt-1 text-sm text-slate-600">Lập và kiểm tra thực đơn theo ngày, ca và nhóm phục vụ.</p>
          </div>
        </header>

        <section aria-label="Phạm vi và tác vụ kế hoạch" className="flex flex-col gap-3 rounded-[3px] border border-slate-300 bg-white p-3 lg:flex-row lg:items-end lg:justify-between">
          <div className="flex flex-wrap items-end gap-3">
            <label className="grid gap-1 text-sm font-semibold text-slate-800">
              <span>Khách hàng</span>
              <select aria-label="Khách hàng" value={model.scope.customerId} onChange={(event) => onCustomerChange(event.target.value)} className="h-9 min-w-64 rounded-[2px] border border-slate-500 bg-white px-3 text-sm font-normal text-slate-950 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-blue-600">
                <option value="">Chọn khách hàng</option>
                {model.scope.customers.map((customer) => <option key={customer.customerId} value={customer.customerId}>{customer.customerCode} - {customer.customerName}</option>)}
              </select>
            </label>
            <label className="grid gap-1 text-sm font-semibold text-slate-800">
              <span>Tuần bắt đầu</span>
              <Input aria-label="Tuần bắt đầu" type="date" weekStartOnly value={model.scope.weekStartDate} onChange={(event) => onWeekChange(event.target.value)} className="h-9 w-44 border-slate-500 bg-white font-normal" />
            </label>
            <div className="grid min-h-9 content-center gap-0.5 border-l border-slate-200 pl-3" aria-label="Định mức thực đơn">
              <span className="text-xs font-medium text-slate-500">Định mức thực đơn</span>
              {model.pricing.blockedReason
                ? <span className="text-sm font-semibold text-red-700">Cần kiểm tra</span>
                : <span className="text-sm font-semibold text-slate-900">{model.pricing.tier ? formatBomTierLabel(model.pricing.tier) : 'Chưa xác định'}{model.pricing.source && <span className="font-normal text-slate-500"> · {model.pricing.source}</span>}</span>}
            </div>
          </div>
          <div className="flex flex-wrap items-center justify-end gap-2">
            <button type="button" onClick={onImport} disabled={!model.commands.canImport || isImporting} className={`ipc-button ${!model.commands.canEdit ? 'ipc-button-primary' : 'ipc-button-ghost'} inline-flex h-9 items-center gap-1.5 px-3 text-sm font-semibold`}><Upload size={16} aria-hidden="true" />{isImporting ? 'Đang nhập...' : 'Nhập Excel'}</button>
            <button type="button" onClick={onEdit} disabled={!model.commands.canEdit} className={`ipc-button ${model.commands.canEdit && !model.commands.canPublish ? 'ipc-button-primary' : 'ipc-button-ghost'} inline-flex h-9 items-center gap-1.5 px-3 text-sm font-semibold`}><Edit3 size={16} aria-hidden="true" />Chỉnh sửa</button>
            {model.commands.canPublish && <button type="button" onClick={onPublish} disabled={isPublishing} className="ipc-button ipc-button-primary inline-flex h-9 items-center gap-1.5 px-3 text-sm font-semibold"><Send size={16} aria-hidden="true" />{isPublishing ? 'Đang xuất bản...' : 'Xuất bản'}</button>}
          </div>
        </section>

        {model.pricing.blockedReason && <InlineAlert title="Định mức thực đơn không nhất quán" variant="danger">{model.pricing.blockedReason}</InlineAlert>}

        <section aria-label="Nội dung kế hoạch tuần" className="min-w-0">
          {model.state.kind === 'prerequisite' && <div className="rounded-[3px] border border-blue-200 bg-blue-50 p-5"><InlineAlert title="Chọn khách hàng và tuần để bắt đầu" variant="info">Phạm vi hợp lệ là điều kiện để tải thực đơn và các thao tác liên quan.</InlineAlert></div>}
          {model.state.kind === 'loading' && <div aria-busy="true" aria-live="polite" className="rounded-[3px] border border-slate-300 bg-white p-4"><span className="sr-only">Đang tải kế hoạch tuần</span><div aria-hidden="true" className="grid animate-pulse gap-2 motion-reduce:animate-none"><div className="h-10 bg-slate-100" /><div className="h-72 bg-slate-50" /></div></div>}
          {model.state.kind === 'forbidden' && <InlineAlert title="Không đủ quyền xem kế hoạch tuần" variant="danger">Tài khoản hiện tại không có quyền đọc dữ liệu điều phối trong phạm vi này.</InlineAlert>}
          {model.state.kind === 'error' && <InlineAlert title="Chưa tải được kế hoạch tuần" variant="danger"><span>Kiểm tra kết nối rồi thử lại.</span> <button type="button" onClick={onRetry} className="font-semibold underline">Thử lại</button></InlineAlert>}
          {model.state.kind === 'empty' && <div className="rounded-[3px] border border-slate-300 bg-white p-6"><EmptyState variant="uncreated" title="Chưa có thực đơn cho tuần đã chọn" description="Nhập Excel hoặc mở trình chỉnh sửa để bắt đầu lập kế hoạch." /></div>}
          {model.state.kind === 'ready' && (
            <div className="overflow-hidden rounded-[3px] border border-slate-300 bg-white">
              <div className="flex items-center gap-2 border-b border-slate-200 bg-slate-50 px-4 py-3 text-sm font-semibold text-slate-900"><CalendarDays size={17} aria-hidden="true" className="text-slate-600" />Thực đơn theo ngày và ca</div>
              <ImportedLayoutMatrix rows={model.state.rows} displayDays={model.matrix.displayDays} activeDayKey={model.matrix.activeDayKey} fixedHeader stickyHeader={false} />
            </div>
          )}
        </section>
      </div>
    </main>
  )
}
