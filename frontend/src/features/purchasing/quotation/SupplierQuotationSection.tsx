import { ConfirmDialog, EmptyState, InlineAlert, PaginationBar, SectionPanel, TableViewport } from '@/components/common';
import type { IngredientLookup } from '@/api/dishCatalogApi';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { formatCurrency } from '@/lib/formatters';
import type { useSupplierQuotations } from './useSupplierQuotations';

type SupplierQuotationWorkflow = ReturnType<typeof useSupplierQuotations>;

const EMPTY_SELECT_VALUE = '__empty__';

export function SupplierQuotationSection({ workflow }: { workflow: SupplierQuotationWorkflow }) {
  const retryLookups = () => {
    if (workflow.ingredientView.phase === 'error') workflow.ingredientView.retry();
    if (workflow.supplierView.phase === 'error') workflow.supplierView.retry();
  };
  const isLookupLoading = workflow.ingredientView.phase === 'loading' || workflow.supplierView.phase === 'loading';

  return (
    <SectionPanel title="Quản lý báo giá nhà cung cấp">
      <div className="mt-4 space-y-4">
        {workflow.isLookupForbidden ? (
          <InlineAlert title="Không có quyền xem danh mục thu mua" variant="danger">
            <span role="alert">Bạn không có quyền xem nguyên liệu hoặc nhà cung cấp phục vụ quản lý báo giá.</span>
          </InlineAlert>
        ) : workflow.isLookupError ? (
          <EmptyState
            variant="error"
            title="Không tải được danh mục nguyên liệu hoặc nhà cung cấp"
            description="Các ô chọn đang rỗng vì lỗi tải dữ liệu, không phải vì hệ thống chưa có danh mục. Hãy tải lại trước khi nhập báo giá."
            onRetry={retryLookups}
            isRetrying={workflow.ingredientView.phase === 'error' && workflow.ingredientView.isRetrying
              || workflow.supplierView.phase === 'error' && workflow.supplierView.isRetrying}
          />
        ) : isLookupLoading ? (
          <InlineAlert title="Đang tải danh mục thu mua" variant="info">
            Danh mục nguyên liệu và nhà cung cấp đang được đồng bộ.
          </InlineAlert>
        ) : null}
        <div className="grid gap-3 md:grid-cols-[minmax(220px,0.6fr)_minmax(280px,1fr)]">
          <Input
            type="search"
            aria-label="Tìm nguyên liệu"
            value={workflow.ingredientSearch}
            onChange={(event) => workflow.setIngredientSearch(event.target.value)}
          />
          <div>
            <label className="mr-2 text-sm font-medium text-slate-700" htmlFor="quotation-ingredient">Nguyên liệu:</label>
          <Select
            value={workflow.selectedIngredientId || EMPTY_SELECT_VALUE}
            onValueChange={(value) => workflow.selectIngredient(value === EMPTY_SELECT_VALUE ? '' : (value ?? ''))}
          >
            <SelectTrigger
              id="quotation-ingredient"
              className="w-full"
              aria-invalid={Boolean(workflow.validationErrors.ingredientId) || undefined}
              aria-describedby={workflow.validationErrors.ingredientId ? 'quotation-ingredient-error' : undefined}
            >
              <SelectValue>
                {workflow.ingredients.find((ingredient) => ingredient.ingredientId === workflow.selectedIngredientId)?.ingredientName
                  ?? '-- Chọn nguyên liệu --'}
              </SelectValue>
            </SelectTrigger>
            <SelectContent>
              <SelectItem value={EMPTY_SELECT_VALUE}>-- Chọn nguyên liệu --</SelectItem>
            {workflow.ingredients.map((ingredient: IngredientLookup) => (
              <SelectItem key={ingredient.ingredientId} value={ingredient.ingredientId}>{ingredient.ingredientName}</SelectItem>
            ))}
            </SelectContent>
          </Select>
          {workflow.validationErrors.ingredientId && (
            <p id="quotation-ingredient-error" className="mt-1 text-xs text-red-700">
              <span className="font-semibold">{workflow.validationErrors.ingredientId.title}</span>{' '}
              {workflow.validationErrors.ingredientId.message}
            </p>
          )}
          </div>
        </div>

        {!workflow.selectedIngredientId ? (
          <InlineAlert title="Chưa chọn nguyên liệu" variant="info">
            Chọn một nguyên liệu để xem lịch sử báo giá và nhập báo giá mới.
          </InlineAlert>
        ) : (
          <>
            {workflow.quotationView.phase === 'forbidden' ? (
              <InlineAlert title="Không có quyền xem báo giá" variant="danger">
                <span role="alert">{workflow.quotationView.message}</span>
              </InlineAlert>
            ) : workflow.quotationView.phase === 'error' ? (
              <EmptyState
                variant="error"
                title="Không tải được báo giá của nguyên liệu này"
                description="Bảng trống bên dưới là do lỗi tải dữ liệu, không phải vì nguyên liệu này chưa có báo giá. Hãy tải lại trước khi chọn nhà cung cấp hoặc nhập giá mới."
                onRetry={workflow.quotationView.retry}
                isRetrying={workflow.quotationView.isRetrying}
              />
            ) : workflow.quotationView.phase === 'loading' ? (
              <InlineAlert title="Đang tải báo giá" variant="info">Bảng báo giá đang được đồng bộ.</InlineAlert>
            ) : null}
            {workflow.quotationView.phase === 'ready' && workflow.quotationView.isRefreshing && (
              <InlineAlert title="Đang cập nhật báo giá" variant="info">
                Dữ liệu hiện tại vẫn được giữ trong khi đồng bộ bản mới.
              </InlineAlert>
            )}
            <TableViewport className="ipc-table-container" ariaLabel="Bảng báo giá theo nguyên liệu">
              <table className="ipc-data-table min-w-[760px]">
                <thead><tr><th>Nhà cung cấp</th><th className="text-right">Đơn giá (đ)</th><th>Hiệu lực từ</th><th>Hiệu lực đến</th><th>Ghi chú</th><th>Trạng thái</th><th>Thao tác</th></tr></thead>
                <tbody>
                  {workflow.rows.map((quotation) => (
                    <tr key={quotation.quotationId} className={quotation.isBestPrice ? 'bg-emerald-50' : ''}>
                      <td>{quotation.supplierName}{quotation.isBestPrice && <span className="ml-2 text-xs font-medium text-emerald-700">Tốt nhất</span>}</td>
                      <td className="text-right">{formatCurrency(quotation.unitPrice)}</td>
                      <td>{quotation.effectiveFrom}</td><td>{quotation.effectiveTo ?? '—'}</td><td>{quotation.note ?? ''}</td>
                      <td>{quotation.isActive ? <span className="text-emerald-600">Đang hoạt động</span> : <span className="text-slate-400">Đã ngừng</span>}</td>
                      <td className="space-x-2">
                        <Button type="button" variant="outline" size="xs" onClick={() => workflow.edit(quotation)}>Sửa</Button>
                        {quotation.isActive && <Button type="button" variant="destructive" size="xs" onClick={() => workflow.setDeactivateTargetId(quotation.quotationId)}>Ngừng</Button>}
                      </td>
                    </tr>
                  ))}
                  {workflow.quotationView.phase === 'ready' && workflow.rows.length === 0 && !workflow.quotationView.isRefreshing && (
                    <tr><td colSpan={7} className="py-4 text-center text-slate-500">Chưa có báo giá nào cho nguyên liệu này</td></tr>
                  )}
                </tbody>
              </table>
            </TableViewport>
            <PaginationBar page={workflow.response?.pageNumber ?? workflow.page} pageSize={workflow.response?.pageSize ?? 8} totalItems={workflow.response?.totalCount ?? 0} onPageChange={workflow.setPage} />
            <form onSubmit={workflow.submit} className="border-t border-slate-200 pt-4">
              <div className="mb-2 font-medium text-slate-700">{workflow.editingId ? 'Sửa báo giá' : 'Thêm báo giá mới'}</div>
              <div className="ipc-quotation-form-grid grid grid-cols-1 gap-3 md:grid-cols-5">
                <div>
                  <Select value={workflow.form.supplierId || EMPTY_SELECT_VALUE} onValueChange={(value) => workflow.setForm({ ...workflow.form, supplierId: value === EMPTY_SELECT_VALUE ? '' : (value ?? '') })} disabled={Boolean(workflow.editingId)}>
                    <SelectTrigger className="w-full" aria-label="Nhà cung cấp" aria-invalid={Boolean(workflow.validationErrors.supplierId) || undefined} aria-describedby={workflow.validationErrors.supplierId ? 'quotation-supplier-error' : undefined}>
                      <SelectValue>
                        {workflow.suppliers.find((supplier) => supplier.supplierId === workflow.form.supplierId)?.supplierName
                          ?? '-- Nhà cung cấp --'}
                      </SelectValue>
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value={EMPTY_SELECT_VALUE}>-- Nhà cung cấp --</SelectItem>
                      {workflow.suppliers.map((supplier) => <SelectItem key={supplier.supplierId} value={supplier.supplierId}>{supplier.supplierName}</SelectItem>)}
                    </SelectContent>
                  </Select>
                  {workflow.validationErrors.supplierId && <p id="quotation-supplier-error" className="mt-1 text-xs text-red-700"><span className="font-semibold">{workflow.validationErrors.supplierId.title}</span>{' '}{workflow.validationErrors.supplierId.message}</p>}
                </div>
                <div>
                  <Input type="number" aria-label="Đơn giá" aria-invalid={Boolean(workflow.validationErrors.unitPrice) || undefined} aria-describedby={workflow.validationErrors.unitPrice ? 'quotation-unit-price-error' : undefined} placeholder="Đơn giá" value={workflow.form.unitPrice} onChange={(event) => workflow.setForm({ ...workflow.form, unitPrice: event.target.value })} />
                  {workflow.validationErrors.unitPrice && <p id="quotation-unit-price-error" className="mt-1 text-xs text-red-700"><span className="font-semibold">{workflow.validationErrors.unitPrice.title}</span>{' '}{workflow.validationErrors.unitPrice.message}</p>}
                </div>
                <div>
                  <Input type="date" aria-label="Hiệu lực từ" aria-invalid={Boolean(workflow.validationErrors.effectiveFrom) || undefined} aria-describedby={workflow.validationErrors.effectiveFrom ? 'quotation-effective-from-error' : undefined} value={workflow.form.effectiveFrom} onChange={(event) => workflow.setForm({ ...workflow.form, effectiveFrom: event.target.value })} />
                  {workflow.validationErrors.effectiveFrom && <p id="quotation-effective-from-error" className="mt-1 text-xs text-red-700"><span className="font-semibold">{workflow.validationErrors.effectiveFrom.title}</span>{' '}{workflow.validationErrors.effectiveFrom.message}</p>}
                </div>
                <Input type="date" aria-label="Hiệu lực đến" value={workflow.form.effectiveTo} onChange={(event) => workflow.setForm({ ...workflow.form, effectiveTo: event.target.value })} />
                <Input type="text" aria-label="Ghi chú" placeholder="Ghi chú" value={workflow.form.note} onChange={(event) => workflow.setForm({ ...workflow.form, note: event.target.value })} />
              </div>
              {workflow.saveError && <div role="alert" className="mt-3"><InlineAlert title="Chưa thể lưu báo giá" variant="danger">{workflow.saveError}</InlineAlert></div>}
              <div className="mt-3 flex gap-2">
                <Button type="submit" size="sm" disabled={workflow.isCreating}>{workflow.editingId ? 'Cập nhật báo giá' : 'Thêm báo giá'}</Button>
                {workflow.editingId && <Button type="button" variant="outline" size="sm" onClick={workflow.resetForm}>Hủy</Button>}
              </div>
            </form>
          </>
        )}
        {workflow.deactivateTargetId !== null && (
          <ConfirmDialog
            open={workflow.deactivateTargetId !== null}
            title="Ngừng báo giá này?"
            description={workflow.deactivateError
              ? `Báo giá sẽ không còn được chọn cho các giao dịch mới. Chưa thể ngừng báo giá. ${workflow.deactivateError}`
              : 'Báo giá sẽ không còn được chọn cho các giao dịch mới.'}
            confirmLabel="Ngừng báo giá"
            onConfirm={workflow.confirmDeactivate}
            onOpenChange={(open) => !open && workflow.setDeactivateTargetId(null)}
          />
        )}
      </div>
    </SectionPanel>
  );
}
