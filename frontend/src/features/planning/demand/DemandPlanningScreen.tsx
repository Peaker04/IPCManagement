import { Fragment, useLayoutEffect, useRef, useState } from 'react'
import { Link } from 'react-router-dom'
import { AlertTriangle, Calculator, Check, CircleCheck, CircleHelp, Clock3, ChevronDown, LockKeyhole, RefreshCw } from 'lucide-react'
import { CommandBar, ConfirmDialog, InlineAlert, PaginationBar, StatusBadge, TableViewport } from '@/components/common'
import { ActionGuard } from '@/components/common/ActionGuard'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { useDebouncedValue } from '@/lib/useDebouncedValue'
import { formatQuantity, formatUnit } from '@/lib/formatters'
import { formatImportDate } from '@/features/projects/weekly-menu/model/formatters'
import { formatBomTierLabel } from '@/features/projects/weeklyMenuPlanning'
import type { MaterialDemandWorkflow } from '@/features/projects/weekly-menu/demand/useMaterialDemand'
import { QuickServingCell } from '@/features/projects/weekly-menu/schedule/QuickServingCell'
import type { WeeklyScheduleEditorWorkflow, WeeklyScheduleFeedback } from '@/features/projects/weekly-menu/schedule/types'
import type { SchedulePageModel } from '../schedule/schedulePageModel'
import './DemandPlanningScreen.css'

type Props = {
  workflow: MaterialDemandWorkflow
  scheduleWorkflow: WeeklyScheduleEditorWorkflow
  servingFeedback?: WeeklyScheduleFeedback | null
  coordinates: SchedulePageModel['scope']
  pricing: SchedulePageModel['pricing']
  inputPhase: 'ready' | 'loading' | 'error' | 'forbidden'
  onCustomerChange: (id: string) => void
  onWeekChange: (date: string) => void
  onRetryInputs: () => void
}

const quantity = (value: number | undefined) => value === undefined ? '—' : formatQuantity(value, { maximumFractionDigits: 6 })

export function DemandPlanningScreen({ workflow, scheduleWorkflow, servingFeedback, coordinates, pricing, inputPhase, onCustomerChange, onWeekChange, onRetryInputs }: Props) {
  const { scope, weeklyCommand, presentation: targetView, dataState, status, state, actions } = workflow
  const scopeKey = `${scope.customerId}:${scope.weekStartDate}`
  const [committed, setCommitted] = useState<{ scopeKey: string; view: MaterialDemandWorkflow['presentation'] } | null>(null)
  const readable = Boolean(scope.customerId && scope.weekStartDate) && inputPhase === 'ready' && dataState.phase === 'ready'
  if (readable && (committed?.scopeKey !== scopeKey || committed.view !== targetView)) setCommitted({ scopeKey, view: targetView })
  else if (!readable && committed && (committed.scopeKey !== scopeKey || inputPhase !== 'ready' || dataState.phase !== 'loading')) setCommitted(null)
  const transitioning = !readable && inputPhase === 'ready' && dataState.phase === 'loading' && committed?.scopeKey === scopeKey
  const view = transitioning && committed ? committed.view : targetView
  const refreshing = dataState.phase === 'ready' && dataState.isRefreshing
  const pending = Boolean(transitioning || refreshing || status.isFetchingAggregate)
  const [sourceView, setSourceView] = useState(false)
  const [search, setSearch] = useState('')
  const [filter, setFilter] = useState('all')
  const debouncedSearch = useDebouncedValue(search)
  const debouncedFilter = useDebouncedValue(filter)
  const [expanded, setExpanded] = useState<string | null>(null)
  const [confirmation, setConfirmation] = useState(false)
  const [submitting, setSubmitting] = useState(false)
  const submitLock = useRef(false)
  const customerControl = useRef<HTMLSelectElement>(null)
  const weekControl = useRef<HTMLInputElement>(null)
  const missingScope = !scope.customerId || !scope.weekStartDate
  const isReady = readable && !pending
  if (confirmation && !isReady) setConfirmation(false)
  const retained = !missingScope && inputPhase === 'ready' && status.hasRetainedDemand
  const busy = submitting || status.isGenerating || status.isSavingQuickServings || scheduleWorkflow.status.isSavingQuickServings
  const eligible = weeklyCommand.dates.filter(date => !date.unavailable && date.preflight?.canRegenerate)
  const canCalculate = isReady && !pricing.blockedReason && eligible.length > 0 && status.stalenessState === 'ready'
    && !weeklyCommand.invalidTier && !weeklyCommand.missingPortions && view.missingBomRows.length === 0
  const command = weeklyCommand.dates.some(date => date.preflight?.hasExistingPlan) ? 'Tính lại nhu cầu tuần' : 'Tính nhu cầu tuần'
  const lines = view.aggregateLines
  const rowsScroller = useRef<HTMLDivElement>(null)
  useLayoutEffect(() => {
    if (rowsScroller.current) rowsScroller.current.scrollTop = 0
  }, [scopeKey, view.activeDay?.key, view.aggregatePage?.pageNumber])
  const term = (search ? debouncedSearch : '').trim().toLocaleLowerCase('vi-VN')
  const appliedFilter = filter === 'all' ? 'all' : debouncedFilter
  const projectedPurchase = (line: typeof lines[number]) => line.projectedPurchaseQty
  const visible = lines.filter(line => (!term || `${line.material} ${line.source} ${line.unit}`.toLocaleLowerCase('vi-VN').includes(term))
    && (appliedFilter === 'all' || (appliedFilter === 'purchase' ? (projectedPurchase(line) ?? 0) > 0 : (line.historicalAllocatedQty ?? 0) > 0)))
  const activeDate = view.activeDate || view.activeDay?.rows?.[0]?.serviceDate
  const dayPreflight = weeklyCommand.dates.find(date => date.serviceDate === activeDate)?.preflight
  const groups = [...new Set(view.activeRows.map(row => row.shiftLabel))].map(shiftLabel => {
    const rows = view.activeRows.filter(row => row.shiftLabel === shiftLabel)
    return { shiftLabel, rows, serving: scheduleWorkflow.presentation.getQuickServingRow(view.activeQuickServingRows, rows[0]) }
  })
  const incomplete = groups.some(group => !group.serving?.isCompleted)
  const sourceError = inputPhase === 'error' || inputPhase === 'forbidden'
  const queryError = dataState.phase === 'error' || dataState.phase === 'forbidden'
  const denied = inputPhase === 'forbidden' || dataState.phase === 'forbidden'
  const loading = !missingScope && (inputPhase === 'loading' || dataState.phase === 'loading' || (dataState.phase === 'uninitialized' && view.dayPages.length > 0))
  const scheduleHref = `/__kit/planning/schedule?${new URLSearchParams({ customerId: scope.customerId, weekStartDate: scope.weekStartDate })}`

  async function calculate() {
    if (!canCalculate || busy || submitLock.current) return
    submitLock.current = true
    setSubmitting(true)
    try {
      await actions.generate()
      setConfirmation(false)
    } finally {
      submitLock.current = false
      setSubmitting(false)
    }
  }

  const servingSource = <div className="demand-source">
    {groups.map(({ shiftLabel, rows, serving }) => <section key={shiftLabel} className="demand-shift">
      <div className="demand-shift-heading"><h3>{shiftLabel}</h3>
        {serving?.isCompleted ? <p className="demand-serving-fact"><strong>{quantity(serving.currentServings)} suất</strong><StatusBadge tone="success" size="sm"><Check size={14} aria-hidden="true" />Đã hoàn tất</StatusBadge></p> : serving && isReady && !retained ? <ActionGuard allowedRoles={['quanly', 'dieuphoi']} requiredPermissions={['coordination.order.lock']}>
          <div className="demand-serving-controls"><QuickServingCell row={serving} workflow={scheduleWorkflow} />
            <Button type="button" variant="outline" size="sm" disabled={busy || scheduleWorkflow.status.isSavingQuickServings || !Number.isFinite(Number(serving.inputValue)) || Number(serving.inputValue) <= 0} onClick={() => void scheduleWorkflow.actions.completeQuickServing(serving)}>Hoàn tất {shiftLabel}</Button>
          </div>
        </ActionGuard> : <p>{serving ? 'Số suất lần tải trước — chỉ đọc.' : 'Chưa có kế hoạch số suất cho ca này.'}</p>}
      </div>
      <ul className="demand-dishes">{rows.map(row => <li key={row.key}><span>{row.dishName}</span><span className="demand-bom" data-missing-bom={!row.hasCatalogBom || undefined}>{row.hasCatalogBom ? <Check size={14} aria-hidden="true" /> : <AlertTriangle size={14} aria-hidden="true" />}{row.hasCatalogBom ? 'BOM hiệu lực' : 'Thiếu BOM hiệu lực'}</span></li>)}</ul>
    </section>)}
  </div>

  const weeklyConditions = !missingScope && <details className="demand-readiness"><summary>Điều kiện tính tuần</summary>
    <div>{pricing.blockedReason && <p>{pricing.blockedReason}</p>}{weeklyCommand.invalidTier && <p>Định mức trong tuần không hợp lệ.</p>}{view.missingBomRows.length > 0 && <p>{view.missingBomRows.length} dòng món thiếu BOM đúng khách hàng, ngày và định mức.</p>}{weeklyCommand.missingPortions && <p>Còn dòng món chưa có số suất vận hành.</p>}{status.stalenessState !== 'ready' && <p>Chưa kiểm tra đủ các ngày trong tuần.</p>}
      {weeklyCommand.dates.map(date => <p key={date.serviceDate}><strong>{formatImportDate(date.serviceDate)}</strong> — {date.unavailable ? 'Chưa kiểm tra được' : date.preflight?.canRegenerate ? 'Có thể tính nhu cầu' : `Giữ nguyên: ${date.preflight?.regenerationBlockReason ?? 'Đã khóa'}`}</p>)}
    </div>
  </details>

  return <main className="demand-screen" data-testid="demand-planning-screen">
    <header className="demand-masthead">
      <div className="demand-heading"><p>Kế hoạch &amp; Điều phối</p><h1>Nhu cầu nguyên liệu</h1></div>
      <CommandBar variant="scope" actions={<div className="demand-week-action" data-read-pending={pending || undefined}><ActionGuard allowedRoles={['quanly', 'dieuphoi']} requiredPermissions={['demand.generate']}>
        <Button type="button" size="sm" disabled={!canCalculate || busy} onClick={() => setConfirmation(true)}>{busy ? <RefreshCw aria-hidden="true" /> : <Calculator aria-hidden="true" />}{busy ? 'Đang tính nhu cầu tuần…' : command}</Button>
      </ActionGuard></div>}>
      <div className="demand-coordinates">
        <label>Khách hàng<select ref={customerControl} value={coordinates.customerId} disabled={busy} onChange={event => onCustomerChange(event.target.value)}><option value="">Chọn khách hàng</option>{coordinates.customers.map(customer => <option key={customer.customerId} value={customer.customerId}>{customer.customerCode} — {customer.customerName}</option>)}</select></label>
        <label>Tuần bắt đầu<Input ref={weekControl} type="date" weekStartOnly value={coordinates.weekStartDate} disabled={busy} onChange={event => onWeekChange(event.target.value)} /></label>
        {!missingScope && pricing.tier && <p className="demand-tier"><span>Định mức</span><strong>{formatBomTierLabel(pricing.tier)}</strong></p>}

      </div></CommandBar>
      {weeklyConditions}
    </header>

    {state.feedback && <InlineAlert role="status" title={state.feedback.title} variant={state.feedback.variant}>{state.feedback.message}
      {state.generationResults && <ul>{state.generationResults.map(result => <li key={result.serviceDate}>{formatImportDate(result.serviceDate)} — {result.status === 'success' ? 'Đã tính nhu cầu' : result.status === 'failed' ? 'Không thành công' : 'Giữ nguyên'}{result.reason && `: ${result.reason}`}</li>)}</ul>}
    </InlineAlert>}

    {servingFeedback && <InlineAlert role={servingFeedback.variant === 'danger' ? 'alert' : 'status'} title={servingFeedback.title} variant={servingFeedback.variant}>{servingFeedback.message}</InlineAlert>}

    {retained && <InlineAlert role="alert" title="Dữ liệu lần tải trước — đã cũ" variant="warning">Chưa cập nhật được nhu cầu. Dữ liệu dưới đây chỉ để đọc; thử lại trước khi thao tác.<Button type="button" variant="outline" size="sm" onClick={() => void actions.retryDemand()}>Thử lại</Button></InlineAlert>}

    {missingScope ? <section className="demand-state"><h2>Chọn phạm vi lập nhu cầu</h2><p>Chọn khách hàng và tuần ở trên. Lệnh tính áp dụng cho tuần; nguyên liệu được kiểm tra riêng từng ngày.</p><Button type="button" variant="outline" size="sm" onClick={() => (!scope.customerId ? customerControl.current : weekControl.current)?.focus()}>{!scope.customerId ? 'Chọn khách hàng' : 'Chọn tuần bắt đầu'}</Button></section>
      : sourceError || (queryError && !retained) ? <section className="demand-state" role="alert"><h2><AlertTriangle size={20} aria-hidden="true" />{denied ? 'Không đủ quyền xem nhu cầu' : 'Chưa tải được dữ liệu nhu cầu'}</h2><p>{denied ? 'Không thể đọc dữ liệu của phạm vi này. Liên hệ quản trị viên để kiểm tra quyền.' : 'Giữ nguyên khách hàng và tuần đã chọn. Thử tải lại trước khi tính nhu cầu.'}</p>{!denied && <Button type="button" variant="outline" size="sm" onClick={() => sourceError ? onRetryInputs() : void actions.retryDemand()}>Thử lại</Button>}</section>
      : loading && !transitioning ? <section className="demand-state" aria-busy="true"><h2>Đang tải nhu cầu</h2><p role="status">Đang kiểm tra nguồn và nhu cầu của tuần đã chọn.</p><div className="demand-skeleton" aria-hidden="true">{Array.from({ length: 6 }, (_, i) => <div key={i} />)}</div></section>
      : view.dayPages.length === 0 ? <section className="demand-state"><h2>Chưa có kế hoạch sản xuất trong tuần đã chọn</h2><p>Kiểm tra thực đơn và số suất tại Kế hoạch tuần trước khi lập nhu cầu.</p><Link to={scheduleHref}>Mở Kế hoạch tuần</Link></section>
      : <div className="demand-workbench">
        <nav className="demand-days" aria-label="Ngày xem nhu cầu"><h2>Ngày phục vụ</h2><ul>{view.dayPages.map(day => {
          const date = day.rows?.[0]?.serviceDate
          const info = weeklyCommand.dates.find(item => item.serviceDate === date)
          return <li key={day.key}><button type="button" aria-current={!sourceView && day.key === view.activeDay?.key ? 'date' : undefined} disabled={busy} onClick={() => { setSourceView(false); setExpanded(null); setSearch(''); setFilter('all'); actions.selectDay(day.key) }}><strong>{day.label}</strong><span>{day.date}</span><small data-stale={!info?.unavailable && info?.preflight?.canRegenerate !== false && info?.preflight?.isStale || undefined}>{info?.unavailable || !info?.preflight ? <><CircleHelp size={12} aria-hidden="true" />Chưa kiểm tra</> : info.preflight.canRegenerate === false ? <><LockKeyhole size={12} aria-hidden="true" />Chỉ xem</> : info.preflight.isStale ? <><AlertTriangle size={12} aria-hidden="true" />Cần tính lại</> : info.preflight.hasExistingPlan ? <><CircleCheck size={12} aria-hidden="true" />Đã tính</> : <><Clock3 size={12} aria-hidden="true" />Chưa tính</>}</small></button></li>
        })}</ul><div className="demand-source-nav"><button type="button" aria-current={sourceView ? 'true' : undefined} disabled={busy} onClick={() => setSourceView(true)}>Số suất và món nguồn</button></div></nav>
        <section className="demand-day" aria-label="Nhu cầu ngày đang chọn" aria-busy={pending}>
          <header className="demand-day-heading"><div><div className="demand-day-identity"><h2>{sourceView ? 'Số suất và món nguồn · ' : ''}{view.activeDay?.label} · {view.activeDay?.date}</h2>{!sourceView && <StatusBadge className="demand-approval" tone={view.demandApprovalStatus.tone}>{view.demandApprovalStatus.tone === 'warning' ? <Clock3 size={14} aria-hidden="true" /> : view.demandApprovalStatus.tone === 'danger' ? <AlertTriangle size={14} aria-hidden="true" /> : view.demandApprovalStatus.tone === 'success' ? <Check size={14} aria-hidden="true" /> : null}{view.demandApprovalStatus.label}</StatusBadge>}</div><p>{sourceView ? `${groups.length} ca · số suất và BOM theo món` : lines.length > 0 ? `${view.aggregatePage?.totalCount ?? lines.length} nguyên liệu · số lượng theo đơn vị từng dòng` : 'Nhu cầu nguyên liệu của ngày đang chọn'}</p></div><span className="demand-day-status">{sourceView && <label className="demand-source-date">Ngày xem nguồn<select value={view.activeDay?.key ?? ''} disabled={busy || pending} onChange={event => { setExpanded(null); setSearch(''); setFilter('all'); actions.selectDay(event.target.value) }}>{view.dayPages.map(day => <option key={day.key} value={day.key}>{day.label} · {day.date}</option>)}</select></label>}<span className="demand-activity" aria-hidden="true" data-pending={pending || undefined}><RefreshCw size={14} /></span><span role="status" className="sr-only">{transitioning ? `Đang tải ${targetView.activeDay?.label} · ${targetView.activeDay?.date} · trang ${state.aggregatePageNumber ?? 1}. Đang xem ngày/trang trước, chỉ đọc.` : pending ? 'Đang cập nhật. Dữ liệu đang xem chỉ đọc.' : ''}</span></span></header>
          {sourceView ? <div className="demand-source-scroll" role="region" aria-label="Số suất và món nguồn của ngày đang chọn" tabIndex={0}>{groups.length > 0 ? servingSource : <p className="demand-uncreated">Chưa có ca và món nguồn cho ngày này.</p>}</div> : <>
          {dayPreflight?.canRegenerate === false && <p className="demand-day-note" data-tone="neutral"><LockKeyhole size={16} aria-hidden="true" />{dayPreflight.regenerationBlockReason || 'Ngày đã khóa, chỉ xem nhu cầu.'}</p>}
          {dayPreflight?.isStale && <p className="demand-day-note"><AlertTriangle size={16} aria-hidden="true" />Nguồn đã thay đổi: {dayPreflight.reasons.join(' · ')}. Nhu cầu dưới đây là lần tính trước.</p>}
          {(readable || retained || transitioning) && lines.length > 0 ? <>
            <div className="demand-filters"><label>Tìm trong trang<input type="search" value={search} onChange={event => { setExpanded(null); setSearch(event.target.value) }} /></label><label>Phân bổ trong trang<select value={filter} onChange={event => { setExpanded(null); setFilter(event.target.value) }}><option value="all">Tất cả</option><option value="purchase">Có đề xuất mua</option><option value="allocation">Có phân bổ</option></select></label>{(search || filter !== 'all') && <Button type="button" size="sm" variant="ghost" onClick={() => { setSearch(''); setFilter('all') }}>Xóa bộ lọc</Button>}</div>
            <div ref={rowsScroller} className="demand-table-scroll" role="region" aria-label="Bảng nguyên liệu ngày" tabIndex={0}>
              <TableViewport appearance="quiet-operational" density="compact" ariaLabel="Bảng lượng nguyên liệu dự kiến"><table className="ipc-data-table demand-table"><caption className="sr-only">Nhu cầu và phân bổ dự kiến của ngày đang chọn; không phải tồn kho hiện tại hoặc bàn giao vật lý; tìm kiếm chỉ áp dụng trang hiện tại.</caption><colgroup><col /><col className="demand-column-unit" /><col className="demand-column-quantity" span={3} /></colgroup><thead><tr><th scope="col">Nguyên liệu</th><th scope="col">Đơn vị</th><th scope="col" className="demand-number">Nhu cầu</th><th scope="col" className="demand-number">Đã phân bổ khi tính</th><th scope="col" className="demand-number">Đề xuất mua khi tính</th></tr></thead><tbody>
                {visible.map(line => <Fragment key={line.id}><tr><th scope="row"><button type="button" aria-expanded={expanded === line.id} aria-controls={`demand-line-${line.id}`} onClick={() => setExpanded(expanded === line.id ? null : line.id)}><ChevronDown size={14} aria-hidden="true" /><span>{line.material}</span></button></th><td>{formatUnit(line.unit)}</td><td className="demand-number demand-required">{quantity(line.required)}</td><td className="demand-number">{quantity(line.historicalAllocatedQty)}</td><td className="demand-number">{quantity(projectedPurchase(line))}</td></tr>
                  {expanded === line.id && <tr className="demand-line-detail" id={`demand-line-${line.id}`} onKeyDown={event => { if (event.key === 'Escape') { setExpanded(null); event.currentTarget.previousElementSibling?.querySelector('button')?.focus() } }}><td colSpan={5}><div className="demand-line-content"><div><h3>Nguồn món</h3><p>{line.source || 'Chưa có nguồn món trong dữ liệu trả về.'}</p>{(view.demandLines ?? []).filter(source => source.serviceDate === activeDate && source.ingredientId === line.ingredientId && source.unitId === line.unitId && source.priceTierAmount === line.priceTierAmount).length > 0 && <ul>{(view.demandLines ?? []).filter(source => source.serviceDate === activeDate && source.ingredientId === line.ingredientId && source.unitId === line.unitId && source.priceTierAmount === line.priceTierAmount).map(source => <li key={source.id}>{source.source} · {quantity(source.required)} {formatUnit(source.unit)}</li>)}</ul>}</div><dl><div><dt>Phân bổ tại lần tính</dt><dd>{quantity(line.historicalAllocatedQty)} {formatUnit(line.unit)}</dd></div><div><dt>Đề xuất mua tại lần tính</dt><dd>{quantity(projectedPurchase(line))} {formatUnit(line.unit)}</dd></div></dl><Button type="button" variant="ghost" size="sm" onClick={event => { const trigger = event.currentTarget.closest('tr')?.previousElementSibling?.querySelector('button'); setExpanded(null); trigger?.focus() }}>Đóng chi tiết</Button></div></td></tr>}
                </Fragment>)}
              </tbody></table></TableViewport>
              {visible.length === 0 && <p className="demand-filter-empty" role="status">Không có nguyên liệu khớp bộ lọc trong trang này. Xóa bộ lọc để xem lại.</p>}
            </div>
            {view.aggregatePage && <PaginationBar page={view.aggregatePage.pageNumber} pageSize={view.aggregatePage.pageSize} totalItems={view.aggregatePage.totalCount} itemLabel="nguyên liệu" preserveFocusWhilePending isPending={pending} onPageChange={page => { setExpanded(null); setSearch(''); setFilter('all'); actions.setAggregatePage(page) }} />}
          </> : <div className="demand-empty-scroll"><div className="demand-uncreated"><h3>{incomplete ? 'Hoàn tất số suất để lập nhu cầu' : 'Ngày này chưa có dòng nhu cầu'}</h3><p>{incomplete ? 'Mở Số suất và món nguồn để nhập và hoàn tất số suất theo ca. Lệnh tính tuần kiểm tra cả các ngày còn lại.' : 'Kiểm tra điều kiện tính tuần ở đầu màn hình, rồi dùng lệnh tính nhu cầu tuần.'}</p><Button type="button" variant="outline" size="sm" onClick={() => setSourceView(true)}>Xem số suất và món nguồn</Button></div></div>}
          </>}
        </section>
      </div>}

    <ConfirmDialog open={confirmation && !retained && isReady} variant="default" title={`${command}?`} description={`${scope.customerLabel} · tuần bắt đầu ${formatImportDate(scope.weekStartDate)}. Mỗi ngày được xử lý riêng, không phải giao dịch toàn tuần; có thể thành công một phần.`} confirmLabel="Xác nhận tính nhu cầu tuần" busy={busy} busyLabel="Đang tính nhu cầu…" onOpenChange={open => { if (!busy) setConfirmation(open) }} onConfirm={() => void calculate()}>
      <ul className="demand-confirm-dates">{weeklyCommand.dates.map(date => <li key={date.serviceDate}><strong>{formatImportDate(date.serviceDate)}</strong><span>{date.unavailable ? 'Chưa kiểm tra được' : date.preflight?.canRegenerate ? 'Sẽ tính nhu cầu' : `Giữ nguyên: ${date.preflight?.regenerationBlockReason ?? 'Ngày đã khóa'}`}</span></li>)}</ul>
      {weeklyCommand.pendingServings.length > 0 && <p>Trước khi tính, thao tác sẽ lưu và hoàn tất {weeklyCommand.pendingServings.length} ca có số suất đang nhập: {weeklyCommand.pendingServings.map(row => `${formatImportDate(row.serviceDate)} · ${row.shiftLabel}`).join('; ')}.</p>}
    </ConfirmDialog>
  </main>
}
