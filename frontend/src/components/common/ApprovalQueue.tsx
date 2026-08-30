import { useState, type ReactNode } from "react";
import { cn } from "@/lib/utils";
import { PaginationBar } from "./PaginationBar";
import { EmptyState } from "./EmptyState";
import { TableViewport } from "./TableViewport";
import { useLocalPagination } from "@/lib/useLocalPagination";
import { StatusBadge } from "./StatusBadge";
import {
  formatCurrency,
  formatDateOnly,
  formatPercent,
  formatQuantityWithUnit,
} from "@/lib/formatters";
import type { ApprovalRecord } from "@/types/workflow";
import { formatWorkflowStatus } from "@/lib/workflowConfig";
import { typography } from "@/lib/typography";

interface ApprovalQueueProps {
  records: ApprovalRecord[];
  title?: ReactNode;
  actionForRecord?: (record: ApprovalRecord) => ReactNode;
  pageSize?: number;
  className?: string;
  selectedRecordId?: string;
}

const getTargetLabel = (targetType?: string) => {
  if (targetType === "material-demand") return "Nhu cầu nguyên liệu";
  if (targetType === "purchase-price-exception") return "Ngoại lệ giá";
  return null;
};

function ApprovalMaterials({ record }: { record: ApprovalRecord }) {
  const [expanded, setExpanded] = useState(false);
  const visibleCount = 4;
  const materialListId = `approval-materials-${record.id}`;
  const visibleMaterials = expanded
    ? record.materials
    : record.materials.slice(0, visibleCount);
  const remainingCount = record.materials.length - visibleCount;

  if (!record.materials || record.materials.length === 0) return null;

  return (
    <div
      className={cn(
        "ipc-approval-zone-materials-group text-xs",
        expanded && "is-expanded",
      )}
    >
      <ul id={materialListId} className="ipc-approval-zone-materials space-y-0.5">
        {visibleMaterials.map((material, materialIndex) => (
          <li
            key={`${record.id}-${material.name}-${material.unit}-${materialIndex}`}
            className="flex items-center justify-between gap-2 text-slate-700"
          >
            <span className="truncate">{material.name}</span>
            <strong className="tabular-nums whitespace-nowrap text-slate-900">
              {formatQuantityWithUnit(material.quantity, material.unit)}
            </strong>
          </li>
        ))}
      </ul>
      {remainingCount > 0 && (
        <button
          type="button"
          className="ipc-approval-materials-toggle text-[11px] text-blue-600 hover:text-blue-800 underline cursor-pointer mt-1 font-medium"
          aria-expanded={expanded}
          aria-controls={materialListId}
          onClick={() => setExpanded((current) => !current)}
        >
          {expanded
            ? "Thu gọn danh sách nguyên liệu"
            : `Xem thêm ${remainingCount} nguyên liệu`}
        </button>
      )}
    </div>
  );
}

export function ApprovalQueue({
  records,
  title = "Hàng đợi duyệt vận hành",
  actionForRecord,
  pageSize = 4,
  className,
  selectedRecordId,
}: ApprovalQueueProps) {
  const {
    page,
    rows: pageRecords,
    totalItems,
    setPage,
  } = useLocalPagination(records, pageSize);

  if (!records.length) {
    return (
      <EmptyState
        title="Chưa có dữ liệu để hiển thị"
        className={cn(
          "ipc-approval-queue is-empty !min-h-0 !items-stretch !justify-start !p-4 !text-left",
          className,
        )}
      />
    );
  }

  return (
    <div
      className={cn(typography.body, "ipc-approval-queue space-y-3", className)}
      role="region"
      aria-label="Hàng đợi duyệt vận hành"
    >
      {title && <h4 className={typography.sectionTitle}>{title}</h4>}
      <TableViewport ariaLabel="Bảng danh sách cần duyệt" caption="Danh sách các phiếu và nhu cầu cần phê duyệt">
        <table className="ipc-erp-grid-table w-full min-w-[1000px]">
          <thead>
            <tr className="grid grid-cols-[minmax(220px,1.5fr)_minmax(160px,1fr)_minmax(240px,1.5fr)_minmax(150px,1fr)_minmax(120px,0.8fr)_minmax(110px,0.7fr)_minmax(160px,1fr)]">
              <th className="text-left">Nghiệp vụ / Mã chứng từ</th>
              <th className="text-left">Khách hàng / Thời điểm</th>
              <th className="text-left">Chi tiết vật tư / Nhu cầu</th>
              <th className="text-left">Người gửi / Phụ trách</th>
              <th className="text-center">Hạn xử lý</th>
              <th className="text-center">Trạng thái</th>
              <th className="text-right">Thao tác</th>
            </tr>
          </thead>
          <tbody>
            {pageRecords.map((record) => {
              const targetLabel = getTargetLabel(record.targetType);
              const isMaterialDemand = record.targetType === "material-demand";
              const isPriceException = record.targetType === "purchase-price-exception";

              return (
                <tr
                  key={record.id}
                  id={`approval-record-${record.id}`}
                  tabIndex={-1}
                  aria-current={selectedRecordId === record.id ? "true" : undefined}
                  className={cn(
                    "border-b border-slate-200 last:border-b-0",
                    selectedRecordId === record.id && "bg-blue-50/60",
                  )}
                >
                  <td colSpan={7} className="!p-0">
                    <article
                      role="article"
                      className="grid grid-cols-[minmax(220px,1.5fr)_minmax(160px,1fr)_minmax(240px,1.5fr)_minmax(150px,1fr)_minmax(120px,0.8fr)_minmax(110px,0.7fr)_minmax(160px,1fr)] divide-x divide-slate-200"
                    >
                      <div className="p-2 text-left align-top">
                        <div className="font-semibold text-slate-900">{record.title}</div>
                        <div className={cn(typography.code, "text-xs text-slate-600")}>{record.sourceDocumentCode ?? record.source}</div>
                        {targetLabel && (
                          <div className="text-[11px] font-semibold text-slate-600 uppercase tracking-wide mt-0.5">
                            {targetLabel}
                          </div>
                        )}
                      </div>
                      <div className="p-2 text-left align-top text-slate-800">
                        <div>{record.serviceDate ? formatDateOnly(record.serviceDate) : (record.submittedAt ? formatDateOnly(record.submittedAt) : '—')}</div>
                        <div className="text-xs text-slate-500">{record.scope === "FULLDAY" ? "Cả ngày (FULLDAY)" : (record.scope ?? "")}</div>
                      </div>
                      <div className="p-2 text-left align-top">
                        {isMaterialDemand && (
                          <div className="text-xs text-slate-700 font-medium mb-1">
                            {record.lineCount ?? record.materials.length} dòng thiếu
                          </div>
                        )}
                        {isPriceException && (
                          <div className="text-xs text-slate-700 mb-1 space-y-0.5">
                            {record.supplierName && (
                              <div className="font-semibold text-slate-900">{record.supplierName}</div>
                            )}
                            <div className="flex items-center gap-1.5">
                              <span>{record.materials[0]?.name ?? ''}</span>
                              {record.variancePercent != null && (
                                <span className="text-red-600 font-semibold">
                                  {record.variancePercent > 0 ? "+" : ""}{formatPercent(record.variancePercent, 2)}
                                </span>
                              )}
                            </div>
                            {record.proposalVersion != null && (
                              <div className="text-slate-500 text-[11px]">
                                Phiên bản {record.proposalVersion}
                              </div>
                            )}
                            {record.proposedPrice != null && (
                              <div className="text-slate-500 text-[11px]">
                                Đề xuất: {formatCurrency(record.proposedPrice)} (Gốc: {record.referencePrice != null ? formatCurrency(record.referencePrice) : '—'})
                              </div>
                            )}
                          </div>
                        )}
                        <ApprovalMaterials record={record} />
                      </div>
                      <div className="p-2 text-left align-top text-slate-700 text-xs">
                        <div className="font-medium text-slate-900">{record.submittedBy}</div>
                        <div className="text-slate-500">{record.owner}</div>
                      </div>
                      <div className="p-2 text-center align-top text-xs tabular-nums text-slate-600">
                        <div>{record.deadline}</div>
                        {record.slaDeadline && (
                          <div className="text-[11px] font-medium mt-0.5">
                            {(() => {
                              const diffMs =
                                new Date(record.slaDeadline).getTime() -
                                new Date().getTime();
                              if (diffMs <= 0) {
                                return <span className="text-red-700 font-semibold">Thời hạn xử lý: Quá hạn</span>;
                              }
                              const hours = Math.floor(diffMs / (1000 * 60 * 60));
                              const mins = Math.floor(
                                (diffMs % (1000 * 60 * 60)) / (1000 * 60),
                              );
                              return (
                                <span className="text-amber-800 font-medium">
                                  Thời hạn xử lý: {hours}g {mins}p
                                </span>
                              );
                            })()}
                          </div>
                        )}
                      </div>
                      <div className="p-2 text-center align-top">
                        <StatusBadge variant={record.tone}>
                          {formatWorkflowStatus(record.status)}
                        </StatusBadge>
                      </div>
                      <div className="p-2 text-right align-top">
                        <div
                          className="ipc-approval-record-action flex flex-wrap items-center justify-end gap-1.5"
                          aria-label={`${actionForRecord ? "Thao tác" : "Hướng xử lý"} cho ${record.title}`}
                        >
                          {!actionForRecord && (
                            <span className="text-xs text-slate-600">{formatWorkflowStatus(record.nextAction)}</span>
                          )}
                          {actionForRecord?.(record)}
                        </div>
                      </div>
                    </article>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </TableViewport>
      <PaginationBar
        page={page}
        pageSize={pageSize}
        totalItems={totalItems}
        onPageChange={setPage}
      />
    </div>
  );
}
