import { useMemo, useState } from 'react'
import { Copy, Check, SlidersHorizontal } from 'lucide-react'
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
  owner: 'weekly-menu' | 'purchasing' | 'warehouse' | 'reports'
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
  const [copiedKey, setCopiedKey] = useState<string>()
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

  const handleCopyText = async (key: string, text: string) => {
    try {
      await navigator.clipboard.writeText(text)
      setCopiedKey(key)
      setTimeout(() => setCopiedKey(undefined), 2000)
    } catch {
      // ignore clipboard error
    }
  }

  return (
    <section className="mt-6 space-y-4 rounded-lg border border-slate-200 bg-white p-5 shadow-xs" aria-label="Không gian đối chiếu nguyên liệu">
      <div className="flex flex-wrap items-center justify-between gap-3 border-b border-slate-100 pb-4">
        <div>
          <div className="flex items-center gap-2">
            <SlidersHorizontal size={18} className="text-slate-600" />
            <h2 className="text-lg font-semibold text-slate-900">Đối chiếu nguyên liệu</h2>
          </div>
          <p className="mt-0.5 text-sm text-slate-600">
            Số liệu độc lập của lô đối chiếu, không phát sinh giao dịch xuất/nhập/tồn kho thực tế.
          </p>
        </div>
        <div className="flex gap-2">
          {selected && owner === 'weekly-menu' && canCoordinate && selected.status === 'DRAFT' && (
            <Button
              disabled={isReadying}
              aria-label={`Sẵn sàng đối chiếu cho lô …${selected.batchId.slice(-8)}`}
              onClick={() => runAction(() => ready({ id: selected.batchId, expectedVersion: selected.version }).unwrap())}
            >
              {isReadying ? 'Đang cập nhật...' : 'Sẵn sàng đối chiếu'}
            </Button>
          )}
          {selected && owner === 'reports' && canDecide && selected.status === 'IN_PROGRESS' && (
            <Button
              disabled={isCompleting}
              aria-label={`Hoàn tất đối chiếu cho lô …${selected.batchId.slice(-8)}`}
              onClick={() => runAction(() => complete({ id: selected.batchId, expectedVersion: selected.version }).unwrap())}
            >
              {isCompleting ? 'Đang hoàn tất...' : 'Hoàn tất đối chiếu'}
            </Button>
          )}
        </div>
      </div>

      {owner === 'weekly-menu' && canCoordinate && (
        <div className="space-y-3 rounded-md border border-slate-200 bg-slate-50/50 p-4" aria-label="Nguồn số suất đối chiếu">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <div>
              <p className="text-sm font-semibold text-slate-900">{sourceLabel}</p>
              <p className="text-sm text-slate-600">Kiểm tra số suất hoàn tất trước khi tạo lô đối chiếu nháp.</p>
            </div>
            <Button
              type="button"
              variant="outline"
              disabled={!menuVersionId || previewQuery.isLoading || isCommittingImport}
              onClick={() => void previewSource()}
            >
              {previewQuery.isLoading ? 'Đang kiểm tra...' : 'Kiểm tra nguồn số suất'}
            </Button>
          </div>
          {!menuVersionId && <p className="text-sm text-slate-500">Chọn một thực đơn tuần đã lưu để kiểm tra nguồn số suất.</p>}
          {previewQuery.isError && !actionError && (
            <p className="text-sm text-red-700" role="alert">Không kiểm tra được nguồn số suất. Hãy thử lại.</p>
          )}
          {preview && (
            <div className="space-y-2 rounded border border-slate-200 bg-white p-3" aria-live="polite">
              <p className="text-sm font-medium text-slate-900">{previewPlanCount} kế hoạch · {previewLineCount} dòng nguồn</p>
              <div className="flex items-center gap-1.5 text-xs text-slate-600">
                <span>Dấu vân tay nguồn:</span>
                <code className="font-mono bg-slate-100 px-1 py-0.5 rounded">{preview.contentFingerprint.slice(0, 16)}…</code>
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  className="h-5 w-5 p-0 text-slate-400 hover:text-slate-700"
                  aria-label="Sao chép dấu vân tay nguồn"
                  title="Sao chép dấu vân tay"
                  onClick={() => void handleCopyText('previewFingerprint', preview.contentFingerprint)}
                >
                  {copiedKey === 'previewFingerprint' ? <Check size={12} className="text-emerald-600" /> : <Copy size={12} />}
                </Button>
              </div>
              {preview.diagnostics.length > 0 && (
                <div role="alert" className="space-y-1 rounded bg-amber-50 p-2.5 text-sm text-amber-800 border border-amber-200">
                  {preview.diagnostics.map((diagnostic) => <p key={diagnostic}>{diagnostic}</p>)}
                </div>
              )}
              <Button type="button" disabled={previewBlocked || isCommittingImport} onClick={() => setIsCommitOpen(true)}>
                Cam kết nguồn số suất
              </Button>
            </div>
          )}
          {quantityImportResult && (
            <div className="space-y-1.5 rounded border border-emerald-200 bg-emerald-50/60 p-3 text-sm" aria-live="polite">
              <p className="font-semibold text-emerald-800">
                {quantityImportResult.idempotentReplay ? 'Nguồn này đã được cam kết trước đó.' : 'Đã tạo nguồn số suất và lô đối chiếu nháp.'}
              </p>
              <div className="flex items-center gap-1.5 text-xs text-slate-700">
                <span>Mã nguồn nhập:</span>
                <code className="font-mono bg-white px-1 py-0.5 rounded border border-slate-200">{quantityImportResult.importBatchId}</code>
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  className="h-5 w-5 p-0 text-slate-400 hover:text-slate-700"
                  aria-label="Sao chép mã nguồn nhập"
                  onClick={() => void handleCopyText('importBatchId', quantityImportResult.importBatchId)}
                >
                  {copiedKey === 'importBatchId' ? <Check size={12} className="text-emerald-600" /> : <Copy size={12} />}
                </Button>
              </div>
              <div className="flex items-center gap-1.5 text-xs text-slate-700">
                <span>Mã lô đối chiếu:</span>
                <code className="font-mono bg-white px-1 py-0.5 rounded border border-slate-200">{quantityImportResult.reconciliationBatchId}</code>
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  className="h-5 w-5 p-0 text-slate-400 hover:text-slate-700"
                  aria-label="Sao chép mã lô đối chiếu"
                  onClick={() => void handleCopyText('reconciliationBatchId', quantityImportResult.reconciliationBatchId)}
                >
                  {copiedKey === 'reconciliationBatchId' ? <Check size={12} className="text-emerald-600" /> : <Copy size={12} />}
                </Button>
              </div>
            </div>
          )}
          <ConfirmDialog
            open={isCommitOpen}
            title="Cam kết nguồn số suất?"
            description={`${sourceLabel} · ${previewPlanCount} kế hoạch · ${previewLineCount} dòng nguồn. Hệ thống sẽ tạo đúng một nguồn nhập và một lô đối chiếu nháp.`}
            confirmLabel="Cam kết nguồn"
            busy={isCommittingImport}
            onConfirm={() => void commitSource()}
            onOpenChange={setIsCommitOpen}
          />
        </div>
      )}

      {actionError && (
        <div className="rounded-md border border-red-200 bg-red-50 p-3 space-y-2" role="alert">
          <p className="text-sm text-red-700">{actionError.message}</p>
          {actionError.canRefetch && (
            <Button type="button" variant="outline" size="sm" onClick={reload}>
              Tải lại dữ liệu
            </Button>
          )}
        </div>
      )}

      {isError ? (
        <div className="flex items-center justify-between p-4 text-sm text-red-700 bg-red-50 rounded-md border border-red-200" role="alert">
          <span>Không tải được dữ liệu lô đối chiếu.</span>
          <Button type="button" variant="outline" size="sm" onClick={() => refetch()}>
            Thử lại
          </Button>
        </div>
      ) : (
        <div className="space-y-4">
          <ReconciliationBatchTable
            batches={data}
            selectedId={selected?.batchId}
            isLoading={isLoading}
            onSelect={setSelectedId}
          />
          {selected && (
            <div className="mt-4 space-y-2 border-t border-slate-100 pt-4">
              <div className="flex items-center justify-between">
                <h3 className="text-sm font-semibold text-slate-900">
                  Chi tiết đối chiếu: Lô …{selected.batchId.slice(-8)} ({selected.lines.length} dòng)
                </h3>
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  aria-pressed={showAll}
                  onClick={() => setShowAll((value) => !value)}
                >
                  {showAll ? 'Chỉ hiện dòng cần xử lý' : 'Hiện tất cả các dòng'}
                </Button>
              </div>
              <ReconciliationComparisonTable
                lines={selected.lines}
                showAll={showAll}
                onEdit={owner === 'purchasing' || owner === 'warehouse' ? (line) => setEditingLineId(line.batchLineId) : undefined}
                onDisposition={owner === 'reports' && canDecide ? (line) => setDisposingLineId(line.batchLineId) : undefined}
              />
            </div>
          )}
        </div>
      )}

      {editing && (
        <ReconciliationActualDrawer
          key={`${editing.batchLineId}:${editing.purchasedVersion ?? 'new'}:${editing.issuedVersion ?? 'new'}`}
          line={editing}
          side={owner === 'warehouse' ? 'issued' : 'purchased'}
          onClose={() => setEditingLineId(undefined)}
          onRefetch={reload}
        />
      )}
      {disposing && (
        <ReconciliationDispositionDrawer
          key={`${disposing.batchLineId}:${disposing.disposition?.version ?? 'new'}:${disposing.purchasedVersion ?? 'new'}:${disposing.issuedVersion ?? 'new'}`}
          line={disposing}
          onClose={() => setDisposingLineId(undefined)}
          onRefetch={reload}
        />
      )}
    </section>
  )
}
