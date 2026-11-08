# Phase 35 geometry denominator v2

Total production arbitrary minima: **95**

| Disposition | Count |
|---|---:|
| ARTIFICIAL_RESERVATION | 0 |
| NEEDS_BROWSER | 27 |
| NOT_APPLICABLE | 0 |
| PURPOSEFUL_CONSTRAINT | 67 |
| RESPONSIVE_WORKAROUND | 1 |
| SHARED_OWNER_DEFECT | 0 |

| ID | Source | Property | Value | Modes | Disposition | Reason |
|---|---|---|---|---|---|---|
| GEO-001 | `frontend/src/app/pages/admin-data/AdminContractsPanel.tsx:122` | min-height | `86px` | DEFAULT, MATERIAL_RECONCILIATION | NEEDS_BROWSER | Source occurrence is classified; browser containment/composition evidence remains required. |
| GEO-002 | `frontend/src/app/pages/admin-data/AdminEmployeesPanel.tsx:162` | min-width | `150px` | DEFAULT, MATERIAL_RECONCILIATION | PURPOSEFUL_CONSTRAINT | Data-table/cell horizontal geometry; measured through its scroll owner. |
| GEO-003 | `frontend/src/app/pages/admin-data/ReconciliationAdminDataPage.tsx:19` | min-height | `420px` | MATERIAL_RECONCILIATION | PURPOSEFUL_CONSTRAINT | Initial lazy/loading geometry is paired with an explicit pending state. |
| GEO-004 | `frontend/src/components/common/ApprovalQueue.tsx:269` | min-width | `1080px` | DEFAULT, MATERIAL_RECONCILIATION | PURPOSEFUL_CONSTRAINT | Data-table/cell horizontal geometry; measured through its scroll owner. |
| GEO-005 | `frontend/src/components/common/DemandSummary.tsx:67` | min-width | `980px` | DEFAULT, MATERIAL_RECONCILIATION | PURPOSEFUL_CONSTRAINT | Data-table/cell horizontal geometry; measured through its scroll owner. |
| GEO-006 | `frontend/src/components/common/ExceptionLane.tsx:37` | min-height | `145px` | DEFAULT, MATERIAL_RECONCILIATION | NEEDS_BROWSER | Source occurrence is classified; browser containment/composition evidence remains required. |
| GEO-007 | `frontend/src/components/common/ExceptionLane.tsx:42` | min-height | `100px` | DEFAULT, MATERIAL_RECONCILIATION | NEEDS_BROWSER | Source occurrence is classified; browser containment/composition evidence remains required. |
| GEO-008 | `frontend/src/components/common/QueryViewBoundary.tsx:26` | min-height | `180px` | DEFAULT, MATERIAL_RECONCILIATION | PURPOSEFUL_CONSTRAINT | Shared semantic geometry scale declared by the boundary primitive. |
| GEO-009 | `frontend/src/components/common/QueryViewBoundary.tsx:27` | min-height | `380px` | DEFAULT, MATERIAL_RECONCILIATION | PURPOSEFUL_CONSTRAINT | Shared semantic geometry scale declared by the boundary primitive. |
| GEO-010 | `frontend/src/components/common/QueryViewBoundary.tsx:28` | min-height | `380px` | DEFAULT, MATERIAL_RECONCILIATION | PURPOSEFUL_CONSTRAINT | Shared semantic geometry scale declared by the boundary primitive. |
| GEO-011 | `frontend/src/components/common/StockMovementTable.tsx:113` | min-width | `760px` | DEFAULT, MATERIAL_RECONCILIATION | PURPOSEFUL_CONSTRAINT | Data-table/cell horizontal geometry; measured through its scroll owner. |
| GEO-012 | `frontend/src/components/common/TabContentSkeleton.tsx:24` | min-height | `12rem` | DEFAULT, MATERIAL_RECONCILIATION | PURPOSEFUL_CONSTRAINT | Shared semantic geometry scale declared by the boundary primitive. |
| GEO-013 | `frontend/src/components/common/TabContentSkeleton.tsx:25` | min-height | `20rem` | DEFAULT, MATERIAL_RECONCILIATION | PURPOSEFUL_CONSTRAINT | Shared semantic geometry scale declared by the boundary primitive. |
| GEO-014 | `frontend/src/components/common/TabContentSkeleton.tsx:26` | min-height | `26rem` | DEFAULT, MATERIAL_RECONCILIATION | PURPOSEFUL_CONSTRAINT | Shared semantic geometry scale declared by the boundary primitive. |
| GEO-015 | `frontend/src/components/common/TabContentSkeleton.tsx:27` | min-height | `34rem` | DEFAULT, MATERIAL_RECONCILIATION | PURPOSEFUL_CONSTRAINT | Shared semantic geometry scale declared by the boundary primitive. |
| GEO-016 | `frontend/src/components/common/TableEmptyState.tsx:25` | min-height | `220px` | DEFAULT, MATERIAL_RECONCILIATION | NEEDS_BROWSER | Source occurrence is classified; browser containment/composition evidence remains required. |
| GEO-017 | `frontend/src/components/reconciliation/ClosedLoopTransferPanel.tsx:151` | min-width | `720px` | DEFAULT, MATERIAL_RECONCILIATION | PURPOSEFUL_CONSTRAINT | Data-table/cell horizontal geometry; measured through its scroll owner. |
| GEO-018 | `frontend/src/components/ui/button.tsx:33` | min-width | `var(--button-min-w-default,5rem)` | DEFAULT, MATERIAL_RECONCILIATION | PURPOSEFUL_CONSTRAINT | Design-token-backed component minimum. |
| GEO-019 | `frontend/src/components/ui/button.tsx:34` | min-width | `var(--button-min-w-sm,4rem)` | DEFAULT, MATERIAL_RECONCILIATION | PURPOSEFUL_CONSTRAINT | Design-token-backed component minimum. |
| GEO-020 | `frontend/src/components/ui/button.tsx:35` | min-width | `var(--button-min-w-sm,4rem)` | DEFAULT, MATERIAL_RECONCILIATION | PURPOSEFUL_CONSTRAINT | Design-token-backed component minimum. |
| GEO-021 | `frontend/src/components/ui/button.tsx:36` | min-width | `var(--button-min-w-lg,6rem)` | DEFAULT, MATERIAL_RECONCILIATION | PURPOSEFUL_CONSTRAINT | Design-token-backed component minimum. |
| GEO-022 | `frontend/src/features/approvals/components/MenuAmendmentReconciliation.tsx:97` | min-width | `900px` | DEFAULT | PURPOSEFUL_CONSTRAINT | Data-table/cell horizontal geometry; measured through its scroll owner. |
| GEO-023 | `frontend/src/features/approvals/pages/ApprovalDecisionDialog.tsx:92` | min-height | `100px` | DEFAULT | NEEDS_BROWSER | Source occurrence is classified; browser containment/composition evidence remains required. |
| GEO-024 | `frontend/src/features/approvals/pages/ApprovalPage.tsx:322` | min-height | `16rem` | DEFAULT | NEEDS_BROWSER | Source occurrence is classified; browser containment/composition evidence remains required. |
| GEO-025 | `frontend/src/features/approvals/pages/ApprovalPage.tsx:324` | min-height | `11.5rem` | DEFAULT | PURPOSEFUL_CONSTRAINT | Initial lazy/loading geometry is paired with an explicit pending state. |
| GEO-026 | `frontend/src/features/approvals/pages/ApprovalQueryPanels.tsx:48` | min-height | `32rem` | DEFAULT | PURPOSEFUL_CONSTRAINT | Initial lazy/loading geometry is paired with an explicit pending state. |
| GEO-027 | `frontend/src/features/approvals/pages/ApprovalQueryPanels.tsx:228` | min-height | `11.5rem` | DEFAULT | NEEDS_BROWSER | Source occurrence is classified; browser containment/composition evidence remains required. |
| GEO-028 | `frontend/src/features/approvals/pages/ApprovalQueryPanels.tsx:238` | min-height | `11.5rem` | DEFAULT | NEEDS_BROWSER | Source occurrence is classified; browser containment/composition evidence remains required. |
| GEO-029 | `frontend/src/features/approvals/pages/ApprovalQueryPanels.tsx:248` | min-height | `11.5rem` | DEFAULT | NEEDS_BROWSER | Source occurrence is classified; browser containment/composition evidence remains required. |
| GEO-030 | `frontend/src/features/approvals/pages/ApprovalQueryPanels.tsx:255` | min-height | `11.5rem` | DEFAULT | NEEDS_BROWSER | Source occurrence is classified; browser containment/composition evidence remains required. |
| GEO-031 | `frontend/src/features/approvals/pages/ApprovalQueryPanels.tsx:265` | min-height | `11.5rem` | DEFAULT | NEEDS_BROWSER | Source occurrence is classified; browser containment/composition evidence remains required. |
| GEO-032 | `frontend/src/features/chef/ChefQueryBoundary.tsx:104` | min-height | `32rem` | DEFAULT | PURPOSEFUL_CONSTRAINT | Initial lazy/loading geometry is paired with an explicit pending state. |
| GEO-033 | `frontend/src/features/chef/components/excess-material-dialog.tsx:230` | min-height | `80px` | DEFAULT | PURPOSEFUL_CONSTRAINT | Notes textarea has an explicit 80px editing area; height and minimum agree. |
| GEO-034 | `frontend/src/features/chef/pages/ChefDashboardPage.tsx:109` | min-height | `420px` | DEFAULT | PURPOSEFUL_CONSTRAINT | Initial lazy/loading geometry is paired with an explicit pending state. |
| GEO-035 | `frontend/src/features/chef/production/ChefProductionSection.tsx:48` | min-width | `900px` | DEFAULT | PURPOSEFUL_CONSTRAINT | Data-table/cell horizontal geometry; measured through its scroll owner. |
| GEO-036 | `frontend/src/features/coordination/components/order-table.tsx:324` | min-width | `240px` | DEFAULT | PURPOSEFUL_CONSTRAINT | Data-table/cell horizontal geometry; measured through its scroll owner. |
| GEO-037 | `frontend/src/features/coordination/pages/CoordinationPage.tsx:120` | min-height | `420px` | DEFAULT | PURPOSEFUL_CONSTRAINT | Initial lazy/loading geometry is paired with an explicit pending state. |
| GEO-038 | `frontend/src/features/dashboard/pages/DashboardPage.tsx:11` | min-height | `28rem` | DEFAULT, MATERIAL_RECONCILIATION | PURPOSEFUL_CONSTRAINT | Named dashboard Suspense fallback preserves the initial lazy-load geometry. |
| GEO-039 | `frontend/src/features/dashboard/pages/DefaultDashboardPage.tsx:422` | min-width | `96px` | DEFAULT, MATERIAL_RECONCILIATION | NEEDS_BROWSER | Source occurrence is classified; browser containment/composition evidence remains required. |
| GEO-040 | `frontend/src/features/projects/components/ImportedLayoutMatrix.tsx:85` | min-width | `190px` | DEFAULT, MATERIAL_RECONCILIATION | PURPOSEFUL_CONSTRAINT | Data-table/cell horizontal geometry; measured through its scroll owner. |
| GEO-041 | `frontend/src/features/projects/weekly-menu/demand/MaterialDemandSection.tsx:247` | min-height | `38px` | DEFAULT, MATERIAL_RECONCILIATION | NEEDS_BROWSER | Source occurrence is classified; browser containment/composition evidence remains required. |
| GEO-042 | `frontend/src/features/projects/weekly-menu/demand/MaterialDemandSection.tsx:253` | min-width | `132px` | DEFAULT, MATERIAL_RECONCILIATION | NEEDS_BROWSER | Source occurrence is classified; browser containment/composition evidence remains required. |
| GEO-043 | `frontend/src/features/projects/weekly-menu/demand/MaterialDemandSection.tsx:294` | min-height | `34px` | DEFAULT, MATERIAL_RECONCILIATION | NEEDS_BROWSER | Source occurrence is classified; browser containment/composition evidence remains required. |
| GEO-044 | `frontend/src/features/projects/weekly-menu/import/WeeklyMenuImportJobs.tsx:77` | min-width | `116px` | DEFAULT, MATERIAL_RECONCILIATION | PURPOSEFUL_CONSTRAINT | Data-table/cell horizontal geometry; measured through its scroll owner. |
| GEO-045 | `frontend/src/features/projects/weekly-menu/import/WeeklyMenuImportSetup.tsx:27` | min-height | `34px` | DEFAULT, MATERIAL_RECONCILIATION | NEEDS_BROWSER | Source occurrence is classified; browser containment/composition evidence remains required. |
| GEO-046 | `frontend/src/features/projects/weekly-menu/import/WeeklyMenuImportSetup.tsx:53` | min-height | `34px` | DEFAULT, MATERIAL_RECONCILIATION | NEEDS_BROWSER | Source occurrence is classified; browser containment/composition evidence remains required. |
| GEO-047 | `frontend/src/features/projects/weekly-menu/import/WeeklyMenuImportSetup.tsx:66` | min-height | `34px` | DEFAULT, MATERIAL_RECONCILIATION | NEEDS_BROWSER | Source occurrence is classified; browser containment/composition evidence remains required. |
| GEO-048 | `frontend/src/features/projects/weekly-menu/import/WeeklyMenuImportSetup.tsx:80` | min-height | `34px` | DEFAULT, MATERIAL_RECONCILIATION | NEEDS_BROWSER | Source occurrence is classified; browser containment/composition evidence remains required. |
| GEO-049 | `frontend/src/features/projects/weekly-menu/import/WeeklyMenuImportSetup.tsx:119` | min-width | `92px` | DEFAULT, MATERIAL_RECONCILIATION | NEEDS_BROWSER | Source occurrence is classified; browser containment/composition evidence remains required. |
| GEO-050 | `frontend/src/features/projects/weekly-menu/shell/WeeklyMenuCommandBar.tsx:89` | min-width | `200px` | DEFAULT, MATERIAL_RECONCILIATION | NEEDS_BROWSER | Source occurrence is classified; browser containment/composition evidence remains required. |
| GEO-051 | `frontend/src/features/purchasing/pages/PurchasingPage.tsx:26` | min-height | `420px` | DEFAULT | PURPOSEFUL_CONSTRAINT | Initial lazy/loading geometry is paired with an explicit pending state. |
| GEO-052 | `frontend/src/features/purchasing/pages/PurchasingPage.tsx:194` | min-width | `10.25rem` | DEFAULT | PURPOSEFUL_CONSTRAINT | Visible primary workflow action width; the former invisible spacer was removed separately. |
| GEO-053 | `frontend/src/features/purchasing/PurchaseLineGroups.tsx:75` | min-width | `900px` | DEFAULT | PURPOSEFUL_CONSTRAINT | Data-table/cell horizontal geometry; measured through its scroll owner. |
| GEO-054 | `frontend/src/features/purchasing/PurchaseServiceDateWorkbench.tsx:125` | min-width | `900px` | DEFAULT | PURPOSEFUL_CONSTRAINT | Data-table/cell horizontal geometry; measured through its scroll owner. |
| GEO-055 | `frontend/src/features/purchasing/PurchaseServiceDateWorkbench.tsx:132` | min-width | `900px` | DEFAULT | PURPOSEFUL_CONSTRAINT | Data-table/cell horizontal geometry; measured through its scroll owner. |
| GEO-056 | `frontend/src/features/purchasing/quotation/SupplierQuotationSection.tsx:113` | min-width | `760px` | DEFAULT | PURPOSEFUL_CONSTRAINT | Data-table/cell horizontal geometry; measured through its scroll owner. |
| GEO-057 | `frontend/src/features/purchasing/SupplementalPurchasingWorkbench.tsx:174` | min-width | `760px` | DEFAULT | PURPOSEFUL_CONSTRAINT | Data-table/cell horizontal geometry; measured through its scroll owner. |
| GEO-058 | `frontend/src/features/reports/LegacyLineageDispositionPanel.tsx:135` | min-width | `260px` | DEFAULT | NEEDS_BROWSER | Source occurrence is classified; browser containment/composition evidence remains required. |
| GEO-059 | `frontend/src/features/reports/pages/ReportsDataQualityPanel.tsx:83` | min-width | `800px` | DEFAULT | PURPOSEFUL_CONSTRAINT | Data-table/cell horizontal geometry; measured through its scroll owner. |
| GEO-060 | `frontend/src/features/reports/pages/ReportsFilters.tsx:27` | min-width | `130px` | DEFAULT | NEEDS_BROWSER | Source occurrence is classified; browser containment/composition evidence remains required. |
| GEO-061 | `frontend/src/features/reports/pages/ReportsFilters.tsx:33` | min-width | `150px` | DEFAULT | NEEDS_BROWSER | Source occurrence is classified; browser containment/composition evidence remains required. |
| GEO-062 | `frontend/src/features/reports/pages/ReportsPage.tsx:59` | min-height | `360px` | DEFAULT | PURPOSEFUL_CONSTRAINT | Initial lazy/loading geometry is paired with an explicit pending state. |
| GEO-063 | `frontend/src/features/reports/pages/ReportsPage.tsx:134` | min-width | `720px` | DEFAULT | PURPOSEFUL_CONSTRAINT | Data-table/cell horizontal geometry; measured through its scroll owner. |
| GEO-064 | `frontend/src/features/reports/pages/ReportsPage.tsx:212` | min-width | `720px` | DEFAULT | PURPOSEFUL_CONSTRAINT | Data-table/cell horizontal geometry; measured through its scroll owner. |
| GEO-065 | `frontend/src/features/reports/pages/ReportsPage.tsx:268` | min-width | `720px` | DEFAULT | PURPOSEFUL_CONSTRAINT | Data-table/cell horizontal geometry; measured through its scroll owner. |
| GEO-066 | `frontend/src/features/reports/pages/ReportsPage.tsx:330` | min-width | `720px` | DEFAULT | PURPOSEFUL_CONSTRAINT | Data-table/cell horizontal geometry; measured through its scroll owner. |
| GEO-067 | `frontend/src/features/reports/pages/ReportsPage.tsx:375` | min-width | `720px` | DEFAULT | PURPOSEFUL_CONSTRAINT | Data-table/cell horizontal geometry; measured through its scroll owner. |
| GEO-068 | `frontend/src/features/reports/pages/ReportsPage.tsx:419` | min-width | `1300px` | DEFAULT | PURPOSEFUL_CONSTRAINT | Data-table/cell horizontal geometry; measured through its scroll owner. |
| GEO-069 | `frontend/src/features/reports/pages/ReportsPricePanel.tsx:134` | min-width | `900px` | DEFAULT | PURPOSEFUL_CONSTRAINT | Data-table/cell horizontal geometry; measured through its scroll owner. |
| GEO-070 | `frontend/src/features/reports/pages/ReportsPricePanel.tsx:212` | min-width | `240px` | DEFAULT | NEEDS_BROWSER | Source occurrence is classified; browser containment/composition evidence remains required. |
| GEO-071 | `frontend/src/features/reports/pages/ReportsPricePanel.tsx:218` | min-width | `240px` | DEFAULT | NEEDS_BROWSER | Source occurrence is classified; browser containment/composition evidence remains required. |
| GEO-072 | `frontend/src/features/reports/pages/ReportsPricePanel.tsx:238` | min-width | `720px` | DEFAULT | PURPOSEFUL_CONSTRAINT | Data-table/cell horizontal geometry; measured through its scroll owner. |
| GEO-073 | `frontend/src/features/reports/pages/ReportsPricePanel.tsx:291` | min-width | `720px` | DEFAULT | PURPOSEFUL_CONSTRAINT | Data-table/cell horizontal geometry; measured through its scroll owner. |
| GEO-074 | `frontend/src/features/reports/pages/ReportsPricePanel.tsx:346` | min-width | `720px` | DEFAULT | PURPOSEFUL_CONSTRAINT | Data-table/cell horizontal geometry; measured through its scroll owner. |
| GEO-075 | `frontend/src/features/reports/pages/ServiceRunReportPanel.tsx:48` | min-width | `1240px` | DEFAULT | PURPOSEFUL_CONSTRAINT | Data-table/cell horizontal geometry; measured through its scroll owner. |
| GEO-076 | `frontend/src/features/warehouse/pages/WarehousePage.tsx:432` | min-height | `420px` | DEFAULT, MATERIAL_RECONCILIATION | PURPOSEFUL_CONSTRAINT | Initial lazy/loading geometry is paired with an explicit pending state. |
| GEO-077 | `frontend/src/features/warehouse/pages/WarehousePage.tsx:463` | min-height | `420px` | DEFAULT, MATERIAL_RECONCILIATION | PURPOSEFUL_CONSTRAINT | Initial lazy/loading geometry is paired with an explicit pending state. |
| GEO-078 | `frontend/src/features/warehouse/pages/WarehousePage.tsx:505` | min-height | `420px` | DEFAULT, MATERIAL_RECONCILIATION | PURPOSEFUL_CONSTRAINT | Initial lazy/loading geometry is paired with an explicit pending state. |
| GEO-079 | `frontend/src/features/warehouse/pages/WarehousePage.tsx:517` | min-height | `420px` | DEFAULT, MATERIAL_RECONCILIATION | PURPOSEFUL_CONSTRAINT | Initial lazy/loading geometry is paired with an explicit pending state. |
| GEO-080 | `frontend/src/features/warehouse/pages/WarehousePurchaseOrdersPanel.tsx:57` | min-width | `1060px` | DEFAULT, MATERIAL_RECONCILIATION | PURPOSEFUL_CONSTRAINT | Data-table/cell horizontal geometry; measured through its scroll owner. |
| GEO-081 | `frontend/src/features/warehouse/pages/WarehousePurchaseOrdersPanel.tsx:60` | min-width | `280px` | DEFAULT, MATERIAL_RECONCILIATION | PURPOSEFUL_CONSTRAINT | Data-table/cell horizontal geometry; measured through its scroll owner. |
| GEO-082 | `frontend/src/features/warehouse/pages/WarehousePurchaseOrdersPanel.tsx:61` | min-width | `160px` | DEFAULT, MATERIAL_RECONCILIATION | PURPOSEFUL_CONSTRAINT | Data-table/cell horizontal geometry; measured through its scroll owner. |
| GEO-083 | `frontend/src/features/warehouse/pages/WarehousePurchaseOrdersPanel.tsx:62` | min-width | `220px` | DEFAULT, MATERIAL_RECONCILIATION | PURPOSEFUL_CONSTRAINT | Data-table/cell horizontal geometry; measured through its scroll owner. |
| GEO-084 | `frontend/src/features/warehouse/pages/WarehousePurchaseOrdersPanel.tsx:63` | min-width | `140px` | DEFAULT, MATERIAL_RECONCILIATION | PURPOSEFUL_CONSTRAINT | Data-table/cell horizontal geometry; measured through its scroll owner. |
| GEO-085 | `frontend/src/features/warehouse/pages/WarehousePurchaseOrdersPanel.tsx:64` | min-width | `130px` | DEFAULT, MATERIAL_RECONCILIATION | PURPOSEFUL_CONSTRAINT | Data-table/cell horizontal geometry; measured through its scroll owner. |
| GEO-086 | `frontend/src/features/warehouse/pages/WarehousePurchaseOrdersPanel.tsx:65` | min-width | `130px` | DEFAULT, MATERIAL_RECONCILIATION | PURPOSEFUL_CONSTRAINT | Data-table/cell horizontal geometry; measured through its scroll owner. |
| GEO-087 | `frontend/src/features/warehouse/PurchaseOrderLineGroups.tsx:60` | min-width | `900px` | DEFAULT, MATERIAL_RECONCILIATION | PURPOSEFUL_CONSTRAINT | Data-table/cell horizontal geometry; measured through its scroll owner. |
| GEO-088 | `frontend/src/features/warehouse/WarehouseExceptionsWorkbench.tsx:293` | min-width | `980px` | DEFAULT, MATERIAL_RECONCILIATION | PURPOSEFUL_CONSTRAINT | Data-table/cell horizontal geometry; measured through its scroll owner. |
| GEO-089 | `frontend/src/features/warehouse/WarehouseExceptionsWorkbench.tsx:311` | min-width | `250px` | DEFAULT, MATERIAL_RECONCILIATION | RESPONSIVE_WORKAROUND | Row action group minimum keeps its visible controls together inside the table scroll owner. |
| GEO-090 | `frontend/src/features/warehouse/WarehouseExceptionsWorkbench.tsx:330` | min-width | `1120px` | DEFAULT, MATERIAL_RECONCILIATION | PURPOSEFUL_CONSTRAINT | Data-table/cell horizontal geometry; measured through its scroll owner. |
| GEO-091 | `frontend/src/features/warehouse/WarehouseExceptionsWorkbench.tsx:351` | min-width | `820px` | DEFAULT, MATERIAL_RECONCILIATION | PURPOSEFUL_CONSTRAINT | Data-table/cell horizontal geometry; measured through its scroll owner. |
| GEO-092 | `frontend/src/features/warehouse/WarehouseReceiptLifecyclePanel.tsx:214` | min-height | `20rem` | DEFAULT, MATERIAL_RECONCILIATION | NEEDS_BROWSER | Source occurrence is classified; browser containment/composition evidence remains required. |
| GEO-093 | `frontend/src/features/warehouse/WarehouseReceiptLifecyclePanel.tsx:229` | min-width | `760px` | DEFAULT, MATERIAL_RECONCILIATION | PURPOSEFUL_CONSTRAINT | Data-table/cell horizontal geometry; measured through its scroll owner. |
| GEO-094 | `frontend/src/routes/AppRouter.tsx:33` | min-height | `580px` | DEFAULT, MATERIAL_RECONCILIATION | PURPOSEFUL_CONSTRAINT | Initial lazy/loading geometry is paired with an explicit pending state. |
| GEO-095 | `frontend/src/routes/AppRouter.tsx:42` | min-height | `380px` | DEFAULT, MATERIAL_RECONCILIATION | PURPOSEFUL_CONSTRAINT | Initial lazy/loading geometry is paired with an explicit pending state. |
