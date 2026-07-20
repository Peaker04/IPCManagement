import { ConfirmDialog, PaginationBar, SectionPanel, TableViewport } from '@/components/common';
import type { IngredientLookup } from '@/features/projects/dishCatalogApi';
import type { useSupplierQuotations } from './useSupplierQuotations';

type SupplierQuotationWorkflow = ReturnType<typeof useSupplierQuotations>;

export function SupplierQuotationSection({ workflow }: { workflow: SupplierQuotationWorkflow }) {
  return (
    <SectionPanel title="Quản lý báo giá nhà cung cấp">
      <div id="purchasing-quotation-panel" role="tabpanel" aria-labelledby="purchasing-quotation-tab" className="mt-4 space-y-4">
        <div>
          <label className="mr-2 text-sm font-medium text-slate-700" htmlFor="quotation-ingredient">Nguyên liệu:</label>
          <select
            id="quotation-ingredient"
            className="ipc-input ipc-quotation-ingredient"
            value={workflow.selectedIngredientId}
            onChange={(event) => workflow.selectIngredient(event.target.value)}
          >
            <option value="">-- Chọn nguyên liệu --</option>
            {workflow.ingredients.map((ingredient: IngredientLookup) => (
              <option key={ingredient.ingredientId} value={ingredient.ingredientId}>{ingredient.ingredientName}</option>
            ))}
          </select>
        </div>

        {workflow.selectedIngredientId && (
          <>
            <TableViewport className="ipc-table-container" ariaLabel="Bảng báo giá theo nguyên liệu">
              <table className="ipc-table">
                <thead><tr><th>Nhà cung cấp</th><th className="text-right">Đơn giá (đ)</th><th>Hiệu lực từ</th><th>Hiệu lực đến</th><th>Ghi chú</th><th>Trạng thái</th><th>Thao tác</th></tr></thead>
                <tbody>
                  {workflow.rows.map((quotation) => (
                    <tr key={quotation.quotationId} className={quotation.isBestPrice ? 'bg-emerald-50' : ''}>
                      <td>{quotation.supplierName}{quotation.isBestPrice && <span className="ml-2 text-xs font-medium text-emerald-700">Tốt nhất</span>}</td>
                      <td className="text-right">{quotation.unitPrice.toLocaleString('vi-VN')}</td>
                      <td>{quotation.effectiveFrom}</td><td>{quotation.effectiveTo ?? '—'}</td><td>{quotation.note ?? ''}</td>
                      <td>{quotation.isActive ? <span className="text-emerald-600">Đang hoạt động</span> : <span className="text-slate-400">Đã ngừng</span>}</td>
                      <td className="space-x-2">
                        <button type="button" className="ipc-button ipc-button-ghost" onClick={() => workflow.edit(quotation)}>Sửa</button>
                        {quotation.isActive && <button type="button" className="ipc-button ipc-button-danger" onClick={() => workflow.setDeactivateTargetId(quotation.quotationId)}>Ngừng</button>}
                      </td>
                    </tr>
                  ))}
                  {workflow.rows.length === 0 && !workflow.isFetching && <tr><td colSpan={7} className="py-4 text-center text-slate-500">Chưa có báo giá nào cho nguyên liệu này</td></tr>}
                </tbody>
              </table>
            </TableViewport>
            <PaginationBar page={workflow.response?.pageNumber ?? workflow.page} pageSize={workflow.response?.pageSize ?? 8} totalItems={workflow.response?.totalCount ?? 0} onPageChange={workflow.setPage} />
            <form onSubmit={workflow.submit} className="border-t border-slate-200 pt-4">
              <div className="mb-2 font-medium text-slate-700">{workflow.editingId ? 'Sửa báo giá' : 'Thêm báo giá mới'}</div>
              <div className="ipc-quotation-form-grid grid grid-cols-1 gap-3 md:grid-cols-5">
                <select className="ipc-input" aria-label="Nhà cung cấp" value={workflow.form.supplierId} onChange={(event) => workflow.setForm({ ...workflow.form, supplierId: event.target.value })} disabled={Boolean(workflow.editingId)}>
                  <option value="">-- Nhà cung cấp --</option>{workflow.suppliers.map((supplier) => <option key={supplier.supplierId} value={supplier.supplierId}>{supplier.supplierName}</option>)}
                </select>
                <input type="number" className="ipc-input" aria-label="Đơn giá" placeholder="Đơn giá" value={workflow.form.unitPrice} onChange={(event) => workflow.setForm({ ...workflow.form, unitPrice: event.target.value })} />
                <input type="date" className="ipc-input" aria-label="Hiệu lực từ" value={workflow.form.effectiveFrom} onChange={(event) => workflow.setForm({ ...workflow.form, effectiveFrom: event.target.value })} />
                <input type="date" className="ipc-input" aria-label="Hiệu lực đến" value={workflow.form.effectiveTo} onChange={(event) => workflow.setForm({ ...workflow.form, effectiveTo: event.target.value })} />
                <input type="text" className="ipc-input" aria-label="Ghi chú" placeholder="Ghi chú" value={workflow.form.note} onChange={(event) => workflow.setForm({ ...workflow.form, note: event.target.value })} />
              </div>
              <div className="mt-3 flex gap-2">
                <button type="submit" className="ipc-button ipc-button-primary" disabled={workflow.isCreating}>{workflow.editingId ? 'Cập nhật báo giá' : 'Thêm báo giá'}</button>
                {workflow.editingId && <button type="button" className="ipc-button ipc-button-ghost" onClick={workflow.resetForm}>Hủy</button>}
              </div>
            </form>
          </>
        )}
        <ConfirmDialog open={workflow.deactivateTargetId !== null} title="Ngừng báo giá này?" description="Báo giá sẽ không còn được chọn cho các giao dịch mới." confirmLabel="Ngừng báo giá" onConfirm={workflow.confirmDeactivate} onOpenChange={(open) => !open && workflow.setDeactivateTargetId(null)} />
      </div>
    </SectionPanel>
  );
}
