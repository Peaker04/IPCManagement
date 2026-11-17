import { useEffect, useState } from 'react';
import { Modal } from '../../components/ui/modal';
import { Button } from '../../components/ui/button';
import { InlineBanner } from '../../components/ui/inline-banner';
import { toVietnameseDate } from '../../utils/dates';
import { MrxSupplementalDemandForm } from './MrxSupplementalDemandForm';
import { MrxSupplementalFulfillmentForm, type SupplementalIssueSelection } from './MrxSupplementalFulfillmentForm';
import { useAuth } from '../../store/useAuth';
import { getDraftStorageKey } from '../../hooks/useClientDraftPersistence';

export interface DailyLineOption {
  dailyLineId: string;
  ingredientName?: string | null;
  issuedQuantity?: number | null;
  canonicalUnitName?: string | null;
}

interface MrxSupplementalIssueModalProps {
  isOpen: boolean;
  onClose: () => void;
  activeBatchId: string;
  activeDate: string;
  lines: DailyLineOption[];
  suppError: string | null;
  isSubmittingSupp: boolean;
  isOutcomeUnknown?: boolean;
  onRecover?: () => void;
  onSubmit: (customLines: SupplementalIssueSelection[]) => boolean | void | Promise<boolean | void>;
  onDirtyChange?: (dirty: boolean) => void;
  onRefreshScope?: () => Promise<void>;
  scopeReady?: boolean;
  sourceVersion?: number;
}

export function MrxSupplementalIssueModal({
  isOpen,
  onClose,
  activeBatchId,
  activeDate,
  lines,
  suppError,
  isSubmittingSupp,
  isOutcomeUnknown = false,
  onRecover,
  onSubmit,
  onDirtyChange,
  onRefreshScope,
  scopeReady = true,
  sourceVersion,
}: MrxSupplementalIssueModalProps) {
  const { user, operationalMode } = useAuth();
  const [mode, setMode] = useState<'direct' | 'by-dish'>('direct');
  const [proposalLocked, setProposalLocked] = useState(false);
  const [actionTarget, setActionTarget] = useState<HTMLSpanElement | null>(null);
  const [formDirty, setFormDirty] = useState(false);
  useEffect(() => { onDirtyChange?.(formDirty); return () => onDirtyChange?.(false); }, [formDirty, onDirtyChange]);
  const actualDraftKey = user?.userId ? getDraftStorageKey(`mrx_supplemental_actual_${operationalMode}_${activeBatchId}_${activeDate}`, user.userId) : undefined;
  return (
    <Modal
      isOpen={isOpen}
      onClose={() => { if (!isSubmittingSupp && !isOutcomeUnknown && !proposalLocked) onClose(); }}
      closeDisabled={isSubmittingSupp || isOutcomeUnknown || proposalLocked}
      isDirty={formDirty}
      title="Xuất kho bổ sung trong ca"
      description={`Lô: ${activeBatchId.slice(0, 8)} · Ngày phục vụ: ${toVietnameseDate(activeDate)}`}
      footer={(requestClose) => (
        <>
          <Button variant="outline" size="sm" disabled={isSubmittingSupp || isOutcomeUnknown || proposalLocked} onClick={requestClose}>
            Hủy bỏ
          </Button>
          <span ref={setActionTarget} />
        </>
      )}
    >
      <div className="space-y-3 text-sm text-slate-700">
        {!scopeReady && <InlineBanner variant="warning" title="Đang đối chiếu dữ liệu Kho"
          actionLabel={onRefreshScope ? 'Tải lại dữ liệu Kho' : undefined}
          onAction={() => { void onRefreshScope?.(); }}>Chờ tải dữ liệu mới nhất trước khi xác nhận lượng thực xuất.</InlineBanner>}
        {suppError && (
          <InlineBanner
            variant="error"
            title={isOutcomeUnknown ? 'Chưa xác nhận được kết quả xuất kho' : undefined}
            actionLabel={isOutcomeUnknown ? (onRecover ? 'Kiểm tra lại lệnh xuất đã gửi' : undefined) : onRefreshScope ? 'Tải lại dữ liệu Kho' : undefined}
            onAction={isOutcomeUnknown ? onRecover : onRefreshScope}
            isActionLoading={isSubmittingSupp}
          >
            {suppError}
          </InlineBanner>
        )}

        <div className="flex items-center gap-1 p-1 bg-slate-100 rounded text-xs">
          <button
            type="button"
            disabled={isSubmittingSupp || isOutcomeUnknown || proposalLocked}
            onClick={() => setMode('direct')}
            className={`flex-1 py-1 rounded font-medium transition-colors cursor-pointer ${
              mode === 'direct' ? 'bg-white text-slate-900 shadow-2xs' : 'text-slate-600 hover:text-slate-900'
            }`}
          >
            Nhập nguyên liệu trực tiếp
          </button>
          <button
            type="button"
            disabled={isSubmittingSupp || isOutcomeUnknown || proposalLocked}
            onClick={() => setMode('by-dish')}
            className={`flex-1 py-1 rounded font-medium transition-colors cursor-pointer ${
              mode === 'by-dish' ? 'bg-white text-slate-900 shadow-2xs' : 'text-slate-600 hover:text-slate-900'
            }`}
          >
            Đề nghị suất phát sinh
          </button>
        </div>

        {mode === 'by-dish' && <MrxSupplementalDemandForm key={`${activeBatchId}:${activeDate}`} batchId={activeBatchId}
          serviceDate={activeDate} materialLabels={lines} onLockChange={setProposalLocked} actionTarget={actionTarget} onDirtyChange={setFormDirty} onSubmitted={onRefreshScope} />}

        {mode === 'direct' && <MrxSupplementalFulfillmentForm batchId={activeBatchId} serviceDate={activeDate}
          materialLabels={lines} busy={isSubmittingSupp || !scopeReady} outcomeUnknown={isOutcomeUnknown} onSubmit={onSubmit} actionTarget={actionTarget}
          sourceVersion={sourceVersion}
          draftKey={actualDraftKey} onDirtyChange={setFormDirty} />}
      </div>
    </Modal>
  );
}
