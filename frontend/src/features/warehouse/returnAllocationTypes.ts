export type ReturnAllocationBalance = {
  sourceIssueLineId: string;
  materialRequestLineId: string;
  customerId: string;
  serviceDate: string;
  shiftName: string;
  priceTierAmount: number;
  ingredientId: string;
  ingredientName?: string;
  unitId: string;
  unitName?: string;
  issuedQuantity: number;
  kitchenAcknowledgedQuantity: number;
  returnedQuantity: number;
  wastedQuantity: number;
  disposedQuantity: number;
  incomingDispositionQuantity: number;
  excessQuantity: number;
  version: number;
  decisionId?: string;
  decisionReason?: string;
  allowedActions: string[];
};

export type CreateReturnAllocationDisposition = {
  decisionId: string;
  sourceIssueLineId: string;
  destinationSourceLineId: string;
  quantity: number;
  reason: string;
  commandId: string;
  expectedVersion: number;
  correlationId?: string;
  causationId?: string;
};

export type ReturnAllocationDispositionResult = {
  allocationDispositionId: string;
  sourceIssueLineId: string;
  destinationSourceLineId: string;
  quantity: number;
  reason: string;
  createdBy: string;
  createdAt: string;
  version: number;
  correlationId?: string;
  causationId?: string;
};
