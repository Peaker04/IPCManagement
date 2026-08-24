import { Download, Pencil, PlusCircle, Power, Save, Search, Upload } from 'lucide-react';
import { ConfirmDialog, FieldRow, InlineAlert, KeepAliveTabPanel, PaginationBar, PaginatedTableFrame, SectionPanel, StatusBadge, TableViewport } from '@/components/common';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Textarea } from '@/components/ui/textarea';
import { formatNumber } from '@/lib/formatters';
import type { BomFormState } from './adminDataPageTypes';
import { AdminEmptyRow as EmptyRow } from './AdminEmptyRow';
import type { AdminDataPageModel } from './useAdminDataPageModel';
import { AdminQueryBoundary } from './AdminQueryBoundary';

type AdminBomPanelProps = { model: AdminDataPageModel };

const EMPTY_BOM_SELECT_VALUE = '__empty_bom_select__';

export function AdminBomPanel({ model }: AdminBomPanelProps) {
  const { bomForm, bomFormErrors, bomImportCustomerId, bomImportEffectiveFrom, bomImportFeedback, bomImportFile, bomImportPreview, bomImportTier, bomPanelMode, bomPreviewPagination, bomSearch, bomTemplateDishId, closeDishBomLineState, closingBom, commitBomImportState, currentBomPagination, currentBomRows, customerContracts, dishCatalog, downloadBomTemplateState, editingBom, effectiveActiveView, handleCloseBomLine, handleCommitBomImport, handleDownloadBomTemplate, handlePreviewBomImport, handleSaveBomLine, ingredientCatalog, isBomDialogOpen, isDishCatalogLoading, isIngredientCatalogLoading, isSavingBom, openCreateBomDialog, openEditBomDialog, previewBomImportState, queryViews, setBomForm, setBomImportCustomerId, setBomImportEffectiveFrom, setBomImportFile, setBomImportPreview, setBomImportTier, setBomSearch, setClosingBom, setIsBomDialogOpen } = model;
  const selectedImportContract = customerContracts?.find((contract) => contract.customerId === bomImportCustomerId);
  const selectedDish = dishCatalog.find((dish) => dish.id === bomForm.dishId);
  const selectedIngredient = ingredientCatalog.find((ingredient) => ingredient.ingredientId === bomForm.ingredientId);
  return (
    <>
      <KeepAliveTabPanel id="admin-bom-import" active={effectiveActiveView === 'bom-import'} className="flex flex-col gap-4">
        <AdminQueryBoundary queries={[
          { label: 'danh mục món và BOM', view: queryViews.dishCatalog },
          { label: 'danh mục nguyên liệu', view: queryViews.ingredientCatalog },
          { label: 'hợp đồng khách hàng', view: queryViews.contracts },
        ]}>
          <SectionPanel title="Import BOM theo đơn giá" icon={<Upload size={18} />}>
            <div className="grid min-w-0 gap-4" style={{ maxWidth: 'calc(100vw - 2rem)' }}>
              <div className="grid w-full min-w-0 max-w-full self-start gap-3 rounded-md border border-slate-200 bg-slate-50 p-3">
                <FieldRow label="Đơn giá BOM">
                  <div className="grid grid-cols-1 gap-2 sm:grid-cols-3">
                    {[25000, 30000, 34000].map((tier) => (
                      <Button
                        key={tier}
                        type="button"
                        variant={bomImportTier === tier ? 'default' : 'outline'}
                        size="sm"
                        onClick={() => {
                          setBomImportTier(tier);
                          setBomImportPreview(null);
                        }}
                      >
                        {formatNumber(tier / 1000)}k
                      </Button>
                    ))}
                  </div>
                </FieldRow>

                <FieldRow label="Khách hàng">
                  <Select
                    value={bomImportCustomerId || EMPTY_BOM_SELECT_VALUE}
                    onValueChange={(value) => {
                      setBomImportCustomerId(!value || value === EMPTY_BOM_SELECT_VALUE ? '' : value);
                      setBomImportPreview(null);
                    }}
                    >
                      <SelectTrigger className="w-full">
                      <SelectValue>
                        {selectedImportContract
                          ? `${selectedImportContract.customerCode} - ${selectedImportContract.customerName}`
                          : 'BOM dùng chung'}
                      </SelectValue>
                      </SelectTrigger>
                    <SelectContent>
                      <SelectItem value={EMPTY_BOM_SELECT_VALUE}>BOM dùng chung</SelectItem>
                      {customerContracts.map((contract) => (
                        <SelectItem key={contract.customerId} value={contract.customerId}>
                          {contract.customerCode} - {contract.customerName}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </FieldRow>

                <FieldRow label="Hiệu lực từ">
                  <Input
                    className="w-full"
                    type="date"
                    value={bomImportEffectiveFrom}
                    onChange={(event) => setBomImportEffectiveFrom(event.target.value)}
                  />
                </FieldRow>

                <FieldRow label="Tải file Excel">
                  <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
                    <Button
                      variant="outline"
                      size="sm"
                      type="button"
                      disabled={Boolean(downloadBomTemplateState?.isLoading)}
                      onClick={() => void handleDownloadBomTemplate('missing')}
                    >
                      <Download size={15} />
                      BOM thiếu
                    </Button>
                    <Button
                      variant="outline"
                      size="sm"
                      type="button"
                      disabled={Boolean(downloadBomTemplateState?.isLoading)}
                      onClick={() => void handleDownloadBomTemplate('blank')}
                    >
                      <Download size={15} />
                      Mẫu trống
                    </Button>
                    {bomTemplateDishId && (
                      <Button
                        variant="outline"
                        size="sm"
                        type="button"
                        disabled={Boolean(downloadBomTemplateState?.isLoading)}
                        onClick={() => void handleDownloadBomTemplate('dish')}
                      >
                        <Download size={15} />
                        Món này
                      </Button>
                    )}
                  </div>
                </FieldRow>

                <FieldRow label="File import">
                  <div className="flex items-center gap-2">
                    <label className="inline-flex cursor-pointer items-center gap-1.5 rounded-md border border-slate-300 bg-white px-3 py-2 text-xs font-semibold text-slate-700 shadow-sm transition hover:bg-slate-50 focus-within:ring-2 focus-within:ring-blue-500">
                      <Upload size={15} className="text-slate-500" />
                      <span>{bomImportFile ? 'Đổi file Excel' : 'Chọn file Excel'}</span>
                      <input
                        className="sr-only"
                        type="file"
                        accept=".xlsx,.csv,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet,text/csv"
                        onChange={(event) => {
                          setBomImportFile(event.target.files?.[0] ?? null);
                          setBomImportPreview(null);
                        }}
                      />
                    </label>
                    <span className="min-w-0 flex-1 truncate text-xs text-slate-600">
                      {bomImportFile ? bomImportFile.name : 'Chưa chọn file (.xlsx, .csv)'}
                    </span>
                  </div>
                </FieldRow>

                <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
                  <Button
                    variant="default"
                    size="sm"
                    type="button"
                    disabled={Boolean(previewBomImportState?.isLoading || !bomImportFile)}
                    aria-describedby="bom-import-action-guidance"
                    title={previewBomImportState?.isLoading ? 'Đang kiểm tra file BOM.' : !bomImportFile ? 'Chọn file BOM trước khi kiểm tra.' : undefined}
                    onClick={() => void handlePreviewBomImport()}
                  >
                    <Search size={15} />
                    Kiểm tra file
                  </Button>
                  <Button
                    variant="default"
                    size="sm"
                    type="button"
                    disabled={Boolean(commitBomImportState?.isLoading || !bomImportPreview?.canCommit)}
                    aria-describedby="bom-import-action-guidance"
                    title={commitBomImportState?.isLoading ? 'Đang nhập dữ liệu BOM.' : !bomImportPreview ? 'Kiểm tra file trước khi nhập dữ liệu.' : !bomImportPreview.canCommit ? 'Kết quả kiểm tra còn lỗi chặn; sửa file rồi kiểm tra lại.' : undefined}
                    onClick={() => void handleCommitBomImport()}
                  >
                    <Save size={15} />
                    Nhập dữ liệu
                  </Button>
                </div>

                {bomImportFeedback && (
                  <InlineAlert title={bomImportFeedback.type === 'success' ? 'Đã nhập định lượng' : 'Cần kiểm tra'} variant={bomImportFeedback.type === 'success' ? 'info' : 'danger'}>
                    {bomImportFeedback.message}
                  </InlineAlert>
                )}

                {bomTemplateDishId && (
                  <InlineAlert title="Mẫu theo món thiếu BOM" variant="info">
                    File tải xuống ưu tiên món đang được chọn từ danh sách lỗi. Mã nguyên liệu và mã đơn vị có thể điền tên nguyên liệu, đơn vị, định lượng rồi tải lên lại.
                  </InlineAlert>
                )}

                <InlineAlert title="Cấu trúc nhập BOM mới" variant="info">
                  <span id="bom-import-action-guidance">Tải BOM thiếu để nhập nhanh các món còn thiếu định lượng. Chọn file, kiểm tra bản xem trước và xử lý hết lỗi chặn trước khi nhập dữ liệu.</span>
                </InlineAlert>
              </div>

              <div className="flex min-w-0 flex-col gap-3">
                <div className="flex flex-col gap-2 rounded-md border border-slate-200 bg-white p-2 sm:flex-row sm:items-center sm:justify-between">
                  <div className="text-xs font-semibold text-slate-600" role="status">
                    {bomPanelMode === 'preview' ? 'Đang xem kết quả kiểm tra file — nhập dữ liệu để áp dụng.' : 'BOM đang áp dụng'}
                  </div>
                  {bomPanelMode === 'current' && (
                    <div className="flex min-w-0 flex-1 gap-2 sm:max-w-xl sm:justify-end">
                      <label className="relative min-w-0 flex-1 sm:max-w-xs">
                        <span className="sr-only">Tìm món hoặc nguyên liệu</span>
                        <Search className="pointer-events-none absolute left-2.5 top-1/2 -translate-y-1/2 text-slate-400" size={15} />
                        <Input
                          className="w-full pl-9"
                          value={bomSearch}
                          onChange={(event) => setBomSearch(event.target.value)}
                          placeholder="Tìm món, nguyên liệu..."
                        />
                      </label>
                      <Button variant="default" size="sm" type="button" onClick={openCreateBomDialog}>
                        <PlusCircle size={15} />
                        Thêm dòng
                      </Button>
                    </div>
                  )}
                </div>

                <KeepAliveTabPanel id="bom-current" active={bomPanelMode === 'current'} className="min-w-0">
                  <div className="min-w-0 max-w-full" style={{ width: 'calc(100vw - 2rem)' }}>
                    <TableViewport className="h-[520px] max-h-[520px]" ariaLabel="BOM hiện tại theo đơn giá">
                      <table className="ipc-data-table ipc-bom-current-table table-fixed">
                    <colgroup>
                      <col className="w-[16%]" />
                      <col className="w-[22%]" />
                      <col className="w-[8%]" />
                      <col className="w-[12%]" />
                      <col className="w-[10%]" />
                      <col className="w-[14%]" />
                      <col className="w-[8%]" />
                      <col className="w-[10%]" />
                    </colgroup>
                    <thead>
                      <tr>
                        <th>Món</th>
                        <th>Nguyên liệu</th>
                        <th>ĐVT</th>
                        <th>Định lượng/suất</th>
                        <th>Hao hụt</th>
                        <th>Hiệu lực</th>
                        <th>Trạng thái</th>
                        <th className="whitespace-nowrap">Thao tác</th>
                      </tr>
                    </thead>
                    <tbody>
                      {(currentBomPagination?.rows ?? []).map(({ dish, line }) => (
                        <tr key={line.bomId}>
                          <td className="align-top"><div className="font-semibold text-slate-900">{dish.name}</div><div className="text-xs text-slate-500">{dish.code}</div></td>
                          <td className="align-top"><div className="font-medium text-slate-800">{line.name}</div><div className="text-xs text-slate-500">{line.ingredientCode}</div></td>
                          <td className="align-top whitespace-nowrap">{line.unit}</td>
                          <td className="align-top text-right font-semibold tabular-nums">{line.grossQtyPerServing}</td>
                          <td className="align-top text-right tabular-nums">{line.wasteRatePercent}%</td>
                          <td className="align-top"><div>{line.effectiveFrom}</div><div className="text-xs text-slate-500">{line.effectiveTo ? `đến ${line.effectiveTo}` : 'không giới hạn'}</div></td>
                          <td className="align-top"><StatusBadge variant={line.bomStatus === 'PUBLISHED' ? 'success' : 'warning'}>{line.bomStatusLabel || line.bomStatus}</StatusBadge></td>
                          <td className="align-top">
                            <div className="flex flex-wrap justify-center gap-1">
                              <Button variant="outline" size="xs" type="button" onClick={() => openEditBomDialog(dish.id, line)}>
                                <Pencil size={14} /> Sửa
                              </Button>
                              <Button variant="outline" size="xs" className="text-rose-700 hover:text-rose-800" type="button" onClick={() => setClosingBom({ dishId: dish.id, dishName: dish.name, line })}>
                                <Power size={14} /> Ngừng
                              </Button>
                            </div>
                          </td>
                        </tr>
                      ))}
                      {!isDishCatalogLoading && (!currentBomRows || currentBomRows.length === 0) && <EmptyRow colSpan={8} />}
                      {isDishCatalogLoading && (
                        <tr><td colSpan={8} className="py-8 text-center text-slate-500">Đang tải BOM hiện tại...</td></tr>
                      )}
                      </tbody>
                      </table>
                    </TableViewport>
                  </div>
                  <PaginationBar
                    page={currentBomPagination?.page ?? 1}
                    pageSize={currentBomPagination?.pageSize ?? 8}
                    totalItems={currentBomPagination?.totalItems ?? 0}
                    onPageChange={currentBomPagination?.setPage ?? (() => {})}
                  />
                </KeepAliveTabPanel>

                <KeepAliveTabPanel id="bom-preview" active={bomPanelMode === 'preview'} className="min-w-0">
                  <PaginatedTableFrame ariaLabel="Bản xem trước dữ liệu định lượng theo đơn giá">
                  <table className="ipc-data-table">
                    <thead>
                      <tr>
                        <th>Dòng</th>
                        <th>Món</th>
                        <th>Nguyên liệu</th>
                        <th>ĐVT</th>
                        <th>Định lượng/suất</th>
                        <th>Hao hụt</th>
                        <th>Thao tác</th>
                        <th>Trạng thái</th>
                      </tr>
                    </thead>
                    <tbody>
                       {(bomPreviewPagination?.rows ?? []).map((row) => (
                        <tr key={`${row.rowNumber}-${row.dishCode}-${row.ingredientCode}`}>
                          <td>{row.rowNumber}</td>
                          <td><div className="font-semibold text-slate-900">{row.dishName || row.dishCode}</div><div className="text-xs text-slate-500">{row.dishCode}</div></td>
                          <td><div className="font-semibold text-slate-900">{row.ingredientName || row.ingredientCode}</div><div className="text-xs text-slate-500">{row.ingredientCode}</div></td>
                          <td>{row.unitCode}</td>
                          <td>{row.grossQtyPerServing}</td>
                          <td>{row.wasteRatePercent}%</td>
                          <td>{row.action}</td>
                          <td><StatusBadge variant={row.status === 'error' ? 'danger' : row.status === 'warning' ? 'warning' : 'success'}>{row.errors?.[0] ?? row.warnings?.[0] ?? 'Hợp lệ'}</StatusBadge></td>
                        </tr>
                      ))}
                      {(!bomImportPreview || !bomImportPreview.rows?.length) && <EmptyRow colSpan={8} />}
                    </tbody>
                  </table>
                  </PaginatedTableFrame>
                  <PaginationBar page={bomPreviewPagination?.page ?? 1} pageSize={bomPreviewPagination?.pageSize ?? 8} totalItems={bomPreviewPagination?.totalItems ?? 0} onPageChange={bomPreviewPagination?.setPage ?? (() => {})} />
                </KeepAliveTabPanel>
              </div>
            </div>
          </SectionPanel>
          </AdminQueryBoundary>
        </KeepAliveTabPanel>

      {isBomDialogOpen && <Dialog open onOpenChange={setIsBomDialogOpen}>
        <DialogContent aria-label={editingBom ? 'Chỉnh dòng BOM' : 'Thêm dòng BOM'} className="max-w-2xl">
          <DialogHeader>
            <DialogTitle>{editingBom ? 'Chỉnh nhanh dòng BOM' : 'Thêm dòng BOM thủ công'}</DialogTitle>
            <DialogDescription>
              Mức định lượng {formatNumber(bomImportTier / 1000)}k · {bomImportCustomerId ? 'BOM theo khách hàng' : 'BOM dùng chung'}. Dòng đang áp dụng được điều chỉnh bằng phiên bản mới để giữ lịch sử.
            </DialogDescription>
          </DialogHeader>

          <AdminQueryBoundary queries={[
            { label: 'danh mục món và BOM', view: queryViews.dishCatalog },
            { label: 'danh mục nguyên liệu', view: queryViews.ingredientCatalog },
          ]}>
          <form className="mt-4 grid gap-4" onSubmit={(event) => void handleSaveBomLine(event)}>
            <div className="grid gap-3 sm:grid-cols-2">
              <label className="flex flex-col gap-1 text-sm font-semibold text-slate-700" htmlFor="manual-bom-dish">
                Món ăn <span className="text-rose-600" aria-hidden="true">*</span>
                <Select
                  value={bomForm.dishId || null}
                  disabled={Boolean(editingBom)}
                  required
                  onValueChange={(value) => setBomForm((prev) => ({
                    ...prev,
                    dishId: !value || value === EMPTY_BOM_SELECT_VALUE ? '' : value,
                  }))}
                >
                  <SelectTrigger
                    id="manual-bom-dish"
                    className="w-full"
                    aria-invalid={Boolean(bomFormErrors.dishId) || undefined}
                    aria-describedby={bomFormErrors.dishId ? 'manual-bom-dish-error' : undefined}
                  >
                    <SelectValue>{selectedDish ? `${selectedDish.code} - ${selectedDish.name}` : 'Chọn món'}</SelectValue>
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value={EMPTY_BOM_SELECT_VALUE}>Chọn món</SelectItem>
                    {dishCatalog.filter((dish) => dish.isActive).map((dish) => (
                      <SelectItem key={dish.id} value={dish.id}>{dish.code} - {dish.name}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                {bomFormErrors.dishId && <span id="manual-bom-dish-error" className="text-xs font-normal text-red-700">{bomFormErrors.dishId}</span>}
              </label>
              <label className="flex flex-col gap-1 text-sm font-semibold text-slate-700" htmlFor="manual-bom-ingredient">
                Nguyên liệu <span className="text-rose-600" aria-hidden="true">*</span>
                <Select
                  value={bomForm.ingredientId || null}
                  required
                  disabled={isIngredientCatalogLoading}
                  onValueChange={(value) => setBomForm((prev) => ({
                    ...prev,
                    ingredientId: !value || value === EMPTY_BOM_SELECT_VALUE ? '' : value,
                  }))}
                >
                  <SelectTrigger
                    id="manual-bom-ingredient"
                    className="w-full"
                    aria-invalid={Boolean(bomFormErrors.ingredientId) || undefined}
                    aria-describedby={bomFormErrors.ingredientId ? 'manual-bom-ingredient-error' : undefined}
                  >
                    <SelectValue>
                      {selectedIngredient
                        ? `${selectedIngredient.ingredientCode} - ${selectedIngredient.ingredientName} (${selectedIngredient.unitName ?? 'ĐVT'})`
                        : 'Chọn nguyên liệu'}
                    </SelectValue>
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value={EMPTY_BOM_SELECT_VALUE}>Chọn nguyên liệu</SelectItem>
                    {ingredientCatalog.map((ingredient) => (
                      <SelectItem key={ingredient.ingredientId} value={ingredient.ingredientId}>
                        {ingredient.ingredientCode} - {ingredient.ingredientName} ({ingredient.unitName ?? 'ĐVT'})
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                {bomFormErrors.ingredientId && <span id="manual-bom-ingredient-error" className="text-xs font-normal text-red-700">{bomFormErrors.ingredientId}</span>}
              </label>
            </div>

            <div className="grid gap-3 sm:grid-cols-3">
              <label className="flex flex-col gap-1 text-sm font-semibold text-slate-700" htmlFor="manual-bom-qty">
                Định lượng/suất <span className="text-rose-600" aria-hidden="true">*</span>
                <Input id="manual-bom-qty" type="number" min="0.000001" step="0.000001" required aria-invalid={Boolean(bomFormErrors.grossQtyPerServing) || undefined} aria-describedby={bomFormErrors.grossQtyPerServing ? 'manual-bom-qty-error' : undefined} value={bomForm.grossQtyPerServing} onChange={(event) => setBomForm((prev) => ({ ...prev, grossQtyPerServing: event.target.value }))} />
                {bomFormErrors.grossQtyPerServing && <span id="manual-bom-qty-error" className="text-xs font-normal text-red-700">{bomFormErrors.grossQtyPerServing}</span>}
              </label>
              <label className="flex flex-col gap-1 text-sm font-semibold text-slate-700" htmlFor="manual-bom-waste">
                Hao hụt (%)
                <Input id="manual-bom-waste" type="number" min="0" max="100" step="0.01" aria-invalid={Boolean(bomFormErrors.wasteRatePercent) || undefined} aria-describedby={bomFormErrors.wasteRatePercent ? 'manual-bom-waste-error' : undefined} value={bomForm.wasteRatePercent} onChange={(event) => setBomForm((prev) => ({ ...prev, wasteRatePercent: event.target.value }))} />
                {bomFormErrors.wasteRatePercent && <span id="manual-bom-waste-error" className="text-xs font-normal text-red-700">{bomFormErrors.wasteRatePercent}</span>}
              </label>
              <label className="flex flex-col gap-1 text-sm font-semibold text-slate-700" htmlFor="manual-bom-status">
                Trạng thái
                <Select value={bomForm.bomStatus} onValueChange={(value) => setBomForm((prev) => ({ ...prev, bomStatus: value ?? prev.bomStatus as BomFormState['bomStatus'] }))}>
                  <SelectTrigger id="manual-bom-status" className="w-full">
                    <SelectValue>{bomForm.bomStatus === 'PUBLISHED' ? 'Áp dụng' : 'Bản nháp'}</SelectValue>
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="PUBLISHED">Áp dụng</SelectItem>
                    <SelectItem value="DRAFT">Bản nháp</SelectItem>
                  </SelectContent>
                </Select>
              </label>
            </div>

            <div className="grid gap-3 sm:grid-cols-2">
              <label className="flex flex-col gap-1 text-sm font-semibold text-slate-700" htmlFor="manual-bom-from">
                Hiệu lực từ <span className="text-rose-600" aria-hidden="true">*</span>
                <Input id="manual-bom-from" type="date" required value={bomForm.effectiveFrom} onChange={(event) => setBomForm((prev) => ({ ...prev, effectiveFrom: event.target.value }))} />
              </label>
              <label className="flex flex-col gap-1 text-sm font-semibold text-slate-700" htmlFor="manual-bom-to">
                Hiệu lực đến
                <Input id="manual-bom-to" type="date" aria-invalid={Boolean(bomFormErrors.effectiveTo) || undefined} aria-describedby={bomFormErrors.effectiveTo ? 'manual-bom-to-error' : undefined} value={bomForm.effectiveTo} onChange={(event) => setBomForm((prev) => ({ ...prev, effectiveTo: event.target.value }))} />
                {bomFormErrors.effectiveTo && <span id="manual-bom-to-error" className="text-xs font-normal text-red-700">{bomFormErrors.effectiveTo}</span>}
              </label>
            </div>

            <label className="flex flex-col gap-1 text-sm font-semibold text-slate-700" htmlFor="manual-bom-reason">
              Lý do điều chỉnh {editingBom && <span className="text-rose-600">*</span>}
              <Textarea id="manual-bom-reason" className="min-h-20" maxLength={500} required={Boolean(editingBom)} aria-invalid={Boolean(bomFormErrors.reason) || undefined} aria-describedby={bomFormErrors.reason ? 'manual-bom-reason-error' : undefined} value={bomForm.reason} onChange={(event) => setBomForm((prev) => ({ ...prev, reason: event.target.value }))} placeholder={editingBom ? 'Ví dụ: cập nhật định lượng theo bảng tháng 07/2026' : 'Ghi chú nếu cần'} />
              {bomFormErrors.reason && <span id="manual-bom-reason-error" className="text-xs font-normal text-red-700">{bomFormErrors.reason}</span>}
            </label>

            {bomImportFeedback?.type === 'error' && (
              <InlineAlert title="Chưa thể lưu" variant="danger">{bomImportFeedback.message}</InlineAlert>
            )}

            <DialogFooter>
              <Button variant="outline" type="button" disabled={isSavingBom} onClick={() => setIsBomDialogOpen(false)}>Hủy</Button>
              <Button variant="default" type="submit" disabled={isSavingBom || isDishCatalogLoading || isIngredientCatalogLoading}>
                <Save size={15} /> {isSavingBom ? 'Đang lưu...' : editingBom ? 'Lưu phiên bản mới' : 'Thêm dòng BOM'}
              </Button>
            </DialogFooter>
          </form>
          </AdminQueryBoundary>
        </DialogContent>
      </Dialog>}

      {closingBom && <ConfirmDialog open
        title="Ngừng áp dụng dòng BOM?"
        description={`${closingBom.dishName} · ${closingBom.line.name}. Dữ liệu không bị xóa cứng và vẫn còn trong lịch sử/audit.`}
        confirmLabel="Ngừng áp dụng"
        busy={closeDishBomLineState.isLoading}
        onConfirm={() => void handleCloseBomLine()}
        onOpenChange={(open) => { if (!open) setClosingBom(null); }}
      />}

    </>
  );
}
