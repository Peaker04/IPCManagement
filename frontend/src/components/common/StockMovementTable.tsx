import { useState } from 'react';
import { Check, Copy } from 'lucide-react';
import { cn } from '@/lib/utils';
import { PaginationBar } from './PaginationBar';
import { CursorPaginationBar } from './CursorPaginationBar';
import { StatusBadge } from './StatusBadge';
import { TableViewport } from './TableViewport';
import { formatQuantity, formatUnit } from '@/lib/formatters';
import type { StockMovement } from '@/features/workflow';
import { useLocalPagination } from '@/lib/useLocalPagination';
import { formatWorkflowStatus } from '@/features/workflow/workflowConfig';

interface StockMovementTableProps {
  movements: StockMovement[];
  pageSize?: number;
  className?: string;
  cursorPagination?: {
    page: number;
    hasNext: boolean;
    onPrevious: () => void;
    onNext: () => void;
  };
}

const movementLabel = {
  receipt: 'Nhập kho',
  issue: 'Xuất kho',
  supplemental: 'Xuất bổ sung',
  return: 'Trả kho',
  adjustment: 'Điều chỉnh',
};

const typeClasses = {
  receipt: 'bg-white text-slate-700 border-slate-200',
  issue: 'bg-white text-slate-700 border-slate-200',
  supplemental: 'bg-white text-slate-700 border-slate-200',
  return: 'bg-white text-slate-700 border-slate-200',
  adjustment: 'bg-white text-slate-700 border-slate-200',
};

function shortenDocumentNo(docNo: string): string {
  if (!docNo) return '';
  const parts = docNo.split('-');
  if (parts.length <= 1) return docNo;

  const prefix = parts[0];
  const suffix = parts.slice(1).join('-');

  const prefixMap: Record<string, string> = {
    inventoryreceiptlines: 'IRL',
    inventoryreceipt: 'IR',
    inventoryissuelines: 'IIL',
    inventoryissue: 'II',
    inventoryreturnlines: 'IRTL',
    inventoryreturn: 'IRT',
    inventoryadjustmentlines: 'IAL',
    inventoryadjustment: 'IA',
    materialrequestlines: 'MRL',
    materialrequest: 'MR',
    purchaserequestlines: 'PRL',
    purchaserequest: 'PR',
  };

  const key = prefix.toLowerCase();
  if (key in prefixMap) {
    return `${prefixMap[key]}-${suffix}`;
  }

  if (prefix.length > 8) {
    const acronym = prefix.match(/[A-Z]/g)?.join('') || prefix.slice(0, 3).toUpperCase();
    return `${acronym}-${suffix}`;
  }

  return docNo;
}

export function StockMovementTable({ movements, pageSize = 8, className, cursorPagination }: StockMovementTableProps) {
  const [copiedDocumentNo, setCopiedDocumentNo] = useState<string | null>(null);
  const pagination = useLocalPagination(movements, pageSize);

  const handleCopyDocumentNo = async (docNo: string) => {
    try {
      await navigator.clipboard.writeText(docNo);
      setCopiedDocumentNo(docNo);
      window.setTimeout(() => {
        setCopiedDocumentNo((current) => (current === docNo ? null : current));
      }, 1400);
    } catch {
      setCopiedDocumentNo(null);
    }
  };

  if (!movements.length) {
    return <div className={cn('ipc-stock-movement-table is-empty text-slate-500 text-center py-8 border border-dashed border-slate-200 bg-slate-50 rounded-sm', className)}>Chưa có dữ liệu để hiển thị</div>;
  }

  return (
    <div className={cn('ipc-stock-movement-table', className)}>
      <TableViewport ariaLabel="Bảng biến động kho" className="ipc-stock-movement-shell" caption="Danh sách biến động kho">
        <table className="ipc-data-table ipc-stock-table ipc-status-action-table">
          <thead>
            <tr>
              <th className="text-left">Chứng từ</th>
              <th>Loại</th>
              <th>Nguyên liệu</th>
              <th className="text-right">Số lượng</th>
              <th>Phụ trách</th>
              <th>Trạng thái</th>
              <th>Tiếp theo</th>
            </tr>
          </thead>
          <tbody>
            {pagination.rows.map((movement) => (
              <tr key={movement.id} className="transition-colors hover:bg-slate-50/50">
                <td className="font-mono text-[13px] font-semibold text-slate-700 text-left">
                  <div className="flex items-center gap-1.5 justify-start">
                    <span title={movement.documentNo}>
                      {shortenDocumentNo(movement.documentNo)}
                    </span>
                    <button
                      type="button"
                      className="ipc-document-copy-button flex-shrink-0"
                      style={{ width: '22px', height: '22px' }}
                      aria-label={`Sao chép mã chứng từ ${movement.documentNo}`}
                      title="Sao chép mã chứng từ"
                      onClick={() => void handleCopyDocumentNo(movement.documentNo)}
                    >
                      {copiedDocumentNo === movement.documentNo ? (
                        <Check size={11} className="text-emerald-500" />
                      ) : (
                        <Copy size={11} />
                      )}
                    </button>
                  </div>
                </td>
                <td className="ipc-badge-cell">
                  <span className={cn('ipc-table-badge ipc-table-badge--type rounded-sm border text-[11.5px] font-semibold leading-normal', typeClasses[movement.type])}>
                    <span className="ipc-table-badge-dot" aria-hidden="true" />
                    <span className="ipc-table-badge-label">{movementLabel[movement.type]}</span>
                  </span>
                </td>
                <td className="font-medium text-slate-800">{movement.material}</td>
                <td className="text-right font-mono font-bold text-slate-900">
                  <div>{formatQuantity(movement.quantity)} <span className="text-xs text-slate-400 font-sans font-normal">{formatUnit(movement.unit)}</span></div>
                  {movement.beforeQty !== undefined && movement.afterQty !== undefined && (
                    <div className="text-[11px] font-normal text-slate-500">
                      {formatQuantity(movement.beforeQty)} -&gt; {formatQuantity(movement.afterQty)}
                    </div>
                  )}
                </td>
                <td>{movement.owner}</td>
                <td className="ipc-badge-cell">
                  <StatusBadge variant={movement.tone} className="ipc-table-badge ipc-table-badge--status">
                    {formatWorkflowStatus(movement.status)}
                  </StatusBadge>
                </td>
                <td className="text-slate-600 text-[13px]">{formatWorkflowStatus(movement.nextAction)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </TableViewport>
      {cursorPagination ? (
        <CursorPaginationBar
          page={cursorPagination.page}
          hasNext={cursorPagination.hasNext}
          onPrevious={cursorPagination.onPrevious}
          onNext={cursorPagination.onNext}
          ariaLabel="Phân trang biến động kho"
        />
      ) : (
        <PaginationBar page={pagination.page} pageSize={pageSize} totalItems={pagination.totalItems} onPageChange={pagination.setPage} />
      )}
    </div>
  );
}
