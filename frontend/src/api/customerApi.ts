import { apiClient } from './client';

export interface CustomerContractItem {
  contractId?: string | null;
  customerId: string;
  customerCode: string;
  customerName: string;
  note?: string | null;
  isActive: boolean;
  effectiveFrom?: string | null;
  effectiveTo?: string | null;
  contractStatus: string;
  menuScheduleCount: number;
  activeWeekDays: string[];
  shiftNames: string[];
  defaultMenuPrice?: number | null;
  defaultBomRatePercent?: number | null;
  latestServiceDate?: string | null;
}

export interface CreateCustomerContractPayload {
  customerCode: string;
  customerName: string;
  defaultMenuPrice?: number;
  defaultBomRatePercent?: number;
  shiftNames?: string[];
  activeWeekDays?: string[];
  effectiveFrom?: string;
  effectiveTo?: string;
  note?: string;
  isActive?: boolean;
}

export interface UpdateCustomerContractPayload {
  customerName?: string;
  note?: string;
  isActive?: boolean;
  effectiveFrom?: string;
  effectiveTo?: string;
  defaultMenuPrice?: number;
  defaultBomRatePercent?: number;
  shiftNames?: string[];
  activeWeekDays?: string[];
}

export const customerApi = {
  getCustomerContracts(): Promise<CustomerContractItem[]> {
    return apiClient<CustomerContractItem[]>('/coordination/customer-contracts');
  },

  createCustomerContract(payload: CreateCustomerContractPayload): Promise<CustomerContractItem> {
    return apiClient<CustomerContractItem>('/coordination/customers/contract', {
      method: 'POST',
      body: JSON.stringify(payload),
    });
  },

  updateCustomerContract(id: string, payload: UpdateCustomerContractPayload): Promise<CustomerContractItem> {
    return apiClient<CustomerContractItem>(`/coordination/customers/${encodeURIComponent(id)}/contract`, {
      method: 'PUT',
      body: JSON.stringify(payload),
    });
  },
};
