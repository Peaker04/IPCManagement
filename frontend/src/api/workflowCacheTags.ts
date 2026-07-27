const workflowTag = <Id extends string>(id: Id) => ({
  type: 'WorkflowReports' as const,
  id,
});

export const workflowCacheTags = {
  documents: workflowTag('Documents'),
  ingredientDemand: workflowTag('IngredientDemand'),
  materialRequestCandidates: workflowTag('MaterialRequestCandidates'),
  purchasePlan: workflowTag('PurchasePlan'),
  productionPlans: workflowTag('ProductionPlans'),
  purchaseRequests: workflowTag('PurchaseRequests'),
  purchaseWorkbench: workflowTag('PurchaseWorkbench'),
  supplierEvidence: workflowTag('SupplierEvidence'),
  supplementalRequests: workflowTag('SupplementalRequests'),
  inventoryReturns: workflowTag('InventoryReturns'),
  approvalInbox: workflowTag('ApprovalInbox'),
  approvalHistory: workflowTag('ApprovalHistory'),
  approvalRules: workflowTag('ApprovalRules'),
  stockMovements: workflowTag('StockMovements'),
  currentStock: workflowTag('CurrentStock'),
  stockLedger: workflowTag('StockLedger'),
  priceVariance: workflowTag('PriceVariance'),
  kitchenIssues: workflowTag('KitchenIssues'),
  issueUsage: workflowTag('IssueUsage'),
  auditChanges: workflowTag('AuditChanges'),
  dataQuality: workflowTag('DataQuality'),
  operationalKpis: workflowTag('OperationalKpis'),
} as const;

export const workflowOverviewCacheTags = [
  workflowCacheTags.documents,
  workflowCacheTags.ingredientDemand,
  workflowCacheTags.priceVariance,
  workflowCacheTags.stockMovements,
] as const;

export const workflowOperationalKpiSourceTags = [
  workflowCacheTags.ingredientDemand,
  workflowCacheTags.purchaseRequests,
  workflowCacheTags.productionPlans,
  workflowCacheTags.inventoryReturns,
  workflowCacheTags.kitchenIssues,
  workflowCacheTags.issueUsage,
  workflowCacheTags.currentStock,
  workflowCacheTags.dataQuality,
] as const;

export const workflowAuditSourceTags = [
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
] as const;
