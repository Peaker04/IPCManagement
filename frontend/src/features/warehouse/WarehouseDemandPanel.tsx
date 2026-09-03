import { Link } from 'react-router-dom';
import { EmptyState, PaginationBar, SearchField, SectionPanel } from '@/components/common';
import { DemandSummary } from '@/components/common/DemandSummary';
import { RoleInbox } from '@/components/common/RoleInbox';
import { formatDateOnly } from '@/lib/formatters';
import type { DemandLine, RoleInboxItem } from '@/types/workflow';

type WarehouseDemandPanelProps = {
  demandSearch: string;
  onDemandSearchChange: (value: string) => void;
  requestedDemandDate: string | null;
  requestedDemandWeek: string | null;
  demandDateTo?: string;
  isError: boolean;
  isFetching: boolean;
  onRetry: () => void;
  lines: DemandLine[];
  page: number;
  pageSize: number;
  totalItems: number;
  onPageChange: (page: number) => void;
  inboxItems: RoleInboxItem[];
};

export function WarehouseDemandPanel({
  demandSearch,
  onDemandSearchChange,
  requestedDemandDate,
  requestedDemandWeek,
  demandDateTo,
  isError,
  isFetching,
  onRetry,
  lines,
  page,
  pageSize,
  totalItems,
  onPageChange,
  inboxItems,
}: WarehouseDemandPanelProps) {
  const scopeLabel = requestedDemandDate
    ? `Ngày ${formatDateOnly(requestedDemandDate)}`
    : requestedDemandWeek
      ? `Tuần ${formatDateOnly(requestedDemandWeek)}–${demandDateTo ? formatDateOnly(demandDateTo) : ''}`
      : 'Tất cả ngày';

  return (
    <SectionPanel
      title="Nhu cầu xuất theo từng ngày"
      description="Danh sách nguyên liệu cần chuẩn bị xuất kho theo ngày hoặc tuần phục vụ."
      actions={
        <div className="flex max-w-full flex-wrap items-center gap-3 sm:flex-nowrap">
          <span className="hidden whitespace-nowrap text-xs text-slate-500 md:inline">Phạm vi: {scopeLabel}</span>
          <SearchField
            id="warehouse-demand-search"
            label="Tìm nguyên liệu trong nhu cầu xuất"
            hideLabel
            width="compact"
            value={demandSearch}
            onChange={(event) => onDemandSearchChange(event.target.value)}
            placeholder="Tìm tên hoặc mã nguyên liệu..."
            inputClassName="bg-slate-50 text-xs focus:bg-white"
          />
        </div>
      }
    >
        {isError ? (
          <EmptyState
            variant="error"
            title="Không tải được nhu cầu xuất kho"
            description="Dữ liệu nhu cầu chưa được xác nhận. Hãy tải lại trước khi lập phiếu xuất."
            onRetry={onRetry}
            isRetrying={isFetching}
          />
        ) : <DemandSummary lines={lines} showServiceDate />}
        <PaginationBar
          page={page}
          pageSize={pageSize}
          totalItems={totalItems}
          onPageChange={onPageChange}
        />
        {inboxItems.length > 0 && (
          <div className="mt-4">
            <RoleInbox
              items={inboxItems}
              title={null}
              actionForItem={(item) => (
                <Link className="ipc-button ipc-button-ghost" to={item.route}>
                  {item.nextAction}
                </Link>
              )}
            />
          </div>
        )}
    </SectionPanel>
  );
}
