import { useEffect, useMemo, useRef, useState } from 'react';
import { CircleAlert, PackageCheck, ReceiptText, ShieldCheck } from 'lucide-react';
import { Link } from 'react-router-dom';
import { EmptyState, InlineAlert, SectionPanel, StatusBadge } from '@/components/common';
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
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { formatCurrency, formatDateOnly, formatQuantityWithUnit, formatUnit } from '@/lib/formatters';
import { toQueryView } from '@/lib/queryView';
import { ROUTES } from '@/lib/routeConfig';
import { formatShiftName } from '@/lib/workflowConfig';
import type {
  PurchaseRequestWorkflowLine,
  PurchaseWorkbenchServiceDate,
  SupplierEvidenceCandidate,
} from '@/api/workflowApiTypes';
import {
  useConfirmLineSupplierMutation,
  useCreatePurchaseOrdersFromRequestMutation,
  useCreatePurchaseRequestFromDemandMutation,
  useGetSupplierEvidenceQuery,
  useSubmitPurchaseRequestMutation,
} from '@/api/purchasingApi';
import { useGetWarehouseSelectorQuery } from '@/features/warehouse/warehouseApi';
import { getPurchasingErrorMessage, type PurchasingStageId } from './purchasingModel';

interface PurchaseDecisionPanelProps {
  week: string;
  selectedStage: PurchasingStageId;
  serviceDate?: PurchaseWorkbenchServiceDate;
  selectedLine?: PurchaseRequestWorkflowLine;
  panelId?: string;
}

type Confirmation =
  | { type: 'supplier' }
  | { type: 'create-request'; materialRequestId: string }
  | { type: 'submit-request'; purchaseRequestId: string }
  | { type: 'create-orders'; purchaseRequestId: string };

const EMPTY_DEMAND_SELECT_VALUE = '__no-approved-demand__';

const evidenceLabel = (candidate: SupplierEvidenceCandidate) =>
  candidate.evidenceType === 'EffectiveQuotation'
    ? `Báo giá hiệu lực đến ${candidate.effectiveTo ? formatDateOnly(candidate.effectiveTo) : 'không giới hạn'}`
    : `Phiếu nhập gần nhất ngày ${formatDateOnly(candidate.evidenceDate)}`;

export function SupplierEvidenceList({
  candidates,
  selectedEvidenceId,
  onSelect,
}: {
  candidates: SupplierEvidenceCandidate[];
  selectedEvidenceId?: string;
  onSelect: (candidate: SupplierEvidenceCandidate) => void;
}) {
  if (candidates.length === 0) {
    return (
      <InlineAlert title="Chưa có bằng chứng nhà cung cấp" variant="warning">
        Chưa có báo giá hiệu lực hoặc phiếu nhập hợp lệ cho nguyên liệu này.
      </InlineAlert>
    );
  }

  return (
    <div className="grid grid-cols-1 gap-2" aria-label="Bằng chứng nhà cung cấp">
      {candidates.map((candidate) => {
        const selected = candidate.evidenceId === selectedEvidenceId;
        return (
          <Button
            key={`${candidate.evidenceType}-${candidate.evidenceId}`}
            type="button"
            variant="outline"
            size="sm"
            textWrap="wrap"
            className={`min-h-11 w-full flex-col items-stretch justify-start rounded-[3px] px-3 py-2 text-left text-body leading-normal transition-colors motion-reduce:transition-none ${
              selected
                ? 'border-[var(--ipc-primary)] bg-blue-50 text-blue-950'
                : 'border-slate-300 bg-white text-slate-800 hover:bg-slate-50'
            }`}
            aria-pressed={selected}
            aria-label={`Chọn ${candidate.supplierName}, ${evidenceLabel(candidate)}`}
            onClick={() => onSelect(candidate)}
          >
            <span className="flex flex-wrap items-center justify-between gap-2">
              <span className="font-semibold">{candidate.supplierName}</span>
              <StatusBadge variant={selected ? 'warning' : 'neutral'}>
                {selected ? 'Đang chọn' : 'Bằng chứng'}
              </StatusBadge>
            </span>
            <span className="mt-1 block text-caption leading-[1.4] text-slate-600">
              {evidenceLabel(candidate)}. {formatCurrency(candidate.unitPrice)}/{formatUnit(candidate.unitName)}
            </span>
          </Button>
        );
      })}
    </div>
  );
}

export function PriceExceptionStatus({ serviceDate }: { serviceDate: PurchaseWorkbenchServiceDate }) {
  const blocked = serviceDate.blockingExceptionCount > 0;
  return (
    <div className="flex flex-wrap items-center justify-between gap-2 rounded-[3px] border border-slate-300 bg-slate-50 px-3 py-2">
      <div>
        <p className="text-body font-semibold text-slate-900">Ngoại lệ giá</p>
        <p className="text-caption leading-[1.4] text-slate-600">
          {blocked
            ? `${serviceDate.blockingExceptionCount} ngoại lệ đang chặn đề xuất mua.`
            : 'Không còn ngoại lệ giá chặn ngày phục vụ này.'}
        </p>
      </div>
      <StatusBadge variant={blocked ? 'warning' : 'success'}>
        {blocked ? 'Cần xử lý' : 'Đủ căn cứ'}
      </StatusBadge>
    </div>
  );
}

export function OrderHandoffStatus({ serviceDate, week }: { serviceDate: PurchaseWorkbenchServiceDate; week: string }) {
  const complete = serviceDate.receivingLineCount > 0 &&
    serviceDate.fullyReceivedLineCount >= serviceDate.receivingLineCount;
  const partial = serviceDate.fullyReceivedLineCount > 0 && !complete;

  return (
    <div className="rounded-[3px] border border-slate-300 bg-slate-50 px-3 py-3">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <p className="text-body font-semibold text-slate-900">Tiến độ nhập kho chỉ đọc</p>
        <StatusBadge variant={complete ? 'success' : partial ? 'warning' : 'neutral'}>
          {complete ? 'Đã nhận đủ' : partial ? 'Nhận một phần' : 'Chưa nhận'}
        </StatusBadge>
      </div>
      <p className="mt-2 text-body leading-[1.5] text-slate-700">
        {serviceDate.fullyReceivedLineCount}/{serviceDate.receivingLineCount} dòng đã nhận đủ trên {serviceDate.orderCount} đơn đặt hàng.
      </p>
      <Button nativeButton={false} className="mt-3 min-h-11 sm:min-h-9" variant="outline" render={<Link to={`${ROUTES.WAREHOUSE}?week=${week}&purchaseRequestId=${serviceDate.purchaseRequestId ?? ''}`} />}>
        <PackageCheck aria-hidden="true" />
        Mở màn hình nhập kho
      </Button>
    </div>
  );
}

export function PurchaseDecisionPanel({
  week,
  selectedStage,
  serviceDate,
  selectedLine,
  panelId = 'purchase-decision-panel',
}: PurchaseDecisionPanelProps) {
  const [selectedEvidence, setSelectedEvidence] = useState<SupplierEvidenceCandidate>();
  const [proposedUnitPrice, setProposedUnitPrice] = useState('');
  const [proposedDeliveryDate, setProposedDeliveryDate] = useState('');
  const [receivingWarehouseId, setReceivingWarehouseId] = useState('');
  const [purchasingTerms, setPurchasingTerms] = useState('');
  const [decisionNote, setDecisionNote] = useState('');
  const [selectedDemandId, setSelectedDemandId] = useState('');
  const [confirmation, setConfirmation] = useState<Confirmation>();
  const [errorMessage, setErrorMessage] = useState('');
  const [successMessage, setSuccessMessage] = useState('');
  const safeActionRef = useRef<HTMLButtonElement>(null);

  const evidenceArgs = {
    purchaseRequestId: serviceDate?.purchaseRequestId ?? '',
    purchaseRequestLineId: selectedLine?.purchaseRequestLineId ?? '',
  };
  const evidenceQuery = useGetSupplierEvidenceQuery(
    evidenceArgs,
    { skip: selectedStage !== 'supplier-price' || !evidenceArgs.purchaseRequestId || !evidenceArgs.purchaseRequestLineId },
  );
  const evidenceView = toQueryView(evidenceQuery, {
    instruction: 'Chọn một dòng nguyên liệu để xem bằng chứng nhà cung cấp.',
    retry: () => evidenceQuery.refetch(),
    errorMessage: 'Không tải được bằng chứng nhà cung cấp.',
    forbiddenMessage: 'Bạn không có quyền xem bằng chứng nhà cung cấp.',
  });
  const evidence = evidenceView.phase === 'ready' ? evidenceView.data : undefined;
  const warehouseQuery = useGetWarehouseSelectorQuery();
  const warehouses = warehouseQuery.data ?? [];
  const [confirmSupplier, { isLoading: isConfirmingSupplier }] = useConfirmLineSupplierMutation();
  const [createRequest, { isLoading: isCreatingRequest }] = useCreatePurchaseRequestFromDemandMutation();
  const [submitRequest, { isLoading: isSubmittingRequest }] = useSubmitPurchaseRequestMutation();
  const [createOrders, { isLoading: isCreatingOrders }] = useCreatePurchaseOrdersFromRequestMutation();
  const isPending = isConfirmingSupplier || isCreatingRequest || isSubmittingRequest || isCreatingOrders;

  useEffect(() => {
    if (!confirmation) return;
    const frame = window.requestAnimationFrame(() => safeActionRef.current?.focus());
    return () => window.cancelAnimationFrame(frame);
  }, [confirmation]);

  const selectedDemand = useMemo(
    () => serviceDate?.approvedDemands.find((demand) => demand.materialRequestId === selectedDemandId),
    [selectedDemandId, serviceDate?.approvedDemands],
  );

  const selectEvidence = (candidate: SupplierEvidenceCandidate) => {
    setSelectedEvidence(candidate);
    setProposedUnitPrice(String(candidate.unitPrice));
    setProposedDeliveryDate('');
    setReceivingWarehouseId('');
    setPurchasingTerms('');
    setDecisionNote('');
    setErrorMessage('');
  };

  const closeConfirmation = () => {
    if (!isPending) setConfirmation(undefined);
  };

  const executeConfirmation = async () => {
    if (!confirmation || !serviceDate) return;
    setErrorMessage('');
    setSuccessMessage('');

    try {
      if (confirmation.type === 'supplier') {
        if (!selectedLine || !selectedEvidence) return;
        await confirmSupplier({
          purchaseRequestId: serviceDate.purchaseRequestId ?? '',
          purchaseRequestLineId: selectedLine.purchaseRequestLineId,
          week,
          data: {
            evidenceType: selectedEvidence.evidenceType,
            evidenceId: selectedEvidence.evidenceId,
            supplierId: selectedEvidence.supplierId,
            proposedUnitPrice: Number(proposedUnitPrice),
            proposedDeliveryDate,
            receivingWarehouseId,
            purchasingTerms: purchasingTerms.trim(),
            expectedDecisionVersion: selectedLine.currentSupplierDecision?.version ?? 0,
            note: decisionNote.trim() || undefined,
          },
        }).unwrap();
        setSuccessMessage(`Đã xác nhận nhà cung cấp cho ${selectedLine.ingredientName}.`);
      } else if (confirmation.type === 'create-request') {
        const result = await createRequest({ materialRequestId: confirmation.materialRequestId }).unwrap();
        setSuccessMessage(`Đã tạo đề xuất mua ${result.data?.purchaseRequestCode ?? ''}.`);
        setSelectedDemandId('');
      } else if (confirmation.type === 'submit-request') {
        await submitRequest(confirmation.purchaseRequestId).unwrap();
        setSuccessMessage(`Đã gửi đề xuất mua ${serviceDate.purchaseRequestCode ?? ''}.`);
      } else {
        const orders = await createOrders(confirmation.purchaseRequestId).unwrap();
        setSuccessMessage(`Đã tạo ${orders.length} đơn đặt hàng theo nhà cung cấp.`);
      }
      setConfirmation(undefined);
    } catch (error) {
      setErrorMessage(`Chưa thể lưu thay đổi. ${getPurchasingErrorMessage(error)}`);
    }
  };

  const confirmationCopy = confirmation?.type === 'supplier'
    ? {
        title: 'Xác nhận nhà cung cấp',
        description: 'Kiểm tra bằng chứng, giá đề xuất và ngày giao trước khi lưu quyết định.',
        safeLabel: 'Quay lại chọn nhà cung cấp',
        submitLabel: 'Xác nhận nhà cung cấp',
      }
    : confirmation?.type === 'create-request'
      ? {
          title: 'Tạo đề xuất mua',
          description: 'Đề xuất chỉ lấy nhu cầu đã duyệt của đúng ngày phục vụ và phạm vi FULLDAY.',
          safeLabel: 'Quay lại kiểm tra nhu cầu',
          submitLabel: 'Tạo đề xuất mua',
        }
      : confirmation?.type === 'submit-request'
        ? {
            title: 'Gửi đề xuất mua',
            description: 'Sau khi gửi, đề xuất chuyển sang hàng đợi phê duyệt của quản lí.',
            safeLabel: 'Giữ bản nháp',
            submitLabel: 'Gửi đề xuất mua',
          }
        : {
            title: 'Tạo đơn đặt hàng',
            description: 'Hệ thống tạo các đơn tách theo nhà cung cấp từ đề xuất đã được duyệt.',
            safeLabel: 'Quay lại kiểm tra đơn',
            submitLabel: 'Tạo đơn đặt hàng',
          };

  if (!serviceDate) {
    return (
      <SectionPanel title="Quyết định thu mua" icon={<ReceiptText size={18} aria-hidden="true" />}>
        <p className="text-body text-slate-600">Chọn một ngày phục vụ để xem hành động tiếp theo.</p>
      </SectionPanel>
    );
  }

  const canSubmitPurchaseRequest = Boolean(serviceDate.purchaseRequestId) &&
    serviceDate.purchaseRequestStatus?.toUpperCase() === 'DRAFT' &&
    serviceDate.shortageLineCount > 0 &&
    serviceDate.supplierReadyLineCount >= serviceDate.shortageLineCount &&
    serviceDate.blockingExceptionCount === 0;
  const scopeLabel = serviceDate.scope?.toUpperCase() === 'FULLDAY'
    ? 'Cả ngày'
    : formatShiftName(serviceDate.scope);

  return (
    <SectionPanel
      title="Quyết định thu mua"
      icon={<ShieldCheck size={18} aria-hidden="true" />}
      description={`${formatDateOnly(serviceDate.serviceDate)} · ${scopeLabel}. Theo tiến độ mới nhất.`}
      className="mt-4 min-w-0"
    >
      <div id={panelId} className="space-y-4" tabIndex={-1}>
        {errorMessage ? <InlineAlert title="Không thể hoàn tất thao tác" variant="danger"><span role="alert">{errorMessage}</span></InlineAlert> : null}
        {successMessage ? <InlineAlert title="Đã cập nhật" variant="info"><span role="status">{successMessage}</span></InlineAlert> : null}

        {selectedStage === 'demand' ? (
          <div className="space-y-3">
            <label className="block text-body font-semibold text-slate-900" htmlFor="approved-demand-selection">Nhu cầu nguyên liệu đã duyệt</label>
            <Select
              value={selectedDemandId || EMPTY_DEMAND_SELECT_VALUE}
              onValueChange={(value) => setSelectedDemandId(value === EMPTY_DEMAND_SELECT_VALUE ? '' : (value ?? ''))}
            >
              <SelectTrigger id="approved-demand-selection" className="min-h-11 w-full sm:min-h-9">
                <SelectValue>
                  {selectedDemand
                    ? `${selectedDemand.requestCode} - ${selectedDemand.shortageLineCount} dòng thiếu`
                    : 'Chọn nhu cầu để tạo đề xuất'}
                </SelectValue>
              </SelectTrigger>
              <SelectContent>
                <SelectItem value={EMPTY_DEMAND_SELECT_VALUE}>Chọn nhu cầu để tạo đề xuất</SelectItem>
              {serviceDate.approvedDemands.map((demand) => (
                <SelectItem key={demand.materialRequestId} value={demand.materialRequestId}>
                  {demand.requestCode} - {demand.shortageLineCount} dòng thiếu
                </SelectItem>
              ))}
              </SelectContent>
            </Select>
            <p id="purchase-demand-action-guidance" className="text-caption text-slate-600">
              {selectedDemand
                ? `${selectedDemand.requestCode}. ${formatDateOnly(selectedDemand.serviceDate)}. Cả ngày (FULLDAY).`
                : serviceDate.approvedDemands.length === 0
                  ? 'Không còn nhu cầu đã duyệt đủ điều kiện tạo đề xuất mua cho ngày này.'
                  : 'Chọn một nhu cầu đã duyệt để tiếp tục.'}
            </p>
            <Button
              className="min-h-11 sm:min-h-9"
              disabled={!selectedDemand}
              aria-describedby="purchase-demand-action-guidance"
              title={!selectedDemand ? (serviceDate.approvedDemands.length === 0 ? 'Không còn nhu cầu đủ điều kiện tạo đề xuất mua.' : 'Chọn nhu cầu đã duyệt trước khi tạo đề xuất.') : undefined}
              onClick={() => selectedDemand && setConfirmation({ type: 'create-request', materialRequestId: selectedDemand.materialRequestId })}
            >
              Tạo đề xuất mua
            </Button>
          </div>
        ) : null}

        {selectedStage === 'supplier-price' ? (
          <div className="space-y-4">
            {selectedLine ? (
              <div className="space-y-4">
                <div className="rounded-[3px] border border-slate-300 bg-slate-50 px-3 py-2 text-body">
                  <p className="font-semibold text-slate-900">{selectedLine.ingredientName}</p>
                  <p className="mt-1 text-caption text-slate-600">Cần mua {formatQuantityWithUnit(selectedLine.purchaseQty, selectedLine.unitName)}.</p>
                </div>
                {evidenceView.phase === 'loading' ? <p role="status" className="text-body text-slate-600">Đang tải bằng chứng nhà cung cấp...</p> : evidenceView.phase === 'forbidden' ? (
                  <InlineAlert title="Không có quyền xem bằng chứng nhà cung cấp" variant="danger">
                    <span role="alert">{evidenceView.message}</span>
                  </InlineAlert>
                ) : evidenceView.phase === 'error' ? (
                  <EmptyState
                    variant="error"
                    title="Không tải được bằng chứng nhà cung cấp"
                    description="Danh sách trống ở đây là do lỗi tải dữ liệu, không phải vì nguyên liệu này thiếu báo giá hoặc phiếu nhập. Hãy tải lại trước khi chọn nhà cung cấp và chốt giá."
                    onRetry={evidenceView.retry}
                    isRetrying={evidenceView.isRetrying}
                  />
                ) : evidenceView.phase === 'uninitialized' ? (
                  <InlineAlert title="Chưa chọn dòng nguyên liệu" variant="info">{evidenceView.instruction}</InlineAlert>
                ) : (
                  <>
                    {evidenceView.isRefreshing && <p role="status" className="text-body text-slate-600">Đang cập nhật bằng chứng; danh sách hiện tại vẫn được giữ.</p>}
                    <SupplierEvidenceList candidates={evidenceView.data.candidates} selectedEvidenceId={selectedEvidence?.evidenceId} onSelect={selectEvidence} />
                  </>
                )}
                {evidence?.blocker ? <InlineAlert title="Không thể xác nhận" variant="danger"><span role="alert">{evidence.blocker}</span></InlineAlert> : null}
                {selectedEvidence ? (
                  <>
                    <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
                      <label className="space-y-2 text-body font-semibold text-slate-900">
                        <span>Giá đề xuất</span>
                        <Input type="number" min="0.01" step="0.01" value={proposedUnitPrice} onChange={(event) => setProposedUnitPrice(event.target.value)} />
                      </label>
                      <label className="space-y-2 text-body font-semibold text-slate-900">
                        <span>Ngày giao</span>
                        <Input type="date" value={proposedDeliveryDate} onChange={(event) => setProposedDeliveryDate(event.target.value)} />
                      </label>
                      <label className="space-y-2 text-body font-semibold text-slate-900">
                        <span>Kho nhận</span>
                        <Select value={receivingWarehouseId} onValueChange={(value) => setReceivingWarehouseId(value ?? '')}>
                          <SelectTrigger aria-label="Kho nhận" className="min-h-11 w-full sm:min-h-9">
                            <SelectValue placeholder={warehouseQuery.isLoading ? 'Đang tải kho...' : 'Chọn kho nhận'} />
                          </SelectTrigger>
                          <SelectContent>
                            {warehouses.map((warehouse) => (
                              <SelectItem key={warehouse.warehouseId} value={warehouse.warehouseId}>
                                {warehouse.warehouseName}
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      </label>
                      <label className="space-y-2 text-body font-semibold text-slate-900">
                        <span>Điều khoản mua</span>
                        <Input value={purchasingTerms} onChange={(event) => setPurchasingTerms(event.target.value)} />
                      </label>
                    </div>
                    {warehouseQuery.isError ? (
                      <InlineAlert title="Không tải được danh sách kho" variant="danger">
                        Hãy tải lại dữ liệu trước khi xác nhận nhà cung cấp.
                      </InlineAlert>
                    ) : null}
                    <label className="block space-y-2 text-body font-semibold text-slate-900">
                      <span>Ghi chú quyết định</span>
                      <Input aria-label="Ghi chú quyết định" value={decisionNote} onChange={(event) => setDecisionNote(event.target.value)} />
                    </label>
                  </>
                ) : null}
                <Button
                  data-inp-action="confirm-supplier"
                  className="min-h-11 sm:min-h-9"
                  disabled={!selectedEvidence || Number(proposedUnitPrice) <= 0 || !proposedDeliveryDate || !receivingWarehouseId || !purchasingTerms.trim() || warehouseQuery.isError || Boolean(evidence?.blocker)}
                  onClick={() => setConfirmation({ type: 'supplier' })}
                >
                  Xác nhận nhà cung cấp
                </Button>
              </div>
            ) : <p className="text-body text-slate-600">Chọn một dòng nguyên liệu trong bảng để xem bằng chứng.</p>}

            {canSubmitPurchaseRequest ? (
              <div className="rounded-[3px] border border-emerald-300 bg-emerald-50 px-3 py-3">
                <p className="text-body font-semibold text-emerald-950">Đã đủ nhà cung cấp, giá và ngày giao cho mọi dòng.</p>
                <Button
                  data-inp-action="submit-purchase-request"
                  className="mt-3 min-h-11 sm:min-h-9"
                  onClick={() => setConfirmation({ type: 'submit-request', purchaseRequestId: serviceDate.purchaseRequestId! })}
                >
                  Gửi đề xuất mua
                </Button>
              </div>
            ) : null}
          </div>
        ) : null}

        {selectedStage === 'exception' ? (
          <div className="space-y-3">
            <PriceExceptionStatus serviceDate={serviceDate} />
            {serviceDate.blockingExceptionCount > 0 ? (
              <Button nativeButton={false} variant="warning" className="min-h-11 sm:min-h-9" render={<Link to={`${ROUTES.APPROVALS}?targetType=purchase-price-exception&date=${serviceDate.serviceDate}&week=${week}`} />}>
                <CircleAlert aria-hidden="true" />
                Gửi duyệt ngoại lệ giá
              </Button>
            ) : null}
          </div>
        ) : null}

        {selectedStage === 'submitted' ? (
          <div className="space-y-3">
            <p className="text-body text-slate-700">Đề xuất mua: <strong>{serviceDate.purchaseRequestCode ?? 'Chưa tạo'}</strong>. Trạng thái: {serviceDate.purchaseRequestStatus ?? 'Chưa có'}.</p>
            {serviceDate.purchaseRequestId && serviceDate.purchaseRequestStatus?.toUpperCase() === 'DRAFT' ? (
              <Button className="min-h-11 sm:min-h-9" onClick={() => setConfirmation({ type: 'submit-request', purchaseRequestId: serviceDate.purchaseRequestId! })}>Gửi đề xuất mua</Button>
            ) : (
              <Button nativeButton={false} variant="outline" className="min-h-11 sm:min-h-9" render={<Link to={`${ROUTES.APPROVALS}?targetType=purchase-request&targetId=${serviceDate.purchaseRequestId ?? ''}&week=${week}&date=${serviceDate.serviceDate}`} />}>Mở phê duyệt đề xuất</Button>
            )}
          </div>
        ) : null}

        {selectedStage === 'approved-order' ? (
          <div className="space-y-3">
            {serviceDate.orderCount > 0 ? (
              <OrderHandoffStatus serviceDate={serviceDate} week={week} />
            ) : (
              <>
                <p className="text-body text-slate-700">Chưa có đơn đặt hàng cho ngày phục vụ này.</p>
                <Button className="min-h-11 sm:min-h-9" disabled={!serviceDate.purchaseRequestId || serviceDate.purchaseRequestStatus?.toUpperCase() !== 'APPROVED'} onClick={() => serviceDate.purchaseRequestId && setConfirmation({ type: 'create-orders', purchaseRequestId: serviceDate.purchaseRequestId })}>Tạo đơn đặt hàng</Button>
              </>
            )}
          </div>
        ) : null}

        {selectedStage === 'receiving' ? <OrderHandoffStatus serviceDate={serviceDate} week={week} /> : null}
      </div>

      {Boolean(confirmation) && (
        <Dialog open={Boolean(confirmation)} onOpenChange={(open) => { if (!open) closeConfirmation(); }}>
          <DialogContent
            aria-labelledby="purchase-confirmation-title"
            aria-describedby="purchase-confirmation-description"
            onKeyDown={(event) => {
              if (event.key === 'Escape') {
                event.preventDefault();
                closeConfirmation();
              }
            }}
          >
            <DialogHeader>
              <DialogTitle id="purchase-confirmation-title">{confirmationCopy.title}</DialogTitle>
              <DialogDescription id="purchase-confirmation-description">{confirmationCopy.description}</DialogDescription>
            </DialogHeader>
            {confirmation?.type === 'supplier' && selectedLine && selectedEvidence ? (
              <div className="space-y-2 rounded-[3px] border border-slate-300 bg-slate-50 p-3 text-body">
                <p><strong>Nguyên liệu:</strong> {selectedLine.ingredientName}</p>
                <p><strong>Nhà cung cấp:</strong> {selectedEvidence.supplierName}</p>
                <p><strong>Bằng chứng:</strong> {evidenceLabel(selectedEvidence)}</p>
                <p><strong>Giá đề xuất:</strong> {formatCurrency(Number(proposedUnitPrice))}</p>
                <p><strong>Ngày giao:</strong> {formatDateOnly(proposedDeliveryDate)}</p>
                <p><strong>Kho nhận:</strong> {warehouses.find((warehouse) => warehouse.warehouseId === receivingWarehouseId)?.warehouseName}</p>
                <p><strong>Điều khoản mua:</strong> {purchasingTerms.trim()}</p>
                {decisionNote.trim() ? <p><strong>Ghi chú:</strong> {decisionNote.trim()}</p> : null}
              </div>
            ) : null}
            {errorMessage ? <InlineAlert title="Chưa thể lưu thay đổi" variant="danger"><span role="alert">{errorMessage}</span></InlineAlert> : null}
            <DialogFooter>
              <Button ref={safeActionRef} variant="outline" className="min-h-11 sm:min-h-9" disabled={isPending} onClick={closeConfirmation}>{confirmationCopy.safeLabel}</Button>
              <Button data-inp-action="confirm-purchase-dialog" className="min-h-11 sm:min-h-9" disabled={isPending} onClick={() => void executeConfirmation()}>{isPending ? 'Đang lưu...' : confirmationCopy.submitLabel}</Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      )}
    </SectionPanel>
  );
}
