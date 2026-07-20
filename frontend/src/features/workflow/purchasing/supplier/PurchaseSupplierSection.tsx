import { PaginationBar, SectionPanel, TableViewport } from '@/components/common';
import { SupplierLineItem } from '../../components/purchasing/SupplierLineItem';
import type { usePurchaseSupplier } from './usePurchaseSupplier';

type PurchaseSupplierWorkflow = ReturnType<typeof usePurchaseSupplier>;

export function PurchaseSupplierSection({ workflow }: { workflow: PurchaseSupplierWorkflow }) {
  return (
    <SectionPanel title="Nhà cung cấp, đơn mua và nhập giá">
      <div id="purchasing-supplier-panel" role="tabpanel" aria-labelledby="purchasing-supplier-tab">
        <TableViewport className="ipc-table-container mt-4" ariaLabel="Bảng dòng mua hàng và nhà cung cấp">
          <table className="ipc-table">
            <thead><tr><th>Chứng từ</th><th>Nguyên liệu</th><th className="text-right">Số lượng cần mua</th><th>Nhà cung cấp</th><th>Giá dự kiến (đ)</th><th>Ngày giao</th><th>Ghi chú</th><th>Thao tác</th></tr></thead>
            <tbody>
              {workflow.lines.map((line) => (
                <SupplierLineItem key={line.id} line={line} suppliers={workflow.suppliers} onUpdate={workflow.updateSupplier} />
              ))}
              {workflow.lines.length === 0 && (
                <tr><td colSpan={8} className="py-4 text-center text-slate-500">Chưa có đơn mua nào để cập nhật nhà cung cấp</td></tr>
              )}
            </tbody>
          </table>
        </TableViewport>
        <PaginationBar
          page={workflow.response?.pageNumber ?? workflow.page}
          pageSize={workflow.response?.pageSize ?? 8}
          totalItems={workflow.response?.totalCount ?? 0}
          onPageChange={workflow.setPage}
        />
      </div>
    </SectionPanel>
  );
}
