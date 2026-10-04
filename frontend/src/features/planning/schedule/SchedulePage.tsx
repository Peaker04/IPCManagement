import { CalendarDays, Edit3, Send, Upload } from 'lucide-react'
import { CommandBar, EmptyState, InlineAlert } from '@/components/common'
import { Input } from '@/components/ui/input'
import { Button } from '@/components/ui/button'
import { ImportedLayoutMatrix } from '@/features/projects/components/ImportedLayoutMatrix'
import { getNormalizedSlotType, SECTIONS } from '@/features/projects/weekly-menu/model/scope'
import { formatBomTierLabel } from '@/features/projects/weeklyMenuPlanning'
import type { SchedulePageModel } from './schedulePageModel'
import '../cost/readPlanning.css'

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

export function SchedulePage({ model, isImporting = false, isPublishing = false, onCustomerChange, onWeekChange, onImport, onEdit, onPublish, onRetry }: Props) {
  return <main className="planning-read" data-testid="schedule-preview-page">
    <header className="planning-identity"><p>Kế hoạch &amp; Điều phối</p><div><h1>{model.identity.title}</h1><span>{model.identity.lifecycle}</span></div></header>
    <section aria-label="Phạm vi và tác vụ kế hoạch"><CommandBar variant="scope" actions={<>
      <Button type="button" size="sm" variant={!model.commands.canEdit ? 'default' : 'ghost'} onClick={onImport} disabled={!model.commands.canImport || isImporting}><Upload size={16} aria-hidden="true" />{isImporting ? 'Đang nhập…' : 'Nhập Excel'}</Button>
      <Button type="button" size="sm" variant={model.commands.canEdit && !model.commands.canPublish ? 'default' : 'ghost'} onClick={onEdit} disabled={!model.commands.canEdit}><Edit3 size={16} aria-hidden="true" />Chỉnh sửa</Button>
      {model.commands.canPublish && <Button type="button" size="sm" disabled={isPublishing} onClick={onPublish}><Send size={16} aria-hidden="true" />{isPublishing ? 'Đang xuất bản…' : 'Xuất bản'}</Button>}
    </>}>
      <label>Khách hàng<select aria-label="Khách hàng" value={model.scope.customerId} onChange={event => onCustomerChange(event.target.value)}><option value="">Chọn khách hàng</option>{model.scope.customers.map(customer => <option key={customer.customerId} value={customer.customerId}>{customer.customerCode} — {customer.customerName}</option>)}</select></label>
      <label>Tuần bắt đầu<Input aria-label="Tuần bắt đầu" type="date" weekStartOnly value={model.scope.weekStartDate} onChange={event => onWeekChange(event.target.value)} /></label>
      <div aria-label="Định mức thực đơn"><small>Định mức thực đơn</small><p>{model.pricing.blockedReason ? 'Cần kiểm tra' : model.pricing.tier ? formatBomTierLabel(model.pricing.tier) : 'Chưa xác định'}{model.pricing.source && ` · ${model.pricing.source}`}</p></div>
    </CommandBar></section>
    {model.pricing.blockedReason && <InlineAlert title="Định mức thực đơn không nhất quán" variant="danger">{model.pricing.blockedReason}</InlineAlert>}
    <section aria-label="Nội dung kế hoạch tuần">
      {model.state.kind === 'prerequisite' && <InlineAlert title="Chọn khách hàng và tuần để bắt đầu" variant="info">Phạm vi hợp lệ là điều kiện để tải thực đơn và các thao tác liên quan.</InlineAlert>}
      {model.state.kind === 'loading' && <div aria-busy="true" role="status">Đang tải kế hoạch tuần…</div>}
      {model.state.kind === 'forbidden' && <InlineAlert title="Không đủ quyền xem kế hoạch tuần" variant="danger">Tài khoản hiện tại không có quyền đọc dữ liệu điều phối trong phạm vi này.</InlineAlert>}
      {model.state.kind === 'error' && <InlineAlert title="Chưa tải được kế hoạch tuần" variant="danger">Kiểm tra kết nối rồi thử lại. <Button type="button" variant="outline" size="sm" onClick={onRetry}>Thử lại</Button></InlineAlert>}
      {model.state.kind === 'empty' && <EmptyState variant="uncreated" title="Chưa có thực đơn cho tuần đã chọn" description="Nhập Excel hoặc mở trình chỉnh sửa để bắt đầu lập kế hoạch." />}
      {model.state.kind === 'ready' && SECTIONS.map(section => {
        const rows = model.state.kind === 'ready' ? model.state.rows.filter(row => {
          const cell = Object.values(row.cells)[0]
          return cell ? getNormalizedSlotType(cell) === section.slotType : row.sourceSection === section.label
        }) : []
        const title = `${section.shift === 'morning' ? 'Trưa' : 'Tối'} · ${section.category === 'savory' ? 'Mặn' : 'Chay'}`
        return <section key={section.slotType} aria-label={title} className="planning-matrix"><h2><CalendarDays size={16} aria-hidden="true" />{title}</h2><ImportedLayoutMatrix rows={rows} displayDays={model.matrix.displayDays} activeDayKey={model.matrix.activeDayKey} maxBodyHeight="" stickyHeader /></section>
      })}
    </section>
  </main>
}
