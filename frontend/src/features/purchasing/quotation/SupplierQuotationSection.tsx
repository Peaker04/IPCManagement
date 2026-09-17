import { ConfirmDialog, EmptyState, InlineAlert, PaginationBar, SearchField, SectionPanel, StatusBadge, TableSkeleton, TableViewport } from '@/components/common';
import type { IngredientLookup } from '@/api/dishCatalogApi';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Info } from 'lucide-react';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { formatCurrency, formatDateOnly } from '@/lib/formatters';
import type { useSupplierQuotations } from './useSupplierQuotations';

type SupplierQuotationWorkflow = ReturnType<typeof useSupplierQuotations>;

const EMPTY_SELECT_VALUE = '__empty__';

type IngredientSelectionError = { title: string; message: string };

export function QuotationIngredientSelector({
  search,
  selectedIngredientId,
  ingredients,
  error,
  onSearchChange,
  onSelectIngredient,
}: {
  search: string;
  selectedIngredientId: string;
  ingredients: IngredientLookup[];
  error?: IngredientSelectionError;
  onSearchChange: (value: string) => void;
  onSelectIngredient: (value: string) => void;
}) {
  return (
    <div data-quotation-ingredient-selector className="grid gap-3 md:grid-cols-[minmax(220px,0.6fr)_minmax(280px,1fr)]">
      <SearchField
        id="quotation-ingredient-search"
        label="Tìm nguyên liệu"
        width="full"
        value={search}
        onChange={(event) => onSearchChange(event.target.value)}
        placeholder="Nhập mã hoặc tên nguyên liệu..."
      />
      <div data-quotation-ingredient-field className="grid gap-1 text-slate-700">
        <label className="text-xs font-bold leading-4" htmlFor="quotation-ingredient">Nguyên liệu</label>
        <Select
          value={selectedIngredientId || EMPTY_SELECT_VALUE}
          onValueChange={(value) => onSelectIngredient(value === EMPTY_SELECT_VALUE ? '' : (value ?? ''))}
        >
          <SelectTrigger
            id="quotation-ingredient"
            size="lg"
            className="w-full text-slate-700"
            aria-invalid={Boolean(error) || undefined}
            aria-describedby={error ? 'quotation-ingredient-error' : undefined}
          >
            <SelectValue>
              {ingredients.find((ingredient) => ingredient.ingredientId === selectedIngredientId)?.ingredientName
                ?? 'Chọn nguyên liệu...'}
            </SelectValue>
          </SelectTrigger>
          <SelectContent>
            <SelectItem value={EMPTY_SELECT_VALUE}>Chọn nguyên liệu...</SelectItem>
            {ingredients.map((ingredient) => (
              <SelectItem key={ingredient.ingredientId} value={ingredient.ingredientId}>{ingredient.ingredientName}</SelectItem>
            ))}
          </SelectContent>
        </Select>
        {error && (
          <p id="quotation-ingredient-error" role="alert" className="text-xs font-medium text-red-700">
            <span className="font-semibold">{error.title}</span>{' '}
            {error.message}
          </p>
        )}
      </div>
    </div>
  );
}

export function SupplierQuotationSection({ workflow }: { workflow: SupplierQuotationWorkflow }) {
  const retryLookups = () => {
    if (workflow.ingredientView.phase === 'error') workflow.ingredientView.retry();
    if (workflow.supplierView.phase === 'error') workflow.supplierView.retry();
  };
  const isLookupLoading = workflow.ingredientView.phase === 'loading' || workflow.supplierView.phase === 'loading';

  return (
    <SectionPanel title="Quản lý báo giá nhà cung cấp">
      <div className="space-y-4">
        {workflow.isLookupForbidden ? (
          <InlineAlert title="Không có quyền xem danh mục thu mua" variant="danger">
            <span role="alert">Bạn không có quyền xem nguyên liệu hoặc nhà cung cấp phục vụ quản lý báo giá.</span>
          </InlineAlert>
        ) : workflow.isLookupError ? (
          <EmptyState
            variant="error"
            title="Không tải được danh mục nguyên liệu hoặc nhà cung cấp"
            description="Vui lòng tải lại trang để nạp danh mục nguyên liệu và nhà cung cấp."
            onRetry={retryLookups}
            isRetrying={workflow.ingredientView.phase === 'error' && workflow.ingredientView.isRetrying
              || workflow.supplierView.phase === 'error' && workflow.supplierView.isRetrying}
          />
        ) : isLookupLoading ? (
          <InlineAlert title="Đang tải danh mục thu mua" variant="info">
            Danh mục nguyên liệu và nhà cung cấp đang được đồng bộ.
          </InlineAlert>
        ) : null}
        <QuotationIngredientSelector
          search={workflow.ingredientSearch}
          selectedIngredientId={workflow.selectedIngredientId}
          ingredients={workflow.ingredients}
          error={workflow.validationErrors.ingredientId}
          onSearchChange={workflow.setIngredientSearch}
          onSelectIngredient={workflow.selectIngredient}
        />

        {!workflow.selectedIngredientId ? (
          <div className="flex items-start gap-3 rounded-sm border border-slate-200 bg-slate-50/70 p-3.5 text-slate-600">
            <Info className="size-4 text-slate-400 mt-0.5 shrink-0" />
            <div>
              <p className="text-xs font-semibold text-slate-700">Chưa chọn nguyên liệu</p>
              <p className="text-caption text-slate-500 mt-0.5">Chọn một nguyên liệu để xem lịch sử báo giá và nhập báo giá mới.</p>
            </div>
          </div>
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
                description="Vui lòng thử tải lại hoặc kiểm tra kết nối mạng."
                onRetry={workflow.quotationView.retry}
                isRetrying={workflow.quotationView.isRetrying}
              />
            ) : workflow.quotationView.phase === 'loading' ? (
              <div className="space-y-2">
                <InlineAlert title="Đang tải báo giá" variant="info">Bảng báo giá đang được đồng bộ.</InlineAlert>
                <TableSkeleton columns={7} rows={4} ariaLabel="Đang tải danh sách báo giá..." />
              </div>
            ) : null}
            {workflow.quotationView.phase === 'ready' && workflow.quotationView.isRefreshing && (
              <InlineAlert title="Đang cập nhật báo giá" variant="info">
                Dữ liệu hiện tại vẫn được giữ trong khi đồng bộ bản mới.
              </InlineAlert>
            )}
            <TableViewport className="ipc-table-container" ariaLabel="Bảng báo giá theo nguyên liệu" caption="Danh sách báo giá theo nguyên liệu">
              <table className="ipc-data-table ipc-erp-grid-table table-fixed w-full min-w-[760px]">
                <thead>
                  <tr>
                    <th className="text-left">Nhà cung cấp</th>
                    <th className="text-right">Đơn giá (VNĐ)</th>
                    <th className="text-center">Hiệu lực từ</th>
                    <th className="text-center">Hiệu lực đến</th>
                    <th className="text-left">Ghi chú</th>
                    <th className="text-center">Trạng thái</th>
                    <th className="text-right">Thao tác</th>
                  </tr>
                </thead>
                <tbody>
                  {workflow.rows.map((quotation) => (
                    <tr key={quotation.quotationId} className={quotation.isBestPrice ? 'bg-emerald-50/60' : ''}>
                      <td className="font-medium text-slate-900">{quotation.supplierName}{quotation.isBestPrice && <StatusBadge tone="success" className="ml-2">Tốt nhất</StatusBadge>}</td>
                      <td className="text-right tabular-nums font-semibold text-slate-900">{formatCurrency(quotation.unitPrice)}</td>
                      <td className="text-center tabular-nums text-slate-700">{formatDateOnly(quotation.effectiveFrom)}</td>
                      <td className="text-center tabular-nums text-slate-700">{quotation.effectiveTo ? formatDateOnly(quotation.effectiveTo) : '—'}</td>
                      <td className="text-slate-600">{quotation.note || '—'}</td>
                      <td className="text-center">
                        <StatusBadge tone={quotation.isActive ? 'success' : 'neutral'}>
                          {quotation.isActive ? 'Đang hoạt động' : 'Đã ngừng'}
                        </StatusBadge>
                      </td>
                      <td className="space-x-2 text-right">
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
                <label className="grid gap-1 text-sm font-medium text-slate-700">
                  Nhà cung cấp
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
                </label>
                <label className="grid gap-1 text-sm font-medium text-slate-700">
                  Đơn giá (VNĐ / đơn vị)
                  <Input type="number" aria-label="Đơn giá" className="text-slate-700 placeholder:text-slate-600" aria-invalid={Boolean(workflow.validationErrors.unitPrice) || undefined} aria-describedby={workflow.validationErrors.unitPrice ? 'quotation-unit-price-error' : undefined} value={workflow.form.unitPrice} onChange={(event) => workflow.setForm({ ...workflow.form, unitPrice: event.target.value })} />
                  {workflow.validationErrors.unitPrice && <p id="quotation-unit-price-error" className="mt-1 text-xs text-red-700"><span className="font-semibold">{workflow.validationErrors.unitPrice.title}</span>{' '}{workflow.validationErrors.unitPrice.message}</p>}
                </label>
                <label className="grid gap-1 text-sm font-medium text-slate-700">
                  Hiệu lực từ
                  <Input type="date" aria-label="Hiệu lực từ" className="text-slate-700 placeholder:text-slate-600" aria-invalid={Boolean(workflow.validationErrors.effectiveFrom) || undefined} aria-describedby={workflow.validationErrors.effectiveFrom ? 'quotation-effective-from-error' : undefined} value={workflow.form.effectiveFrom} onChange={(event) => workflow.setForm({ ...workflow.form, effectiveFrom: event.target.value })} />
                  {workflow.validationErrors.effectiveFrom && <p id="quotation-effective-from-error" className="mt-1 text-xs text-red-700"><span className="font-semibold">{workflow.validationErrors.effectiveFrom.title}</span>{' '}{workflow.validationErrors.effectiveFrom.message}</p>}
                </label>
                <label className="grid gap-1 text-sm font-medium text-slate-700">
                  Hiệu lực đến
                  <Input type="date" aria-label="Hiệu lực đến" className="text-slate-700 placeholder:text-slate-600" value={workflow.form.effectiveTo} onChange={(event) => workflow.setForm({ ...workflow.form, effectiveTo: event.target.value })} />
                </label>
                <label className="grid gap-1 text-sm font-medium text-slate-700">
                  Ghi chú
                  <Input type="text" aria-label="Ghi chú" className="text-slate-700 placeholder:text-slate-600" value={workflow.form.note} onChange={(event) => workflow.setForm({ ...workflow.form, note: event.target.value })} />
                </label>
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
              ? `Chưa thể ngừng báo giá. ${workflow.deactivateError}`
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
