import { CalendarCheck, Pencil, PlusCircle, Save } from 'lucide-react';
import { TableViewport, ContextStrip, SectionPanel, StatusBadge } from '@/components/common';
import { AdminEmptyRow as EmptyRow } from './AdminEmptyRow';
import type { AdminDataPageModel } from './useAdminDataPageModel';
import { AdminQueryBoundary } from './AdminQueryBoundary';

type AdminContractsPanelProps = { model: AdminDataPageModel };

export function AdminContractsPanel({ model }: AdminContractsPanelProps) {
  const { contractFeedback, contractForm, customerContracts, effectiveActiveView, handleSaveCustomerContract, handleSaveScheduleRules, handleUpdateScheduleVersion, isCreatingContract, isSavingContract, loadContractForm, loadScheduleRuleForm, menuSchedules, queryViews, scheduleRuleForm, selectedContract, selectedSchedule, setContractForm, setIsCreatingContract, setScheduleRuleForm, setSelectedContractCustomerId, setSelectedScheduleId, startNewContract } = model;
  return (
    <>
      {effectiveActiveView === 'contracts' && (
        <div id="admin-contracts-panel" role="tabpanel" aria-labelledby="admin-contracts-tab" className="flex flex-col gap-4">
          <AdminQueryBoundary queries={[
            { label: 'customer contract', view: queryViews.contracts },
            ...(selectedContract ? [{ label: 'lịch thực đơn', view: queryViews.menuSchedules }] : []),
          ]}>
          <SectionPanel title="Customer contract và quy tắc suất ăn" icon={<CalendarCheck size={18} />}>
            <ContextStrip
              items={[
                { label: 'Khách hàng', value: customerContracts.length.toString(), tone: 'neutral' },
                { label: 'Đang dùng', value: customerContracts.filter((item) => item.isActive).length.toString(), tone: 'success' },
                { label: 'Ca phục vụ', value: selectedContract?.shiftNames.join(', ') || '-', tone: 'info' },
                { label: 'BOM áp dụng', value: 'Theo đơn giá menu, 100%', tone: 'info' },
                { label: 'Lịch version', value: menuSchedules.length.toString(), tone: 'neutral' },
              ]}
            />

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
                <label className="text-[12px] font-bold text-slate-600" htmlFor="admin-contract-customer">
                  Khách hàng
                </label>
                <select
                  id="admin-contract-customer"
                  className="ipc-select"
                  value={isCreatingContract ? '' : selectedContract?.customerId ?? ''}
                  onChange={(event) => {
                    const contract = customerContracts.find((item) => item.customerId === event.target.value);
                    setIsCreatingContract(false);
                    setSelectedContractCustomerId(event.target.value);
                    setSelectedScheduleId('');
                    loadContractForm(contract);
                    loadScheduleRuleForm(undefined);
                  }}
                >
                  <option value="" disabled>
                    {isCreatingContract ? 'Đang tạo khách hàng mới' : 'Chọn khách hàng'}
                  </option>
                  {customerContracts.map((customer) => (
                    <option key={customer.customerId} value={customer.customerId}>
                      {customer.customerCode} - {customer.customerName}
                    </option>
                  ))}
                </select>

                <div className="grid grid-cols-2 gap-2">
                  <button className="ipc-button ipc-button-ghost justify-center" type="button" onClick={() => loadContractForm(selectedContract)}>
                    <Pencil size={15} />
                    Nạp
                  </button>
                  <button className="ipc-button ipc-button-ghost justify-center" type="button" onClick={startNewContract}>
                    <PlusCircle size={15} />
                    Tạo mới
                  </button>
                </div>

                <label className="text-[12px] font-bold text-slate-600" htmlFor="admin-contract-code">
                  Mã khách hàng
                </label>
                <input
                  id="admin-contract-code"
                  className="ipc-input"
                  value={contractForm.customerCode}
                  disabled={!isCreatingContract}
                  onChange={(event) => setContractForm((prev) => ({ ...prev, customerCode: event.target.value.toUpperCase() }))}
                  placeholder={isCreatingContract ? 'VD: DAV' : selectedContract?.customerCode ?? 'Mã khách hàng'}
                />

                <label className="text-[12px] font-bold text-slate-600" htmlFor="admin-contract-name">
                  Tên khách hàng
                </label>
                <input
                  id="admin-contract-name"
                  className="ipc-input"
                  value={contractForm.customerName}
                  onChange={(event) => setContractForm((prev) => ({ ...prev, customerName: event.target.value }))}
                  placeholder={selectedContract?.customerName ?? 'Tên khách hàng'}
                />

                <label className="text-[12px] font-bold text-slate-600" htmlFor="admin-contract-note">
                  Ghi chú contract
                </label>
                <textarea
                  id="admin-contract-note"
                  className="ipc-input min-h-[86px]"
                  value={contractForm.note}
                  onChange={(event) => setContractForm((prev) => ({ ...prev, note: event.target.value }))}
                  placeholder={selectedContract?.note ?? 'Ca phục vụ, ngày làm việc, ràng buộc menu'}
                />

                <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                  <label className="flex flex-col gap-1 text-[12px] font-bold text-slate-600" htmlFor="admin-contract-effective-from">
                    Hiệu lực từ
                    <input
                      id="admin-contract-effective-from"
                      className="ipc-input"
                      type="date"
                      value={contractForm.effectiveFrom}
                      onChange={(event) => setContractForm((prev) => ({ ...prev, effectiveFrom: event.target.value }))}
                    />
                  </label>
                  <label className="flex flex-col gap-1 text-[12px] font-bold text-slate-600" htmlFor="admin-contract-effective-to">
                    Hiệu lực đến
                    <input
                      id="admin-contract-effective-to"
                      className="ipc-input"
                      type="date"
                      value={contractForm.effectiveTo}
                      onChange={(event) => setContractForm((prev) => ({ ...prev, effectiveTo: event.target.value }))}
                    />
                  </label>
                </div>

                <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                  <label className="flex flex-col gap-1 text-[12px] font-bold text-slate-600" htmlFor="admin-contract-week-days">
                    Ngày làm việc
                    <input
                      id="admin-contract-week-days"
                      className="ipc-input"
                      value={contractForm.activeWeekDays}
                      onChange={(event) => setContractForm((prev) => ({ ...prev, activeWeekDays: event.target.value }))}
                      placeholder="t2,t3,t4,t5,t6,t7"
                    />
                  </label>
                  <label className="flex flex-col gap-1 text-[12px] font-bold text-slate-600" htmlFor="admin-contract-shifts">
                    Ca phục vụ
                    <input
                      id="admin-contract-shifts"
                      className="ipc-input"
                      value={contractForm.shiftNames}
                      onChange={(event) => setContractForm((prev) => ({ ...prev, shiftNames: event.target.value }))}
                      placeholder="MORNING,AFTERNOON"
                    />
                  </label>
                </div>

                <div className="grid grid-cols-1 gap-3">
                  <label className="flex flex-col gap-1 text-[12px] font-bold text-slate-600" htmlFor="admin-contract-default-price">
                    Đơn giá mặc định / tier BOM
                    <input
                      id="admin-contract-default-price"
                      className="ipc-input"
                      type="number"
                      min="0"
                      step="1000"
                      value={contractForm.defaultMenuPrice}
                      onChange={(event) => setContractForm((prev) => ({ ...prev, defaultMenuPrice: event.target.value }))}
                      placeholder={selectedContract?.defaultMenuPrice?.toString() ?? '25000'}
                    />
                  </label>
                </div>

                <label className="flex items-center gap-2 rounded-md border border-slate-200 bg-slate-50 px-3 py-2 text-sm text-slate-700">
                  <input
                    type="checkbox"
                    checked={contractForm.isActive}
                    onChange={(event) => setContractForm((prev) => ({ ...prev, isActive: event.target.checked }))}
                  />
                  Khách hàng đang hoạt động
                </label>

                <button className="ipc-button ipc-button-primary justify-center" type="button" disabled={isSavingContract || (!isCreatingContract && !selectedContract)} onClick={() => void handleSaveCustomerContract()}>
                  <Save size={15} />
                  {isCreatingContract ? 'Tạo contract' : 'Lưu contract'}
                </button>
              </div>

              <div className="grid gap-4">
                <TableViewport caption="Danh sách contract khách hàng" ariaLabel="Bảng contract khách hàng">
                  <table className="ipc-data-table text-sm">
                    <thead>
                      <tr>
                        <th>Khách hàng</th>
                        <th>Ngày làm việc</th>
                        <th>Ca</th>
                        <th>Hiệu lực</th>
                        <th>Đơn giá / tier</th>
                        <th>BOM áp dụng</th>
                        <th>Trạng thái</th>
                      </tr>
                    </thead>
                    <tbody>
                      {customerContracts.length === 0 ? <EmptyRow colSpan={7} /> : customerContracts.map((contract) => (
                        <tr key={contract.customerId}>
                          <td>
                            <div className="font-semibold text-slate-900">{contract.customerCode}</div>
                            <div className="text-xs text-slate-500">{contract.customerName}</div>
                          </td>
                          <td>{contract.activeWeekDays.join(', ') || '-'}</td>
                          <td>{contract.shiftNames.join(', ') || '-'}</td>
                          <td>
                            <div>{contract.effectiveFrom ?? '-'}</div>
                            <div className="text-xs text-slate-500">{contract.effectiveTo ? `đến ${contract.effectiveTo}` : contract.contractStatus}</div>
                          </td>
                          <td className="ipc-numeric-cell">{contract.defaultMenuPrice?.toLocaleString('vi-VN') ?? '-'}</td>
                          <td className="ipc-numeric-cell">100%</td>
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
                    <label className="flex flex-col gap-1 text-[12px] font-bold text-slate-600" htmlFor="admin-contract-schedule">
                      Lịch thực đơn
                      <select
                        id="admin-contract-schedule"
                        className="ipc-select"
                        value={selectedSchedule?.menuScheduleId ?? ''}
                        onChange={(event) => {
                          const schedule = menuSchedules.find((item) => item.menuScheduleId === event.target.value);
                          setSelectedScheduleId(event.target.value);
                          loadScheduleRuleForm(schedule);
                        }}
                      >
                        {menuSchedules.map((schedule) => (
                          <option key={schedule.menuScheduleId} value={schedule.menuScheduleId}>
                            {schedule.serviceDate} / {schedule.shift} / {schedule.menuName}
                          </option>
                        ))}
                      </select>
                      <span className="text-[11px] font-medium text-slate-500">
                        {selectedSchedule?.sourceImportBatch
                          ? `Batch ${selectedSchedule.sourceImportBatch} / V${selectedSchedule.menuVersionNo ?? '-'} / ${selectedSchedule.menuVersionStatus ?? selectedSchedule.status}`
                          : `Version ${selectedSchedule?.status ?? '-'}`}
                      </span>
                    </label>
                    <label className="flex flex-col gap-1 text-[12px] font-bold text-slate-600">
                      Đơn giá / tier BOM
                      <input
                        className="ipc-input"
                        inputMode="decimal"
                        type="number"
                        min="0"
                        value={scheduleRuleForm.menuPrice}
                        onChange={(event) => setScheduleRuleForm((prev) => ({ ...prev, menuPrice: event.target.value }))}
                        placeholder={selectedSchedule?.menuPrice.toString() ?? '0'}
                      />
                    </label>
                    <label className="flex flex-col gap-1 text-[12px] font-bold text-slate-600">
                      Version
                      <select
                        className="ipc-select"
                        value={scheduleRuleForm.status}
                        onChange={(event) => setScheduleRuleForm((prev) => ({ ...prev, status: event.target.value }))}
                      >
                        <option value="DRAFT">DRAFT</option>
                        <option value="ACTIVE">ACTIVE</option>
                        <option value="SUPERSEDED">SUPERSEDED</option>
                        <option value="LOCKED">LOCKED</option>
                      </select>
                    </label>
                  </div>

                  <label className="flex flex-col gap-1 text-[12px] font-bold text-slate-600">
                    Lý do
                    <input
                      className="ipc-input"
                      value={scheduleRuleForm.reason}
                      onChange={(event) => setScheduleRuleForm((prev) => ({ ...prev, reason: event.target.value }))}
                      placeholder="Cập nhật contract/version"
                    />
                  </label>

                  <div className="flex flex-wrap gap-2">
                    <button className="ipc-button ipc-button-primary" type="button" disabled={isSavingContract || !selectedSchedule} onClick={() => void handleSaveScheduleRules()}>
                      <Save size={15} />
                      Lưu quy tắc
                    </button>
                    <button className="ipc-button ipc-button-ghost" type="button" disabled={isSavingContract || !selectedSchedule} onClick={() => void handleUpdateScheduleVersion('ACTIVE')}>
                      Publish
                    </button>
                    <button className="ipc-button ipc-button-ghost" type="button" disabled={isSavingContract || !selectedSchedule} onClick={() => void handleUpdateScheduleVersion('SUPERSEDED')}>
                      Archive
                    </button>
                  </div>
                </div>
              </div>
            </div>
          </SectionPanel>
          </AdminQueryBoundary>
        </div>
      )}


    </>
  );
}
