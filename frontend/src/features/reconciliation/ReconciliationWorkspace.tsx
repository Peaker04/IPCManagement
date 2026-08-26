import { useMemo, useState } from 'react'
import { useAppSelector } from '@/app/hooks'
import { ConfirmDialog } from '@/components/common'
import { Button } from '@/components/ui/button'
import { useSystemOperation } from '@/features/system-operation/systemOperationContext'
import { ReconciliationBatchTable } from './ReconciliationBatchTable'
import { ReconciliationComparisonTable } from './ReconciliationComparisonTable'
import { ReconciliationActualDrawer } from './ReconciliationActualDrawer'
import { ReconciliationDispositionDrawer } from './ReconciliationDispositionDrawer'
import { describeReconciliationError } from './reconciliationErrors'
import {
  useCommitReconciliationQuantityImportMutation,
  useCompleteReconciliationBatchMutation,
  useListReconciliationBatchesQuery,
  usePreviewReconciliationQuantityImportMutation,
  useReadyReconciliationBatchMutation,
  type QuantityImportCommit,
} from './reconciliationApi'

type ReconciliationWorkspaceProps = {
  owner: 'weekly-menu'|'purchasing'|'warehouse'|'reports'
  menuVersionId?: string | null
  menuVersionLabel?: string
}

export function ReconciliationWorkspace({ owner, menuVersionId, menuVersionLabel }: ReconciliationWorkspaceProps) {
  const mode = useSystemOperation()
  if (mode?.mode !== 'MATERIAL_RECONCILIATION') return null
  return <ActiveReconciliationWorkspace owner={owner} menuVersionId={menuVersionId} menuVersionLabel={menuVersionLabel} />
}

function ActiveReconciliationWorkspace({ owner, menuVersionId, menuVersionLabel }: ReconciliationWorkspaceProps) {
  const user = useAppSelector((state) => state.auth.user)
  const { data = [], isLoading, isError, refetch } = useListReconciliationBatchesQuery()
  const canCoordinate = Boolean(user && (user.isAdminFullAccess || ['admin', 'quanly', 'dieuphoi'].includes(user.role) || user.permissions.includes('*') || user.permissions.includes('coordination.read')))
  const canDecide = Boolean(user && (user.isAdminFullAccess || ['admin', 'quanly'].includes(user.role) || user.permissions.includes('*')))
  const [selectedId, setSelectedId] = useState<string>()
  const [showAll, setShowAll] = useState(false)
  const [editingLineId, setEditingLineId] = useState<string>()
  const [disposingLineId, setDisposingLineId] = useState<string>()
  const [actionError, setActionError] = useState<{ message: string; canRefetch: boolean }>()
  const [isCommitOpen, setIsCommitOpen] = useState(false)
  const [quantityImportResult, setQuantityImportResult] = useState<QuantityImportCommit>()
  const selected = useMemo(() => data.find((batch) => batch.batchId === (selectedId ?? data[0]?.batchId)), [data, selectedId])
  const editing = selected?.lines.find((line) => line.batchLineId === editingLineId)
  const disposing = selected?.lines.find((line) => line.batchLineId === disposingLineId)
  const [previewQuantityImport, previewQuery] = usePreviewReconciliationQuantityImportMutation()
  const [commitQuantityImport, { isLoading: isCommittingImport }] = useCommitReconciliationQuantityImportMutation()
  const [ready, { isLoading: isReadying }] = useReadyReconciliationBatchMutation()
  const [complete, { isLoading: isCompleting }] = useCompleteReconciliationBatchMutation()

  const runAction = async (action: () => Promise<unknown>) => {
    setActionError(undefined)
    try { await action() } catch (error) { setActionError(describeReconciliationError(error)) }
  }
  const reload = () => { refetch(); setActionError(undefined) }
  const preview = previewQuery.data
  const previewPlanCount = preview?.plans.length ?? 0
  const previewLineCount = preview?.plans.reduce((count, plan) => count + plan.lines.length, 0) ?? 0
  const previewBlocked = !preview || previewPlanCount === 0 || previewLineCount === 0 || preview.diagnostics.length > 0
  const sourceLabel = menuVersionLabel?.trim() || 'Phiên bản thực đơn đã chọn'
  const previewSource = async () => {
    if (!menuVersionId) return
    setActionError(undefined)
    setQuantityImportResult(undefined)
    try { await previewQuantityImport({ menuVersionId, sourceLabel }).unwrap() }
    catch (error) { setActionError(describeReconciliationError(error)) }
  }
  const commitSource = async () => {
    if (!preview || previewBlocked) return
    setIsCommitOpen(false)
    setActionError(undefined)
    try {
      const result = await commitQuantityImport({ token: preview.token, contentFingerprint: preview.contentFingerprint, sourceLabel }).unwrap()
      setQuantityImportResult(result)
      setSelectedId(result.reconciliationBatchId)
    } catch (error) { setActionError(describeReconciliationError(error)) }
  }

  return <section className="mt-6 space-y-4 rounded-lg border border-slate-200 bg-white p-4" aria-label="Đối chiếu nguyên liệu">
    <div className="flex flex-wrap items-center justify-between gap-2">
      <div><h2 className="text-lg font-semibold">Đối chiếu nguyên liệu</h2><p className="text-sm text-slate-600">Số liệu riêng của lô, không tạo phiếu mua, nhập, xuất hoặc biến động tồn.</p></div>
      <div className="flex gap-2">
        {selected && owner === 'weekly-menu' && canCoordinate && selected.status === 'DRAFT' && <Button disabled={isReadying} onClick={() => runAction(() => ready({ id: selected.batchId, expectedVersion: selected.version }).unwrap())}>Sẵn sàng đối chiếu</Button>}
        {selected && owner === 'reports' && canDecide && selected.status === 'IN_PROGRESS' && <Button disabled={isCompleting} onClick={() => runAction(() => complete({ id: selected.batchId, expectedVersion: selected.version }).unwrap())}>Hoàn tất đối chiếu</Button>}
      </div>
    </div>

    {owner === 'weekly-menu' && canCoordinate && <div className="space-y-3 rounded border border-slate-200 p-3" aria-label="Nguồn số suất đối chiếu">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div><p className="text-sm font-medium text-slate-900">{sourceLabel}</p><p className="text-sm text-slate-600">Kiểm tra số suất hoàn tất trước khi tạo lô đối chiếu nháp.</p></div>
        <Button type="button" variant="outline" disabled={!menuVersionId || previewQuery.isLoading || isCommittingImport} onClick={() => void previewSource()}>{previewQuery.isLoading ? 'Đang kiểm tra...' : 'Kiểm tra nguồn số suất'}</Button>
      </div>
      {!menuVersionId && <p className="text-sm text-slate-600">Chọn một thực đơn tuần đã lưu để kiểm tra nguồn số suất.</p>}
      {previewQuery.isError && !actionError && <p className="text-sm text-red-700" role="alert">Không kiểm tra được nguồn số suất. Hãy thử lại.</p>}
      {preview && <div className="space-y-2" aria-live="polite">
        <p className="text-sm font-medium">{previewPlanCount} kế hoạch · {previewLineCount} dòng nguồn</p>
        <p className="text-xs text-slate-600">Dấu vân tay nguồn: <code>{preview.contentFingerprint.slice(0, 12)}</code></p>
        {preview.diagnostics.length > 0 && <div role="alert" className="space-y-1 text-sm text-amber-800">{preview.diagnostics.map((diagnostic) => <p key={diagnostic}>{diagnostic}</p>)}</div>}
        <Button type="button" disabled={previewBlocked || isCommittingImport} onClick={() => setIsCommitOpen(true)}>Cam kết nguồn số suất</Button>
      </div>}
      {quantityImportResult && <div className="space-y-1 text-sm" aria-live="polite">
        <p className="font-medium text-emerald-800">{quantityImportResult.idempotentReplay ? 'Nguồn này đã được cam kết trước đó.' : 'Đã tạo nguồn số suất và lô đối chiếu nháp.'}</p>
        <p>Mã nguồn nhập: <code>{quantityImportResult.importBatchId}</code></p>
        <p>Mã lô đối chiếu: <code>{quantityImportResult.reconciliationBatchId}</code></p>
        <p>Dấu vân tay: <code>{quantityImportResult.contentFingerprint}</code></p>
      </div>}
      <ConfirmDialog open={isCommitOpen} title="Cam kết nguồn số suất?" description={`${sourceLabel} · ${previewPlanCount} kế hoạch · ${previewLineCount} dòng nguồn. Hệ thống sẽ tạo đúng một nguồn nhập và một lô đối chiếu nháp.`} confirmLabel="Cam kết nguồn" busy={isCommittingImport} onConfirm={() => void commitSource()} onOpenChange={setIsCommitOpen} />
    </div>}

    {actionError && <div className="space-y-2" role="alert"><p className="text-sm text-red-700">{actionError.message}</p>{actionError.canRefetch && <Button type="button" variant="outline" size="sm" onClick={reload}>Tải lại dữ liệu</Button>}</div>}
    {isLoading ? <p>Đang tải lô đối chiếu...</p> : isError ? <p role="alert">Không tải được lô đối chiếu. <Button type="button" variant="link" className="h-auto p-0" onClick={() => refetch()}>Thử lại</Button></p> : data.length === 0 ? <p>Chưa có lô đối chiếu.</p> : <>
      <ReconciliationBatchTable batches={data} selectedId={selected?.batchId} onSelect={setSelectedId}/>
      {selected && <><div className="flex justify-end"><Button type="button" variant="link" className="h-auto p-0 text-sm" onClick={() => setShowAll((value) => !value)}>{showAll ? 'Chỉ hiện dòng cần xử lý' : 'Hiện tất cả'}</Button></div><ReconciliationComparisonTable lines={selected.lines} showAll={showAll} onEdit={owner === 'purchasing' || owner === 'warehouse' ? (line) => setEditingLineId(line.batchLineId) : undefined} onDisposition={owner === 'reports' && canDecide ? (line) => setDisposingLineId(line.batchLineId) : undefined}/></>}
    </>}
    {editing && <ReconciliationActualDrawer key={`${editing.batchLineId}:${editing.purchasedVersion ?? 'new'}:${editing.issuedVersion ?? 'new'}`} line={editing} side={owner === 'warehouse' ? 'issued' : 'purchased'} onClose={() => setEditingLineId(undefined)} onRefetch={reload}/>}
    {disposing && <ReconciliationDispositionDrawer key={`${disposing.batchLineId}:${disposing.disposition?.version ?? 'new'}:${disposing.purchasedVersion ?? 'new'}:${disposing.issuedVersion ?? 'new'}`} line={disposing} onClose={() => setDisposingLineId(undefined)} onRefetch={reload}/>}
  </section>
}
