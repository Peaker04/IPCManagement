import { useMemo, useState } from 'react';
import { Check, ClipboardCheck, Link2, X } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { InfoNote, QueryErrorAlert, StatusBadge } from '@/components/common';
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
import { formatLegacyDispositionStatus, formatLegacyLineType } from '@/lib/workflowConfig';

type SourceRow = NonNullable<SupplyLineReconciliationDto['legacyLineageDispositions']>[number];
type SelectedSource = Pick<SourceRow, 'legacyLineType' | 'legacyLineId'> & { displayLabel: string };

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
    () => rows.flatMap((row) => (row.legacyLineageDispositions ?? [])
      .filter((item) => item.status === 'UNDISPOSITIONED')
      .map((item) => ({ ...item, displayLabel: `${formatLegacyLineType(item.legacyLineType)} · ${row.materialRequestCode} · ${row.ingredientName ?? 'Nguyên liệu chưa có tên'} · ${row.unitName ?? 'chưa có đơn vị'}` })))
      .filter((item, index, all) => all.findIndex((candidate) => candidate.legacyLineType === item.legacyLineType && candidate.legacyLineId === item.legacyLineId) === index),
    [rows],
  );
  const reviewItems = [...(pendingResult.data ?? []), ...(approvedResult.data ?? [])]
    .filter((item, index, all) => all.findIndex(candidate => candidate.dispositionId === item.dispositionId) === index);
  const isBusy = createState.isLoading || reviewState.isLoading || applyState.isLoading;

  const submitCreate = async () => {
    if (!selectedSource || !targetLineId || !reason.trim()) {
      setFeedback('Cần chọn dòng nguồn và nhập lý do trước khi tạo đề xuất xử lý.');
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
      setFeedback('Đã tạo đề xuất xử lý, đang chờ Quản lý duyệt.');
      setSelectedSource(null);
      setTargetLineId('');
      setReason('');
    } catch {
      setFeedback('Không thể tạo đề xuất xử lý; hãy tải lại trạng thái dòng nguồn.');
    }
  };

  const submitReview = async (dispositionId: string, version: number, approve: boolean) => {
    if (!reason.trim()) {
      setFeedback('Cần nhập lý do duyệt.');
      return;
    }
    try {
      await review({
        dispositionId,
        body: { commandId: newCommandId(approve ? 'legacy-approve' : 'legacy-reject'), expectedVersion: version, approve, reason: reason.trim() },
      }).unwrap();
      setFeedback(approve ? 'Đã duyệt đề xuất xử lý.' : 'Đã từ chối đề xuất xử lý.');
      setReason('');
    } catch {
      setFeedback('Duyệt thất bại; đề xuất có thể đã được cập nhật hoặc xử lý.');
    }
  };

  const submitApply = async (dispositionId: string, version: number) => {
    if (!reason.trim()) {
      setFeedback('Cần nhập lý do áp dụng liên kết nguồn.');
      return;
    }
    try {
      await apply({
        dispositionId,
        body: { commandId: newCommandId('legacy-apply'), expectedVersion: version, reason: reason.trim() },
      }).unwrap();
      setFeedback('Đã áp dụng liên kết nguồn; bảng đối soát sẽ tải lại theo từng dòng.');
      setReason('');
    } catch {
      setFeedback('Áp dụng thất bại; dòng nguồn có thể đã được liên kết bởi luồng khác.');
    }
  };

  if (!canReview && !canCreateOrApply) return null;

  return (
    <section className="mt-4 rounded-lg border border-slate-200 bg-slate-50/80 p-4" aria-labelledby="legacy-lineage-title">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="flex items-center gap-2">
          <h3 id="legacy-lineage-title" className="flex items-center gap-2 text-sm font-semibold text-slate-900">
            <Link2 size={16} aria-hidden="true" />
            Đối soát liên kết chứng từ lịch sử
          </h3>
          <InfoNote
            title="Quy tắc đối soát liên kết chứng từ"
            content="Mỗi dòng phải được đối chiếu bằng chứng riêng. Không liên kết theo tên nguyên liệu; mọi thao tác đều lưu lý do và nhật ký."
          />
        </div>
        <label className="min-w-[260px] text-xs font-semibold text-slate-600" htmlFor="legacy-disposition-reason">
          Lý do xử lý
          <Input id="legacy-disposition-reason" value={reason} onChange={(event) => setReason(event.target.value)} className="mt-1 h-9 bg-white" placeholder="Nhập bằng chứng hoặc lý do xử lý" />
        </label>
      </div>

      {feedback && <p className="mt-3 text-xs text-slate-700" role="status">{feedback}</p>}

      {(pendingResult.isError || approvedResult.isError) && (
        <QueryErrorAlert
          title="Không tải được đề xuất liên kết nguồn"
          onRetry={() => void Promise.all([pendingResult.refetch(), approvedResult.refetch()])}
          isRetrying={pendingResult.isFetching || approvedResult.isFetching}
          className="mt-3"
        >
          Danh sách duyệt chưa đầy đủ; không suy diễn là không có đề xuất đang chờ.
        </QueryErrorAlert>
      )}

      {canCreateOrApply && undispositioned.length > 0 && (
        <div className="mt-4 space-y-2">
          <p className="text-xs font-semibold text-slate-700">Dữ liệu lịch sử chưa có đề xuất xử lý ({undispositioned.length})</p>
          {undispositioned.map((item) => (
            <div key={`${item.legacyLineType}-${item.legacyLineId}`} className="flex flex-wrap items-center gap-2 rounded-md border border-slate-200 bg-white p-2 text-xs">
              <span className="font-medium text-slate-800">{item.displayLabel}</span>
              <StatusBadge variant={statusTone(item.status)}>{formatLegacyDispositionStatus(item.status)}</StatusBadge>
              <Button type="button" size="sm" variant="outline" onClick={() => { setSelectedSource({ legacyLineType: item.legacyLineType, legacyLineId: item.legacyLineId, displayLabel: item.displayLabel }); setTargetLineId(''); }} disabled={isBusy}>
                <ClipboardCheck size={14} /> Chọn dòng đích
              </Button>
            </div>
          ))}
        </div>
      )}

      {selectedSource && canCreateOrApply && (
        <div className="mt-3 rounded-md border border-blue-200 bg-blue-50 p-3">
          <div className="flex items-center justify-between gap-2 text-xs font-semibold text-blue-900">
            <span>Chọn dòng chứng từ đích cho {selectedSource.displayLabel}</span>
            <Button type="button" size="sm" variant="ghost" aria-label="Đóng chọn source đích" onClick={() => setSelectedSource(null)}><X size={14} /></Button>
          </div>
          {candidatesResult.isError && (
            <QueryErrorAlert
              title="Không tải được dòng đích"
              onRetry={() => void candidatesResult.refetch()}
              isRetrying={candidatesResult.isFetching}
              className="mt-2"
            >
              Không thể tạo đề xuất xử lý cho đến khi danh sách ứng viên được tải lại.
            </QueryErrorAlert>
          )}
          <Select value={targetLineId || null} onValueChange={(value) => setTargetLineId(value ?? '')} disabled={candidatesResult.isError || candidatesResult.isFetching}>
            <SelectTrigger className="mt-2 w-full bg-white" aria-label="Dòng chứng từ đích">
              <SelectValue placeholder="Chọn dòng chứng từ hợp lệ" />
            </SelectTrigger>
            <SelectContent>
              {(candidatesResult.data ?? []).map((candidate, index, candidates) => (
                <SelectItem key={candidate.targetLineId} value={candidate.targetLineId}>
                  {candidate.documentCode} · Lựa chọn {index + 1}/{candidates.length}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          <Button type="button" className="mt-2" size="sm" onClick={submitCreate} disabled={isBusy || candidatesResult.isFetching || !targetLineId}>Tạo đề xuất xử lý</Button>
        </div>
      )}

      {reviewItems.length > 0 && (
        <div className="mt-4 space-y-2">
          <p className="text-xs font-semibold text-slate-700">Đề xuất đang chờ xử lý ({reviewItems.length})</p>
          {reviewItems.map((item) => (
            <div key={item.dispositionId} className="flex flex-wrap items-center gap-2 rounded-md border border-slate-200 bg-white p-2 text-xs">
              <span className="font-medium text-slate-800">{formatLegacyLineType(item.legacyLineType)}</span>
              <StatusBadge variant={statusTone(item.status)}>{formatLegacyDispositionStatus(item.status)}</StatusBadge>
              {item.status === 'PENDING_MANAGER_REVIEW' && canReview && (
                <>
                  <Button type="button" size="sm" onClick={() => submitReview(item.dispositionId, item.version, true)} disabled={isBusy}><Check size={14} /> Duyệt</Button>
                  <Button type="button" size="sm" variant="outline" onClick={() => submitReview(item.dispositionId, item.version, false)} disabled={isBusy}><X size={14} /> Từ chối</Button>
                </>
              )}
              {item.status === 'APPROVED' && canCreateOrApply && (
                <Button type="button" size="sm" onClick={() => submitApply(item.dispositionId, item.version)} disabled={isBusy}>Áp dụng liên kết nguồn</Button>
              )}
            </div>
          ))}
        </div>
      )}
    </section>
  );
}
