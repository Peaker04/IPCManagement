import { useMemo, useState } from 'react';
import { ArrowRight, PackageCheck, RefreshCw, Undo2 } from 'lucide-react';
import {
  InlineAlert,
  PaginationBar,
  QueryErrorAlert,
  SectionPanel,
  TableViewport,
} from '@/components/common';
import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { formatQuantityWithUnit } from '@/lib/formatters';
import { formatWorkflowStatus } from '../workflowConfig';
import {
  useConfirmInventoryReturnReceiptMutation,
  useFulfillSupplementalMaterialRequestMutation,
  useGetInventoryReturnByIdQuery,
  useGetInventoryReturnsQuery,
  useGetSupplementalMaterialRequestsQuery,
  useRejectSupplementalMaterialRequestMutation,
  useRouteSupplementalMaterialRequestToPurchasingMutation,
  type SupplementalMaterialRequestResult,
} from '../workflowApi';

type Feedback = { title: string; message: string; variant: 'info' | 'warning' | 'danger' };

const mutationError = (error: unknown, fallback: string) => {
  if (error && typeof error === 'object' && 'data' in error) {
    const data = (error as { data?: { message?: unknown } }).data;
    if (data?.message) return String(data.message);
  }
  return fallback;
};

export function WarehouseExceptionsWorkbench({ canManage }: { canManage: boolean }) {
  const [supplementalPage, setSupplementalPage] = useState(1);
  const [returnPage, setReturnPage] = useState(1);
  const [selectedSupplemental, setSelectedSupplemental] = useState<SupplementalMaterialRequestResult>();
  const [fulfillQty, setFulfillQty] = useState('');
  const [rejecting, setRejecting] = useState<SupplementalMaterialRequestResult>();
  const [rejectReason, setRejectReason] = useState('');
  const [selectedReturnId, setSelectedReturnId] = useState('');
  const [adjustedQuantities, setAdjustedQuantities] = useState<Record<string, string>>({});
  const [hasDiscrepancy, setHasDiscrepancy] = useState(false);
  const [discrepancyNote, setDiscrepancyNote] = useState('');
  const [feedback, setFeedback] = useState<Feedback>();

  const supplementalQuery = useGetSupplementalMaterialRequestsQuery({ pageNumber: supplementalPage, pageSize: 8 });
  const returnsQuery = useGetInventoryReturnsQuery({ pageNumber: returnPage, pageSize: 8, isReceived: false });
  const returnDetailQuery = useGetInventoryReturnByIdQuery(selectedReturnId, { skip: !selectedReturnId });
  const [fulfill, fulfillState] = useFulfillSupplementalMaterialRequestMutation();
  const [routeToPurchasing, routeState] = useRouteSupplementalMaterialRequestToPurchasingMutation();
  const [reject, rejectState] = useRejectSupplementalMaterialRequestMutation();
  const [confirmReturn, confirmReturnState] = useConfirmInventoryReturnReceiptMutation();

  const supplementalItems = supplementalQuery.data?.items ?? [];
  const returnItems = returnsQuery.data?.items ?? [];
  const selectedReturn = returnDetailQuery.data;

  const returnQuantity = useMemo(
    () => selectedReturn?.lines.reduce((sum, line) => sum + line.quantity, 0) ?? 0,
    [selectedReturn],
  );

  const openFulfill = (item: SupplementalMaterialRequestResult) => {
    setFeedback(undefined);
    setSelectedSupplemental(item);
    setFulfillQty(String(Math.min(item.remainingQty, item.availableQty)));
  };

  const submitFulfill = async () => {
    if (!selectedSupplemental) return;
    const quantity = Number(fulfillQty);
    if (!Number.isFinite(quantity) || quantity <= 0 || quantity > selectedSupplemental.remainingQty) {
      setFeedback({
        title: 'Số lượng cấp chưa hợp lệ',
        message: `Nhập số lớn hơn 0 và không vượt ${formatQuantityWithUnit(selectedSupplemental.remainingQty, selectedSupplemental.unitName)}.`,
        variant: 'warning',
      });
      return;
    }
    try {
      const response = await fulfill({ requestId: selectedSupplemental.requestId, quantity }).unwrap();
      setSelectedSupplemental(undefined);
      setFeedback({
        title: 'Đã tạo phiếu xuất bổ sung',
        message: response.data
          ? `${response.data.requestCode}: đã cấp ${formatQuantityWithUnit(quantity, response.data.unitName)}, còn ${formatQuantityWithUnit(response.data.remainingQty, response.data.unitName)}.`
          : response.message || 'Tồn kho và phiếu xuất đã được cập nhật.',
        variant: 'info',
      });
    } catch (error) {
      setFeedback({ title: 'Chưa cấp được nguyên liệu', message: mutationError(error, 'Tải lại tồn kho và thử lại.'), variant: 'danger' });
    }
  };

  const submitRouteToPurchasing = async (item: SupplementalMaterialRequestResult) => {
    setFeedback(undefined);
    try {
      const response = await routeToPurchasing(item.requestId).unwrap();
      setFeedback({
        title: 'Đã chuyển sang thu mua',
        message: response.data?.purchaseRequestCode
          ? `${response.data.purchaseRequestCode} đã được tạo ở trạng thái bản nháp; Thu mua cần chọn nhà cung cấp và gửi duyệt.`
          : response.message || 'Thu mua đã nhận phần thiếu.',
        variant: 'info',
      });
    } catch (error) {
      setFeedback({ title: 'Chưa chuyển được sang thu mua', message: mutationError(error, 'Tải lại yêu cầu và thử lại.'), variant: 'danger' });
    }
  };

  const submitReject = async () => {
    if (!rejecting) return;
    if (!rejectReason.trim()) {
      setFeedback({ title: 'Thiếu lý do từ chối', message: 'Nhập lý do để bếp biết cách xử lý tiếp theo.', variant: 'warning' });
      return;
    }
    try {
      await reject({ requestId: rejecting.requestId, reason: rejectReason.trim() }).unwrap();
      setRejecting(undefined);
      setRejectReason('');
      setFeedback({ title: 'Đã từ chối yêu cầu', message: 'Lý do đã được lưu vào lịch sử nghiệp vụ.', variant: 'info' });
    } catch (error) {
      setFeedback({ title: 'Chưa từ chối được yêu cầu', message: mutationError(error, 'Tải lại trạng thái và thử lại.'), variant: 'danger' });
    }
  };

  const submitReturnReceipt = async () => {
    if (!selectedReturn) return;
    if (hasDiscrepancy && !discrepancyNote.trim()) {
      setFeedback({ title: 'Thiếu mô tả chênh lệch', message: 'Ghi rõ số thực nhận hoặc tình trạng nguyên liệu trước khi xác nhận.', variant: 'warning' });
      return;
    }
    const adjustedLines = selectedReturn.lines.map((line) => ({
      returnLineId: line.returnLineId,
      newQuantity: Number(adjustedQuantities[line.returnLineId] ?? line.quantity),
    }));
    if (adjustedLines.some((line) => !Number.isFinite(line.newQuantity) || line.newQuantity < 0)) {
      setFeedback({ title: 'Số thực nhận chưa hợp lệ', message: 'Số thực nhận phải từ 0 trở lên.', variant: 'warning' });
      return;
    }
    try {
      await confirmReturn({
        returnId: selectedReturn.returnId,
        hasDiscrepancy,
        discrepancyNote: hasDiscrepancy ? discrepancyNote.trim() : undefined,
        adjustedLines,
      }).unwrap();
      setSelectedReturnId('');
      setFeedback({
        title: selectedReturn.returnType === 'WASTE' ? 'Đã ghi nhận hao hụt' : 'Đã nhập lại nguyên liệu trả',
        message: selectedReturn.returnType === 'WASTE'
          ? 'Hao hụt đã được ghi audit và không cộng tồn.'
          : 'Số thực nhận đã được cộng vào tồn kho và ghi stock ledger.',
        variant: 'info',
      });
    } catch (error) {
      setFeedback({ title: 'Chưa xác nhận được phiếu trả', message: mutationError(error, 'Kiểm tra số thực nhận và thử lại.'), variant: 'danger' });
    }
  };

  return (
    <div className="grid gap-4">
      {!canManage && (
        <InlineAlert title="Chế độ chỉ đọc" variant="info">
          Chỉ vai trò Warehouse được cấp bổ sung, chuyển thu mua hoặc xác nhận nguyên liệu trả.
        </InlineAlert>
      )}
      {feedback && <InlineAlert title={feedback.title} variant={feedback.variant}>{feedback.message}</InlineAlert>}

      <SectionPanel
        title="Yêu cầu cấp nguyên liệu bổ sung"
        icon={<RefreshCw size={18} aria-hidden="true" />}
        description="Kho xử lý theo tồn thực tế; phần thiếu được chuyển thành đề xuất mua có thể truy vết."
      >
        {supplementalQuery.isError && (
          <QueryErrorAlert title="Không tải được yêu cầu cấp bổ sung" onRetry={() => void supplementalQuery.refetch()}>
            Không thể quyết định cấp hoặc mua thêm khi dữ liệu chưa tải thành công.
          </QueryErrorAlert>
        )}
        <TableViewport ariaLabel="Danh sách yêu cầu cấp nguyên liệu bổ sung" caption="Trạng thái và eligibility thao tác do máy chủ cung cấp.">
          <table className="ipc-data-table min-w-[980px]">
            <thead><tr><th>Yêu cầu</th><th>Nguyên liệu</th><th>Đã cấp / yêu cầu</th><th>Tồn khả dụng</th><th>Trạng thái</th><th>Hướng xử lý</th><th>Thao tác</th></tr></thead>
            <tbody>
              {supplementalQuery.isFetching && supplementalItems.length === 0 ? (
                <tr><td colSpan={7} className="text-center text-slate-600">Đang tải yêu cầu bổ sung...</td></tr>
              ) : supplementalItems.length === 0 ? (
                <tr><td colSpan={7} className="text-center text-slate-600">Không có yêu cầu bổ sung trong phạm vi kho.</td></tr>
              ) : supplementalItems.map((item) => (
                <tr key={item.requestId}>
                  <td><span className="block font-semibold text-slate-950">{item.requestCode}</span><span className="text-xs text-slate-600">Từ {item.issueCode}</span></td>
                  <td><span className="block font-medium text-slate-900">{item.ingredientName}</span><span className="text-xs text-slate-600">{item.reason || 'Không có ghi chú'}</span></td>
                  <td>{formatQuantityWithUnit(item.fulfilledQty, item.unitName)} / {formatQuantityWithUnit(item.requestedQty, item.unitName)}</td>
                  <td>{formatQuantityWithUnit(item.availableQty, item.unitName)}</td>
                  <td>{formatWorkflowStatus(item.status)}{item.purchaseRequestCode && <span className="block text-xs text-slate-600">{item.purchaseRequestCode}: {formatWorkflowStatus(item.purchaseRequestStatus || '')}</span>}</td>
                  <td className="max-w-[240px] text-xs text-slate-700">{item.actionDisabledReason || (item.availableQty >= item.remainingQty ? 'Cấp đủ phần còn thiếu.' : 'Cấp phần đang có, chuyển phần thiếu sang thu mua.')}</td>
                  <td>
                    {canManage ? (
                      <div className="flex min-w-[250px] flex-wrap gap-2">
                        <Button type="button" size="sm" disabled={!item.canFulfill || fulfillState.isLoading} onClick={() => openFulfill(item)}>Cấp bổ sung</Button>
                        <Button type="button" size="sm" variant="outline" disabled={!item.canRouteToPurchasing || routeState.isLoading} onClick={() => void submitRouteToPurchasing(item)}><ArrowRight size={15} aria-hidden="true" /> Chuyển thu mua</Button>
                        <Button type="button" size="sm" variant="ghost" disabled={!item.canReject || rejectState.isLoading} onClick={() => { setRejecting(item); setRejectReason(''); }}>Từ chối</Button>
                      </div>
                    ) : <span className="text-xs text-slate-500">Chỉ đọc</span>}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </TableViewport>
        <PaginationBar page={supplementalQuery.data?.pageNumber ?? supplementalPage} pageSize={supplementalQuery.data?.pageSize ?? 8} totalItems={supplementalQuery.data?.totalCount ?? 0} onPageChange={setSupplementalPage} />
      </SectionPanel>

      <SectionPanel
        title="Phiếu trả dư và hao hụt chờ kho tiếp nhận"
        icon={<Undo2 size={18} aria-hidden="true" />}
        description="RETURN cộng tồn theo số thực nhận; WASTE chỉ ghi nhận hao hụt và audit."
      >
        {returnsQuery.isError && (
          <QueryErrorAlert title="Không tải được phiếu trả" onRetry={() => void returnsQuery.refetch()}>
            Không hiển thị empty state khi API tiếp nhận phiếu trả đang lỗi.
          </QueryErrorAlert>
        )}
        <TableViewport ariaLabel="Danh sách phiếu trả nguyên liệu chờ tiếp nhận" caption="Kho mở từng phiếu để kiểm đếm số thực nhận.">
          <table className="ipc-data-table min-w-[820px]">
            <thead><tr><th>Phiếu trả</th><th>Loại</th><th>Phiếu xuất gốc</th><th>Ngày/ca</th><th>Lý do</th><th>Trạng thái</th><th>Thao tác</th></tr></thead>
            <tbody>
              {returnsQuery.isFetching && returnItems.length === 0 ? (
                <tr><td colSpan={7} className="text-center text-slate-600">Đang tải phiếu trả...</td></tr>
              ) : returnItems.length === 0 ? (
                <tr><td colSpan={7} className="text-center text-slate-600">Không có phiếu trả hoặc hao hụt đang chờ kho.</td></tr>
              ) : returnItems.map((item) => (
                <tr key={item.returnId}>
                  <td className="font-semibold text-slate-950">{item.returnCode}</td>
                  <td>{item.returnType === 'WASTE' ? 'Hao hụt / hủy' : 'Trả lại kho'}</td>
                  <td>{item.issueCode || item.issueId}</td>
                  <td>{item.returnDate}{item.shiftName ? ` · ${item.shiftName}` : ''}</td>
                  <td className="max-w-[280px]">{item.reason}</td>
                  <td>{formatWorkflowStatus(item.status)}</td>
                  <td><Button type="button" size="sm" disabled={!canManage} onClick={() => { setSelectedReturnId(item.returnId); setAdjustedQuantities({}); setHasDiscrepancy(false); setDiscrepancyNote(''); }}><PackageCheck size={15} aria-hidden="true" /> Tiếp nhận</Button></td>
                </tr>
              ))}
            </tbody>
          </table>
        </TableViewport>
        <PaginationBar page={returnsQuery.data?.pageNumber ?? returnPage} pageSize={returnsQuery.data?.pageSize ?? 8} totalItems={returnsQuery.data?.totalCount ?? 0} onPageChange={setReturnPage} />
      </SectionPanel>

      <Dialog open={Boolean(selectedSupplemental)} onOpenChange={(open) => { if (!open) setSelectedSupplemental(undefined); }}>
        <DialogContent aria-labelledby="supplemental-fulfill-title" aria-describedby="supplemental-fulfill-description">
          <DialogHeader><DialogTitle id="supplemental-fulfill-title">Cấp nguyên liệu bổ sung</DialogTitle><DialogDescription id="supplemental-fulfill-description">Tạo phiếu xuất bổ sung thật và trừ tồn kho ngay khi xác nhận.</DialogDescription></DialogHeader>
          {selectedSupplemental && <div className="grid gap-2"><label htmlFor="supplemental-quantity" className="text-sm font-medium text-slate-900">Số lượng cấp ({selectedSupplemental.unitName})</label><Input id="supplemental-quantity" type="number" min="0.000001" max={Math.min(selectedSupplemental.remainingQty, selectedSupplemental.availableQty)} step="any" value={fulfillQty} onChange={(event) => setFulfillQty(event.target.value)} /><p className="text-xs text-slate-600">Còn thiếu {formatQuantityWithUnit(selectedSupplemental.remainingQty, selectedSupplemental.unitName)}; tồn khả dụng {formatQuantityWithUnit(selectedSupplemental.availableQty, selectedSupplemental.unitName)}.</p></div>}
          <DialogFooter><Button type="button" variant="outline" onClick={() => setSelectedSupplemental(undefined)}>Hủy</Button><Button type="button" disabled={fulfillState.isLoading} onClick={() => void submitFulfill()}>{fulfillState.isLoading ? 'Đang tạo phiếu...' : 'Xác nhận cấp'}</Button></DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={Boolean(rejecting)} onOpenChange={(open) => { if (!open) setRejecting(undefined); }}>
        <DialogContent aria-labelledby="supplemental-reject-title" aria-describedby="supplemental-reject-description">
          <DialogHeader><DialogTitle id="supplemental-reject-title">Từ chối yêu cầu bổ sung</DialogTitle><DialogDescription id="supplemental-reject-description">Lý do là bắt buộc và sẽ hiển thị trong audit để bếp có hướng xử lý.</DialogDescription></DialogHeader>
          <div className="grid gap-2"><label htmlFor="supplemental-reject-reason" className="text-sm font-medium text-slate-900">Lý do từ chối</label><textarea id="supplemental-reject-reason" className="min-h-24 rounded-sm border border-slate-300 px-3 py-2 text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-600" value={rejectReason} onChange={(event) => setRejectReason(event.target.value)} /></div>
          <DialogFooter><Button type="button" variant="outline" onClick={() => setRejecting(undefined)}>Hủy</Button><Button type="button" variant="destructive" disabled={rejectState.isLoading} onClick={() => void submitReject()}>Xác nhận từ chối</Button></DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={Boolean(selectedReturnId)} onOpenChange={(open) => { if (!open) setSelectedReturnId(''); }}>
        <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-2xl" aria-labelledby="return-receipt-title" aria-describedby="return-receipt-description">
          <DialogHeader><DialogTitle id="return-receipt-title">Tiếp nhận nguyên liệu trả</DialogTitle><DialogDescription id="return-receipt-description">Kiểm đếm từng dòng. RETURN cộng tồn; WASTE chỉ ghi audit sau xác nhận.</DialogDescription></DialogHeader>
          {returnDetailQuery.isFetching ? <p role="status" className="text-sm text-slate-600">Đang tải chi tiết phiếu trả...</p> : selectedReturn && <div className="grid gap-4">
            <InlineAlert title={`${selectedReturn.returnCode} · ${selectedReturn.returnType === 'WASTE' ? 'Hao hụt' : 'Trả kho'}`} variant={selectedReturn.returnType === 'WASTE' ? 'warning' : 'info'}>Bếp khai báo tổng {returnQuantity}; kho nhập số thực nhận cho từng dòng.</InlineAlert>
            {selectedReturn.lines.map((line) => <div key={line.returnLineId} className="grid gap-2 rounded-sm border border-slate-200 p-3 sm:grid-cols-[1fr_180px]"><div><p className="font-medium text-slate-950">{line.ingredientName}</p><p className="text-xs text-slate-600">Bếp khai báo {formatQuantityWithUnit(line.quantity, line.unitName || '')}</p></div><div><label htmlFor={`return-line-${line.returnLineId}`} className="text-xs font-medium text-slate-700">Số thực nhận ({line.unitName})</label><Input id={`return-line-${line.returnLineId}`} type="number" min="0" step="any" value={adjustedQuantities[line.returnLineId] ?? String(line.quantity)} onChange={(event) => setAdjustedQuantities((current) => ({ ...current, [line.returnLineId]: event.target.value }))} /></div></div>)}
            <label className="flex min-h-11 items-center gap-2 text-sm font-medium text-slate-900"><input type="checkbox" checked={hasDiscrepancy} onChange={(event) => setHasDiscrepancy(event.target.checked)} /> Có chênh lệch so với bếp khai báo</label>
            {hasDiscrepancy && <div className="grid gap-2"><label htmlFor="return-discrepancy-note" className="text-sm font-medium text-slate-900">Mô tả chênh lệch</label><textarea id="return-discrepancy-note" className="min-h-24 rounded-sm border border-slate-300 px-3 py-2 text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-600" value={discrepancyNote} onChange={(event) => setDiscrepancyNote(event.target.value)} /></div>}
          </div>}
          {returnDetailQuery.isError && <QueryErrorAlert title="Không tải được chi tiết phiếu trả" onRetry={() => void returnDetailQuery.refetch()}>Không thể xác nhận khi chưa có dữ liệu dòng.</QueryErrorAlert>}
          <DialogFooter><Button type="button" variant="outline" onClick={() => setSelectedReturnId('')}>Hủy</Button><Button type="button" disabled={!selectedReturn || confirmReturnState.isLoading} onClick={() => void submitReturnReceipt()}>{confirmReturnState.isLoading ? 'Đang cập nhật...' : 'Xác nhận tiếp nhận'}</Button></DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
