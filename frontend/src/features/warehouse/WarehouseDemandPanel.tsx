import { Link } from 'react-router-dom';
import { EmptyState, PaginationBar, RefreshStatus, SearchField, SectionPanel, TableSkeleton } from '@/components/common';
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
  onPageSizeChange: (pageSize: number) => void;
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
  onPageSizeChange,
  inboxItems,
}: WarehouseDemandPanelProps) {
  const scopeLabel = requestedDemandDate
    ? `Ngày ${formatDateOnly(requestedDemandDate)}`
    : requestedDemandWeek
      ? `Tuần ${formatDateOnly(requestedDemandWeek)}–${demandDateTo ? formatDateOnly(demandDateTo) : ''}`
      : 'Tất cả ngày';

  return (
    <SectionPanel
      title="Nhu cầu cần xuất kho"
      description="Theo dõi lượng cần xuất, lượng đã bàn giao và bước xử lý tiếp theo theo ngày phục vụ."
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
        ) : isFetching && lines.length === 0 ? (
          <TableSkeleton rows={8} columns={6} ariaLabel="Đang tải nhu cầu xuất kho..." />
        ) : lines.length === 0 ? (
          <EmptyState
            variant={demandSearch.trim() ? 'filtered' : 'empty'}
            title={demandSearch.trim() ? 'Không có nhu cầu khớp bộ lọc.' : 'Chưa có nhu cầu cần xuất trong phạm vi này.'}
            description={demandSearch.trim() ? 'Thử từ khóa khác hoặc xóa tìm kiếm để xem nhu cầu trong phạm vi này.' : 'Thay đổi ngày hoặc tuần khi cần kiểm tra một phạm vi phục vụ khác.'}
            className="!min-h-0 !p-4"
          />
        ) : (
          <>
            {isFetching && <RefreshStatus>Đang cập nhật nhu cầu xuất kho…</RefreshStatus>}
            <DemandSummary lines={lines} showServiceDate className="warehouse-demand-summary" />
          </>
        )}
        {!isError && lines.length > 0 && totalItems > 0 && (
          <PaginationBar
            page={page}
            pageSize={pageSize}
            totalItems={totalItems}
            pageSizeOptions={[8, 20, 50]}
            onPageSizeChange={(nextSize) => { if (!isFetching) onPageSizeChange(nextSize); }}
            onPageChange={(nextPage) => { if (!isFetching) onPageChange(nextPage); }}
          />
        )}
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
