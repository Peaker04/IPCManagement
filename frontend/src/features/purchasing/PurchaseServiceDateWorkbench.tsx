import type { ReactNode } from 'react';
import { CalendarDays } from 'lucide-react';
import {
  InlineAlert,
  PaginationBar,
  SectionPanel,
  StatusBadge,
  TableViewport,
} from '@/components/common';
import type { PurchaseWorkbenchServiceDate } from '@/api/workflowApiTypes';
import { Button } from '@/components/ui/button';
import { formatDateOnly } from '@/lib/formatters';
import { PurchaseLineGroups } from './PurchaseLineGroups';
import type { PurchasingStageId } from './purchasingModel';

interface PurchaseServiceDateWorkbenchProps {
  serviceDates: PurchaseWorkbenchServiceDate[];
  selectedDate?: string;
  selectedLineId?: string;
  selectedStage?: PurchasingStageId;
  page: number;
  pageSize: number;
  totalItems: number;
  isLoading: boolean;
  errorMessage?: string;
  onDateChange: (date: PurchaseWorkbenchServiceDate) => void;
  onLineChange: (lineId: string) => void;
  onPageChange: (page: number) => void;
  children?: ReactNode;
}

const serviceDateProgressLabel = (serviceDate: PurchaseWorkbenchServiceDate) => {
  if (serviceDate.currentStage === 'receiving') {
    return serviceDate.receivingLineCount > 0
      && serviceDate.fullyReceivedLineCount >= serviceDate.receivingLineCount
      ? 'Đã nhận đủ'
      : 'Đang nhập kho';
  }
  if (serviceDate.currentStage === 'submitted') return 'Đã gửi duyệt';
  return serviceDate.approvedDemandCount > 0 || serviceDate.currentStage === 'approved-order'
    ? undefined
    : 'Chưa tạo';
};

const receivingStatus = (serviceDate: PurchaseWorkbenchServiceDate) => {
  if (serviceDate.receivingLineCount === 0) return 'Chưa nhận';
  if (serviceDate.fullyReceivedLineCount >= serviceDate.receivingLineCount) return 'Đã nhận đủ';
  return 'Nhận một phần';
};

export function PurchaseServiceDateWorkbench({
  serviceDates,
  selectedDate,
  selectedLineId,
  selectedStage,
  page,
  pageSize,
  totalItems,
  isLoading,
  errorMessage,
  onDateChange,
  onLineChange,
  onPageChange,
  children,
}: PurchaseServiceDateWorkbenchProps) {
  const activeDate = serviceDates.find((item) => item.serviceDate === selectedDate);
  const hasPurchaseLines = Boolean(activeDate?.purchaseLines.length);

  return (
    <SectionPanel
      title="Ngày phục vụ"
      icon={<CalendarDays size={18} aria-hidden="true" />}
      description="Chọn một ngày phục vụ để xử lý nhu cầu cả ngày."
      className="min-w-0 overflow-hidden"
    >
      <fieldset className="m-0 min-w-0 border-0 p-0">
        <legend className="sr-only">Các ngày cần xử lý</legend>
        <div className="grid grid-cols-1 gap-1.5 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-5">
        {serviceDates.map((serviceDate) => {
          const active = serviceDate.serviceDate === selectedDate;
          const supplierLineCount = Math.max(serviceDate.shortageLineCount, serviceDate.purchaseLines.length);
          const progressLabel = serviceDateProgressLabel(serviceDate);
          return (
            <Button
              key={serviceDate.serviceDate}
              type="button"
              variant="outline"
              size="sm"
              textWrap="wrap"
              className={`min-h-11 w-full flex-col items-stretch justify-start rounded-md px-3 py-2 text-left text-body leading-normal transition-colors motion-reduce:transition-none shadow-2xs ${
                active
                  ? 'border-primary bg-blue-50/80 text-blue-950 font-medium'
                  : 'border-slate-300 bg-slate-50/70 text-slate-800 hover:bg-slate-100'
              }`}
              aria-expanded={active}
              aria-controls={`purchase-service-date-${serviceDate.serviceDate}`}
              onClick={() => onDateChange(serviceDate)}
            >
              <span className="flex flex-wrap items-center justify-between gap-1.5 font-semibold text-xs leading-tight">
                <span>{formatDateOnly(serviceDate.serviceDate)}</span>
                {progressLabel ? <StatusBadge variant={active ? 'warning' : 'neutral'}>{progressLabel}</StatusBadge> : null}
              </span>
              <span className="mt-1.5 grid grid-cols-2 gap-x-2 gap-y-0.5 text-xs leading-tight text-slate-600">
                <span>Thiếu: {serviceDate.shortageLineCount} dòng</span>
                <span>NCC: {serviceDate.supplierReadyLineCount}/{supplierLineCount}</span>
                <span>Ngoại lệ: {serviceDate.blockingExceptionCount}</span>
                <span>Nhập kho: {receivingStatus(serviceDate)}</span>
              </span>
            </Button>
          );
        })}
        </div>
      </fieldset>

      <div
        id={activeDate ? `purchase-service-date-${activeDate.serviceDate}` : 'purchase-service-date-empty'}
        className="mt-4 min-w-0"
      >
        {errorMessage ? (
          <InlineAlert title="Không tải được quy trình thu mua" variant="danger" className="mb-4">
            <span role="alert">{errorMessage}</span>
          </InlineAlert>
        ) : null}

        {selectedStage === 'demand' && !hasPurchaseLines && serviceDates.length > 0 ? (
          activeDate ? children : null
        ) : (
          <>
            {isLoading ? (
              <TableViewport
                ariaLabel="Dòng nguyên liệu của ngày phục vụ đang chọn"
                caption="Bảng có cuộn ngang cục bộ."
              >
                <table className="ipc-data-table min-w-[900px] table-fixed">
                  <thead><tr><th scope="col" className="sticky top-0 z-10 text-left whitespace-nowrap">Nguyên liệu</th><th scope="col" className="sticky top-0 z-10 text-right whitespace-nowrap">Số lượng mua</th><th scope="col" className="sticky top-0 z-10 text-left whitespace-nowrap">Nhà cung cấp</th><th scope="col" className="sticky top-0 z-10 text-left whitespace-nowrap">Bằng chứng hiện tại</th><th scope="col" className="sticky top-0 z-10 text-right whitespace-nowrap">Giá đề xuất</th><th scope="col" className="sticky top-0 z-10 text-center whitespace-nowrap">Ngày giao</th><th scope="col" className="sticky top-0 z-10 text-right whitespace-nowrap">Thao tác</th></tr></thead>
                  <tbody>{Array.from({ length: 8 }, (_, index) => <tr key={`purchase-line-skeleton-${index}`} aria-hidden="true">{Array.from({ length: 7 }, (_, cellIndex) => <td key={cellIndex}><div className="h-5 animate-pulse rounded-[2px] bg-slate-200 motion-reduce:animate-none" /></td>)}</tr>)}</tbody>
                </table>
              </TableViewport>
            ) : hasPurchaseLines && activeDate ? (
              <PurchaseLineGroups lines={activeDate.purchaseLines} selectedLineId={selectedLineId} onLineChange={onLineChange} />
            ) : (
              <TableViewport
                ariaLabel="Dòng nguyên liệu của ngày phục vụ đang chọn"
                caption="Trạng thái trống của ngày phục vụ đang chọn."
              >
                <table className="ipc-data-table min-w-[900px] table-fixed">
                  <thead><tr><th scope="col" className="sticky top-0 z-10 text-left whitespace-nowrap">Nguyên liệu</th><th scope="col" className="sticky top-0 z-10 text-right whitespace-nowrap">Số lượng mua</th><th scope="col" className="sticky top-0 z-10 text-left whitespace-nowrap">Nhà cung cấp</th><th scope="col" className="sticky top-0 z-10 text-left whitespace-nowrap">Bằng chứng hiện tại</th><th scope="col" className="sticky top-0 z-10 text-right whitespace-nowrap">Giá đề xuất</th><th scope="col" className="sticky top-0 z-10 text-center whitespace-nowrap">Ngày giao</th><th scope="col" className="sticky top-0 z-10 text-right whitespace-nowrap">Thao tác</th></tr></thead>
                  <tbody><tr><td colSpan={7} className="py-10 text-center text-slate-600">{serviceDates.length === 0 ? 'Chưa có nhu cầu đã duyệt trong tuần này.' : 'Chưa có dòng nguyên liệu cho giai đoạn đang xem.'}</td></tr></tbody>
                </table>
              </TableViewport>
            )}
            <PaginationBar
              page={page}
              pageSize={pageSize}
              totalItems={totalItems}
              onPageChange={onPageChange}
            />

            {activeDate ? children : null}
          </>
        )}
      </div>
    </SectionPanel>
  );
}
