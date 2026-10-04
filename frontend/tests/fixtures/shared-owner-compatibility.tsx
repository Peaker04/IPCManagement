/* eslint-disable react-refresh/only-export-components */
import { createRoot } from 'react-dom/client'
import { useState } from 'react'
import '@/styles/index.css'
import '@/styles/components/dashboard.css'
import '@/styles/components/tables.css'
import '@/styles/components/shell.css'
import '@/styles/components/operations.css'
import '@/styles/components/documents.css'
import '@/styles/components/domain-pages.css'
import '@/styles/components/responsive.css'
import '@/styles/ui-redesign.css'
import '@/styles/redesign/fiori.css'
import '@/styles/redesign/demand.css'
import '@/styles/redesign/responsive.css'
import '@/styles/redesign/dashboard.css'
import { CommandBar } from '@/components/common/CommandBar'
import { ContextStrip } from '@/components/common/ContextStrip'
import { TableViewport } from '@/components/common/TableViewport'
import { Button } from '@/components/ui/button'
import { Select, SelectTrigger, SelectValue, SelectContent, SelectItem } from '@/components/ui/select'
import { Dialog, DialogContent, DialogTitle, DialogDescription } from '@/components/ui/dialog'
import { WeeklyScheduleCommandBar } from '@/features/projects/weekly-menu/schedule/WeeklyScheduleCommandBar'

function Controls({ id }: { id: string }) {
  return <Select defaultValue="a"><SelectTrigger aria-label={`Khách hàng ${id}`}><SelectValue /></SelectTrigger><SelectContent><SelectItem value="a">Khách hàng mẫu A</SelectItem><SelectItem value="b">Khách hàng mẫu B</SelectItem></SelectContent></Select>
}
function Ledger({ nested = false }: { nested?: boolean }) {
  return <table className="ipc-data-table"><caption className="sr-only">Dữ liệu tổng hợp thử nghiệm</caption><thead><tr><th scope="col">Nguyên liệu</th><th scope="col">Lượng</th></tr></thead><tbody><tr><td>Nguyên liệu có dấu: ế ệ ở ồ</td><td data-cell-role="numeric">30,123456</td></tr><tr><td>Nhận diện nhiều dòng<br />Nguồn thứ hai</td><td data-cell-role="numeric">1.000.000 ₫</td></tr>{nested && <tr><td colSpan={2}><TableViewport ariaLabel="Nested default" density="compact"><Ledger /></TableViewport></td></tr>}</tbody></table>
}
function App() {
  const [open, setOpen] = useState(false)
  const [loading, setLoading] = useState(true)
  return <main className="p-6 space-y-6"><h1>Shared-owner compatibility specimen</h1><p role="note">Synthetic fixture only. No product providers or business requests.</p>
    {[false, true].map(redesign => <section key={String(redesign)} className={redesign ? 'ipc-redesign-shell' : ''} data-sample={redesign ? 'redesign' : 'plain'}>
      <h2>{redesign ? 'Redesign ancestor' : 'Plain ancestor'}</h2>
      <div data-default="command"><CommandBar actions={<><Button>Secondary</Button><button className="ipc-button-primary">Primary</button><Button>Third</Button><Button>Fourth</Button></>}><Controls id={String(redesign)} /><label>Week<input type="date" defaultValue="2026-09-28" /></label></CommandBar></div>
      <div data-default="context"><ContextStrip items={[{ label: 'Số lượng', value: '30,123456' }, { label: 'Cảnh báo', value: 'Thiếu nguồn', tone: 'warning' }]} /></div>
      <div data-default="table"><TableViewport ariaLabel={`Default ${redesign}`} density="compact" caption="Default description"><Ledger /></TableViewport></div>
      <div data-default="matrix"><TableViewport ariaLabel={`Matrix ${redesign}`} density="compact" stickyHeader={false} frozenFirstIdentifier={false}><table className="ipc-data-table ipc-matrix-grid-table"><thead><tr><th scope="col">Ca / vị trí</th><th scope="col">Thứ Hai</th></tr></thead><tbody><tr><td colSpan={2} className="ipc-menu-section-header">Ca trưa</td></tr><tr><td className="ipc-matrix-slot-cell">Món chính</td><td>Món mẫu</td></tr></tbody></table></TableViewport></div>
    </section>)}
    <section className="ipc-redesign-shell" data-sample="new"><h2>Opt-in variants</h2>
      <CommandBar variant="scope"><Controls id="scope" /><Button onClick={() => setOpen(true)}>Open dialog</Button></CommandBar>
      <ContextStrip variant="inline" items={[{ label: 'Số lượng', value: '30,123456' }, { label: 'Cảnh báo', value: 'Thiếu nguồn', tone: 'warning' }, {label:'Trạng thái',value:'Đã hoàn tất',tone:'success',emphasis:'strong'}]} />
      <TableViewport appearance="quiet-operational" density="compact" ariaLabel="Quiet ledger" caption="Quiet description"><Ledger nested /></TableViewport>
    </section>
    <section data-default="schedule-consumer"><h2>Existing Schedule command consumer</h2><WeeklyScheduleCommandBar customers={[]} selectedCustomerId="" weekStartDate="2026-09-28" isCustomerLoading={false} isImporting={false} canPublish isPublishing={false} onEdit={() => undefined} onImport={() => undefined} onPublish={() => undefined} onCustomerChange={() => undefined} onWeekChange={() => undefined} /></section>
    <section data-sample="interactions">
      <div style={{width: 420, maxWidth:'100%'}} data-wrap="scope"><CommandBar variant="scope" actions={<><Button>Inspect record</Button><Button>Export reference</Button><Button>Refresh source</Button><Button>More information</Button></>}><label>Scope label<input aria-label="Scope input" defaultValue="Long scope value" /></label></CommandBar></div>
      <Button onClick={() => setLoading(value => !value)}>Toggle loading</Button>
      <TableViewport appearance="quiet-operational" ariaLabel="Loading ledger" loading={loading} skeleton={<p role="status">Loading synthetic rows</p>}><Ledger /></TableViewport>
      <TableViewport appearance="quiet-operational" ariaLabel="Preference ledger" density="compact" preferences={{accountId:'fixture-only',config:{tableId:'shared-owner-compatibility',columns:[{id:'identity',label:'Identity',locked:true},{id:'quantity',label:'Quantity'}]}}}>{({columns}) => <table className="ipc-data-table"><thead><tr>{columns.map(column => <th scope="col" key={column.id}>{column.label}</th>)}</tr></thead><tbody><tr>{columns.map(column => <td key={column.id}>{column.id === 'quantity' ? '30,123456' : 'Identity value'}</td>)}</tr></tbody></table>}</TableViewport>
      <TableViewport appearance="quiet-operational" ariaLabel="Sticky ledger" size="weekly" density="compact"><table className="ipc-data-table" style={{minWidth:1800}}><thead><tr><th scope="col">Identity</th><th scope="col">Full amount</th></tr></thead><tbody>{Array.from({length:30},(_,i)=><tr key={i}><td>Record {i+1}</td><td data-cell-role="numeric">123.456.789.012 ₫</td></tr>)}</tbody></table></TableViewport>
      <div data-default="specialized"><TableViewport ariaLabel="ERP specialized" density="compact"><table className="ipc-data-table ipc-erp-grid-table"><thead><tr><th scope="col">Identity</th><th scope="col">Amount</th></tr></thead><tbody><tr><td>Record</td><td data-cell-role="numeric">123.456 ₫</td></tr></tbody></table></TableViewport></div>
    </section>
    <Dialog open={open} onOpenChange={setOpen}><DialogContent><DialogTitle>Compatibility dialog</DialogTitle><DialogDescription>Portal and focus regression</DialogDescription><Controls id="dialog" /><Button onClick={() => setOpen(false)}>Close dialog</Button></DialogContent></Dialog>
  </main>
}
createRoot(document.getElementById('root')!).render(<App />)
