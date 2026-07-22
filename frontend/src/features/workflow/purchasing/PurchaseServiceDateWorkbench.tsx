import type { ReactNode } from 'react';
import { CalendarDays } from 'lucide-react';
import {
  InlineAlert,
  PaginationBar,
  SectionPanel,
  StatusBadge,
  TableViewport,
} from '@/components/common';
import type { PurchaseWorkbenchServiceDate } from '../workflowApi';

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

const demandStatusLabel = (serviceDate: PurchaseWorkbenchServiceDate) =>
  serviceDate.approvedDemandCount > 0 ? 'Đã duyệt' : 'Chưa tạo';

const formatIsoDate = (value: string) => {
  const [year, month, day] = value.slice(0, 10).split('-');
  return year && month && day ? `${day}/${month}/${year}` : value;
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

  return (
    <SectionPanel
      title="Ngày phục vụ"
      icon={<CalendarDays size={18} aria-hidden="true" />}
      description="Chọn đúng một ngày trong tuần. Mọi dòng bên dưới thuộc phạm vi Cả ngày (FULLDAY)."
      className="min-w-0 overflow-hidden"
    >
      <div className="grid grid-cols-1 gap-2 md:grid-cols-2 xl:grid-cols-3" aria-label="Các ngày cần xử lý">
        {serviceDates.map((serviceDate) => {
          const active = serviceDate.serviceDate === selectedDate;
          return (
            <button
              key={serviceDate.serviceDate}
              type="button"
              className={`min-h-11 rounded-[3px] border px-3 py-2 text-left text-[14px] transition-colors motion-reduce:transition-none ${
                active
                  ? 'border-[var(--ipc-primary)] bg-blue-50 text-blue-950'
                  : 'border-slate-300 bg-slate-50 text-slate-800 hover:bg-slate-100'
              }`}
              aria-expanded={active}
              aria-controls={`purchase-service-date-${serviceDate.serviceDate}`}
              onClick={() => onDateChange(serviceDate)}
            >
              <span className="flex flex-wrap items-center justify-between gap-2 font-semibold">
                <span>{formatIsoDate(serviceDate.serviceDate)}</span>
                <StatusBadge variant={active ? 'warning' : 'neutral'}>{demandStatusLabel(serviceDate)}</StatusBadge>
              </span>
              <span className="mt-2 grid grid-cols-2 gap-x-3 gap-y-1 text-[12px] leading-[1.4] text-slate-600">
                <span>Thiếu: {serviceDate.shortageLineCount} dòng</span>
                <span>NCC: {serviceDate.supplierReadyLineCount}/{serviceDate.shortageLineCount}</span>
                <span>Ngoại lệ: {serviceDate.blockingExceptionCount}</span>
                <span>Nhập kho: {receivingStatus(serviceDate)}</span>
              </span>
            </button>
          );
        })}
      </div>

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
          caption="Bảng có cuộn ngang cục bộ và giữ chiều cao ổn định."
          className="h-[400px] max-h-[400px] xl:h-[480px] xl:max-h-[480px]"
        >
          <table className="ipc-data-table min-w-[900px]">
            <thead>
              <tr>
                <th>Nguyên liệu</th>
                <th>Số lượng mua</th>
                <th>Nhà cung cấp</th>
                <th>Bằng chứng hiện tại</th>
                <th>Giá đề xuất</th>
                <th>Ngày giao</th>
                <th>Thao tác</th>
              </tr>
            </thead>
            <tbody>
              {isLoading
                ? Array.from({ length: 8 }, (_, index) => (
                    <tr key={`purchase-line-skeleton-${index}`} aria-hidden="true">
                      <td colSpan={7}><div className="h-5 animate-pulse rounded-[2px] bg-slate-200 motion-reduce:animate-none" /></td>
                    </tr>
                  ))
                : activeDate?.purchaseLines.length
                  ? activeDate.purchaseLines.map((line) => {
                      const currentDecision = line.currentSupplierDecision;
                      return (
                        <tr key={line.purchaseRequestLineId}>
                          <td>
                            <span className="block font-semibold text-slate-900">{line.ingredientName}</span>
                            <span className="text-[12px] text-slate-500">{line.purchaseRequestLineId}</span>
                          </td>
                          <td>{line.purchaseQty} {line.unitName}</td>
                          <td>{line.supplierName || 'Chưa chọn nhà cung cấp'}</td>
                          <td>
                            {currentDecision
                              ? `${currentDecision.evidenceType} ngày ${formatIsoDate(currentDecision.evidenceDate)}`
                              : 'Chưa có bằng chứng được xác nhận'}
                          </td>
                          <td>{currentDecision ? currentDecision.proposedUnitPrice.toLocaleString('vi-VN') : 'Chưa có'}</td>
                          <td>{currentDecision ? formatIsoDate(currentDecision.proposedDeliveryDate) : 'Chưa có'}</td>
                          <td>
                            <button
                              type="button"
                              className="ipc-button min-h-9 whitespace-nowrap max-md:min-h-11"
                              aria-pressed={selectedLineId === line.purchaseRequestLineId}
                              onClick={() => onLineChange(line.purchaseRequestLineId)}
                            >
                              {currentDecision ? 'Xem quyết định' : 'Xem bằng chứng'}
                            </button>
                          </td>
                        </tr>
                      );
                    })
                  : (
                      <tr>
                        <td colSpan={7} className="h-[320px] text-center text-slate-600">
                          {serviceDates.length === 0
                            ? 'Chưa có nhu cầu đã duyệt trong tuần này.'
                            : 'Chưa có dòng nguyên liệu cho giai đoạn đang xem.'}
                        </td>
                      </tr>
                    )}
            </tbody>
          </table>
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
