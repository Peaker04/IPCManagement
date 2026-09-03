import { useDeferredValue, useMemo, useState } from 'react';
import { ArrowRight, PackageCheck, RefreshCw, Undo2 } from 'lucide-react';
import {
  IdentifierText,
  InlineAlert,
  PaginationBar,
  SearchField,
  SectionPanel,
  TableViewport,
} from '@/components/common';
import { QueryViewBoundary } from '@/components/common/QueryViewBoundary';
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
import { Checkbox } from '@/components/ui/checkbox';
import { Textarea } from '@/components/ui/textarea';
import { formatCurrency, formatDateOnly, formatQuantityWithUnit, formatUnit } from '@/lib/formatters';
import { formatShiftName, formatWorkflowStatus } from '@/lib/workflowConfig';
import { toLabeledQueryView } from '@/lib/labeledQueryView';
import {
  useConfirmInventoryReturnReceiptMutation,
  useCreateReturnAllocationDispositionMutation,
  useGetReturnAllocationBalancesQuery,
  useFulfillSupplementalMaterialRequestMutation,
  useGetInventoryReturnByIdQuery,
  useGetInventoryReturnsQuery,
  useGetSupplementalMaterialRequestsQuery,
  useRejectSupplementalMaterialRequestMutation,
  useRouteSupplementalMaterialRequestToPurchasingMutation,
} from '@/api/warehouseApi';
import type { SupplementalMaterialRequestResult } from '@/api/workflowApiTypes';
import type { ReturnAllocationBalance } from './returnAllocationTypes';

type Feedback = { title: string; message: string; variant: 'info' | 'warning' | 'danger' };
type FieldFeedback = Pick<Feedback, 'title' | 'message'>;

const allocationCustomerLabel = (row: ReturnAllocationBalance) =>
  row.customerCode ? `${row.customerName} (${row.customerCode})` : row.customerName;

const allocationScopeLabel = (row: ReturnAllocationBalance) =>
  `${allocationCustomerLabel(row)} · ${formatDateOnly(row.serviceDate)} · ${formatShiftName(row.shiftName)} · ${formatCurrency(row.priceTierAmount)}`;

const mutationError = (error: unknown, fallback: string) => {
  if (error && typeof error === 'object' && 'data' in error) {
    const data = (error as { data?: { message?: unknown } }).data;
    if (data?.message) return String(data.message);
  }
  return fallback;
};

function CompactQuantity({ value, unit }: { value: number; unit: string }) {
  return <span title={`Giá trị chính xác: ${formatQuantityWithUnit(value, unit, { maximumFractionDigits: 6 })}`}>{formatQuantityWithUnit(value, unit)}</span>
}

export function WarehouseExceptionsWorkbench({ canManage, canDisposition = false }: { canManage: boolean; canDisposition?: boolean }) {
  const [supplementalPage, setSupplementalPage] = useState(1);
  const [returnPage, setReturnPage] = useState(1);
  const [supplementalSearch, setSupplementalSearch] = useState('');
  const [returnSearch, setReturnSearch] = useState('');
  const deferredSupplementalSearch = useDeferredValue(supplementalSearch.trim());
  const deferredReturnSearch = useDeferredValue(returnSearch.trim());
  const [selectedSupplemental, setSelectedSupplemental] = useState<SupplementalMaterialRequestResult>();
  const [fulfillQty, setFulfillQty] = useState('');
  const [rejecting, setRejecting] = useState<SupplementalMaterialRequestResult>();
  const [rejectReason, setRejectReason] = useState('');
  const [selectedReturnId, setSelectedReturnId] = useState('');
  const [adjustedQuantities, setAdjustedQuantities] = useState<Record<string, string>>({});
  const [hasDiscrepancy, setHasDiscrepancy] = useState(false);
  const [discrepancyNote, setDiscrepancyNote] = useState('');
  const [feedback, setFeedback] = useState<Feedback>();
  const [fulfillValidation, setFulfillValidation] = useState<FieldFeedback>();
  const [fulfillError, setFulfillError] = useState<FieldFeedback>();
  const [rejectValidation, setRejectValidation] = useState<FieldFeedback>();
  const [rejectError, setRejectError] = useState<FieldFeedback>();
  const [discrepancyValidation, setDiscrepancyValidation] = useState<FieldFeedback>();
  const [adjustedQuantityErrors, setAdjustedQuantityErrors] = useState<Record<string, FieldFeedback>>({});
  const [returnError, setReturnError] = useState<FieldFeedback>();
  const [allocationError, setAllocationError] = useState<FieldFeedback>();
  const [selectedAllocation, setSelectedAllocation] = useState<ReturnAllocationBalance>();
  const [destinationSourceLineId, setDestinationSourceLineId] = useState('');
  const [allocationQuantity, setAllocationQuantity] = useState('');
  const [allocationReason, setAllocationReason] = useState('');

  const supplementalQuery = useGetSupplementalMaterialRequestsQuery({ pageNumber: supplementalPage, pageSize: 8, searchKeyword: deferredSupplementalSearch || undefined });
  const returnsQuery = useGetInventoryReturnsQuery({ pageNumber: returnPage, pageSize: 8, isReceived: false, searchKeyword: deferredReturnSearch || undefined });
  const returnDetailQuery = useGetInventoryReturnByIdQuery(selectedReturnId, { skip: !selectedReturnId });
  const allocationQuery = useGetReturnAllocationBalancesQuery();
  const [fulfill, fulfillState] = useFulfillSupplementalMaterialRequestMutation();
  const [routeToPurchasing, routeState] = useRouteSupplementalMaterialRequestToPurchasingMutation();
  const [reject, rejectState] = useRejectSupplementalMaterialRequestMutation();
  const [confirmReturn, confirmReturnState] = useConfirmInventoryReturnReceiptMutation();
  const [createAllocationDisposition, allocationDispositionState] = useCreateReturnAllocationDispositionMutation();

  const supplementalView = toLabeledQueryView(supplementalQuery, 'yêu cầu cấp bổ sung');
  const returnsView = toLabeledQueryView(returnsQuery, 'phiếu trả');
  const returnDetailView = toLabeledQueryView(returnDetailQuery, 'chi tiết phiếu trả', {
    instruction: 'Chọn một phiếu trả để tải chi tiết.',
  });
  const supplementalData = supplementalView.phase === 'ready' ? supplementalView.data : undefined;
  const returnsData = returnsView.phase === 'ready' ? returnsView.data : undefined;
  const supplementalItems = supplementalData?.items ?? [];
  const returnItems = returnsData?.items ?? [];
  const selectedReturn = returnDetailView.phase === 'ready' ? returnDetailView.data : undefined;
  const allocationView = toLabeledQueryView(allocationQuery, 'đối soát nguyên liệu theo dòng chứng từ');
  const allocationRows: ReturnAllocationBalance[] = allocationView.phase === 'ready' ? allocationView.data : [];

  const returnQuantity = useMemo(
    () => selectedReturn?.lines.reduce((sum, line) => sum + line.quantity, 0) ?? 0,
    [selectedReturn],
  );

  const openFulfill = (item: SupplementalMaterialRequestResult) => {
    setFeedback(undefined);
    setFulfillValidation(undefined);
    setFulfillError(undefined);
    setSelectedSupplemental(item);
    setFulfillQty(String(Math.min(item.remainingQty, item.availableQty)));
  };

  const submitFulfill = async () => {
    if (!selectedSupplemental) return;
    setFulfillValidation(undefined);
    setFulfillError(undefined);
    const quantity = Number(fulfillQty);
    if (!Number.isFinite(quantity) || quantity <= 0 || quantity > selectedSupplemental.remainingQty) {
      setFulfillValidation({
        title: 'Số lượng cấp chưa hợp lệ',
        message: `Nhập số lớn hơn 0 và không vượt ${formatQuantityWithUnit(selectedSupplemental.remainingQty, selectedSupplemental.unitName)}.`,
      });
      return;
    }
    try {
      const response = await fulfill({
        requestId: selectedSupplemental.requestId,
        commandId: crypto.randomUUID(),
        expectedVersion: selectedSupplemental.concurrencyVersion,
        quantity,
      }).unwrap();
      setSelectedSupplemental(undefined);
      setFeedback({
        title: 'Đã tạo phiếu xuất bổ sung',
        message: response.data
          ? `${response.data.requestCode}: đã cấp ${formatQuantityWithUnit(quantity, response.data.unitName)}, còn ${formatQuantityWithUnit(response.data.remainingQty, response.data.unitName)}.`
          : response.message || 'Tồn kho và phiếu xuất đã được cập nhật.',
        variant: 'info',
      });
    } catch (error) {
      setFulfillError({ title: 'Chưa cấp được nguyên liệu', message: mutationError(error, 'Tải lại tồn kho và thử lại.') });
    }
  };

  const submitRouteToPurchasing = async (item: SupplementalMaterialRequestResult) => {
    setFeedback(undefined);
    try {
      const response = await routeToPurchasing({
        requestId: item.requestId,
        commandId: crypto.randomUUID(),
        expectedVersion: item.concurrencyVersion,
      }).unwrap();
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
    setRejectValidation(undefined);
    setRejectError(undefined);
    if (!rejectReason.trim()) {
      setRejectValidation({ title: 'Thiếu lý do từ chối', message: 'Nhập lý do để bếp biết cách xử lý tiếp theo.' });
      return;
    }
    try {
      await reject({
        requestId: rejecting.requestId,
        commandId: crypto.randomUUID(),
        expectedVersion: rejecting.concurrencyVersion,
        reason: rejectReason.trim(),
      }).unwrap();
      setRejecting(undefined);
      setRejectReason('');
      setFeedback({ title: 'Đã từ chối yêu cầu', message: 'Lý do đã được lưu vào lịch sử nghiệp vụ.', variant: 'info' });
    } catch (error) {
      setRejectError({ title: 'Chưa từ chối được yêu cầu', message: mutationError(error, 'Tải lại trạng thái và thử lại.') });
    }
  };

  const submitReturnReceipt = async () => {
    if (!selectedReturn) return;
    setDiscrepancyValidation(undefined);
    setAdjustedQuantityErrors({});
    setReturnError(undefined);
    if (hasDiscrepancy && !discrepancyNote.trim()) {
      setDiscrepancyValidation({ title: 'Thiếu mô tả chênh lệch', message: 'Ghi rõ số thực nhận hoặc tình trạng nguyên liệu trước khi xác nhận.' });
      return;
    }
    const adjustedLines = selectedReturn.lines.map((line) => ({
      returnLineId: line.returnLineId,
      newQuantity: Number(adjustedQuantities[line.returnLineId] ?? line.quantity),
    }));
    const invalidAdjustedLines = adjustedLines.filter((line) => !Number.isFinite(line.newQuantity) || line.newQuantity < 0);
    if (invalidAdjustedLines.length > 0) {
      setAdjustedQuantityErrors(Object.fromEntries(invalidAdjustedLines.map((line) => [line.returnLineId, {
        title: 'Số thực nhận chưa hợp lệ',
        message: 'Số thực nhận phải từ 0 trở lên.',
      }])));
      return;
    }
    try {
      await confirmReturn({
        returnId: selectedReturn.returnId,
        commandId: crypto.randomUUID(),
        expectedVersion: selectedReturn.concurrencyVersion,
        hasDiscrepancy,
        discrepancyNote: hasDiscrepancy ? discrepancyNote.trim() : undefined,
        adjustedLines,
      }).unwrap();
      setSelectedReturnId('');
      setFeedback({
        title: selectedReturn.returnType === 'WASTE' ? 'Đã ghi nhận hao hụt' : 'Đã nhập lại nguyên liệu trả',
        message: selectedReturn.returnType === 'WASTE'
          ? 'Hao hụt đã được ghi audit và không cộng tồn.'
          : 'Số thực nhận đã được cộng vào tồn kho và ghi vào sổ kho.',
        variant: 'info',
      });
    } catch (error) {
      setReturnError({ title: 'Chưa xác nhận được phiếu trả', message: mutationError(error, 'Kiểm tra số thực nhận và thử lại.') });
    }
  };

  const openDisposition = (row: ReturnAllocationBalance) => {
    setSelectedAllocation(row);
    setAllocationError(undefined);
    setDestinationSourceLineId('');
    setAllocationQuantity(String(row.excessQuantity));
    setAllocationReason('');
  };

  const submitDisposition = async () => {
    if (!selectedAllocation?.decisionId) return;
    const quantity = Number(allocationQuantity);
    if (!destinationSourceLineId || !allocationReason.trim() || !Number.isFinite(quantity) || quantity <= 0 || quantity > selectedAllocation.excessQuantity) {
      setAllocationError({ title: 'Chưa thể điều phối', message: 'Chọn phạm vi nhận, ghi lý do và nhập số lượng không vượt phần dư hiện có.' });
      return;
    }
    try {
      await createAllocationDisposition({
        decisionId: selectedAllocation.decisionId, sourceIssueLineId: selectedAllocation.sourceIssueLineId,
        destinationSourceLineId, quantity, reason: allocationReason.trim(), expectedVersion: selectedAllocation.version,
        commandId: crypto.randomUUID(), correlationId: selectedAllocation.decisionId,
      }).unwrap();
      setSelectedAllocation(undefined);
      setFeedback({ title: 'Đã ghi nhận điều phối', message: 'Phần dư đã được ghi vào lịch sử; số dư của hai phạm vi đang được cập nhật.', variant: 'info' });
    } catch (error) {
      setAllocationError({ title: 'Chưa ghi nhận được điều phối', message: mutationError(error, 'Số dư đã thay đổi; hãy tải lại trước khi thử lại.') });
    }
  };

  return (
    <div className="grid gap-4">
      {!canManage && (
        <InlineAlert title="Chế độ chỉ đọc" variant="info">
          Chỉ nhân viên Kho được cấp bổ sung, chuyển thu mua hoặc xác nhận nguyên liệu trả.
        </InlineAlert>
      )}
      {feedback && <InlineAlert title={feedback.title} variant={feedback.variant}>{feedback.message}</InlineAlert>}

      <SectionPanel
        title="Yêu cầu cấp nguyên liệu bổ sung"
        icon={<RefreshCw size={18} aria-hidden="true" />}
        description="Kho xử lý theo tồn thực tế; phần thiếu được chuyển thành đề xuất mua có thể truy vết."
      >
        <div className="mb-3 flex flex-wrap items-end justify-between gap-2">
          <SearchField id="warehouse-supplemental-search" label="Tìm yêu cầu, nguyên liệu hoặc trạng thái" width="wide" value={supplementalSearch} onChange={(event) => { setSupplementalSearch(event.target.value); setSupplementalPage(1); }} placeholder="Nhập mã hoặc tên nguyên liệu" />
          {supplementalSearch.trim() && supplementalData && <span className="pb-2 text-xs text-slate-500">{supplementalData.totalCount} kết quả</span>}
        </div>
        <QueryViewBoundary queries={[{ label: 'yêu cầu cấp bổ sung', view: supplementalView }]} refreshLabel="Đang cập nhật yêu cầu cấp bổ sung">
        <TableViewport ariaLabel="Danh sách yêu cầu cấp nguyên liệu bổ sung" caption="Trạng thái và eligibility thao tác do máy chủ cung cấp.">
          <table className="ipc-data-table min-w-[980px]">
            <thead><tr><th>Yêu cầu</th><th>Nguyên liệu</th><th className="text-right">Đã cấp / yêu cầu</th><th className="text-right">Tồn khả dụng</th><th>Trạng thái</th><th>Hướng xử lý</th><th className="text-right">Thao tác</th></tr></thead>
            <tbody>
              {supplementalItems.length === 0 ? (
                <tr><td colSpan={7} className="text-center text-slate-600">Không có yêu cầu bổ sung trong phạm vi kho.</td></tr>
              ) : supplementalItems.map((item) => (
                <tr key={item.requestId}>
                  <td><IdentifierText value={item.requestCode} className="font-semibold text-slate-950" /><span className="flex min-w-0 items-center gap-1 text-xs text-slate-600">Từ <IdentifierText value={item.issueCode} className="min-w-0" /></span></td>
                  <td><span className="block font-medium text-slate-900">{item.ingredientName}</span><span className="text-xs text-slate-600">{item.reason || 'Không có ghi chú'}</span></td>
                  <td className="text-right tabular-nums"><CompactQuantity value={item.fulfilledQty} unit={item.unitName} /> / <CompactQuantity value={item.requestedQty} unit={item.unitName} /></td>
                  <td className="text-right tabular-nums"><CompactQuantity value={item.availableQty} unit={item.unitName} /></td>
                  <td title={item.purchaseRequestCode ? `${item.purchaseRequestCode}: ${formatWorkflowStatus(item.purchaseRequestStatus || '')}` : undefined}>{formatWorkflowStatus(item.status)}{item.purchaseRequestCode && <span className="block text-xs text-slate-500">Đã liên kết thu mua</span>}</td>
                  <td className="max-w-[240px] text-xs text-slate-700">
                    {item.remainingQty > 0 && <span className="block font-medium text-slate-900">Còn thiếu <CompactQuantity value={item.remainingQty} unit={item.unitName} /></span>}
                    {item.actionDisabledReason || (item.availableQty >= item.remainingQty ? 'Cấp phần còn thiếu.' : 'Cấp tồn có sẵn hoặc chuyển thu mua.')}
                  </td>
                  <td className="text-right">
                    {canManage ? (
                      <div className="flex min-w-[250px] justify-end flex-wrap gap-2">
                        <Button type="button" size="sm" disabled={!item.canFulfill || fulfillState.isLoading} onClick={() => openFulfill(item)}>Cấp bổ sung</Button>
                        <Button type="button" size="sm" variant="outline" disabled={!item.canRouteToPurchasing || routeState.isLoading} onClick={() => void submitRouteToPurchasing(item)}><ArrowRight size={15} aria-hidden="true" /> Chuyển thu mua</Button>
                        <Button type="button" size="sm" variant="ghost" disabled={!item.canReject || rejectState.isLoading} onClick={() => { setFeedback(undefined); setRejectValidation(undefined); setRejectError(undefined); setRejecting(item); setRejectReason(''); }}>Từ chối</Button>
                      </div>
                    ) : <span className="text-xs text-slate-500">Chỉ đọc</span>}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </TableViewport>
        <PaginationBar page={supplementalData?.pageNumber ?? supplementalPage} pageSize={supplementalData?.pageSize ?? 8} totalItems={supplementalData?.totalCount ?? 0} isPending={supplementalView.phase === 'ready' && supplementalView.isRefreshing} onPageChange={setSupplementalPage} />
        </QueryViewBoundary>
      </SectionPanel>

      <SectionPanel title="Đối soát nguyên liệu đã xuất" icon={<Undo2 size={18} aria-hidden="true" />} description="Theo dõi nguyên liệu đã trả, hao hụt và còn dư theo đúng khách hàng, ngày, ca và mức suất.">
        <QueryViewBoundary queries={[{ label: 'đối soát nguyên liệu theo dòng chứng từ', view: allocationView }]} refreshLabel="Đang cập nhật số liệu đối soát">
          <TableViewport ariaLabel="Đối chiếu trả kho, hao hụt và dư thừa theo dòng chứng từ" caption="Quyết định điều chuyển giữa khách hàng chỉ xuất hiện khi hệ thống xác nhận đủ điều kiện.">
            <table className="ipc-data-table min-w-[1120px]">
              <thead><tr><th>Khách hàng và ca phục vụ</th><th>Nguyên liệu</th><th className="text-right">Đã xuất</th><th className="text-right">Đã trả</th><th className="text-right">Hao hụt</th><th className="text-right">Còn dư</th><th>Hướng xử lý</th><th className="text-right">Thao tác</th></tr></thead>
              <tbody>{allocationRows.length === 0 ? <tr><td colSpan={8} className="text-center text-slate-600">Chưa có nguyên liệu cần đối soát trong phạm vi hiện tại.</td></tr> : allocationRows.map((row) => (
                <tr key={row.sourceIssueLineId}><td><span className="block font-medium text-slate-900">{allocationCustomerLabel(row)}</span><span className="text-xs text-slate-600">{formatDateOnly(row.serviceDate)} · {formatShiftName(row.shiftName)} · {formatCurrency(row.priceTierAmount)}</span></td><td><span className="block font-medium text-slate-900">{row.ingredientName || 'Chưa xác định nguyên liệu'}</span></td><td className="text-right tabular-nums"><CompactQuantity value={row.issuedQuantity} unit={row.unitName ?? ''} /></td><td className="text-right tabular-nums"><CompactQuantity value={row.returnedQuantity} unit={row.unitName ?? ''} /></td><td className="text-right tabular-nums"><CompactQuantity value={row.wastedQuantity} unit={row.unitName ?? ''} /></td><td className="text-right tabular-nums"><CompactQuantity value={row.excessQuantity} unit={row.unitName ?? ''} /></td><td>{row.decisionReason || (row.allowedActions.includes('CROSS_CUSTOMER_DISPOSITION') ? 'Có thể điều phối sang khách hàng khác' : 'Đang theo dõi trong phạm vi này')}</td><td className="text-right">{canDisposition && row.allowedActions.includes('CROSS_CUSTOMER_DISPOSITION') ? <Button type="button" size="sm" onClick={() => openDisposition(row)}>Điều phối phần dư</Button> : <span className="text-xs text-slate-500">Chưa cần thao tác</span>}</td></tr>
              ))}</tbody>
            </table>
          </TableViewport>
        </QueryViewBoundary>
      </SectionPanel>

      <SectionPanel
        title="Phiếu trả dư và hao hụt chờ kho tiếp nhận"
        icon={<Undo2 size={18} aria-hidden="true" />}
        description="Nguyên liệu trả lại được cộng tồn theo số thực nhận; hao hụt chỉ được ghi vào lịch sử, không cộng tồn."
      >
        <div className="mb-3 flex flex-wrap items-end justify-between gap-2">
          <SearchField id="warehouse-return-search" label="Tìm phiếu trả, ngày hoặc lý do" width="wide" value={returnSearch} onChange={(event) => { setReturnSearch(event.target.value); setReturnPage(1); }} placeholder="Nhập mã phiếu hoặc nội dung" />
          {returnSearch.trim() && returnsData && <span className="pb-2 text-xs text-slate-500">{returnsData.totalCount} kết quả</span>}
        </div>
        <QueryViewBoundary queries={[{ label: 'phiếu trả', view: returnsView }]} refreshLabel="Đang cập nhật phiếu trả">
        <TableViewport ariaLabel="Danh sách phiếu trả nguyên liệu chờ tiếp nhận" caption="Kho mở từng phiếu để kiểm đếm số thực nhận.">
          <table className="ipc-data-table min-w-[820px]">
            <thead><tr><th>Phiếu trả</th><th>Loại</th><th>Phiếu xuất gốc</th><th>Ngày/ca</th><th>Lý do</th><th>Trạng thái</th><th className="text-right">Thao tác</th></tr></thead>
            <tbody>
              {returnItems.length === 0 ? (
                <tr><td colSpan={7} className="text-center text-slate-600">Không có phiếu trả hoặc hao hụt đang chờ kho.</td></tr>
              ) : returnItems.map((item) => (
                <tr key={item.returnId}>
                  <td className="font-semibold text-slate-950">{item.returnCode}</td>
                  <td>{item.returnType === 'WASTE' ? 'Hao hụt / hủy' : 'Trả lại kho'}</td>
                  <td>{item.issueCode || item.issueId}</td>
                  <td>{item.returnDate}{item.shiftName ? ` · ${item.shiftName}` : ''}</td>
                  <td className="max-w-[280px]">{item.reason}</td>
                  <td>{formatWorkflowStatus(item.status)}</td>
                  <td className="text-right"><Button type="button" size="sm" disabled={!canManage} onClick={() => { setFeedback(undefined); setDiscrepancyValidation(undefined); setAdjustedQuantityErrors({}); setReturnError(undefined); setSelectedReturnId(item.returnId); setAdjustedQuantities({}); setHasDiscrepancy(false); setDiscrepancyNote(''); }}><PackageCheck size={15} aria-hidden="true" /> Tiếp nhận</Button></td>
                </tr>
              ))}
            </tbody>
          </table>
        </TableViewport>
        <PaginationBar page={returnsData?.pageNumber ?? returnPage} pageSize={returnsData?.pageSize ?? 8} totalItems={returnsData?.totalCount ?? 0} isPending={returnsView.phase === 'ready' && returnsView.isRefreshing} onPageChange={setReturnPage} />
        </QueryViewBoundary>
      </SectionPanel>

      {Boolean(selectedSupplemental) && (
        <Dialog open={Boolean(selectedSupplemental)} onOpenChange={(open) => { if (!open) { setSelectedSupplemental(undefined); setFulfillValidation(undefined); setFulfillError(undefined); } }}>
          <DialogContent aria-labelledby="supplemental-fulfill-title" aria-describedby="supplemental-fulfill-description">
            <DialogHeader><DialogTitle id="supplemental-fulfill-title">Cấp nguyên liệu bổ sung</DialogTitle><DialogDescription id="supplemental-fulfill-description">Lập phiếu xuất kho bổ sung và cập nhật trừ tồn kho ngay.</DialogDescription></DialogHeader>
            {selectedSupplemental && <div className="grid gap-2"><label htmlFor="supplemental-quantity" className="text-sm font-medium text-slate-900">Số lượng cấp ({formatUnit(selectedSupplemental.unitName)})</label><Input id="supplemental-quantity" type="number" min="0.000001" max={Math.min(selectedSupplemental.remainingQty, selectedSupplemental.availableQty)} step="any" aria-invalid={Boolean(fulfillValidation) || undefined} aria-describedby={fulfillValidation ? 'supplemental-quantity-error' : undefined} value={fulfillQty} onChange={(event) => { setFulfillQty(event.target.value); setFulfillValidation(undefined); }} />{fulfillValidation && <p id="supplemental-quantity-error" className="text-xs text-red-700"><span className="font-semibold">{fulfillValidation.title}</span>{' '}{fulfillValidation.message}</p>}<p className="text-xs text-slate-600">Còn thiếu <CompactQuantity value={selectedSupplemental.remainingQty} unit={selectedSupplemental.unitName} />; tồn khả dụng <CompactQuantity value={selectedSupplemental.availableQty} unit={selectedSupplemental.unitName} />.</p></div>}
            {fulfillError && <div role="alert"><InlineAlert title={fulfillError.title} variant="danger">{fulfillError.message}</InlineAlert></div>}
            <DialogFooter><Button type="button" variant="outline" onClick={() => setSelectedSupplemental(undefined)}>Hủy</Button><Button type="button" disabled={fulfillState.isLoading} onClick={() => void submitFulfill()}>{fulfillState.isLoading ? 'Đang tạo phiếu...' : 'Xác nhận cấp'}</Button></DialogFooter>
          </DialogContent>
        </Dialog>
      )}

      {Boolean(selectedAllocation) && (
        <Dialog open={Boolean(selectedAllocation)} onOpenChange={(open) => { if (!open) setSelectedAllocation(undefined); }}>
          <DialogContent aria-labelledby="allocation-disposition-title" aria-describedby="allocation-disposition-description">
            <DialogHeader><DialogTitle id="allocation-disposition-title">Điều phối nguyên liệu còn dư</DialogTitle><DialogDescription id="allocation-disposition-description">Chuyển số lượng còn dư sang khách hàng khác có cùng nguyên liệu.</DialogDescription></DialogHeader>
            {selectedAllocation && <div className="grid gap-3"><p className="text-sm text-slate-700"><span className="block font-medium text-slate-950">{selectedAllocation.ingredientName || 'Nguyên liệu chưa xác định'}</span>{allocationScopeLabel(selectedAllocation)} · Còn dư {formatQuantityWithUnit(selectedAllocation.excessQuantity, selectedAllocation.unitName ?? '')}</p><label className="grid gap-1 text-sm font-medium" htmlFor="allocation-destination">Chuyển sang phạm vi<select id="allocation-destination" className="h-9 rounded-md border border-slate-300 px-2" value={destinationSourceLineId} onChange={(event) => setDestinationSourceLineId(event.target.value)}><option value="">Chọn khách hàng và ca nhận</option>{allocationRows.filter((row) => row.sourceIssueLineId !== selectedAllocation.sourceIssueLineId && row.customerId !== selectedAllocation.customerId && row.ingredientId === selectedAllocation.ingredientId && row.unitId === selectedAllocation.unitId).map((row) => <option key={row.sourceIssueLineId} value={row.sourceIssueLineId}>{allocationScopeLabel(row)} · {row.ingredientName || 'Nguyên liệu chưa xác định'}</option>)}</select></label><label className="grid gap-1 text-sm font-medium" htmlFor="allocation-quantity">Số lượng điều phối ({formatUnit(selectedAllocation.unitName ?? '')})<Input id="allocation-quantity" type="number" min="0.000001" max={selectedAllocation.excessQuantity} step="any" value={allocationQuantity} onChange={(event) => setAllocationQuantity(event.target.value)} /></label><label className="grid gap-1 text-sm font-medium" htmlFor="allocation-reason">Lý do<Textarea id="allocation-reason" value={allocationReason} onChange={(event) => setAllocationReason(event.target.value)} /></label>{allocationError && <InlineAlert title={allocationError.title} variant="danger">{allocationError.message}</InlineAlert>}</div>}
            <DialogFooter><Button type="button" variant="outline" onClick={() => setSelectedAllocation(undefined)}>Hủy</Button><Button type="button" disabled={allocationDispositionState.isLoading} onClick={() => void submitDisposition()}>{allocationDispositionState.isLoading ? 'Đang ghi nhận...' : 'Xác nhận điều phối'}</Button></DialogFooter>
          </DialogContent>
        </Dialog>
      )}

      {Boolean(rejecting) && (
        <Dialog open={Boolean(rejecting)} onOpenChange={(open) => { if (!open) { setRejecting(undefined); setRejectValidation(undefined); setRejectError(undefined); } }}>
          <DialogContent aria-labelledby="supplemental-reject-title" aria-describedby="supplemental-reject-description">
            <DialogHeader><DialogTitle id="supplemental-reject-title">Từ chối yêu cầu bổ sung</DialogTitle><DialogDescription id="supplemental-reject-description">Vui lòng nhập lý do từ chối yêu cầu bổ sung của bếp.</DialogDescription></DialogHeader>
            <div className="grid gap-2"><label htmlFor="supplemental-reject-reason" className="text-sm font-medium text-slate-900">Lý do từ chối</label><Textarea id="supplemental-reject-reason" className="min-h-24" aria-invalid={Boolean(rejectValidation) || undefined} aria-describedby={rejectValidation ? 'supplemental-reject-reason-error' : undefined} value={rejectReason} onChange={(event) => { setRejectReason(event.target.value); setRejectValidation(undefined); }} />{rejectValidation && <p id="supplemental-reject-reason-error" className="text-xs text-red-700"><span className="font-semibold">{rejectValidation.title}</span>{' '}{rejectValidation.message}</p>}</div>
            {rejectError && <div role="alert"><InlineAlert title={rejectError.title} variant="danger">{rejectError.message}</InlineAlert></div>}
            <DialogFooter><Button type="button" variant="outline" onClick={() => setRejecting(undefined)}>Hủy</Button><Button type="button" variant="destructive" disabled={rejectState.isLoading} onClick={() => void submitReject()}>Xác nhận từ chối</Button></DialogFooter>
          </DialogContent>
        </Dialog>
      )}

      {Boolean(selectedReturnId) && (
        <Dialog open={Boolean(selectedReturnId)} onOpenChange={(open) => { if (!open) { setSelectedReturnId(''); setDiscrepancyValidation(undefined); setAdjustedQuantityErrors({}); setReturnError(undefined); } }}>
          <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-2xl" aria-labelledby="return-receipt-title" aria-describedby="return-receipt-description">
            <DialogHeader><DialogTitle id="return-receipt-title">Tiếp nhận nguyên liệu trả</DialogTitle><DialogDescription id="return-receipt-description">Kiểm đếm và nhập số lượng thực nhận cho từng nguyên liệu.</DialogDescription></DialogHeader>
            <QueryViewBoundary queries={[{ label: 'chi tiết phiếu trả', view: returnDetailView }]} refreshLabel="Đang cập nhật chi tiết phiếu trả">
            {selectedReturn && <div className="grid gap-4">
              <InlineAlert title={`${selectedReturn.returnCode} · ${selectedReturn.returnType === 'WASTE' ? 'Hao hụt' : 'Trả kho'}`} variant={selectedReturn.returnType === 'WASTE' ? 'warning' : 'info'}>Bếp khai báo tổng {returnQuantity}; kho nhập số thực nhận cho từng dòng.</InlineAlert>
              {selectedReturn.lines.map((line) => {
                const quantityError = adjustedQuantityErrors[line.returnLineId];
                return <div key={line.returnLineId} className="grid gap-2 rounded-sm border border-slate-200 p-3 sm:grid-cols-[1fr_180px]"><div><p className="font-medium text-slate-950">{line.ingredientName}</p><p className="text-xs text-slate-600">Bếp khai báo {formatQuantityWithUnit(line.quantity, line.unitName || '')}</p></div><div><label htmlFor={`return-line-${line.returnLineId}`} className="text-xs font-medium text-slate-700">Số thực nhận ({formatUnit(line.unitName || '')})</label><Input id={`return-line-${line.returnLineId}`} type="number" min="0" step="any" aria-invalid={Boolean(quantityError) || undefined} aria-describedby={quantityError ? `return-line-${line.returnLineId}-error` : undefined} value={adjustedQuantities[line.returnLineId] ?? String(line.quantity)} onChange={(event) => { setAdjustedQuantities((current) => ({ ...current, [line.returnLineId]: event.target.value })); setAdjustedQuantityErrors((current) => { const next = { ...current }; delete next[line.returnLineId]; return next; }); }} />{quantityError && <p id={`return-line-${line.returnLineId}-error`} className="mt-1 text-xs text-red-700"><span className="font-semibold">{quantityError.title}</span>{' '}{quantityError.message}</p>}</div></div>;
              })}
              <label className="flex min-h-11 cursor-pointer items-center gap-2 text-sm font-medium text-slate-900">
                <Checkbox
                  checked={hasDiscrepancy}
                  onCheckedChange={(checked) => setHasDiscrepancy(checked === true)}
                />
                <span>Có chênh lệch so với bếp khai báo</span>
              </label>
              {hasDiscrepancy && <div className="grid gap-2"><label htmlFor="return-discrepancy-note" className="text-sm font-medium text-slate-900">Mô tả chênh lệch</label><Textarea id="return-discrepancy-note" className="min-h-24" aria-invalid={Boolean(discrepancyValidation) || undefined} aria-describedby={discrepancyValidation ? 'return-discrepancy-note-error' : undefined} value={discrepancyNote} onChange={(event) => { setDiscrepancyNote(event.target.value); setDiscrepancyValidation(undefined); }} />{discrepancyValidation && <p id="return-discrepancy-note-error" className="text-xs text-red-700"><span className="font-semibold">{discrepancyValidation.title}</span>{' '}{discrepancyValidation.message}</p>}</div>}
            </div>}
            </QueryViewBoundary>
            {returnError && <div role="alert"><InlineAlert title={returnError.title} variant="danger">{returnError.message}</InlineAlert></div>}
            <DialogFooter><Button type="button" variant="outline" onClick={() => setSelectedReturnId('')}>Hủy</Button><Button type="button" disabled={!selectedReturn || confirmReturnState.isLoading} onClick={() => void submitReturnReceipt()}>{confirmReturnState.isLoading ? 'Đang cập nhật...' : 'Xác nhận tiếp nhận'}</Button></DialogFooter>
          </DialogContent>
        </Dialog>
      )}
    </div>
  );
}
