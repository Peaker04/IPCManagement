import { describe, expect, it } from 'vitest';

import {
  workflowAuditSourceTags,
  workflowCacheTags,
  workflowOperationalKpiSourceTags,
  workflowOverviewCacheTags,
} from '@/api/workflowCacheTags';

const tag = (id: string) => ({ type: 'WorkflowReports', id });

describe('workflow cache contract', () => {
  it('keeps the canonical tag registry stable', () => {
    expect(workflowCacheTags).toEqual({
      documents: tag('Documents'),
      ingredientDemand: tag('IngredientDemand'),
      materialRequestCandidates: tag('MaterialRequestCandidates'),
      purchasePlan: tag('PurchasePlan'),
      productionPlans: tag('ProductionPlans'),
      purchaseRequests: tag('PurchaseRequests'),
      purchaseWorkbench: tag('PurchaseWorkbench'),
      supplierEvidence: tag('SupplierEvidence'),
      supplementalRequests: tag('SupplementalRequests'),
      inventoryReturns: tag('InventoryReturns'),
      approvalInbox: tag('ApprovalInbox'),
      approvalHistory: tag('ApprovalHistory'),
      approvalRules: tag('ApprovalRules'),
      stockMovements: tag('StockMovements'),
      currentStock: tag('CurrentStock'),
      stockLedger: tag('StockLedger'),
      priceVariance: tag('PriceVariance'),
      kitchenIssues: tag('KitchenIssues'),
      issueUsage: tag('IssueUsage'),
      auditChanges: tag('AuditChanges'),
      dataQuality: tag('DataQuality'),
      operationalKpis: tag('OperationalKpis'),
    });
  });

  it('keeps overview, KPI and audit invalidation fan-out stable', () => {
    expect(workflowOverviewCacheTags).toEqual([
      workflowCacheTags.documents,
      workflowCacheTags.ingredientDemand,
      workflowCacheTags.priceVariance,
      workflowCacheTags.stockMovements,
    ]);
    expect(workflowOperationalKpiSourceTags).toEqual([
      workflowCacheTags.ingredientDemand,
      workflowCacheTags.purchaseRequests,
      workflowCacheTags.productionPlans,
      workflowCacheTags.inventoryReturns,
      workflowCacheTags.kitchenIssues,
      workflowCacheTags.issueUsage,
      workflowCacheTags.currentStock,
      workflowCacheTags.dataQuality,
    ]);
    expect(workflowAuditSourceTags).toEqual([
      workflowCacheTags.documents,
      workflowCacheTags.ingredientDemand,
      workflowCacheTags.materialRequestCandidates,
      workflowCacheTags.purchasePlan,
      workflowCacheTags.productionPlans,
      workflowCacheTags.purchaseRequests,
      workflowCacheTags.purchaseWorkbench,
      workflowCacheTags.supplierEvidence,
      workflowCacheTags.supplementalRequests,
      workflowCacheTags.inventoryReturns,
      workflowCacheTags.approvalInbox,
      workflowCacheTags.approvalHistory,
      workflowCacheTags.approvalRules,
      workflowCacheTags.stockMovements,
      workflowCacheTags.currentStock,
      workflowCacheTags.stockLedger,
      workflowCacheTags.priceVariance,
      workflowCacheTags.kitchenIssues,
      workflowCacheTags.issueUsage,
      workflowCacheTags.dataQuality,
      workflowCacheTags.operationalKpis,
    ]);
  });
});
