import { useMemo, useState } from 'react';
import {
  useCreateCustomerContractMutation,
  useGetCustomerContractsQuery,
  useGetMenuSchedulesQuery,
  useUpdateCustomerContractMutation,
  useUpdateMenuScheduleRulesMutation,
  useUpdateMenuScheduleVersionMutation,
} from '@/api/coordinationApi';
import type {
  ApiShiftName,
  CreateCustomerContractRequest,
  CustomerContractDto,
  MenuScheduleDto,
  UpdateCustomerContractRequest,
  UpdateMenuScheduleRulesRequest,
  UpdateMenuScheduleVersionRequest,
} from '@/types/coordination';
import {
  defaultContractForm,
  defaultScheduleRuleForm,
  getMutationErrorMessage,
  type AdminView,
  type ContractFormState,
  type ScheduleRuleFormState,
} from './adminDataPageTypes';
import { EMPTY_ADMIN_LIST, toAdminView } from './adminDataPageModelShared';
import { formatMenuVersionStatus } from '@/lib/workflowConfig';

const toApiShiftName = (value: string): ApiShiftName | null => {
  const normalized = value.trim().toLocaleUpperCase('vi-VN');
  if (['MORNING', 'CA SÁNG', 'CA SANG'].includes(normalized)) return 'MORNING';
  if (['AFTERNOON', 'CA CHIỀU', 'CA CHIEU'].includes(normalized)) return 'AFTERNOON';
  return null;
};

const formatContractShiftInput = (shift: string) => shift === 'MORNING' ? 'Ca sáng' : shift === 'AFTERNOON' ? 'Ca chiều' : shift;

export function useAdminContractsPanelModel(activeView: AdminView) {
  const [selectedContractCustomerId, setSelectedContractCustomerId] = useState('');
  const [isCreatingContract, setIsCreatingContract] = useState(false);
  const [selectedScheduleId, setSelectedScheduleId] = useState('');
  const [contractForm, setContractForm] = useState<ContractFormState>(defaultContractForm);
  const [scheduleRuleForm, setScheduleRuleForm] = useState<ScheduleRuleFormState>(defaultScheduleRuleForm);
  const [contractFeedback, setContractFeedback] = useState<{ type: 'success' | 'error'; message: string } | null>(null);
  const customerContractsQuery = useGetCustomerContractsQuery(undefined, {
    skip: activeView !== 'contracts' && activeView !== 'bom-import',
  });
  const customerContractsView = toAdminView(customerContractsQuery, 'hợp đồng khách hàng');
  const customerContracts = customerContractsView.phase === 'ready'
    ? customerContractsView.data.data ?? EMPTY_ADMIN_LIST
    : EMPTY_ADMIN_LIST;
  const selectedContract = useMemo(
    () => customerContracts.find((customer) => customer.customerId === selectedContractCustomerId) ?? customerContracts[0],
    [customerContracts, selectedContractCustomerId],
  );
  const menuSchedulesQuery = useGetMenuSchedulesQuery(
    { customerId: selectedContract?.customerId, serviceDate: selectedContract?.latestServiceDate ?? undefined },
    { skip: activeView !== 'contracts' || !selectedContract?.customerId },
  );
  const menuSchedulesView = toAdminView(menuSchedulesQuery, 'lịch thực đơn');
  const menuSchedules = menuSchedulesView.phase === 'ready'
    ? menuSchedulesView.data.data ?? EMPTY_ADMIN_LIST
    : EMPTY_ADMIN_LIST;
  const selectedSchedule = useMemo(
    () => menuSchedules.find((schedule) => schedule.menuScheduleId === selectedScheduleId) ?? menuSchedules[0],
    [menuSchedules, selectedScheduleId],
  );
  const [createCustomerContract, createCustomerContractState] = useCreateCustomerContractMutation();
  const [updateCustomerContract, updateCustomerContractState] = useUpdateCustomerContractMutation();
  const [updateMenuScheduleRules, updateMenuScheduleRulesState] = useUpdateMenuScheduleRulesMutation();
  const [updateMenuScheduleVersion, updateMenuScheduleVersionState] = useUpdateMenuScheduleVersionMutation();
  const isSavingContract = createCustomerContractState.isLoading
    || updateCustomerContractState.isLoading
    || updateMenuScheduleRulesState.isLoading
    || updateMenuScheduleVersionState.isLoading;

  const loadContractForm = (contract: CustomerContractDto | undefined) => {
    setIsCreatingContract(false);
    setContractForm(contract ? {
      customerCode: contract.customerCode,
      customerName: contract.customerName,
      note: contract.note ?? '',
      isActive: contract.isActive,
      effectiveFrom: contract.effectiveFrom ?? '',
      effectiveTo: contract.effectiveTo ?? '',
      activeWeekDays: contract.activeWeekDays.join(','),
      shiftNames: contract.shiftNames.map(formatContractShiftInput).join(', '),
      defaultMenuPrice: contract.defaultMenuPrice != null ? String(contract.defaultMenuPrice) : '',
    } : defaultContractForm);
    setContractFeedback(null);
  };

  const loadScheduleRuleForm = (schedule: MenuScheduleDto | undefined) => {
    setScheduleRuleForm(schedule ? {
      menuPrice: String(schedule.menuPrice),
      status: schedule.status,
      reason: '',
    } : defaultScheduleRuleForm);
    setContractFeedback(null);
  };

  const startNewContract = () => {
    setIsCreatingContract(true);
    setSelectedContractCustomerId('');
    setSelectedScheduleId('');
    setContractForm({
      ...defaultContractForm,
      isActive: true,
      activeWeekDays: 't2,t3,t4,t5,t6,t7',
      shiftNames: 'Ca sáng, Ca chiều',
      defaultMenuPrice: '25000',
    });
    loadScheduleRuleForm(undefined);
    setContractFeedback(null);
  };

  const handleSaveCustomerContract = async () => {
    if (!isCreatingContract && !selectedContract) {
      setContractFeedback({ type: 'error', message: 'Chưa chọn khách hàng.' });
      return;
    }

    const nextCustomerCode = contractForm.customerCode.trim().toUpperCase();
    const nextCustomerName = contractForm.customerName.trim() || selectedContract?.customerName;
    const nextNote = contractForm.customerName || contractForm.note
      ? contractForm.note.trim()
      : selectedContract?.note ?? '';
    const nextIsActive = contractForm.customerName || contractForm.note || selectedContractCustomerId
      ? contractForm.isActive
      : selectedContract?.isActive ?? true;

    if (isCreatingContract && !nextCustomerCode) {
      setContractFeedback({ type: 'error', message: 'Mã khách hàng không được trống.' });
      return;
    }
    if (!nextCustomerName) {
      setContractFeedback({ type: 'error', message: 'Tên khách hàng không được trống.' });
      return;
    }

    const defaultMenuPrice = contractForm.defaultMenuPrice.trim()
      ? Number(contractForm.defaultMenuPrice)
      : undefined;
    if (defaultMenuPrice != null && (!Number.isFinite(defaultMenuPrice) || defaultMenuPrice < 0)) {
      setContractFeedback({ type: 'error', message: 'Đơn giá mặc định không hợp lệ.' });
      return;
    }

    const activeWeekDays = contractForm.activeWeekDays.split(',').map((value) => value.trim()).filter(Boolean);
    const rawShiftNames = contractForm.shiftNames
      .split(',')
      .map((value) => value.trim())
      .filter(Boolean);
    const shiftNames = rawShiftNames.map(toApiShiftName);
    if (activeWeekDays.length === 0) {
      setContractFeedback({ type: 'error', message: 'Ngày làm việc trong hợp đồng không được trống.' });
      return;
    }
    if (shiftNames.length === 0 || shiftNames.some((shift) => !shift)) {
      setContractFeedback({ type: 'error', message: 'Ca phục vụ không được trống hoặc không đúng định dạng.' });
      return;
    }

    const body: UpdateCustomerContractRequest = {
      customerName: nextCustomerName,
      note: nextNote || null,
      isActive: nextIsActive,
      effectiveFrom: contractForm.effectiveFrom || undefined,
      effectiveTo: contractForm.effectiveTo || undefined,
      activeWeekDays,
      shiftNames: shiftNames as ApiShiftName[],
      defaultMenuPrice,
      defaultBomRatePercent: 100,
    };

    try {
      if (isCreatingContract) {
        const createBody: CreateCustomerContractRequest = { customerCode: nextCustomerCode, ...body, customerName: nextCustomerName };
        const response = await createCustomerContract(createBody).unwrap();
        if (!response.data) throw new Error('Không nhận được hợp đồng vừa tạo.');

        setSelectedContractCustomerId(response.data.customerId);
        setIsCreatingContract(false);
        loadContractForm(response.data);
        setContractFeedback({ type: 'success', message: 'Đã tạo khách hàng và hợp đồng.' });
        return;
      }

      await updateCustomerContract({ customerId: selectedContract!.customerId, body }).unwrap();
      setContractFeedback({ type: 'success', message: 'Đã lưu hợp đồng khách hàng.' });
    } catch (error) {
      setContractFeedback({ type: 'error', message: getMutationErrorMessage(error, 'Chưa lưu được hợp đồng khách hàng.') });
    }
  };

  const handleSaveScheduleRules = async () => {
    if (!selectedSchedule) {
      setContractFeedback({ type: 'error', message: 'Chưa chọn lịch thực đơn/ca phục vụ.' });
      return;
    }

    const menuPrice = Number(scheduleRuleForm.menuPrice || selectedSchedule.menuPrice);
    if (!Number.isFinite(menuPrice) || menuPrice < 0) {
      setContractFeedback({ type: 'error', message: 'Đơn giá menu không hợp lệ.' });
      return;
    }
    const body: UpdateMenuScheduleRulesRequest = {
      menuPrice,
      bomRatePercent: 100,
      status: scheduleRuleForm.status,
      reason: scheduleRuleForm.reason.trim() || undefined,
    };

    try {
      await updateMenuScheduleRules({ menuScheduleId: selectedSchedule.menuScheduleId, body }).unwrap();
      setContractFeedback({ type: 'success', message: 'Đã lưu quy tắc suất ăn cho ca/ngày.' });
    } catch (error) {
      setContractFeedback({ type: 'error', message: getMutationErrorMessage(error, 'Chưa lưu được quy tắc suất ăn.') });
    }
  };

  const handleUpdateScheduleVersion = async (status: string) => {
    if (!selectedSchedule) {
      setContractFeedback({ type: 'error', message: 'Chưa chọn lịch thực đơn để cập nhật version.' });
      return;
    }
    const body: UpdateMenuScheduleVersionRequest = {
      status,
      reason: scheduleRuleForm.reason.trim() || undefined,
    };

    try {
      await updateMenuScheduleVersion({ menuScheduleId: selectedSchedule.menuScheduleId, body }).unwrap();
      setScheduleRuleForm((prev) => ({ ...prev, status }));
      setContractFeedback({ type: 'success', message: `Đã chuyển trạng thái phiên bản thực đơn thành ${formatMenuVersionStatus(status)}.` });
    } catch (error) {
      setContractFeedback({ type: 'error', message: getMutationErrorMessage(error, 'Chưa cập nhật được version thực đơn.') });
    }
  };

  return {
    queryViews: { contracts: customerContractsView, menuSchedules: menuSchedulesView },
    contractFeedback,
    contractForm,
    customerContracts,
    handleSaveCustomerContract,
    handleSaveScheduleRules,
    handleUpdateScheduleVersion,
    isCreatingContract,
    isSavingContract,
    loadContractForm,
    loadScheduleRuleForm,
    menuSchedules,
    scheduleRuleForm,
    selectedContract,
    selectedSchedule,
    setContractForm,
    setIsCreatingContract,
    setScheduleRuleForm,
    setSelectedContractCustomerId,
    setSelectedScheduleId,
    startNewContract,
  };
}
