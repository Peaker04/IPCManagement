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

interface PurchaseServiceDateWorkbenchProps {
  serviceDates: PurchaseWorkbenchServiceDate[];
  selectedDate?: string;
  selectedLineId?: string;
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

const demandStatusLabel = (serviceDate: PurchaseWorkbenchServiceDate) => {
  if (serviceDate.currentStage === 'receiving') {
    return serviceDate.receivingLineCount > 0
      && serviceDate.fullyReceivedLineCount >= serviceDate.receivingLineCount
      ? 'Đã nhận đủ'
      : 'Đang nhập kho';
  }
  if (serviceDate.currentStage === 'approved-order') return 'Đã duyệt';
  if (serviceDate.currentStage === 'submitted') return 'Đã gửi duyệt';
  return serviceDate.approvedDemandCount > 0 ? 'Đã duyệt' : 'Chưa tạo';
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
      description="Chọn đúng một ngày trong tuần. Mọi dòng bên dưới thuộc phạm vi Cả ngày (FULLDAY)."
      className="min-w-0 overflow-hidden"
    >
      <fieldset className="m-0 min-w-0 border-0 p-0">
        <legend className="sr-only">Các ngày cần xử lý</legend>
        <div className="grid grid-cols-1 gap-2 md:grid-cols-2 xl:min-h-[11.4rem] xl:grid-cols-3">
        {serviceDates.map((serviceDate) => {
          const active = serviceDate.serviceDate === selectedDate;
          const supplierLineCount = Math.max(serviceDate.shortageLineCount, serviceDate.purchaseLines.length);
          return (
            <Button
              key={serviceDate.serviceDate}
              type="button"
              variant="outline"
              size="sm"
              textWrap="wrap"
              className={`min-h-11 w-full flex-col items-stretch justify-start rounded-[3px] px-3 py-2 text-left text-body leading-normal transition-colors motion-reduce:transition-none ${
                active
                  ? 'border-[var(--ipc-primary)] bg-blue-50 text-blue-950'
                  : 'border-slate-300 bg-slate-50 text-slate-800 hover:bg-slate-100'
              }`}
              aria-expanded={active}
              aria-controls={`purchase-service-date-${serviceDate.serviceDate}`}
              onClick={() => onDateChange(serviceDate)}
            >
              <span className="flex flex-wrap items-center justify-between gap-2 font-semibold">
                <span>{formatDateOnly(serviceDate.serviceDate)}</span>
                <StatusBadge variant={active ? 'warning' : 'neutral'}>{demandStatusLabel(serviceDate)}</StatusBadge>
              </span>
              <span className="mt-2 grid grid-cols-2 gap-x-3 gap-y-1 text-caption leading-[1.4] text-slate-600">
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

        <TableViewport
          ariaLabel="Dòng nguyên liệu của ngày phục vụ đang chọn"
          caption={isLoading || hasPurchaseLines ? 'Bảng có cuộn ngang cục bộ và giữ chiều cao ổn định.' : 'Trạng thái trống của ngày phục vụ đang chọn.'}
          className={isLoading || hasPurchaseLines ? 'h-[400px] max-h-[400px] xl:h-[480px] xl:max-h-[480px]' : undefined}
        >
          {isLoading ? (
            <table className="ipc-data-table min-w-[900px] table-fixed">
              <thead><tr><th>Nguyên liệu</th><th>Số lượng mua</th><th>Nhà cung cấp</th><th>Bằng chứng hiện tại</th><th>Giá đề xuất</th><th>Ngày giao</th><th>Thao tác</th></tr></thead>
              <tbody>{Array.from({ length: 8 }, (_, index) => <tr key={`purchase-line-skeleton-${index}`} aria-hidden="true">{Array.from({ length: 7 }, (_, cellIndex) => <td key={cellIndex}><div className="h-5 animate-pulse rounded-[2px] bg-slate-200 motion-reduce:animate-none" /></td>)}</tr>)}</tbody>
            </table>
          ) : hasPurchaseLines && activeDate ? (
            <PurchaseLineGroups lines={activeDate.purchaseLines} selectedLineId={selectedLineId} onLineChange={onLineChange} />
          ) : (
            <table className="ipc-data-table min-w-[900px] table-fixed">
              <thead><tr><th>Nguyên liệu</th><th>Số lượng mua</th><th>Nhà cung cấp</th><th>Bằng chứng hiện tại</th><th>Giá đề xuất</th><th>Ngày giao</th><th>Thao tác</th></tr></thead>
              <tbody><tr><td colSpan={7} className="py-10 text-center text-slate-600">{serviceDates.length === 0 ? 'Chưa có nhu cầu đã duyệt trong tuần này.' : 'Chưa có dòng nguyên liệu cho giai đoạn đang xem.'}</td></tr></tbody>
            </table>
          )}
        </TableViewport>
        <PaginationBar
          page={page}
          pageSize={pageSize}
          totalItems={totalItems}
          onPageChange={onPageChange}
        />

        {children}
      </div>
    </SectionPanel>
  );
}
