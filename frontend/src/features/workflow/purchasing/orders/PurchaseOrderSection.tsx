import { Fragment } from 'react';
import { ConfirmDialog, PaginationBar, SectionPanel, TableViewport } from '@/components/common';
import { formatWorkflowStatus } from '../../workflowConfig';
import type { usePurchaseOrders } from './usePurchaseOrders';

type PurchaseOrderWorkflow = ReturnType<typeof usePurchaseOrders>;

export function PurchaseOrderSection({ workflow }: { workflow: PurchaseOrderWorkflow }) {
  return (
    <SectionPanel title="Đơn mua hàng (tách theo nhà cung cấp)">
      <div id="purchasing-orders-panel" role="tabpanel" aria-labelledby="purchasing-orders-tab" className="mt-4 space-y-6">
        <div>
          <div className="mb-2 font-medium text-slate-700">Đề xuất đã duyệt, chưa tạo đơn mua hàng</div>
          {workflow.approvedRequests.length === 0 ? <div className="text-sm text-slate-500">Không có đề xuất mua hàng nào đã duyệt.</div> : (
            <TableViewport className="ipc-table-container" ariaLabel="Bảng đề xuất đã duyệt chờ tạo đơn mua">
              <table className="ipc-table"><thead><tr><th>Chứng từ</th><th>Thao tác</th></tr></thead><tbody>
                {workflow.approvedRequests.map((line) => <tr key={line.purchaseRequestId}><td className="font-mono">{line.sourceDocumentCode}</td><td><button type="button" className="ipc-button ipc-button-primary" disabled={workflow.isCreating} onClick={() => void workflow.create(line.purchaseRequestId!)}>Tạo đơn mua hàng</button></td></tr>)}
              </tbody></table>
            </TableViewport>
          )}
          <PaginationBar
            page={workflow.approvedRequestResponse?.pageNumber ?? workflow.approvedRequestPage}
            pageSize={workflow.approvedRequestResponse?.pageSize ?? 8}
            totalItems={workflow.approvedRequestResponse?.totalCount ?? 0}
            onPageChange={workflow.setApprovedRequestPage}
          />
        </div>
        <div>
          <div className="mb-2 font-medium text-slate-700">Danh sách đơn mua hàng</div>
          <TableViewport className="ipc-table-container" ariaLabel="Bảng đơn mua hàng">
            <table className="ipc-table"><thead><tr><th>Mã đơn mua hàng</th><th>Nhà cung cấp</th><th>Đề xuất gốc</th><th>Ngày đặt</th><th>Trạng thái</th><th>Thao tác</th></tr></thead><tbody>
              {workflow.orders.length === 0 && <tr><td colSpan={6} className="py-4 text-center text-slate-500">Chưa có đơn mua hàng nào</td></tr>}
              {workflow.orders.map((order) => (
                <Fragment key={order.purchaseOrderId}>
                  <tr><td className="font-mono">{order.purchaseOrderCode}</td><td>{order.supplierName}</td><td className="font-mono">{order.purchaseRequestCode}</td><td>{order.orderDate}</td><td>{formatWorkflowStatus(order.status)}</td>
                    <td className="space-x-2">
                      {order.status !== 'CANCELLED' && order.status !== 'RECEIVED' && <button type="button" className="ipc-button ipc-button-ghost" onClick={() => workflow.setExpandedOrderId(workflow.expandedOrderId === order.purchaseOrderId ? null : order.purchaseOrderId)}>{workflow.expandedOrderId === order.purchaseOrderId ? 'Đóng' : 'Ghi nhận nhận hàng'}</button>}
                      {order.status === 'ORDERED' && <button type="button" className="ipc-button ipc-button-danger" onClick={() => workflow.setCancelTargetId(order.purchaseOrderId)}>Hủy</button>}
                    </td>
                  </tr>
                  {workflow.expandedOrderId === order.purchaseOrderId && <tr><td colSpan={6}>
                    <div className="space-y-2 rounded-md bg-slate-50 p-3">
                      <label className="flex flex-col gap-1 text-sm text-slate-700 md:max-w-xs">Kho nhập hàng
                        <select className="ipc-input" value={workflow.receiveWarehouseByOrder[order.purchaseOrderId] ?? ''} onChange={(event) => workflow.setReceiveWarehouseByOrder({ ...workflow.receiveWarehouseByOrder, [order.purchaseOrderId]: event.target.value })}>
                          <option value="">{workflow.warehouseOptions.length === 0 ? 'Chưa có kho trong danh mục' : 'Chọn kho nhập hàng'}</option>
                          {workflow.warehouseOptions.map((warehouse) => <option key={warehouse.warehouseId} value={warehouse.warehouseId}>{warehouse.warehouse}</option>)}
                        </select>
                      </label>
                      {order.lines.map((line) => <div key={line.purchaseOrderLineId} className="flex items-center gap-3"><span className="flex-1">{line.ingredientName} — đã đặt {line.orderedQty} {line.unitName}, đã nhận {line.receivedQty}</span><input type="number" className="ipc-input w-32" aria-label={`Số lượng nhận thêm cho ${line.ingredientName}`} placeholder="SL nhận thêm" value={workflow.receiveQtyByLine[line.purchaseOrderLineId] ?? ''} onChange={(event) => workflow.setReceiveQtyByLine({ ...workflow.receiveQtyByLine, [line.purchaseOrderLineId]: event.target.value })} /></div>)}
                      <button type="button" className="ipc-button ipc-button-primary" onClick={() => void workflow.receive(order)}>Ghi nhận</button>
                    </div>
                  </td></tr>}
                </Fragment>
              ))}
            </tbody></table>
          </TableViewport>
          <PaginationBar page={workflow.response?.page.pageNumber ?? workflow.page} pageSize={workflow.response?.page.pageSize ?? 6} totalItems={workflow.response?.page.totalCount ?? 0} onPageChange={workflow.setPage} />
        </div>
        <ConfirmDialog open={workflow.cancelTargetId !== null} title="Hủy đơn mua hàng này?" description="Đơn mua sẽ không tiếp tục được xử lý trong luồng thu mua." confirmLabel="Hủy đơn mua" onConfirm={workflow.confirmCancel} onOpenChange={(open) => !open && workflow.setCancelTargetId(null)} />
      </div>
    </SectionPanel>
  );
}
