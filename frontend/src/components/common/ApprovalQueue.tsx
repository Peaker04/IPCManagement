import { useState, type ReactNode } from "react";
import { cn } from "@/lib/utils";
import { PaginationBar } from "./PaginationBar";
import { EmptyState } from "./EmptyState";
import { TableViewport } from "./TableViewport";
import { useLocalPagination } from "@/lib/useLocalPagination";
import { StatusBadge } from "./StatusBadge";
import { IdentifierText } from "./IdentifierText";
import {
  formatCurrency,
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

const getRecordSummary = (record: ApprovalRecord) => {
  if (record.targetType === "material-demand") return "Đã tổng hợp nhu cầu, chờ duyệt";
  if (record.targetType === "purchase-price-exception") return "Giá mua vượt ngưỡng, chờ duyệt";
  return record.reason;
};

const getCompactReference = (record: ApprovalRecord) => {
  const prefix = record.targetType === "material-demand"
    ? "MR"
    : record.targetType === "purchase-price-exception"
      ? "Giá mua"
      : "Chứng từ";
  return record.serviceDate ? `${prefix} · ${record.serviceDate}` : prefix;
};

const getEvidenceLabel = (value?: string | null) => {
  const normalized = value?.replaceAll(/[-_\s]/g, "").toUpperCase();
  if (normalized === "EFFECTIVEQUOTATION") return "Báo giá hiệu lực";
  if (normalized === "LATESTVALIDRECEIPT") return "Phiếu nhập hợp lệ gần nhất";
  return value || "Chưa có loại bằng chứng";
};

function SlaIndicator({ deadline, referenceNow }: { deadline?: string; referenceNow: number }) {
  if (!deadline) return null;

  const diffMs = new Date(deadline).getTime() - referenceNow;
  const label = (() => {
    if (diffMs <= 0) return "Quá hạn";
    const hours = Math.floor(diffMs / (1000 * 60 * 60));
    const minutes = Math.floor((diffMs % (1000 * 60 * 60)) / (1000 * 60));
    return `${hours}g ${minutes}p`;
  })();

  return (
    <span
      className={cn(
        "mt-1 inline-flex max-w-full rounded-sm border px-1.5 py-0.5 text-xs font-semibold",
        diffMs <= 0
          ? "border-red-200 bg-red-50 text-red-700"
          : diffMs / (1000 * 60 * 60) <= 4
            ? "border-amber-200 bg-amber-50 text-amber-700"
            : "border-emerald-200 bg-emerald-50 text-emerald-700",
      )}
    >
      Thời hạn xử lý: {label}
    </span>
  );
}

function ApprovalMaterials({ record }: { record: ApprovalRecord }) {
  const [expanded, setExpanded] = useState(false);
  const visibleCount = 4;
  const materialListId = `approval-materials-${record.id}`;
  const visibleMaterials = expanded
    ? record.materials
    : record.materials.slice(0, visibleCount);
  const remainingCount = record.materials.length - visibleCount;

  if (!record.materials.length) return null;

  return (
    <div
      className={cn(
        "ipc-approval-zone-materials-group min-w-0",
        expanded && "is-expanded",
      )}
    >
      <ul
        id={materialListId}
        className="grid gap-x-6 gap-y-1 text-xs sm:grid-cols-2 xl:grid-cols-4"
      >
        {visibleMaterials.map((material, materialIndex) => (
          <li
            key={`${record.id}-${material.name}-${material.unit}-${materialIndex}`}
            className="flex min-w-0 items-center justify-between gap-2 border-b border-slate-200 py-1"
          >
            <span className="truncate text-slate-700" title={material.name}>
              {material.name}
            </span>
            <strong className={cn(typography.numeric, "whitespace-nowrap tabular-nums text-blue-700")}>
              {formatQuantityWithUnit(material.quantity, material.unit)}
            </strong>
          </li>
        ))}
      </ul>
      {remainingCount > 0 && (
        <button
          type="button"
          className="mt-1 text-xs font-semibold text-blue-700 underline underline-offset-2 hover:text-blue-900"
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

function ApprovalDetail({ record }: { record: ApprovalRecord }) {
  const isMaterialDemand = record.targetType === "material-demand";
  const isPriceException = record.targetType === "purchase-price-exception";

  if (!isMaterialDemand && !isPriceException && !record.materials.length) {
    return null;
  }

  return (
    <div className="grid gap-4 bg-slate-50/70 px-4 py-3 lg:grid-cols-[minmax(280px,0.8fr)_minmax(0,2fr)]">
      <dl className="grid content-start gap-x-5 gap-y-2 text-xs sm:grid-cols-2">
        {isMaterialDemand && (
          <>
            <div>
              <dt className="text-slate-500">Ngày phục vụ</dt>
              <dd className="font-semibold text-slate-900">{record.serviceDate ?? "Chưa có"}</dd>
            </div>
            <div>
              <dt className="text-slate-500">Phạm vi</dt>
              <dd className="font-semibold text-slate-900">
                {record.scope === "FULLDAY" ? "Cả ngày (FULLDAY)" : (record.scope ?? "Chưa có")}
              </dd>
            </div>
            <div className="min-w-0 sm:col-span-2">
              <dt className="text-slate-500">Chứng từ nguồn</dt>
              <dd className="min-w-0 font-semibold text-slate-900">
                <IdentifierText value={record.sourceDocumentCode} />
              </dd>
            </div>
            <div className="sm:col-span-2">
              <dt className="text-slate-500">Thiếu hụt</dt>
              <dd className="font-semibold text-slate-900">
                {record.lineCount ?? record.materials.length} dòng thiếu
              </dd>
            </div>
          </>
        )}
        {isPriceException && (
          <>
            <div>
              <dt className="text-slate-500">Nhà cung cấp</dt>
              <dd className="font-semibold text-slate-900">{record.supplierName ?? "Chưa có"}</dd>
            </div>
            <div>
              <dt className="text-slate-500">Nguyên liệu</dt>
              <dd className="font-semibold text-slate-900">{record.materials[0]?.name ?? "Chưa có"}</dd>
            </div>
            <div>
              <dt className="text-slate-500">Giá tham chiếu</dt>
              <dd className="font-semibold tabular-nums text-slate-900">
                {record.referencePrice == null ? "Chưa có" : formatCurrency(record.referencePrice)}
              </dd>
            </div>
            <div>
              <dt className="text-slate-500">Giá đề xuất</dt>
              <dd className="font-semibold tabular-nums text-slate-900">
                {record.proposedPrice == null ? "Chưa có" : formatCurrency(record.proposedPrice)}
              </dd>
            </div>
            <div>
              <dt className="text-slate-500">Chênh lệch server</dt>
              <dd className="font-semibold tabular-nums text-red-700">
                {record.variancePercent == null
                  ? "Chưa có"
                  : `${record.variancePercent > 0 ? "+" : ""}${formatPercent(record.variancePercent, 2)}`}
              </dd>
            </div>
            <div>
              <dt className="text-slate-500">Bằng chứng</dt>
              <dd className="font-semibold text-slate-900">
                {getEvidenceLabel(record.evidenceType)}
                {record.evidenceDate ? `, ngày ${record.evidenceDate}` : ""}
              </dd>
            </div>
            <div className="min-w-0">
              <dt className="text-slate-500">Đề xuất mua</dt>
              <dd className="min-w-0 font-semibold text-slate-900">
                <IdentifierText value={record.source} />
              </dd>
            </div>
            <div>
              <dt className="text-slate-500">Phiên bản</dt>
              <dd className="font-semibold text-slate-900">
                {record.proposalVersion == null ? "Chưa có" : `Phiên bản ${record.proposalVersion}`}
              </dd>
            </div>
          </>
        )}
      </dl>
      <ApprovalMaterials record={record} />
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
  const { page, rows: pageRecords, totalItems, setPage } = useLocalPagination(records, pageSize);
  const [referenceNow] = useState(() => Date.now());
  const [expandedRecordIds, setExpandedRecordIds] = useState<Set<string>>(() => new Set());

  const toggleRecordDetail = (recordId: string) => {
    setExpandedRecordIds((current) => {
      const next = new Set(current);
      if (next.has(recordId)) next.delete(recordId);
      else next.add(recordId);
      return next;
    });
  };

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
      className={cn(typography.body, "ipc-approval-queue min-w-0", className)}
      role="region"
      aria-label="Hàng đợi duyệt vận hành"
    >
      {title && <h4 className={typography.sectionTitle}>{title}</h4>}
      <TableViewport
        ariaLabel="Danh sách chứng từ cần duyệt"
        caption="Danh sách nghiệp vụ, thời điểm, nội dung, người phụ trách, hạn xử lý, trạng thái và thao tác duyệt."
        className="ipc-table-viewport--page-flow rounded-none border-0 shadow-none"
      >
        <table aria-label="Danh sách chứng từ cần duyệt" className="ipc-data-table ipc-approval-table min-w-[1080px] !table-fixed">
          <colgroup>
            <col className="w-[18%]" />
            <col className="w-[11%]" />
            <col className="w-[21%]" />
            <col className="w-[13%]" />
            <col className="w-[12%]" />
            <col className="w-[10%]" />
            <col className="w-[15%]" />
          </colgroup>
          <thead>
            <tr>
              <th scope="col">Chứng từ</th>
              <th scope="col">Ngày phục vụ</th>
              <th scope="col">Nội dung</th>
              <th scope="col">Phụ trách</th>
              <th scope="col" className="text-center">Hạn duyệt</th>
              <th scope="col" className="text-center">Trạng thái</th>
              <th scope="col" className="text-right">Xử lý</th>
            </tr>
          </thead>
          {pageRecords.map((record) => {
            const hasDetail =
              record.targetType === "material-demand" ||
              record.targetType === "purchase-price-exception" ||
              record.materials.length > 0;

            const isDetailExpanded = expandedRecordIds.has(record.id);

            return (
              <tbody
                key={record.id}
                className={cn(
                  "ipc-approval-record-group",
                  selectedRecordId === record.id && "bg-blue-50/60",
                )}
              >
                <tr
                  id={`approval-record-${record.id}`}
                  tabIndex={-1}
                  aria-current={selectedRecordId === record.id ? "true" : undefined}
                  className="ipc-approval-table-row align-top"
                >
                  <td>
                    <div className="font-semibold text-slate-950">{record.title}</div>
                    <span
                      className={cn(typography.code, "mt-1 block text-xs text-slate-500")}
                      title={record.source}
                    >
                      {getCompactReference(record)}
                    </span>
                  </td>
                  <td>
                    <div className="whitespace-nowrap font-medium tabular-nums text-slate-900">
                      {record.serviceDate ?? record.deadline}
                    </div>
                    {record.scope && (
                      <div className="mt-1 text-xs text-slate-500">
                        {record.scope === "FULLDAY" ? "Cả ngày" : record.scope}
                      </div>
                    )}
                  </td>
                  <td>
                    <p className="text-sm text-slate-700" title={record.reason}>
                      {getRecordSummary(record)}
                    </p>
                    {record.targetType === "material-demand" && (
                      <div className="mt-1 text-xs font-semibold text-slate-600">
                        {record.lineCount ?? record.materials.length} dòng thiếu
                      </div>
                    )}
                    {record.targetType === "purchase-price-exception" && (
                      <div className="mt-1 text-xs text-slate-600">
                        {record.supplierName ?? "Chưa có nhà cung cấp"}
                      </div>
                    )}
                    {hasDetail && (
                      <button
                        type="button"
                        className="mt-1 text-xs font-semibold text-blue-700 hover:text-blue-900"
                        aria-expanded={isDetailExpanded}
                        aria-controls={`approval-detail-${record.id}`}
                        onClick={() => toggleRecordDetail(record.id)}
                      >
                        {isDetailExpanded ? "Ẩn chi tiết" : "Xem chi tiết"}
                      </button>
                    )}
                  </td>
                  <td>
                    <div className="font-medium text-slate-900">{record.submittedBy}</div>
                    {record.owner !== record.submittedBy && (
                      <div className="mt-1 text-xs text-slate-500">{record.owner}</div>
                    )}
                  </td>
                  <td className="text-center">
                    <div className="whitespace-nowrap tabular-nums text-slate-800">{record.deadline}</div>
                    <SlaIndicator deadline={record.slaDeadline ?? undefined} referenceNow={referenceNow} />
                  </td>
                  <td className="ipc-badge-cell text-center">
                    <StatusBadge variant={record.tone}>
                      {formatWorkflowStatus(record.status)}
                    </StatusBadge>
                  </td>
                  <td
                    className="ipc-approval-record-action text-right"
                    aria-label={`${actionForRecord ? "Thao tác" : "Hướng xử lý"} cho ${record.title}`}
                  >
                    {!actionForRecord && (
                      <span className="text-xs font-semibold text-blue-700">
                        {formatWorkflowStatus(record.nextAction)}
                      </span>
                    )}
                    {actionForRecord?.(record)}
                  </td>
                </tr>
                {hasDetail && isDetailExpanded && (
                  <tr id={`approval-detail-${record.id}`} className="ipc-approval-detail-row">
                    <td colSpan={7} className="!p-0">
                      <ApprovalDetail record={record} />
                    </td>
                  </tr>
                )}
              </tbody>
            );
          })}
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
