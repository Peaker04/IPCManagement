import { Search } from 'lucide-react';
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
    <SectionPanel
      title="Nhu cầu xuất theo từng ngày"
      description="Danh sách nguyên liệu cần chuẩn bị xuất kho theo ngày hoặc tuần phục vụ."
      actions={
        <div className="flex items-center gap-3 flex-wrap sm:flex-nowrap">
          <span className="text-xs text-slate-500 whitespace-nowrap hidden md:inline">Phạm vi: {scopeLabel}</span>
          <div className="relative w-64 max-w-full">
            <Search aria-hidden="true" className="pointer-events-none absolute left-2.5 top-1/2 size-4 -translate-y-1/2 text-slate-400" />
            <Input
              id="warehouse-demand-search"
              type="search"
              value={demandSearch}
              onChange={(event) => onDemandSearchChange(event.target.value)}
              placeholder="Tìm tên hoặc mã nguyên liệu..."
              className="h-8 pl-8 text-xs bg-slate-50 border-slate-300 focus:bg-white"
              aria-label="Tìm nguyên liệu trong nhu cầu xuất"
            />
          </div>
        </div>
      }
    >
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
