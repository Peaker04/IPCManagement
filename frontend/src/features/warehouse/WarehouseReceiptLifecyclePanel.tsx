import { useMemo, useState } from 'react';
import { CheckCircle2, ClipboardCheck, LoaderCircle } from 'lucide-react';
import { useHasRole } from '@/lib/useHasRole';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { InlineAlert, QueryErrorAlert, TableViewport } from '@/components/common';
import { formatQuantityWithUnit } from '@/lib/formatters';
import { typography } from '@/lib/typography';
import { cn } from '@/lib/utils';
import {
  useAcceptReceiptQualityMutation,
  useGetInventoryReceiptByIdQuery,
  useGetInventoryReceiptsQuery,
  usePostWarehousePurchaseReceiptMutation,
  useCreateReceiptCorrectionMutation,
  useReworkWarehousePurchaseReceiptMutation,
} from './warehouseApi';

type QualityDraft = Record<string, { acceptedQuantity: string; reason: string }>;
type CorrectionDraft = Record<string, string>;

const commandId = (prefix: string) => `${prefix}-${crypto.randomUUID()}`;

const messageFromError = (error: unknown, fallback: string) => {
  if (error && typeof error === 'object' && 'data' in error) {
    const data = (error as { data?: { message?: unknown } }).data;
    if (data?.message) return String(data.message);
  }
  return fallback;
};

const statusLabel = (status: string, qualityStatus: string) => `${status} · ${qualityStatus}`;

export function WarehouseReceiptLifecyclePanel() {
  const canInspectQuality = useHasRole(['thukho']);
  const canPost = useHasRole(['admin']);
  const canRework = useHasRole(['dieuphoi']);
  const canCorrect = canPost;
  const { data: receiptPage, isError, isFetching, refetch } = useGetInventoryReceiptsQuery({ pageNumber: 1, pageSize: 20 });
  const [selectedReceiptId, setSelectedReceiptId] = useState<string>();
  const [qualityOpen, setQualityOpen] = useState(false);
  const [postOpen, setPostOpen] = useState(false);
  const [reworkOpen, setReworkOpen] = useState(false);
  const [reworkReason, setReworkReason] = useState('');
  const [correctionOpen, setCorrectionOpen] = useState(false);
  const [correctionReason, setCorrectionReason] = useState('');
  const [correctionDraft, setCorrectionDraft] = useState<CorrectionDraft>({});
  const [qualityDraft, setQualityDraft] = useState<QualityDraft>({});
  const [feedback, setFeedback] = useState<string>();
  const [acceptQuality, { isLoading: isSubmittingQuality }] = useAcceptReceiptQualityMutation();
  const [postReceipt, { isLoading: isPosting }] = usePostWarehousePurchaseReceiptMutation();
  const [reworkReceipt, { isLoading: isReworking }] = useReworkWarehousePurchaseReceiptMutation();
  const [createCorrection, { isLoading: isCorrecting }] = useCreateReceiptCorrectionMutation();

  const canonicalReceipts = useMemo(
    () => (receiptPage?.items ?? []).filter((item) => Boolean(item.purchaseOrderId)),
    [receiptPage],
  );
  const activeReceiptId = selectedReceiptId ?? canonicalReceipts[0]?.receiptId;
  const { data: receipt, isFetching: isFetchingReceipt, isError: isReceiptError, refetch: refetchReceipt } = useGetInventoryReceiptByIdQuery(activeReceiptId!, { skip: !activeReceiptId });

  const refresh = async () => {
    await Promise.all([refetch(), activeReceiptId ? refetchReceipt() : Promise.resolve()]);
  };

  const showQualityControl = Boolean(receipt && receipt.status === 'DRAFT' && receipt.qualityStatus === 'PENDING_INSPECTION' && canInspectQuality);
  const showPostControl = Boolean(receipt && receipt.status === 'APPROVED' && (receipt.qualityStatus === 'ACCEPTED' || receipt.qualityStatus === 'PARTIALLY_ACCEPTED') && canPost);
  const showReworkControl = Boolean(receipt && receipt.status === 'REJECTED' && canRework);
  const showCorrectionControl = Boolean(receipt && receipt.status === 'POSTED' && canCorrect);
  const selectionReason = !receipt
    ? 'Chọn phiếu nhập để xem trạng thái.'
    : !receipt.purchaseOrderId
      ? 'Phiếu lịch sử chưa có nguồn đơn mua bất biến; chỉ xem, không cho chạy lifecycle mới.'
      : receipt.status === 'DRAFT'
        ? canInspectQuality ? 'Chờ Thủ kho kiểm tra chất lượng.' : 'Chỉ Thủ kho được kiểm tra chất lượng.'
        : receipt.status === 'PENDING_APPROVAL'
          ? 'Đã kiểm tra; đang chờ Quản lý duyệt trong Hộp thư phê duyệt.'
          : receipt.status === 'APPROVED'
            ? canPost ? 'Sẵn sàng POSTED bởi Admin.' : 'Chỉ Admin được POSTED sau khi Quản lý duyệt.'
            : receipt.status === 'POSTED'
              ? canCorrect ? 'Đã POSTED; chỉ Admin có thể tạo correction append-only có source-line lineage.' : 'Đã POSTED; không mở lại writer cũ.'
              : receipt.status === 'REJECTED'
                ? canRework ? 'Phiếu bị từ chối; Điều phối có thể yêu cầu kiểm tra lại.' : 'Phiếu bị từ chối; chỉ Điều phối tạo phiếu mới được yêu cầu xử lý lại.'
              : 'Phiếu đã ở trạng thái kết thúc hoặc cần xử lý lại.';

  const submitQuality = async () => {
    if (!receipt?.purchaseOrderId) return;
    const lines = receipt.lines.map((line) => {
      const draft = qualityDraft[line.receiptLineId];
      const acceptedQuantity = Number(draft?.acceptedQuantity ?? line.quantity);
      return {
        receiptLineId: line.receiptLineId,
        acceptedQuantity,
        rejectedQuantity: Math.max(line.quantity - acceptedQuantity, 0),
        reason: draft?.reason.trim() || null,
      };
    });
    const invalidLine = lines.find((line) => !Number.isFinite(line.acceptedQuantity) || line.acceptedQuantity < 0 || line.rejectedQuantity > 0 && !line.reason);
    if (invalidLine) {
      setFeedback('Nhập số lượng đạt hợp lệ; mọi phần không đạt phải có lý do.');
      return;
    }

    try {
      await acceptQuality({
        purchaseOrderId: receipt.purchaseOrderId,
        receiptId: receipt.receiptId,
        data: { commandId: commandId('receipt-quality'), expectedVersion: receipt.concurrencyVersion, lines },
      }).unwrap();
      setQualityOpen(false);
      setFeedback('Đã lưu kết quả chất lượng. Phiếu chỉ vào inbox Quản lý khi có số lượng đạt.');
      await refresh();
    } catch (error) {
      setFeedback(messageFromError(error, 'Không thể ghi nhận kết quả chất lượng. Dữ liệu chưa được thay đổi.'));
    }
  };

  const submitPost = async () => {
    if (!receipt?.purchaseOrderId) return;
    try {
      await postReceipt({
        purchaseOrderId: receipt.purchaseOrderId,
        receiptId: receipt.receiptId,
        data: { commandId: commandId('receipt-post'), expectedVersion: receipt.concurrencyVersion },
      }).unwrap();
      setPostOpen(false);
      setFeedback('Đã POSTED phiếu nhập. Sổ kho và tiến độ đơn mua đã được cập nhật đúng một lần.');
      await refresh();
    } catch (error) {
      setFeedback(messageFromError(error, 'Không thể POSTED phiếu nhập. Hãy tải lại trước khi thử lại.'));
    }
  };

  const submitRework = async () => {
    if (!receipt?.purchaseOrderId || !reworkReason.trim()) {
      setFeedback('Lý do xử lý lại không được để trống.');
      return;
    }
    try {
      await reworkReceipt({
        purchaseOrderId: receipt.purchaseOrderId,
        receiptId: receipt.receiptId,
        data: { commandId: commandId('receipt-rework'), expectedVersion: receipt.concurrencyVersion, reason: reworkReason.trim() },
      }).unwrap();
      setReworkOpen(false);
      setReworkReason('');
      setFeedback('Đã trả phiếu về bước kiểm tra chất lượng. Không có thay đổi tồn kho.');
      await refresh();
    } catch (error) {
      setFeedback(messageFromError(error, 'Không thể xử lý lại phiếu nhập. Dữ liệu chưa được thay đổi.'));
    }
  };

  const submitCorrection = async () => {
    if (!receipt?.purchaseOrderId || !correctionReason.trim()) {
      setFeedback('Lý do correction không được để trống.');
      return;
    }
    const lines = receipt.lines
      .map((line) => ({ receiptLineId: line.receiptLineId, quantity: Number(correctionDraft[line.receiptLineId] ?? 0) }))
      .filter((line) => line.quantity > 0);
    if (lines.length === 0 || lines.some((line) => !Number.isFinite(line.quantity))) {
      setFeedback('Chọn ít nhất một dòng và nhập số lượng correction lớn hơn 0.');
      return;
    }
    try {
      const result = await createCorrection({
        purchaseOrderId: receipt.purchaseOrderId,
        receiptId: receipt.receiptId,
        data: { commandId: commandId('receipt-correction'), expectedVersion: 0, reason: correctionReason.trim(), lines },
      }).unwrap();
      setCorrectionOpen(false);
      setCorrectionReason('');
      setCorrectionDraft({});
      setFeedback(`Đã POSTED correction ${result.correctionCode}. Phiếu nhập và movement gốc không bị sửa.`);
      await refresh();
    } catch (error) {
      setFeedback(messageFromError(error, 'Không thể tạo correction. Tồn kho, phiếu nhập và ledger gốc chưa bị thay đổi.'));
    }
  };

  return (
    <section
      className={cn(typography.body, 'mt-4 grid min-h-[48rem] content-start gap-3')}
      aria-labelledby="receipt-lifecycle-title"
      aria-busy={isFetching || isFetchingReceipt}
      data-testid="receipt-lifecycle-panel"
    >
      <div>
        <h3 id="receipt-lifecycle-title" className={cn(typography.sectionTitle, 'text-slate-950')}>Lifecycle phiếu nhập</h3>
        <p className={cn(typography.caption, 'mt-1 text-slate-600')}>DRAFT → kiểm tra chất lượng → Quản lý duyệt → Admin POSTED. Tồn kho chỉ thay đổi ở POSTED.</p>
      </div>
      {isError ? (
        <QueryErrorAlert title="Không tải được phiếu nhập lifecycle" onRetry={() => void refetch()}>
          Không coi danh sách trống là không có phiếu. Hãy tải lại trước khi đưa ra kết luận hoặc thao tác.
        </QueryErrorAlert>
      ) : (
        <TableViewport ariaLabel="Phiếu nhập theo lifecycle" caption="Chỉ hiển thị phiếu đã có nguồn đơn mua bất biến." className="max-h-[220px]">
          <table className="ipc-data-table min-w-[760px]">
            <thead><tr><th>Phiếu</th><th>Nhà cung cấp</th><th>Trạng thái</th><th>Thao tác</th></tr></thead>
            <tbody>
              {isFetching && canonicalReceipts.length === 0 ? <tr><td colSpan={4} className="h-20 text-center text-slate-600">Đang tải phiếu nhập…</td></tr>
                : canonicalReceipts.length === 0 ? <tr><td colSpan={4} className="h-20 text-center text-slate-600">Chưa có phiếu nhập lifecycle mới trong trang này.</td></tr>
                  : canonicalReceipts.map((item) => <tr key={item.receiptId} className={item.receiptId === activeReceiptId ? 'bg-blue-50/60' : undefined}>
                    <td className={cn(typography.code, 'font-semibold text-slate-900')}>{item.receiptCode}</td>
                    <td>{item.supplierName ?? '—'}</td>
                    <td>{statusLabel(item.status, item.qualityStatus)}</td>
                    <td><Button type="button" size="sm" variant="outline" onClick={() => { setSelectedReceiptId(item.receiptId); setFeedback(undefined); }}>Xem trạng thái</Button></td>
                  </tr>)}
            </tbody>
          </table>
        </TableViewport>
      )}

      {isReceiptError && <InlineAlert title="Không tải được chi tiết phiếu" variant="danger">Không thể đánh giá đủ source line hoặc version; mọi action đã bị chặn.</InlineAlert>}
      {isFetchingReceipt && activeReceiptId && <InlineAlert title="Đang tải source line" variant="info">Đang lấy lại phiên bản phiếu trước khi mở action.</InlineAlert>}
      {receipt && !isReceiptError && (
        <div className="grid gap-3 rounded-sm border border-slate-300 bg-slate-50 p-3" data-testid="receipt-lifecycle-detail">
          <div className="flex flex-wrap items-start justify-between gap-3">
            <div><p className="font-semibold text-slate-950">{receipt.receiptCode}</p><p className="text-xs text-slate-600">{statusLabel(receipt.status, receipt.qualityStatus)} · version {receipt.concurrencyVersion}</p></div>
            <div className="flex flex-wrap gap-2">
              {showQualityControl && <Button type="button" size="sm" onClick={() => { setFeedback(undefined); setQualityOpen(true); }}><ClipboardCheck size={16} />Kiểm tra chất lượng</Button>}
              {showPostControl && <Button type="button" size="sm" onClick={() => { setFeedback(undefined); setPostOpen(true); }}><CheckCircle2 size={16} />POSTED phiếu nhập</Button>}
              {showReworkControl && <Button type="button" size="sm" variant="outline" onClick={() => { setFeedback(undefined); setReworkReason(''); setReworkOpen(true); }}>Xử lý lại phiếu nhập</Button>}
              {showCorrectionControl && <Button type="button" size="sm" variant="outline" onClick={() => { setFeedback(undefined); setCorrectionReason(''); setCorrectionDraft({}); setCorrectionOpen(true); }}>Tạo correction hậu nhập</Button>}
            </div>
          </div>
          <InlineAlert title="Điều kiện hành động" variant={showQualityControl || showPostControl ? 'info' : 'warning'}>{selectionReason}</InlineAlert>
          <ul className="grid gap-1 text-xs text-slate-700" aria-label="Dòng phiếu nhập">
            {receipt.lines.map((line) => <li key={line.receiptLineId} className="rounded-sm border border-slate-200 bg-white px-2 py-1.5"><strong>{line.ingredientName ?? line.ingredientId}</strong> · {formatQuantityWithUnit(line.quantity, line.unitName ?? '')} {line.acceptedQuantity != null && <>· đạt {formatQuantityWithUnit(line.acceptedQuantity, line.unitName ?? '')}</>} {line.rejectedQuantity != null && <>· không đạt {formatQuantityWithUnit(line.rejectedQuantity, line.unitName ?? '')}</>} {line.qualityReason && <span className="block text-amber-800">Lý do: {line.qualityReason}</span>}</li>)}
          </ul>
        </div>
      )}
      {feedback && <InlineAlert title="Phiếu nhập lifecycle" variant="info">{feedback}</InlineAlert>}

      <Dialog open={qualityOpen} onOpenChange={setQualityOpen}>
        <DialogContent className="max-w-2xl" aria-describedby="receipt-quality-description">
          <DialogHeader><DialogTitle>Kiểm tra chất lượng phiếu nhập</DialogTitle><DialogDescription id="receipt-quality-description">Nhập số lượng đạt trên từng source line. Phần còn lại là không đạt và bắt buộc nêu lý do.</DialogDescription></DialogHeader>
          <div className="grid gap-3">
            {receipt?.lines.map((line) => {
              const draft = qualityDraft[line.receiptLineId] ?? { acceptedQuantity: String(line.quantity), reason: '' };
              const accepted = Number(draft.acceptedQuantity);
              const rejected = Number.isFinite(accepted) ? Math.max(line.quantity - accepted, 0) : 0;
              return <div key={line.receiptLineId} className="grid gap-2 rounded-sm border border-slate-200 p-3 sm:grid-cols-[minmax(0,1fr)_10rem]">
                <div><p className="font-medium text-slate-950">{line.ingredientName ?? line.ingredientId}</p><p className="text-xs text-slate-600">Thực nhận {formatQuantityWithUnit(line.quantity, line.unitName ?? '')}</p>{rejected > 0 && <Input aria-label={`Lý do không đạt ${line.ingredientName ?? line.receiptLineId}`} className="mt-2" value={draft.reason} placeholder="Lý do không đạt (bắt buộc)" onChange={(event) => setQualityDraft((current) => ({ ...current, [line.receiptLineId]: { ...draft, reason: event.target.value } }))} />}</div>
                <label className="grid gap-1 text-xs font-semibold text-slate-700">Số lượng đạt<Input aria-label={`Số lượng đạt ${line.ingredientName ?? line.receiptLineId}`} type="number" min="0" max={line.quantity} step="0.001" value={draft.acceptedQuantity} onChange={(event) => setQualityDraft((current) => ({ ...current, [line.receiptLineId]: { ...draft, acceptedQuantity: event.target.value } }))} /><span className="font-normal text-slate-500">Không đạt: {formatQuantityWithUnit(rejected, line.unitName ?? '')}</span></label>
              </div>;
            })}
          </div>
          <DialogFooter><Button type="button" variant="outline" disabled={isSubmittingQuality} onClick={() => setQualityOpen(false)}>Hủy</Button><Button type="button" disabled={isSubmittingQuality} onClick={() => void submitQuality()}>{isSubmittingQuality && <LoaderCircle className="animate-spin" />}Lưu kết quả</Button></DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={postOpen} onOpenChange={setPostOpen}>
        <DialogContent aria-describedby="receipt-post-description"><DialogHeader><DialogTitle>POSTED phiếu nhập?</DialogTitle><DialogDescription id="receipt-post-description">Thao tác này sinh movement và cập nhật tiến độ đơn mua. Hệ thống dùng version và command ID để chặn stale/duplicate POST.</DialogDescription></DialogHeader><DialogFooter><Button type="button" variant="outline" disabled={isPosting} onClick={() => setPostOpen(false)}>Hủy</Button><Button type="button" disabled={isPosting} onClick={() => void submitPost()}>{isPosting && <LoaderCircle className="animate-spin" />}Xác nhận POSTED</Button></DialogFooter></DialogContent>
      </Dialog>
      <Dialog open={reworkOpen} onOpenChange={setReworkOpen}>
        <DialogContent aria-describedby="receipt-rework-description">
          <DialogHeader><DialogTitle>Xử lý lại phiếu nhập?</DialogTitle><DialogDescription id="receipt-rework-description">Phiếu sẽ quay về DRAFT/PENDING_INSPECTION để Thủ kho kiểm tra lại. Tồn kho không thay đổi.</DialogDescription></DialogHeader>
          <label className="grid gap-1 text-sm font-semibold text-slate-700">Lý do xử lý lại<Input aria-label="Lý do xử lý lại" value={reworkReason} onChange={(event) => setReworkReason(event.target.value)} placeholder="Nêu lý do và bằng chứng cần kiểm tra lại" /></label>
          <DialogFooter><Button type="button" variant="outline" disabled={isReworking} onClick={() => setReworkOpen(false)}>Hủy</Button><Button type="button" disabled={isReworking || !reworkReason.trim()} onClick={() => void submitRework()}>{isReworking && <LoaderCircle className="animate-spin" />}Xác nhận xử lý lại</Button></DialogFooter>
        </DialogContent>
      </Dialog>
      <Dialog open={correctionOpen} onOpenChange={setCorrectionOpen}>
        <DialogContent className="max-w-2xl" aria-describedby="receipt-correction-description">
          <DialogHeader><DialogTitle>Tạo correction hậu POSTED</DialogTitle><DialogDescription id="receipt-correction-description">Correction là chứng từ append-only. Nó tạo bút toán xuất bù trừ theo source line; Receipt và movement POSTED gốc không bị sửa.</DialogDescription></DialogHeader>
          <div className="grid gap-3">
            {receipt?.lines.map((line) => {
              const maxQuantity = line.acceptedQuantity ?? 0;
              return <label key={line.receiptLineId} className="grid gap-1 rounded-sm border border-slate-200 p-3 text-sm font-semibold text-slate-700 sm:grid-cols-[minmax(0,1fr)_10rem] sm:items-center"><span>{line.ingredientName ?? line.ingredientId}<span className="mt-1 block text-xs font-normal text-slate-600">Tối đa theo dòng đã chấp nhận: {formatQuantityWithUnit(maxQuantity, line.unitName ?? '')}. Hệ thống kiểm tra lại balance và tồn kho khi POSTED.</span></span><Input aria-label={`Số lượng correction ${line.ingredientName ?? line.receiptLineId}`} type="number" min="0" max={maxQuantity} step="0.001" value={correctionDraft[line.receiptLineId] ?? ''} onChange={(event) => setCorrectionDraft((current) => ({ ...current, [line.receiptLineId]: event.target.value }))} disabled={maxQuantity <= 0} /></label>;
            })}
            <label className="grid gap-1 text-sm font-semibold text-slate-700">Lý do correction<Input aria-label="Lý do correction" value={correctionReason} onChange={(event) => setCorrectionReason(event.target.value)} placeholder="Nêu chứng từ/bằng chứng đối soát và lý do bù trừ" /></label>
          </div>
          <DialogFooter><Button type="button" variant="outline" disabled={isCorrecting} onClick={() => setCorrectionOpen(false)}>Hủy</Button><Button type="button" disabled={isCorrecting || !correctionReason.trim()} onClick={() => void submitCorrection()}>{isCorrecting && <LoaderCircle className="animate-spin" />}POSTED correction</Button></DialogFooter>
        </DialogContent>
      </Dialog>
    </section>
  );
}
