import { LoaderCircle } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { formatQuantityWithUnit } from '@/lib/formatters';
import type { InventoryReceipt } from '@/api/workflowApiTypes';

type QualityDraft = Record<string, { acceptedQuantity: string; reason: string }>;
type CorrectionDraft = Record<string, string>;

interface WarehouseReceiptLifecycleDialogsProps {
  receipt?: InventoryReceipt;
  qualityOpen: boolean;
  postOpen: boolean;
  reworkOpen: boolean;
  voidOpen: boolean;
  correctionOpen: boolean;
  qualityDraft: QualityDraft;
  correctionDraft: CorrectionDraft;
  reworkReason: string;
  voidReason: string;
  correctionReason: string;
  isSubmittingQuality: boolean;
  isPosting: boolean;
  isReworking: boolean;
  isVoiding: boolean;
  isCorrecting: boolean;
  onQualityOpenChange: (open: boolean) => void;
  onPostOpenChange: (open: boolean) => void;
  onReworkOpenChange: (open: boolean) => void;
  onVoidOpenChange: (open: boolean) => void;
  onCorrectionOpenChange: (open: boolean) => void;
  onQualityDraftChange: (draft: QualityDraft) => void;
  onCorrectionDraftChange: (draft: CorrectionDraft) => void;
  onReworkReasonChange: (reason: string) => void;
  onVoidReasonChange: (reason: string) => void;
  onCorrectionReasonChange: (reason: string) => void;
  onSubmitQuality: () => void;
  onSubmitPost: () => void;
  onSubmitRework: () => void;
  onSubmitVoid: () => void;
  onSubmitCorrection: () => void;
}

export function WarehouseReceiptLifecycleDialogs(props: WarehouseReceiptLifecycleDialogsProps) {
  const {
    receipt, qualityOpen, postOpen, reworkOpen, voidOpen, correctionOpen, qualityDraft, correctionDraft,
    reworkReason, voidReason, correctionReason, isSubmittingQuality, isPosting, isReworking, isVoiding,
    isCorrecting, onQualityOpenChange, onPostOpenChange, onReworkOpenChange, onVoidOpenChange,
    onCorrectionOpenChange, onQualityDraftChange, onCorrectionDraftChange, onReworkReasonChange,
    onVoidReasonChange, onCorrectionReasonChange, onSubmitQuality, onSubmitPost, onSubmitRework,
    onSubmitVoid, onSubmitCorrection,
  } = props;

  return <>
    {qualityOpen && <Dialog open onOpenChange={onQualityOpenChange}>
      <DialogContent className="max-w-2xl" aria-describedby="receipt-quality-description">
        <DialogHeader><DialogTitle>Kiểm tra chất lượng phiếu nhập</DialogTitle><DialogDescription id="receipt-quality-description">Nhập số lượng đạt cho từng dòng nguyên liệu. Phần còn lại là không đạt và bắt buộc nêu lý do.</DialogDescription></DialogHeader>
        <div className="grid gap-3">{receipt?.lines.map((line) => {
          const draft = qualityDraft[line.receiptLineId] ?? { acceptedQuantity: String(line.quantity), reason: '' };
          const accepted = Number(draft.acceptedQuantity);
          const rejected = Number.isFinite(accepted) ? Math.max(line.quantity - accepted, 0) : 0;
          return <div key={line.receiptLineId} className="grid gap-2 rounded-sm border border-slate-200 p-3 sm:grid-cols-[minmax(0,1fr)_10rem]">
            <div><p className="font-medium text-slate-950">{line.ingredientName ?? line.ingredientId}</p><p className="text-xs text-slate-600">Thực nhận {formatQuantityWithUnit(line.quantity, line.unitName ?? '')}</p>{rejected > 0 && <Input aria-label={`Lý do không đạt ${line.ingredientName ?? line.receiptLineId}`} className="mt-2" value={draft.reason} placeholder="Lý do không đạt (bắt buộc)" onChange={(event) => onQualityDraftChange({ ...qualityDraft, [line.receiptLineId]: { ...draft, reason: event.target.value } })} />}</div>
            <label className="grid gap-1 text-xs font-semibold text-slate-700">Số lượng đạt<Input aria-label={`Số lượng đạt ${line.ingredientName ?? line.receiptLineId}`} type="number" min="0" max={line.quantity} step="0.001" value={draft.acceptedQuantity} onChange={(event) => onQualityDraftChange({ ...qualityDraft, [line.receiptLineId]: { ...draft, acceptedQuantity: event.target.value } })} /><span className="font-normal text-slate-500">Không đạt: {formatQuantityWithUnit(rejected, line.unitName ?? '')}</span></label>
          </div>;
        })}</div>
        <DialogFooter><Button type="button" variant="outline" disabled={isSubmittingQuality} onClick={() => onQualityOpenChange(false)}>Hủy</Button><Button type="button" disabled={isSubmittingQuality} onClick={onSubmitQuality}>{isSubmittingQuality && <LoaderCircle className="animate-spin" />}Lưu kết quả</Button></DialogFooter>
      </DialogContent>
    </Dialog>}

    {postOpen && <Dialog open onOpenChange={onPostOpenChange}><DialogContent aria-describedby="receipt-post-description"><DialogHeader><DialogTitle>Ghi sổ kho cho phiếu nhập?</DialogTitle><DialogDescription id="receipt-post-description">Xác nhận ghi sổ kho để cập nhật số lượng tồn thực tế vào hệ thống.</DialogDescription></DialogHeader><DialogFooter><Button type="button" variant="outline" disabled={isPosting} onClick={() => onPostOpenChange(false)}>Hủy</Button><Button type="button" disabled={isPosting} onClick={onSubmitPost}>{isPosting && <LoaderCircle className="animate-spin" />}Xác nhận ghi sổ kho</Button></DialogFooter></DialogContent></Dialog>}

    {reworkOpen && <Dialog open onOpenChange={onReworkOpenChange}><DialogContent aria-describedby="receipt-rework-description"><DialogHeader><DialogTitle>Xử lý lại phiếu nhập?</DialogTitle><DialogDescription id="receipt-rework-description">Phiếu nhập sẽ quay về bước chờ kiểm tra chất lượng.</DialogDescription></DialogHeader><label className="grid gap-1 text-sm font-semibold text-slate-700">Lý do xử lý lại<Input aria-label="Lý do xử lý lại" value={reworkReason} onChange={(event) => onReworkReasonChange(event.target.value)} placeholder="Nêu lý do và bằng chứng cần kiểm tra lại" /></label><DialogFooter><Button type="button" variant="outline" disabled={isReworking} onClick={() => onReworkOpenChange(false)}>Hủy</Button><Button type="button" disabled={isReworking || !reworkReason.trim()} onClick={onSubmitRework}>{isReworking && <LoaderCircle className="animate-spin" />}Xác nhận xử lý lại</Button></DialogFooter></DialogContent></Dialog>}

    {voidOpen && <Dialog open onOpenChange={onVoidOpenChange}><DialogContent aria-describedby="receipt-void-description"><DialogHeader><DialogTitle>Hủy phiếu nhập trước khi ghi sổ kho?</DialogTitle><DialogDescription id="receipt-void-description">Phiếu nhập sẽ chuyển sang trạng thái đã hủy và không thay đổi tồn kho.</DialogDescription></DialogHeader><label className="grid gap-1 text-sm font-semibold text-slate-700">Lý do đối soát<Input aria-label="Lý do hủy phiếu" value={voidReason} onChange={(event) => onVoidReasonChange(event.target.value)} placeholder="Nêu chứng từ, bằng chứng và lý do hủy" /></label><DialogFooter><Button type="button" variant="outline" disabled={isVoiding} onClick={() => onVoidOpenChange(false)}>Quay lại</Button><Button type="button" variant="destructive" disabled={isVoiding || !voidReason.trim()} onClick={onSubmitVoid}>{isVoiding && <LoaderCircle className="animate-spin" />}Xác nhận hủy phiếu</Button></DialogFooter></DialogContent></Dialog>}

    {correctionOpen && <Dialog open onOpenChange={onCorrectionOpenChange}><DialogContent className="max-w-2xl" aria-describedby="receipt-correction-description"><DialogHeader><DialogTitle>Tạo chứng từ điều chỉnh sau khi ghi sổ</DialogTitle><DialogDescription id="receipt-correction-description">Tạo chứng từ bù trừ điều chỉnh số lượng sau khi đã ghi sổ kho (không sửa phiếu nhập hoặc bút toán gốc).</DialogDescription></DialogHeader><div className="grid gap-3">{receipt?.lines.map((line) => {
      const maxQuantity = line.acceptedQuantity ?? 0;
      return <label key={line.receiptLineId} className="grid gap-1 rounded-sm border border-slate-200 p-3 text-sm font-semibold text-slate-700 sm:grid-cols-[minmax(0,1fr)_10rem] sm:items-center"><span>{line.ingredientName ?? 'Nguyên liệu chưa có tên'}<span className="mt-1 block text-xs font-normal text-slate-600">Tối đa theo số lượng đã chấp nhận: {formatQuantityWithUnit(maxQuantity, line.unitName ?? '')}.</span></span><Input aria-label={`Số lượng điều chỉnh ${line.ingredientName ?? 'nguyên liệu'}`} type="number" min="0" max={maxQuantity} step="0.001" value={correctionDraft[line.receiptLineId] ?? ''} onChange={(event) => onCorrectionDraftChange({ ...correctionDraft, [line.receiptLineId]: event.target.value })} disabled={maxQuantity <= 0} /></label>;
    })}<label className="grid gap-1 text-sm font-semibold text-slate-700">Lý do điều chỉnh<Input aria-label="Lý do điều chỉnh" value={correctionReason} onChange={(event) => onCorrectionReasonChange(event.target.value)} placeholder="Nêu chứng từ, bằng chứng đối soát và lý do bù trừ" /></label></div><DialogFooter><Button type="button" variant="outline" disabled={isCorrecting} onClick={() => onCorrectionOpenChange(false)}>Hủy</Button><Button type="button" disabled={isCorrecting || !correctionReason.trim()} onClick={onSubmitCorrection}>{isCorrecting && <LoaderCircle className="animate-spin" />}Ghi sổ chứng từ điều chỉnh</Button></DialogFooter></DialogContent></Dialog>}
  </>;
}
