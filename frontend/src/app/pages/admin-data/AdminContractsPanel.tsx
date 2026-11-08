import { useEffect } from 'react';
import { CalendarCheck, Pencil, PlusCircle, Save } from 'lucide-react';
import { TableViewport, KeepAliveTabPanel, SectionPanel, StatusBadge } from '@/components/common';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Checkbox } from '@/components/ui/checkbox';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Textarea } from '@/components/ui/textarea';
import { formatCurrency, formatDateOnly } from '@/lib/formatters';
import { formatMenuVersionStatus, formatShiftName } from '@/lib/workflowConfig';
import { AdminEmptyRow as EmptyRow } from './AdminEmptyRow';
import type { AdminDataPageModel } from './useAdminDataPageModel';
import { AdminQueryBoundary } from './AdminQueryBoundary';

type AdminContractsPanelProps = { model: AdminDataPageModel };

const EMPTY_CONTRACT_CUSTOMER_VALUE = '__empty_contract_customer__';
const contractWeekDays = ['t2', 't3', 't4', 't5', 't6', 't7'] as const;
const contractShifts = [['Ca sáng', 'Ca sáng'], ['Ca chiều', 'Ca chiều']] as const;
const splitValues = (value: string) => value.split(',').map((item) => item.trim()).filter(Boolean);
const toggleValue = (value: string, item: string, checked: boolean) => {
  const values = new Set(splitValues(value));
  if (checked) values.add(item); else values.delete(item);
  return [...values].join(', ');
};

export function AdminContractsPanel({ model }: AdminContractsPanelProps) {
  const { contractFeedback, contractFieldErrors = {}, contractForm, customerContracts, effectiveActiveView, handleSaveCustomerContract, handleSaveScheduleRules, handleUpdateScheduleVersion, isCreatingContract, isSavingContract, loadContractForm, loadScheduleRuleForm, menuSchedules, queryViews, scheduleRuleForm, selectedContract, selectedSchedule, setContractForm, setIsCreatingContract, setScheduleRuleForm, setSelectedContractCustomerId, setSelectedScheduleId, startNewContract } = model;
  useEffect(() => {
    document.querySelector<HTMLElement>('[data-contract-field-error="true"]')?.focus();
  }, [contractFieldErrors]);
  return (
    <>
      <KeepAliveTabPanel id="admin-contracts" active={effectiveActiveView === 'contracts'} className="flex flex-col gap-4">
        <AdminQueryBoundary queries={[
          { label: 'hợp đồng khách hàng', view: queryViews.contracts },
          ...(selectedContract ? [{ label: 'lịch thực đơn', view: queryViews.menuSchedules }] : []),
        ]}>
          <SectionPanel
            title="Hợp đồng khách hàng và quy tắc suất ăn"
            icon={<CalendarCheck size={18} />}
            description="Quản lý thông tin hợp đồng khách hàng, quy tắc suất ăn, các ca áp dụng và phiên bản lịch thực đơn."
          >

            {contractFeedback && (
              <div
                className={`mt-4 rounded-md border px-3 py-2 text-sm font-medium ${
                  contractFeedback.type === 'success'
                    ? 'border-emerald-200 bg-emerald-50 text-emerald-800'
                    : 'border-rose-200 bg-rose-50 text-rose-800'
                }`}
              >
                {contractFeedback.message}
              </div>
            )}

            <div className="mt-4 grid gap-4 xl:grid-cols-[minmax(260px,0.8fr)_minmax(0,1.6fr)]">
              <div className="grid gap-3 rounded-md border border-slate-200 bg-white p-3">
                <label className="text-label font-bold text-slate-600" htmlFor="admin-contract-customer">
                  Khách hàng
                </label>
                <Select
                  value={isCreatingContract ? EMPTY_CONTRACT_CUSTOMER_VALUE : selectedContract?.customerId ?? EMPTY_CONTRACT_CUSTOMER_VALUE}
                  onValueChange={(value) => {
                    const customerId = !value || value === EMPTY_CONTRACT_CUSTOMER_VALUE ? '' : value;
                    const contract = customerContracts.find((item) => item.customerId === customerId);
                    setIsCreatingContract(false);
                    setSelectedContractCustomerId(customerId);
                    setSelectedScheduleId('');
                    loadContractForm(contract);
                    loadScheduleRuleForm(undefined);
                  }}
                  >
                    <SelectTrigger id="admin-contract-customer" className="w-full">
                    <SelectValue>{selectedContract && !isCreatingContract ? `${selectedContract.customerCode} - ${selectedContract.customerName}` : 'Chọn khách hàng'}</SelectValue>
                    </SelectTrigger>
                  <SelectContent>
                    <SelectItem value={EMPTY_CONTRACT_CUSTOMER_VALUE} disabled>
                      {isCreatingContract ? 'Đang tạo khách hàng mới' : 'Chọn khách hàng'}
                    </SelectItem>
                    {customerContracts.map((customer) => (
                      <SelectItem key={customer.customerId} value={customer.customerId}>
                        {customer.customerCode} - {customer.customerName}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>

                <div className="grid grid-cols-2 gap-2">
                  <Button variant="outline" size="sm" type="button" onClick={() => loadContractForm(selectedContract)}>
                    <Pencil size={15} />
                    Nạp
                  </Button>
                  <Button variant="outline" size="sm" type="button" onClick={startNewContract}>
                    <PlusCircle size={15} />
                    Tạo mới
                  </Button>
                </div>

                <label className="text-label font-bold text-slate-600" htmlFor="admin-contract-code">
                  Mã khách hàng
                </label>
                <Input
                  id="admin-contract-code"
                  value={contractForm.customerCode}
                  disabled={!isCreatingContract}
                  aria-invalid={Boolean(contractFieldErrors.customerCode) || undefined}
                  aria-describedby={contractFieldErrors.customerCode ? 'admin-contract-code-error' : undefined}
                  onChange={(event) => setContractForm((prev) => ({ ...prev, customerCode: event.target.value.toUpperCase() }))}
                  placeholder={isCreatingContract ? 'VD: DAV' : selectedContract?.customerCode ?? 'Mã khách hàng'}
                />
                {contractFieldErrors.customerCode && <p id="admin-contract-code-error" tabIndex={-1} data-contract-field-error="true" className="text-xs text-red-700">{contractFieldErrors.customerCode}</p>}

                <label className="text-label font-bold text-slate-600" htmlFor="admin-contract-name">
                  Tên khách hàng
                </label>
                <Input
                  id="admin-contract-name"
                  value={contractForm.customerName}
                  aria-invalid={Boolean(contractFieldErrors.customerName) || undefined}
                  aria-describedby={contractFieldErrors.customerName ? 'admin-contract-name-error' : undefined}
                  onChange={(event) => setContractForm((prev) => ({ ...prev, customerName: event.target.value }))}
                  placeholder={selectedContract?.customerName ?? 'Tên khách hàng'}
                />
                {contractFieldErrors.customerName && <p id="admin-contract-name-error" tabIndex={-1} data-contract-field-error="true" className="text-xs text-red-700">{contractFieldErrors.customerName}</p>}

                <label className="text-label font-bold text-slate-600" htmlFor="admin-contract-note">
                  Ghi chú hợp đồng
                </label>
                <Textarea
                  id="admin-contract-note"
                  className="min-h-[86px]"
                  value={contractForm.note}
                  onChange={(event) => setContractForm((prev) => ({ ...prev, note: event.target.value }))}
                  placeholder={selectedContract?.note ?? 'Ca phục vụ, ngày làm việc, ràng buộc menu'}
                />

                <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                  <label className="flex flex-col gap-1 text-label font-bold text-slate-600" htmlFor="admin-contract-effective-from">
                    Hiệu lực từ
                    <Input
                      id="admin-contract-effective-from"
                      type="date"
                      value={contractForm.effectiveFrom}
                      onChange={(event) => setContractForm((prev) => ({ ...prev, effectiveFrom: event.target.value }))}
                    />
                  </label>
                  <label className="flex flex-col gap-1 text-label font-bold text-slate-600" htmlFor="admin-contract-effective-to">
                    Hiệu lực đến
                    <Input
                      id="admin-contract-effective-to"
                      type="date"
                      value={contractForm.effectiveTo}
                      onChange={(event) => setContractForm((prev) => ({ ...prev, effectiveTo: event.target.value }))}
                    />
                  </label>
                </div>

                <fieldset className="grid gap-2" tabIndex={contractFieldErrors.activeWeekDays ? -1 : undefined} data-contract-field-error={contractFieldErrors.activeWeekDays ? 'true' : undefined} aria-invalid={Boolean(contractFieldErrors.activeWeekDays) || undefined} aria-describedby={contractFieldErrors.activeWeekDays ? 'admin-contract-days-error' : undefined}>
                  <legend className="text-label font-bold text-slate-600">Ngày làm việc</legend>
                  <div className="flex flex-wrap gap-3">
                    {contractWeekDays.map((day) => (
                      <label key={day} className="flex items-center gap-2 text-sm text-slate-700">
                        <Checkbox
                          checked={splitValues(contractForm.activeWeekDays).includes(day)}
                          onCheckedChange={(checked) => setContractForm((prev) => ({ ...prev, activeWeekDays: toggleValue(prev.activeWeekDays, day, checked === true) }))}
                        />
                        {day.toUpperCase()}
                      </label>
                    ))}
                  </div>
                  {contractFieldErrors.activeWeekDays && <p id="admin-contract-days-error" className="text-xs text-red-700">{contractFieldErrors.activeWeekDays}</p>}
                </fieldset>
                <fieldset className="grid gap-2" tabIndex={contractFieldErrors.shiftNames ? -1 : undefined} data-contract-field-error={contractFieldErrors.shiftNames ? 'true' : undefined} aria-invalid={Boolean(contractFieldErrors.shiftNames) || undefined} aria-describedby={contractFieldErrors.shiftNames ? 'admin-contract-shifts-error' : undefined}>
                  <legend className="text-label font-bold text-slate-600">Ca phục vụ</legend>
                  <div className="flex flex-wrap gap-3">
                    {contractShifts.map(([value, label]) => (
                      <label key={value} className="flex items-center gap-2 text-sm text-slate-700">
                        <Checkbox
                          checked={splitValues(contractForm.shiftNames).includes(value)}
                          onCheckedChange={(checked) => setContractForm((prev) => ({ ...prev, shiftNames: toggleValue(prev.shiftNames, value, checked === true) }))}
                        />
                        {label}
                      </label>
                    ))}
                  </div>
                  {contractFieldErrors.shiftNames && <p id="admin-contract-shifts-error" className="text-xs text-red-700">{contractFieldErrors.shiftNames}</p>}
                </fieldset>

                <div className="grid grid-cols-1 gap-3">
                  <label className="flex flex-col gap-1 text-label font-bold text-slate-600" htmlFor="admin-contract-default-price">
                    Đơn giá mặc định / mức BOM
                    <Input
                      id="admin-contract-default-price"
                      type="number"
                      min="0"
                      step="1000"
                      value={contractForm.defaultMenuPrice}
                      aria-invalid={Boolean(contractFieldErrors.defaultMenuPrice) || undefined}
                      aria-describedby={contractFieldErrors.defaultMenuPrice ? 'admin-contract-price-error' : undefined}
                      onChange={(event) => setContractForm((prev) => ({ ...prev, defaultMenuPrice: event.target.value }))}
                      placeholder={selectedContract?.defaultMenuPrice?.toString() ?? '25000'}
                    />
                    {contractFieldErrors.defaultMenuPrice && <span id="admin-contract-price-error" tabIndex={-1} data-contract-field-error="true" className="text-xs text-red-700">{contractFieldErrors.defaultMenuPrice}</span>}
                  </label>
                </div>

                <label className="flex items-center gap-2 rounded-md border border-slate-200 bg-slate-50 px-3 py-2 text-sm text-slate-700 cursor-pointer">
                  <Checkbox
                    checked={contractForm.isActive}
                    onCheckedChange={(checked) => setContractForm((prev) => ({ ...prev, isActive: checked === true }))}
                  />
                  Khách hàng đang hoạt động
                </label>

                <Button variant="default" size="sm" type="button" disabled={isSavingContract || (!isCreatingContract && !selectedContract)} onClick={() => void handleSaveCustomerContract()}>
                  <Save size={15} />
                  {isCreatingContract ? 'Tạo hợp đồng' : 'Lưu hợp đồng'}
                </Button>
              </div>

              <div className="grid gap-4">
                <TableViewport caption="Danh sách hợp đồng khách hàng" ariaLabel="Bảng hợp đồng khách hàng">
                  <table className="ipc-data-table ipc-erp-grid-table table-fixed w-full text-sm">
                    <thead>
                      <tr>
                        <th className="text-left">Khách hàng</th>
                        <th className="text-left">Ngày làm việc</th>
                        <th className="text-left">Ca</th>
                        <th className="text-left">Hiệu lực</th>
                        <th className="text-right">Đơn giá</th>
                        <th className="text-right">BOM áp dụng</th>
                        <th className="text-center">Trạng thái</th>
                      </tr>
                    </thead>
                    <tbody>
                      {customerContracts.length === 0 ? <EmptyRow colSpan={7} /> : customerContracts.map((contract) => (
                        <tr key={contract.customerId}>
                          <td>
                            <div className="font-semibold text-slate-900">{contract.customerName}</div>
                            <div className="text-xs text-slate-500">Mã {contract.customerCode}</div>
                          </td>
                          <td>{contract.activeWeekDays.join(', ') || '—'}</td>
                          <td>{contract.shiftNames.map(formatShiftName).join(', ') || '—'}</td>
                          <td>
                            <div>{contract.effectiveFrom ? formatDateOnly(contract.effectiveFrom) : '—'}</div>
                            <div className="text-xs text-slate-500">{contract.effectiveTo ? `đến ${formatDateOnly(contract.effectiveTo)}` : 'Không giới hạn'}</div>
                          </td>
                          <td className="text-right tabular-nums font-semibold">{contract.defaultMenuPrice == null ? '—' : formatCurrency(contract.defaultMenuPrice)}</td>
                          <td className="text-right tabular-nums">100%</td>
                          <td>
                            <StatusBadge variant={contract.isActive ? 'success' : 'warning'}>
                              {contract.isActive ? 'Đang dùng' : 'Đã khóa'}
                            </StatusBadge>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </TableViewport>

                <div className="grid gap-3 rounded-md border border-slate-200 bg-white p-3">
                  <div className="grid gap-3 md:grid-cols-[minmax(0,1.4fr)_repeat(2,minmax(130px,0.5fr))]">
                    <label className="flex flex-col gap-1 text-label font-bold text-slate-600" htmlFor="admin-contract-schedule">
                      Lịch thực đơn
                      <Select
                        value={selectedSchedule?.menuScheduleId ?? ''}
                        onValueChange={(value) => {
                          const schedule = menuSchedules.find((item) => item.menuScheduleId === value);
                          setSelectedScheduleId(value ?? '');
                          loadScheduleRuleForm(schedule);
                        }}
                      >
                        <SelectTrigger id="admin-contract-schedule" className="w-full">
                          <SelectValue>{selectedSchedule ? `${selectedSchedule.serviceDate} / ${formatShiftName(selectedSchedule.shift)} / ${selectedSchedule.menuName}` : 'Chọn lịch thực đơn'}</SelectValue>
                        </SelectTrigger>
                        <SelectContent>
                          {menuSchedules.map((schedule) => (
                            <SelectItem key={schedule.menuScheduleId} value={schedule.menuScheduleId}>
                              {schedule.serviceDate} / {formatShiftName(schedule.shift)} / {schedule.menuName}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                      <span className="text-xs font-medium text-slate-500">
                        {selectedSchedule?.sourceImportBatch
                          ? `Lần nhập ${selectedSchedule.sourceImportBatch} · Phiên bản ${selectedSchedule.menuVersionNo ?? '-'} · ${formatMenuVersionStatus(selectedSchedule.menuVersionStatus ?? selectedSchedule.status)}`
                          : `Trạng thái phiên bản: ${formatMenuVersionStatus(selectedSchedule?.status)}`}
                      </span>
                    </label>
                    <label className="flex flex-col gap-1 text-label font-bold text-slate-600">
                      Đơn giá / mức BOM
                      <Input
                        inputMode="decimal"
                        type="number"
                        min="0"
                        value={scheduleRuleForm.menuPrice}
                        onChange={(event) => setScheduleRuleForm((prev) => ({ ...prev, menuPrice: event.target.value }))}
                        placeholder={selectedSchedule?.menuPrice.toString() ?? '0'}
                      />
                    </label>
                    <label className="flex flex-col gap-1 text-label font-bold text-slate-600">
                      Trạng thái phiên bản
                      <Select
                        value={scheduleRuleForm.status}
                        onValueChange={(value) => setScheduleRuleForm((prev) => ({ ...prev, status: value ?? prev.status }))}
                      >
                        <SelectTrigger className="w-full">
                        <SelectValue>{formatMenuVersionStatus(scheduleRuleForm.status)}</SelectValue>
                        </SelectTrigger>
                        <SelectContent>
                          {['DRAFT', 'ACTIVE', 'SUPERSEDED', 'LOCKED'].map((status) => <SelectItem key={status} value={status}>{formatMenuVersionStatus(status)}</SelectItem>)}
                        </SelectContent>
                      </Select>
                    </label>
                  </div>

                  <label className="flex flex-col gap-1 text-label font-bold text-slate-600">
                    Lý do
                    <Input
                      value={scheduleRuleForm.reason}
                      onChange={(event) => setScheduleRuleForm((prev) => ({ ...prev, reason: event.target.value }))}
                      placeholder="Lý do cập nhật hợp đồng hoặc phiên bản"
                    />
                  </label>

                  <div className="flex flex-wrap gap-2">
                    <Button variant="default" size="sm" type="button" disabled={isSavingContract || !selectedSchedule} onClick={() => void handleSaveScheduleRules()}>
                      <Save size={15} />
                      Lưu quy tắc
                    </Button>
                    <Button variant="outline" size="sm" type="button" disabled={isSavingContract || !selectedSchedule} onClick={() => void handleUpdateScheduleVersion('ACTIVE')}>
                      Áp dụng phiên bản
                    </Button>
                    <Button variant="outline" size="sm" type="button" disabled={isSavingContract || !selectedSchedule} onClick={() => void handleUpdateScheduleVersion('SUPERSEDED')}>
                      Lưu phiên bản cũ
                    </Button>
                  </div>
                </div>
              </div>
            </div>
          </SectionPanel>
          </AdminQueryBoundary>
        </KeepAliveTabPanel>


    </>
  );
}
