import { useMemo, useState } from 'react';
import { Check, ClipboardCheck, Link2, X } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { QueryErrorAlert, StatusBadge } from '@/components/common';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { useHasRole } from '@/lib/useHasRole';
import {
  useApplyLegacyLineageDispositionMutation,
  useCreateLegacyLineageDispositionMutation,
  useGetLegacyLineageCandidatesQuery,
  useGetLegacyLineageDispositionsQuery,
  useReviewLegacyLineageDispositionMutation,
} from '@/features/reports/reportsApi';
import type { SupplyLineReconciliationDto } from '@/api/workflowApiTypes';
import { typography } from '@/lib/typography';

type SourceRow = NonNullable<SupplyLineReconciliationDto['legacyLineageDispositions']>[number];
type SelectedSource = Pick<SourceRow, 'legacyLineType' | 'legacyLineId'>;

const statusLabel: Record<string, string> = {
  UNDISPOSITIONED: 'Chưa lập proposal',
  PENDING_MANAGER_REVIEW: 'Chờ Manager duyệt',
  APPROVED: 'Đã duyệt · chờ Admin áp dụng',
  REJECTED: 'Đã từ chối',
  APPLIED: 'Đã áp dụng',
};

const statusTone = (status: string) => {
  if (status === 'APPROVED') return 'success' as const;
  if (status === 'REJECTED') return 'danger' as const;
  if (status.includes('PENDING') || status === 'UNDISPOSITIONED') return 'warning' as const;
  return 'info' as const;
};

const newCommandId = (prefix: string) => `${prefix}-${crypto.randomUUID()}`;

export function LegacyLineageDispositionPanel({ rows }: { rows: SupplyLineReconciliationDto[] }) {
  const canCreateOrApply = useHasRole(['admin']);
  const canReview = useHasRole(['admin', 'quanly']);
  const pendingResult = useGetLegacyLineageDispositionsQuery('PENDING_MANAGER_REVIEW', { skip: !canReview });
  const approvedResult = useGetLegacyLineageDispositionsQuery('APPROVED', { skip: !canCreateOrApply });
  const [selectedSource, setSelectedSource] = useState<SelectedSource | null>(null);
  const [targetLineId, setTargetLineId] = useState('');
  const [reason, setReason] = useState('');
  const [feedback, setFeedback] = useState<string | null>(null);
  const candidatesResult = useGetLegacyLineageCandidatesQuery(
    selectedSource ?? { legacyLineType: 'ISSUE_LINE', legacyLineId: '' },
    { skip: !selectedSource },
  );
  const [create, createState] = useCreateLegacyLineageDispositionMutation();
  const [review, reviewState] = useReviewLegacyLineageDispositionMutation();
  const [apply, applyState] = useApplyLegacyLineageDispositionMutation();

  const undispositioned = useMemo(
    () => rows.flatMap((row) => (row.legacyLineageDispositions ?? []).filter((item) => item.status === 'UNDISPOSITIONED')),
    [rows],
  );
  const reviewItems = [...(pendingResult.data ?? []), ...(approvedResult.data ?? [])]
    .filter((item, index, all) => all.findIndex(candidate => candidate.dispositionId === item.dispositionId) === index);
  const isBusy = createState.isLoading || reviewState.isLoading || applyState.isLoading;

  const submitCreate = async () => {
    if (!selectedSource || !targetLineId || !reason.trim()) {
      setFeedback('Cần chọn dòng nguồn và nhập lý do trước khi tạo proposal.');
      return;
    }
    try {
      await create({
        commandId: newCommandId('legacy-create'),
        legacyLineType: selectedSource.legacyLineType,
        legacyLineId: selectedSource.legacyLineId,
        targetLineId,
        reason: reason.trim(),
      }).unwrap();
      setFeedback('Đã tạo proposal, đang chờ Manager review.');
      setSelectedSource(null);
      setTargetLineId('');
      setReason('');
    } catch {
      setFeedback('Không thể tạo proposal; hãy tải lại trạng thái source-line.');
    }
  };

  const submitReview = async (dispositionId: string, version: number, approve: boolean) => {
    if (!reason.trim()) {
      setFeedback('Cần nhập lý do review.');
      return;
    }
    try {
      await review({
        dispositionId,
        body: { commandId: newCommandId(approve ? 'legacy-approve' : 'legacy-reject'), expectedVersion: version, approve, reason: reason.trim() },
      }).unwrap();
      setFeedback(approve ? 'Đã duyệt proposal.' : 'Đã từ chối proposal.');
      setReason('');
    } catch {
      setFeedback('Review thất bại; proposal có thể đã đổi version hoặc đã được xử lý.');
    }
  };

  const submitApply = async (dispositionId: string, version: number) => {
    if (!reason.trim()) {
      setFeedback('Cần nhập lý do áp dụng provenance.');
      return;
    }
    try {
      await apply({
        dispositionId,
        body: { commandId: newCommandId('legacy-apply'), expectedVersion: version, reason: reason.trim() },
      }).unwrap();
      setFeedback('Đã áp dụng provenance; reconciliation sẽ tải lại theo source-line.');
      setReason('');
    } catch {
      setFeedback('Áp dụng thất bại; source-line có thể đã được map bởi luồng khác.');
    }
  };

  if (!canReview && !canCreateOrApply) return null;

  return (
    <section className="mt-4 rounded-lg border border-slate-200 bg-slate-50/80 p-4" aria-labelledby="legacy-lineage-title">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h3 id="legacy-lineage-title" className="flex items-center gap-2 text-sm font-semibold text-slate-900">
            <Link2 size={16} aria-hidden="true" />
            Xử lý lineage legacy theo source-line
          </h3>
          <p className="mt-1 max-w-3xl text-xs text-slate-600">
            Mỗi dòng phải được đối chiếu bằng chứng riêng. Không map theo tên nguyên liệu; mọi action đều có version, lý do và audit.
          </p>
        </div>
        <label className="min-w-[260px] text-xs font-semibold text-slate-600" htmlFor="legacy-disposition-reason">
          Lý do action
          <Input id="legacy-disposition-reason" value={reason} onChange={(event) => setReason(event.target.value)} className="mt-1 h-9 bg-white" placeholder="Nhập bằng chứng / lý do xử lý" />
        </label>
      </div>

      {feedback && <p className="mt-3 text-xs text-slate-700" role="status">{feedback}</p>}

      {(pendingResult.isError || approvedResult.isError) && (
        <QueryErrorAlert
          title="Không tải được proposal lineage"
          onRetry={() => void Promise.all([pendingResult.refetch(), approvedResult.refetch()])}
          isRetrying={pendingResult.isFetching || approvedResult.isFetching}
          className="mt-3"
        >
          Danh sách review chưa đầy đủ; không suy diễn là không có proposal đang chờ.
        </QueryErrorAlert>
      )}

      {canCreateOrApply && undispositioned.length > 0 && (
        <div className="mt-4 space-y-2">
          <p className="text-xs font-semibold text-slate-700">Legacy chưa có proposal ({undispositioned.length})</p>
          {undispositioned.map((item) => (
            <div key={`${item.legacyLineType}-${item.legacyLineId}`} className="flex flex-wrap items-center gap-2 rounded-md border border-slate-200 bg-white p-2 text-xs">
              <span className={typography.code}>{item.legacyLineType} · {item.legacyLineId}</span>
              <StatusBadge variant={statusTone(item.status)}>{statusLabel[item.status] ?? item.status}</StatusBadge>
              <Button type="button" size="sm" variant="outline" onClick={() => { setSelectedSource(item); setTargetLineId(''); }} disabled={isBusy}>
                <ClipboardCheck size={14} /> Chọn source đích
              </Button>
            </div>
          ))}
        </div>
      )}

      {selectedSource && canCreateOrApply && (
        <div className="mt-3 rounded-md border border-blue-200 bg-blue-50 p-3">
          <div className="flex items-center justify-between gap-2 text-xs font-semibold text-blue-900">
            <span>Chọn dòng đích cho {selectedSource.legacyLineType} · {selectedSource.legacyLineId}</span>
            <Button type="button" size="sm" variant="ghost" aria-label="Đóng chọn source đích" onClick={() => setSelectedSource(null)}><X size={14} /></Button>
          </div>
          {candidatesResult.isError && (
            <QueryErrorAlert
              title="Không tải được source-line đích"
              onRetry={() => void candidatesResult.refetch()}
              isRetrying={candidatesResult.isFetching}
              className="mt-2"
            >
              Không thể tạo proposal cho đến khi danh sách ứng viên được tải lại.
            </QueryErrorAlert>
          )}
          <Select value={targetLineId || null} onValueChange={(value) => setTargetLineId(value ?? '')} disabled={candidatesResult.isError || candidatesResult.isFetching}>
            <SelectTrigger className="mt-2 w-full bg-white" aria-label="Dòng đích provenance">
              <SelectValue placeholder="Chọn dòng source-line hợp lệ" />
            </SelectTrigger>
            <SelectContent>
              {(candidatesResult.data ?? []).map((candidate) => (
                <SelectItem key={candidate.targetLineId} value={candidate.targetLineId}>
                  {candidate.documentCode} · {candidate.targetLineId} · unit {candidate.unitId}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          <Button type="button" className="mt-2" size="sm" onClick={submitCreate} disabled={isBusy || candidatesResult.isFetching || !targetLineId}>Tạo proposal</Button>
        </div>
      )}

      {reviewItems.length > 0 && (
        <div className="mt-4 space-y-2">
          <p className="text-xs font-semibold text-slate-700">Proposal đang chờ xử lý ({reviewItems.length})</p>
          {reviewItems.map((item) => (
            <div key={item.dispositionId} className="flex flex-wrap items-center gap-2 rounded-md border border-slate-200 bg-white p-2 text-xs">
              <span className={typography.code}>{item.legacyLineType} · {item.legacyLineId}</span>
              <StatusBadge variant={statusTone(item.status)}>{statusLabel[item.status] ?? item.status}</StatusBadge>
              <span className="text-slate-500">v{item.version}</span>
              {item.status === 'PENDING_MANAGER_REVIEW' && canReview && (
                <>
                  <Button type="button" size="sm" onClick={() => submitReview(item.dispositionId, item.version, true)} disabled={isBusy}><Check size={14} /> Duyệt</Button>
                  <Button type="button" size="sm" variant="outline" onClick={() => submitReview(item.dispositionId, item.version, false)} disabled={isBusy}><X size={14} /> Từ chối</Button>
                </>
              )}
              {item.status === 'APPROVED' && canCreateOrApply && (
                <Button type="button" size="sm" onClick={() => submitApply(item.dispositionId, item.version)} disabled={isBusy}>Áp dụng provenance</Button>
              )}
            </div>
          ))}
        </div>
      )}
    </section>
  );
}
