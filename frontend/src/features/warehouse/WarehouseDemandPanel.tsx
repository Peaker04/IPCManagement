import { Link } from 'react-router-dom';
import { EmptyState, PaginationBar, SectionPanel } from '@/components/common';
import { DemandSummary } from '@/components/common/DemandSummary';
import { RoleInbox } from '@/components/common/RoleInbox';
import { Input } from '@/components/ui/input';
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
    <SectionPanel title="Nhu cầu xuất theo từng ngày">
      <div className="mb-3 grid gap-2 border-b border-slate-200 pb-3 md:grid-cols-[minmax(0,1fr)_auto] md:items-end">
          <label htmlFor="warehouse-demand-search" className="grid gap-1 text-xs font-semibold text-slate-700">
            Tìm nguyên liệu trong nhu cầu xuất
            <Input
              id="warehouse-demand-search"
              type="search"
              value={demandSearch}
              onChange={(event) => onDemandSearchChange(event.target.value)}
              placeholder="Tên hoặc mã nguyên liệu"
              className="h-9"
            />
          </label>
          <p className="text-xs text-slate-600 md:pb-2">Phạm vi: {scopeLabel}</p>
        </div>
        {isError ? (
          <EmptyState
            variant="error"
            title="Không tải được nhu cầu xuất kho"
            description="Chưa lấy được danh sách nhu cầu và thiếu hàng, nên không thể kết luận là không còn gì phải xuất. Hãy tải lại trước khi lập phiếu xuất."
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
