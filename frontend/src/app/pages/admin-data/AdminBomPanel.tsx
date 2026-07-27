import { Download, Pencil, PlusCircle, Power, Save, Search, Upload } from 'lucide-react';
import { ContextStrip, FieldRow, InlineAlert, PaginationBar, PaginatedTableFrame, SectionPanel, StatusBadge, DataTableShell, ViewSwitcher } from '@/components/common';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import type { BomFormState } from './adminDataPageTypes';
import { AdminEmptyRow as EmptyRow } from './AdminEmptyRow';
import type { AdminDataPageModel } from './useAdminDataPageModel';
import { AdminQueryBoundary } from './AdminQueryBoundary';

type AdminBomPanelProps = { model: AdminDataPageModel };

export function AdminBomPanel({ model }: AdminBomPanelProps) {
  const { bomForm, bomImportCustomerId, bomImportEffectiveFrom, bomImportFeedback, bomImportFile, bomImportPreview, bomImportTier, bomPanelMode, bomPreviewPagination, bomSearch, bomTemplateDishId, closeDishBomLineState, closingBom, commitBomImportState, currentBomPagination, currentBomRows, customerContracts, dishCatalog, downloadBomTemplateState, editingBom, effectiveActiveView, handleCloseBomLine, handleCommitBomImport, handleDownloadBomTemplate, handlePreviewBomImport, handleSaveBomLine, ingredientCatalog, isBomDialogOpen, isDishCatalogLoading, isIngredientCatalogLoading, isSavingBom, openCreateBomDialog, openEditBomDialog, previewBomImportState, queryViews, setBomForm, setBomImportCustomerId, setBomImportEffectiveFrom, setBomImportFile, setBomImportPreview, setBomImportTier, setBomPanelMode, setBomSearch, setClosingBom, setIsBomDialogOpen } = model;
  return (
    <>
      {effectiveActiveView === 'bom-import' && (
        <div id="admin-bom-import-panel" role="tabpanel" aria-labelledby="admin-bom-import-tab" className="flex flex-col gap-4">
          <AdminQueryBoundary queries={[
            { label: 'danh mục món và BOM', view: queryViews.dishCatalog },
            { label: 'danh mục nguyên liệu', view: queryViews.ingredientCatalog },
            { label: 'customer contract', view: queryViews.contracts },
          ]}>
          <SectionPanel title="Import BOM theo đơn giá" icon={<Upload size={18} />}>
            <div className="grid gap-4 xl:grid-cols-[minmax(280px,0.8fr)_minmax(0,1.6fr)]">
              <div className="grid self-start gap-3 rounded-md border border-slate-200 bg-slate-50 p-3">
                <FieldRow label="Đơn giá BOM">
                  <div className="grid grid-cols-3 gap-2">
                    {[25000, 30000, 34000].map((tier) => (
                      <button
                        key={tier}
                        type="button"
                        className={`ipc-button ${bomImportTier === tier ? 'ipc-button-primary' : 'ipc-button-ghost'}`}
                        onClick={() => {
                          setBomImportTier(tier);
                          setBomImportPreview(null);
                        }}
                      >
                        {(tier / 1000).toFixed(0)}k
                      </button>
                    ))}
                  </div>
                </FieldRow>

                <FieldRow label="Khách hàng">
                  <select
                    className="ipc-select w-full"
                    value={bomImportCustomerId}
                    onChange={(event) => {
                      setBomImportCustomerId(event.target.value);
                      setBomImportPreview(null);
                    }}
                  >
                    <option value="">BOM global</option>
                    {customerContracts.map((contract) => (
                      <option key={contract.customerId} value={contract.customerId}>
                        {contract.customerCode} - {contract.customerName}
                      </option>
                    ))}
                  </select>
                </FieldRow>

                <FieldRow label="Hiệu lực từ">
                  <input
                    className="ipc-input w-full"
                    type="date"
                    value={bomImportEffectiveFrom}
                    onChange={(event) => setBomImportEffectiveFrom(event.target.value)}
                  />
                </FieldRow>

                <FieldRow label="Tải file Excel">
                  <div className="grid grid-cols-2 gap-2">
                    <button
                      className="ipc-button ipc-button-ghost justify-center"
                      type="button"
                      disabled={downloadBomTemplateState.isLoading}
                      onClick={() => void handleDownloadBomTemplate('missing')}
                    >
                      <Download size={15} />
                      BOM thiếu
                    </button>
                    <button
                      className="ipc-button ipc-button-ghost justify-center"
                      type="button"
                      disabled={downloadBomTemplateState.isLoading}
                      onClick={() => void handleDownloadBomTemplate('blank')}
                    >
                      <Download size={15} />
                      Mẫu trống
                    </button>
                    {bomTemplateDishId && (
                      <button
                        className="ipc-button ipc-button-ghost justify-center"
                        type="button"
                        disabled={downloadBomTemplateState.isLoading}
                        onClick={() => void handleDownloadBomTemplate('dish')}
                      >
                        <Download size={15} />
                        Món này
                      </button>
                    )}
                  </div>
                </FieldRow>

                <FieldRow label="File import">
                  <input
                    className="ipc-input w-full"
                    type="file"
                    accept=".xlsx,.csv,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet,text/csv"
                    onChange={(event) => {
                      setBomImportFile(event.target.files?.[0] ?? null);
                      setBomImportPreview(null);
                    }}
                  />
                </FieldRow>

                <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
                  <button
                    className="ipc-button ipc-button-primary"
                    type="button"
                    disabled={previewBomImportState.isLoading || !bomImportFile}
                    aria-describedby="bom-import-action-guidance"
                    title={previewBomImportState.isLoading ? 'Đang kiểm tra file BOM.' : !bomImportFile ? 'Chọn file BOM trước khi kiểm tra.' : undefined}
                    onClick={() => void handlePreviewBomImport()}
                  >
                    <Search size={15} />
                    Kiểm tra file
                  </button>
                  <button
                    className="ipc-button ipc-button-primary"
                    type="button"
                    disabled={commitBomImportState.isLoading || !bomImportPreview?.canCommit}
                    aria-describedby="bom-import-action-guidance"
                    title={commitBomImportState.isLoading ? 'Đang nhập dữ liệu BOM.' : !bomImportPreview ? 'Kiểm tra file trước khi nhập dữ liệu.' : !bomImportPreview.canCommit ? 'Preview còn lỗi chặn; sửa file rồi kiểm tra lại.' : undefined}
                    onClick={() => void handleCommitBomImport()}
                  >
                    <Save size={15} />
                    Nhập dữ liệu
                  </button>
                </div>

                {bomImportFeedback && (
                  <InlineAlert title={bomImportFeedback.type === 'success' ? 'BOM import' : 'Cần kiểm tra'} variant={bomImportFeedback.type === 'success' ? 'info' : 'danger'}>
                    {bomImportFeedback.message}
                  </InlineAlert>
                )}

                {bomTemplateDishId && (
                  <InlineAlert title="Mẫu theo món thiếu BOM" variant="info">
                    File tải xuống ưu tiên món đang được chọn từ danh sách lỗi. IngredientCode không cần nhập; chỉ điền IngredientName, UnitCode, định lượng và import lại.
                  </InlineAlert>
                )}

                <InlineAlert title="Cấu trúc nhập BOM mới" variant="info">
                  <span id="bom-import-action-guidance">Tải BOM thiếu để nhập nhanh các món còn thiếu định lượng. Chọn file, kiểm tra preview và xử lý hết lỗi chặn trước khi nhập dữ liệu.</span>
                </InlineAlert>
              </div>

              <div className="flex flex-col gap-3">
                <ContextStrip
                  items={[
                    { label: 'Tier', value: `${(bomImportTier / 1000).toFixed(0)}k`, tone: 'info' },
                    { label: 'Scope', value: bomImportCustomerId ? 'Customer override' : 'Global', tone: bomImportCustomerId ? 'warning' : 'neutral' },
                    { label: 'BOM hiện tại', value: `${currentBomRows.length} dòng`, tone: currentBomRows.length ? 'success' : 'neutral' },
                    { label: 'Kết quả kiểm tra', value: bomImportPreview ? `${bomImportPreview.validRows}/${bomImportPreview.totalRows} hợp lệ` : 'Chưa kiểm tra', tone: bomImportPreview?.errorRows ? 'danger' : bomImportPreview ? 'success' : 'neutral' },
                  ]}
                />

                <div className="flex flex-col gap-2 rounded-md border border-slate-200 bg-white p-2 sm:flex-row sm:items-center sm:justify-between">
                  <ViewSwitcher
                    compact
                    ariaLabel="Chọn dữ liệu BOM hiển thị"
                    tabs={[
                      { id: 'bom-current', label: 'BOM hiện tại' },
                      { id: 'bom-preview', label: 'Bản xem trước' },
                    ]}
                    activeTab={`bom-${bomPanelMode}`}
                    onTabChange={(id) => setBomPanelMode(id === 'bom-preview' ? 'preview' : 'current')}
                  />
                  {bomPanelMode === 'current' && (
                    <div className="flex min-w-0 flex-1 gap-2 sm:max-w-xl sm:justify-end">
                      <label className="relative min-w-0 flex-1 sm:max-w-xs">
                        <span className="sr-only">Tìm món hoặc nguyên liệu</span>
                        <Search className="pointer-events-none absolute left-2.5 top-1/2 -translate-y-1/2 text-slate-400" size={15} />
                        <input
                          className="ipc-input w-full !pl-9"
                          value={bomSearch}
                          onChange={(event) => setBomSearch(event.target.value)}
                          placeholder="Tìm món, nguyên liệu..."
                        />
                      </label>
                      <button className="ipc-button ipc-button-primary shrink-0" type="button" onClick={openCreateBomDialog}>
                        <PlusCircle size={15} />
                        Thêm dòng
                      </button>
                    </div>
                  )}
                </div>

                {bomPanelMode === 'current' ? (
                  <div id="bom-current-panel" role="tabpanel" aria-labelledby="bom-current-tab" className="min-w-0">
                    <DataTableShell className="h-[520px] max-h-[520px]" ariaLabel="BOM hiện tại theo đơn giá">
                      <table className="ipc-data-table min-w-[1038px] table-fixed">
                      <colgroup>
                        <col className="w-[215px]" />
                        <col className="w-[190px]" />
                        <col className="w-[80px]" />
                        <col className="w-[85px]" />
                        <col className="w-[70px]" />
                        <col className="w-[115px]" />
                        <col className="w-[115px]" />
                        <col className="w-[168px]" />
                      </colgroup>
                      <thead>
                        <tr>
                          <th>Món</th>
                          <th>Nguyên liệu</th>
                          <th>ĐVT</th>
                          <th>Qty/suất</th>
                          <th>Hao hụt</th>
                          <th>Hiệu lực</th>
                          <th>Trạng thái</th>
                          <th className="whitespace-nowrap">Thao tác</th>
                        </tr>
                      </thead>
                      <tbody>
                        {currentBomPagination.rows.map(({ dish, line }) => (
                          <tr key={line.bomId}>
                            <td>
                              <div className="font-semibold text-slate-900">{dish.name}</div>
                              <div className="text-xs text-slate-500">{dish.code}</div>
                            </td>
                            <td>
                              <div className="font-semibold text-slate-900">{line.name}</div>
                              <div className="text-xs text-slate-500">{line.ingredientCode}</div>
                            </td>
                            <td>{line.unit}</td>
                            <td className="ipc-numeric-cell">{line.grossQtyPerServing}</td>
                            <td className="ipc-numeric-cell">{line.wasteRatePercent}%</td>
                            <td>
                              <div>{line.effectiveFrom}</div>
                              <div className="text-xs text-slate-500">{line.effectiveTo ? `đến ${line.effectiveTo}` : 'không giới hạn'}</div>
                            </td>
                            <td>
                              <StatusBadge variant={line.bomStatus === 'PUBLISHED' ? 'success' : 'warning'}>
                                {line.bomStatusLabel || line.bomStatus}
                              </StatusBadge>
                            </td>
                            <td className="whitespace-nowrap">
                              <div className="flex flex-nowrap justify-center gap-1">
                                <button className="ipc-button ipc-button-ghost shrink-0 whitespace-nowrap" type="button" onClick={() => openEditBomDialog(dish.id, line)}>
                                  <Pencil size={14} /> Sửa
                                </button>
                                <button className="ipc-button ipc-button-ghost shrink-0 whitespace-nowrap text-rose-700" type="button" onClick={() => setClosingBom({ dishId: dish.id, dishName: dish.name, line })}>
                                  <Power size={14} /> Ngừng
                                </button>
                              </div>
                            </td>
                          </tr>
                        ))}
                        {!isDishCatalogLoading && currentBomRows.length === 0 && <EmptyRow colSpan={8} />}
                        {isDishCatalogLoading && (
                          <tr><td colSpan={8} className="py-8 text-center text-slate-500">Đang tải BOM hiện tại...</td></tr>
                        )}
                      </tbody>
                      </table>
                    </DataTableShell>
                    <PaginationBar
                      page={currentBomPagination.page}
                      pageSize={currentBomPagination.pageSize}
                      totalItems={currentBomPagination.totalItems}
                      onPageChange={currentBomPagination.setPage}
                    />
                  </div>
                ) : (
                  <div id="bom-preview-panel" role="tabpanel" aria-labelledby="bom-preview-tab" className="min-w-0">
                    <PaginatedTableFrame ariaLabel="Bản xem trước dữ liệu định lượng theo đơn giá">
                    <table className="ipc-data-table">
                      <thead>
                        <tr>
                          <th>Dòng</th>
                          <th>Món</th>
                          <th>Nguyên liệu</th>
                          <th>ĐVT</th>
                          <th>Qty/suất</th>
                          <th>Hao hụt</th>
                          <th>Action</th>
                          <th>Trạng thái</th>
                        </tr>
                      </thead>
                      <tbody>
                         {bomPreviewPagination.rows.map((row) => (
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
                    <PaginationBar page={bomPreviewPagination.page} pageSize={bomPreviewPagination.pageSize} totalItems={bomPreviewPagination.totalItems} onPageChange={bomPreviewPagination.setPage} />
                  </div>
                )}
              </div>
            </div>
          </SectionPanel>
          </AdminQueryBoundary>
        </div>
      )}

      {isBomDialogOpen && <Dialog open onOpenChange={setIsBomDialogOpen}>
        <DialogContent aria-label={editingBom ? 'Chỉnh dòng BOM' : 'Thêm dòng BOM'} className="max-w-2xl">
          <DialogHeader>
            <DialogTitle>{editingBom ? 'Chỉnh nhanh dòng BOM' : 'Thêm dòng BOM thủ công'}</DialogTitle>
            <DialogDescription>
              Tier {(bomImportTier / 1000).toFixed(0)}k · {bomImportCustomerId ? 'BOM theo khách hàng' : 'BOM global'}. Dòng published được điều chỉnh bằng version mới để giữ lịch sử.
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
                <select
                  id="manual-bom-dish"
                  className="ipc-select"
                  value={bomForm.dishId}
                  disabled={Boolean(editingBom)}
                  required
                  onChange={(event) => setBomForm((prev) => ({ ...prev, dishId: event.target.value }))}
                >
                  <option value="">Chọn món</option>
                  {dishCatalog.filter((dish) => dish.isActive).map((dish) => (
                    <option key={dish.id} value={dish.id}>{dish.code} - {dish.name}</option>
                  ))}
                </select>
              </label>
              <label className="flex flex-col gap-1 text-sm font-semibold text-slate-700" htmlFor="manual-bom-ingredient">
                Nguyên liệu <span className="text-rose-600" aria-hidden="true">*</span>
                <select
                  id="manual-bom-ingredient"
                  className="ipc-select"
                  value={bomForm.ingredientId}
                  required
                  disabled={isIngredientCatalogLoading}
                  onChange={(event) => setBomForm((prev) => ({ ...prev, ingredientId: event.target.value }))}
                >
                  <option value="">Chọn nguyên liệu</option>
                  {ingredientCatalog.map((ingredient) => (
                    <option key={ingredient.ingredientId} value={ingredient.ingredientId}>
                      {ingredient.ingredientCode} - {ingredient.ingredientName} ({ingredient.unitName ?? 'ĐVT'})
                    </option>
                  ))}
                </select>
              </label>
            </div>

            <div className="grid gap-3 sm:grid-cols-3">
              <label className="flex flex-col gap-1 text-sm font-semibold text-slate-700" htmlFor="manual-bom-qty">
                Qty/suất <span className="text-rose-600" aria-hidden="true">*</span>
                <input id="manual-bom-qty" className="ipc-input" type="number" min="0.000001" step="0.000001" required value={bomForm.grossQtyPerServing} onChange={(event) => setBomForm((prev) => ({ ...prev, grossQtyPerServing: event.target.value }))} />
              </label>
              <label className="flex flex-col gap-1 text-sm font-semibold text-slate-700" htmlFor="manual-bom-waste">
                Hao hụt (%)
                <input id="manual-bom-waste" className="ipc-input" type="number" min="0" max="100" step="0.01" value={bomForm.wasteRatePercent} onChange={(event) => setBomForm((prev) => ({ ...prev, wasteRatePercent: event.target.value }))} />
              </label>
              <label className="flex flex-col gap-1 text-sm font-semibold text-slate-700" htmlFor="manual-bom-status">
                Trạng thái
                <select id="manual-bom-status" className="ipc-select" value={bomForm.bomStatus} onChange={(event) => setBomForm((prev) => ({ ...prev, bomStatus: event.target.value as BomFormState['bomStatus'] }))}>
                  <option value="PUBLISHED">Áp dụng</option>
                  <option value="DRAFT">Bản nháp</option>
                </select>
              </label>
            </div>

            <div className="grid gap-3 sm:grid-cols-2">
              <label className="flex flex-col gap-1 text-sm font-semibold text-slate-700" htmlFor="manual-bom-from">
                Hiệu lực từ <span className="text-rose-600" aria-hidden="true">*</span>
                <input id="manual-bom-from" className="ipc-input" type="date" required value={bomForm.effectiveFrom} onChange={(event) => setBomForm((prev) => ({ ...prev, effectiveFrom: event.target.value }))} />
              </label>
              <label className="flex flex-col gap-1 text-sm font-semibold text-slate-700" htmlFor="manual-bom-to">
                Hiệu lực đến
                <input id="manual-bom-to" className="ipc-input" type="date" value={bomForm.effectiveTo} onChange={(event) => setBomForm((prev) => ({ ...prev, effectiveTo: event.target.value }))} />
              </label>
            </div>

            <label className="flex flex-col gap-1 text-sm font-semibold text-slate-700" htmlFor="manual-bom-reason">
              Lý do điều chỉnh {editingBom && <span className="text-rose-600">*</span>}
              <textarea id="manual-bom-reason" className="ipc-input min-h-20 py-2" maxLength={500} required={Boolean(editingBom)} value={bomForm.reason} onChange={(event) => setBomForm((prev) => ({ ...prev, reason: event.target.value }))} placeholder={editingBom ? 'Ví dụ: cập nhật định lượng theo bảng tháng 07/2026' : 'Ghi chú nếu cần'} />
            </label>

            {bomImportFeedback?.type === 'error' && (
              <InlineAlert title="Chưa thể lưu" variant="danger">{bomImportFeedback.message}</InlineAlert>
            )}

            <DialogFooter>
              <button className="ipc-button ipc-button-ghost" type="button" disabled={isSavingBom} onClick={() => setIsBomDialogOpen(false)}>Hủy</button>
              <button className="ipc-button ipc-button-primary" type="submit" disabled={isSavingBom || isDishCatalogLoading || isIngredientCatalogLoading}>
                <Save size={15} /> {isSavingBom ? 'Đang lưu...' : editingBom ? 'Lưu version mới' : 'Thêm dòng BOM'}
              </button>
            </DialogFooter>
          </form>
          </AdminQueryBoundary>
        </DialogContent>
      </Dialog>}

      {closingBom && <Dialog open onOpenChange={(open) => { if (!open) setClosingBom(null); }}>
        <DialogContent aria-label="Ngừng áp dụng dòng BOM" className="max-w-md">
          <DialogHeader>
            <DialogTitle>Ngừng áp dụng dòng BOM?</DialogTitle>
            <DialogDescription>
              {closingBom ? `${closingBom.dishName} · ${closingBom.line.name}` : ''}. Dữ liệu không bị xóa cứng và vẫn còn trong lịch sử/audit.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter className="mt-5">
            <button className="ipc-button ipc-button-ghost" type="button" disabled={closeDishBomLineState.isLoading} onClick={() => setClosingBom(null)}>Hủy</button>
            <button className="ipc-button ipc-button-primary bg-rose-700 hover:bg-rose-800" type="button" disabled={closeDishBomLineState.isLoading} onClick={() => void handleCloseBomLine()}>
              <Power size={15} /> {closeDishBomLineState.isLoading ? 'Đang xử lý...' : 'Ngừng áp dụng'}
            </button>
          </DialogFooter>
        </DialogContent>
      </Dialog>}

    </>
  );
}
