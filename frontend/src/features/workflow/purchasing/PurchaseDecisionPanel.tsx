import { useEffect, useMemo, useRef, useState } from 'react';
import { CircleAlert, PackageCheck, ReceiptText, ShieldCheck } from 'lucide-react';
import { Link } from 'react-router-dom';
import { InlineAlert, SectionPanel, StatusBadge } from '@/components/common';
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
import { formatCurrency } from '@/lib/formatters';
import { ROUTES } from '@/routes/routeConfig';
import type {
  PurchaseRequestWorkflowLine,
  PurchaseWorkbenchServiceDate,
  SupplierEvidenceCandidate,
} from '../workflowApi';
import {
  useConfirmLineSupplierMutation,
  useCreatePurchaseOrdersFromRequestMutation,
  useCreatePurchaseRequestFromDemandMutation,
  useGetSupplierEvidenceQuery,
  useSubmitPurchaseRequestMutation,
} from '../workflowApi';
import { getPurchasingErrorMessage, type PurchasingStageId } from './purchasingModel';

interface PurchaseDecisionPanelProps {
  week: string;
  selectedStage: PurchasingStageId;
  serviceDate?: PurchaseWorkbenchServiceDate;
  selectedLine?: PurchaseRequestWorkflowLine;
}

type Confirmation =
  | { type: 'supplier' }
  | { type: 'create-request'; materialRequestId: string }
  | { type: 'submit-request'; purchaseRequestId: string }
  | { type: 'create-orders'; purchaseRequestId: string };

const evidenceLabel = (candidate: SupplierEvidenceCandidate) =>
  candidate.evidenceType === 'EffectiveQuotation'
    ? `Báo giá hiệu lực đến ${candidate.effectiveTo ? formatIsoDate(candidate.effectiveTo) : 'không giới hạn'}`
    : `Phiếu nhập gần nhất ngày ${formatIsoDate(candidate.evidenceDate)}`;

const formatIsoDate = (value: string) => {
  const [year, month, day] = value.slice(0, 10).split('-');
  return year && month && day ? `${day}/${month}/${year}` : value;
};

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
          <button
            key={`${candidate.evidenceType}-${candidate.evidenceId}`}
            type="button"
            className={`min-h-11 rounded-[3px] border px-3 py-2 text-left text-[14px] transition-colors motion-reduce:transition-none ${
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
            <span className="mt-1 block text-[12px] leading-[1.4] text-slate-600">
              {evidenceLabel(candidate)}. {formatCurrency(candidate.unitPrice)}/{candidate.unitName}
            </span>
          </button>
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
        <p className="text-[14px] font-semibold text-slate-900">Ngoại lệ giá</p>
        <p className="text-[12px] leading-[1.4] text-slate-600">
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

export function OrderHandoffStatus({ serviceDate }: { serviceDate: PurchaseWorkbenchServiceDate }) {
  const complete = serviceDate.receivingLineCount > 0 &&
    serviceDate.fullyReceivedLineCount >= serviceDate.receivingLineCount;
  const partial = serviceDate.fullyReceivedLineCount > 0 && !complete;

  return (
    <div className="rounded-[3px] border border-slate-300 bg-slate-50 px-3 py-3">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <p className="text-[14px] font-semibold text-slate-900">Tiến độ nhập kho chỉ đọc</p>
        <StatusBadge variant={complete ? 'success' : partial ? 'warning' : 'neutral'}>
          {complete ? 'Đã nhận đủ' : partial ? 'Nhận một phần' : 'Chưa nhận'}
        </StatusBadge>
      </div>
      <p className="mt-2 text-[14px] leading-[1.5] text-slate-700">
        {serviceDate.fullyReceivedLineCount}/{serviceDate.receivingLineCount} dòng đã nhận đủ trên {serviceDate.orderCount} đơn đặt hàng.
      </p>
      <Button className="mt-3 min-h-11 sm:min-h-9" variant="outline" render={<Link to={`${ROUTES.WAREHOUSE}?week=${serviceDate.serviceDate}&purchaseRequestId=${serviceDate.purchaseRequestId ?? ''}`} />}>
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
}: PurchaseDecisionPanelProps) {
  const [selectedEvidence, setSelectedEvidence] = useState<SupplierEvidenceCandidate>();
  const [proposedUnitPrice, setProposedUnitPrice] = useState('');
  const [proposedDeliveryDate, setProposedDeliveryDate] = useState('');
  const [selectedDemandId, setSelectedDemandId] = useState('');
  const [confirmation, setConfirmation] = useState<Confirmation>();
  const [errorMessage, setErrorMessage] = useState('');
  const [successMessage, setSuccessMessage] = useState('');
  const safeActionRef = useRef<HTMLButtonElement>(null);

  const evidenceArgs = {
    purchaseRequestId: serviceDate?.purchaseRequestId ?? '',
    purchaseRequestLineId: selectedLine?.purchaseRequestLineId ?? '',
  };
  const { data: evidence, isFetching: isEvidenceLoading } = useGetSupplierEvidenceQuery(
    evidenceArgs,
    { skip: selectedStage !== 'supplier-price' || !evidenceArgs.purchaseRequestId || !evidenceArgs.purchaseRequestLineId },
  );
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
            expectedDecisionVersion: selectedLine.currentSupplierDecision?.version ?? 0,
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
        <p className="text-[14px] text-slate-600">Chọn một ngày phục vụ để xem hành động tiếp theo.</p>
      </SectionPanel>
    );
  }

  return (
    <SectionPanel
      title="Quyết định thu mua"
      icon={<ShieldCheck size={18} aria-hidden="true" />}
      description={`${formatIsoDate(serviceDate.serviceDate)}. Cả ngày (FULLDAY). Dữ liệu trạng thái do máy chủ xác định.`}
      className="mt-4 min-w-0"
    >
      <div id="purchase-decision-panel" className="space-y-4" tabIndex={-1}>
        {errorMessage ? <InlineAlert title="Không thể hoàn tất thao tác" variant="danger"><span role="alert">{errorMessage}</span></InlineAlert> : null}
        {successMessage ? <InlineAlert title="Đã cập nhật" variant="info"><span role="status">{successMessage}</span></InlineAlert> : null}

        {selectedStage === 'demand' ? (
          <div className="space-y-3">
            <label className="block text-[14px] font-semibold text-slate-900" htmlFor="approved-demand-selection">Nhu cầu nguyên liệu đã duyệt</label>
            <select
              id="approved-demand-selection"
              className="ipc-select min-h-11 w-full sm:min-h-9"
              value={selectedDemandId}
              onChange={(event) => setSelectedDemandId(event.target.value)}
            >
              <option value="">Chọn nhu cầu để tạo đề xuất</option>
              {serviceDate.approvedDemands.map((demand) => (
                <option key={demand.materialRequestId} value={demand.materialRequestId}>
                  {demand.requestCode} - {demand.shortageLineCount} dòng thiếu
                </option>
              ))}
            </select>
            {selectedDemand ? <p className="text-[12px] text-slate-600">{selectedDemand.requestCode}. {formatIsoDate(selectedDemand.serviceDate)}. Cả ngày (FULLDAY).</p> : null}
            <Button className="min-h-11 sm:min-h-9" disabled={!selectedDemand} onClick={() => selectedDemand && setConfirmation({ type: 'create-request', materialRequestId: selectedDemand.materialRequestId })}>
              Tạo đề xuất mua
            </Button>
          </div>
        ) : null}

        {selectedStage === 'supplier-price' ? (
          selectedLine ? (
            <div className="space-y-4">
              <div className="rounded-[3px] border border-slate-300 bg-slate-50 px-3 py-2 text-[14px]">
                <p className="font-semibold text-slate-900">{selectedLine.ingredientName}</p>
                <p className="mt-1 text-[12px] text-slate-600">Cần mua {selectedLine.purchaseQty} {selectedLine.unitName}. Mã dòng {selectedLine.purchaseRequestLineId}.</p>
              </div>
              {isEvidenceLoading ? <p role="status" className="text-[14px] text-slate-600">Đang tải bằng chứng nhà cung cấp...</p> : (
                <SupplierEvidenceList candidates={evidence?.candidates ?? []} selectedEvidenceId={selectedEvidence?.evidenceId} onSelect={selectEvidence} />
              )}
              {evidence?.blocker ? <InlineAlert title="Không thể xác nhận" variant="danger"><span role="alert">{evidence.blocker}</span></InlineAlert> : null}
              {selectedEvidence ? (
                <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
                  <label className="space-y-2 text-[14px] font-semibold text-slate-900">
                    <span>Giá đề xuất</span>
                    <Input type="number" min="0.01" step="0.01" value={proposedUnitPrice} onChange={(event) => setProposedUnitPrice(event.target.value)} />
                  </label>
                  <label className="space-y-2 text-[14px] font-semibold text-slate-900">
                    <span>Ngày giao</span>
                    <Input type="date" value={proposedDeliveryDate} onChange={(event) => setProposedDeliveryDate(event.target.value)} />
                  </label>
                </div>
              ) : null}
              <Button
                className="min-h-11 sm:min-h-9"
                disabled={!selectedEvidence || Number(proposedUnitPrice) <= 0 || !proposedDeliveryDate || Boolean(evidence?.blocker)}
                onClick={() => setConfirmation({ type: 'supplier' })}
              >
                Xác nhận nhà cung cấp
              </Button>
            </div>
          ) : <p className="text-[14px] text-slate-600">Chọn một dòng nguyên liệu trong bảng để xem bằng chứng.</p>
        ) : null}

        {selectedStage === 'exception' ? (
          <div className="space-y-3">
            <PriceExceptionStatus serviceDate={serviceDate} />
            {serviceDate.blockingExceptionCount > 0 ? (
              <Button variant="warning" className="min-h-11 sm:min-h-9" render={<Link to={`${ROUTES.APPROVALS}?targetType=purchase-price-exception&date=${serviceDate.serviceDate}&week=${week}`} />}>
                <CircleAlert aria-hidden="true" />
                Gửi duyệt ngoại lệ giá
              </Button>
            ) : null}
          </div>
        ) : null}

        {selectedStage === 'submitted' ? (
          <div className="space-y-3">
            <p className="text-[14px] text-slate-700">Đề xuất mua: <strong>{serviceDate.purchaseRequestCode ?? 'Chưa tạo'}</strong>. Trạng thái: {serviceDate.purchaseRequestStatus ?? 'Chưa có'}.</p>
            {serviceDate.purchaseRequestId && serviceDate.purchaseRequestStatus?.toUpperCase() === 'DRAFT' ? (
              <Button className="min-h-11 sm:min-h-9" onClick={() => setConfirmation({ type: 'submit-request', purchaseRequestId: serviceDate.purchaseRequestId! })}>Gửi đề xuất mua</Button>
            ) : (
              <Button variant="outline" className="min-h-11 sm:min-h-9" render={<Link to={`${ROUTES.APPROVALS}?targetType=purchase-request&targetId=${serviceDate.purchaseRequestId ?? ''}&week=${week}&date=${serviceDate.serviceDate}`} />}>Mở phê duyệt đề xuất</Button>
            )}
          </div>
        ) : null}

        {selectedStage === 'approved-order' ? (
          <div className="space-y-3">
            <p className="text-[14px] text-slate-700">Đã có {serviceDate.orderCount} đơn đặt hàng cho ngày phục vụ này.</p>
            <Button className="min-h-11 sm:min-h-9" disabled={!serviceDate.purchaseRequestId || serviceDate.purchaseRequestStatus?.toUpperCase() !== 'APPROVED'} onClick={() => serviceDate.purchaseRequestId && setConfirmation({ type: 'create-orders', purchaseRequestId: serviceDate.purchaseRequestId })}>Tạo đơn đặt hàng</Button>
          </div>
        ) : null}

        {selectedStage === 'receiving' ? <OrderHandoffStatus serviceDate={serviceDate} /> : null}
      </div>

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
            <div className="space-y-2 rounded-[3px] border border-slate-300 bg-slate-50 p-3 text-[14px]">
              <p><strong>Nguyên liệu:</strong> {selectedLine.ingredientName}</p>
              <p><strong>Nhà cung cấp:</strong> {selectedEvidence.supplierName}</p>
              <p><strong>Bằng chứng:</strong> {evidenceLabel(selectedEvidence)}</p>
              <p><strong>Giá đề xuất:</strong> {formatCurrency(Number(proposedUnitPrice))}</p>
              <p><strong>Ngày giao:</strong> {formatIsoDate(proposedDeliveryDate)}</p>
            </div>
          ) : null}
          {errorMessage ? <InlineAlert title="Chưa thể lưu thay đổi" variant="danger"><span role="alert">{errorMessage}</span></InlineAlert> : null}
          <DialogFooter>
            <Button ref={safeActionRef} variant="outline" className="min-h-11 sm:min-h-9" disabled={isPending} onClick={closeConfirmation}>{confirmationCopy.safeLabel}</Button>
            <Button className="min-h-11 sm:min-h-9" disabled={isPending} onClick={() => void executeConfirmation()}>{isPending ? 'Đang lưu...' : confirmationCopy.submitLabel}</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </SectionPanel>
  );
}
