import { addCalendarDays, getBangkokToday } from '@/lib/chefServiceDate';

export type AdminView = 'bom-import' | 'contracts' | 'cleanup' | 'inventory' | 'audit' | 'statistics' | 'employees';
export type BomTemplateType = 'missing' | 'blank' | 'dish';
export type BomPanelMode = 'current' | 'preview';

export type BomFormState = {
  dishId: string;
  ingredientId: string;
  grossQtyPerServing: string;
  wasteRatePercent: string;
  bomStatus: 'PUBLISHED' | 'DRAFT';
  effectiveFrom: string;
  effectiveTo: string;
  reason: string;
};

export type ContractFormState = {
  customerCode: string;
  customerName: string;
  note: string;
  isActive: boolean;
  effectiveFrom: string;
  effectiveTo: string;
  activeWeekDays: string;
  shiftNames: string;
  defaultMenuPrice: string;
};

export type ScheduleRuleFormState = {
  menuPrice: string;
  status: string;
  reason: string;
};

export const defaultContractForm: ContractFormState = {
  customerCode: '',
  customerName: '',
  note: '',
  isActive: true,
  effectiveFrom: '',
  effectiveTo: '',
  activeWeekDays: '',
  shiftNames: '',
  defaultMenuPrice: '',
};

export const defaultScheduleRuleForm: ScheduleRuleFormState = {
  menuPrice: '',
  status: 'ACTIVE',
  reason: '',
};

export const getTodayInputValue = () => getBangkokToday();

export const getNextDayInputValue = (value: string) => addCalendarDays(value, 1);

export const createDefaultBomForm = (): BomFormState => ({
  dishId: '',
  ingredientId: '',
  grossQtyPerServing: '',
  wasteRatePercent: '0',
  bomStatus: 'PUBLISHED',
  effectiveFrom: getTodayInputValue(),
  effectiveTo: '',
  reason: '',
});

export type EmployeeFormState = {
  fullName: string;
  username: string;
  password: string;
  roleId: string;
  isActive: boolean;
};

export const defaultEmployeeForm: EmployeeFormState = {
  fullName: '',
  username: '',
  password: '',
  roleId: '',
  isActive: true,
};

export const getBomTemplateTypeLabel = (type: BomTemplateType) => {
  switch (type) {
    case 'blank':
      return 'Biểu mẫu trống';
    case 'dish':
      return 'Món đang chọn';
    default:
      return 'BOM thiếu';
  }
};

export const getMutationErrorMessage = (error: unknown, fallback: string) => {
  if (error && typeof error === 'object' && 'data' in error) {
    const data = (error as { data?: { message?: unknown } }).data;
    if (data && typeof data === 'object' && 'message' in data) {
      return String(data.message);
    }
  }

  return fallback;
};

export const isAdminView = (value: string | null): value is AdminView =>
  value === 'bom-import' ||
  value === 'contracts' ||
  value === 'cleanup' ||
  value === 'inventory' ||
  value === 'audit' ||
  value === 'statistics' ||
  value === 'employees';
