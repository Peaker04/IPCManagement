# Phase 20 — PC mismatch disposition

Nguồn đo duy nhất của ledger này là artifact `FE-fixture-read-only`
`.artifacts/shipyard-live/pc-action-completeness-20-02/pc-action-completeness.json` sinh lúc
`2026-07-31T02:30:31.403Z`. Artifact có 535 identity, 360 control quan sát được, 280 `KHỚP`, 255
`CHƯA-KẾT-LUẬN-ĐƯỢC`, và không có `THIẾU`, `MỒ CÔI`, `IM LẶNG` hay `LỆCH VỊ TRÍ`.

Ledger không biến control nhìn thấy thành bằng chứng quyền backend. Mỗi nhóm bên dưới được bung thành mọi
`actor × viewport` đã khai để phủ đúng 255 identity unresolved. `ALL-PC-VIEWPORTS` trỏ tới năm viewport
canonical được import bởi PC contract; test fail-closed kiểm phép bung này.

## Kết luận PD

- Production candidate: **0**.
- Checkpoint: **DEFERRED** theo chỉ thị “không mở PD”.
- Không sửa UI, policy, gate, backend operation hay registry.
- Các operation không được exercise trong PC; `request` và `postAction` vẫn `null`. Đây không phải backend/DB
  E2E.

## Ledger máy đọc

```json disposition-ledger
{
  "schemaVersion": 1,
  "artifact": {
    "evidenceKind": "FE-fixture-read-only",
    "path": ".artifacts/shipyard-live/pc-action-completeness-20-02/pc-action-completeness.json",
    "measurementRows": 535,
    "matched": 280,
    "unresolved": 255,
    "missing": 0,
    "orphan": 0,
    "silent": 0,
    "wrongPlace": 0,
    "controlsObserved": 360,
    "operationsExercised": false
  },
  "checkpoint": {
    "outcome": "DEFERRED",
    "productionCandidates": [],
    "reason": "Không có actionable mismatch; mọi non-match còn lại chứa canonical UNKNOWN. Người vận hành đã yêu cầu không mở PD."
  },
  "acceptedExceptions": [
    {
      "id": "D-01",
      "family": "WeeklyMenuLifecycle",
      "scenarioId": "draft",
      "actors": ["manager", "coordinator"],
      "decision": "INTENTIONAL-FE-STRICTER",
      "consequence": "Publish chỉ hiện cho Admin; Manager và Coordinator không bị coi là thiếu control.",
      "sources": [
        "frontend/tests/weekly-menu-lifecycle-pa2b-fixture.ts:102-106",
        "frontend/src/app/pages/admin-data/AdminContractsPanel.tsx:240-304",
        "backend/src/IPCManagement.Api/Security/AuthorizationPolicies.cs:42-47"
      ],
      "pdCandidate": false
    }
  ],
  "groups": [
    {
      "id": "U-APPROVAL-ACTIONABLE",
      "family": "ApprovalDocument",
      "scenarioId": "actionable-record",
      "operation": "KHÔNG-XÁC-ĐỊNH-ĐƯỢC",
      "actors": ["admin"],
      "viewports": "ALL-PC-VIEWPORTS",
      "canonicalUnknown": ["operation", "actor", "backendPermission", "frontendPermission"],
      "controlEvidence": { "status": "OBSERVED", "selector": "role=button[name=/Duyệt|Từ chối/]", "source": "frontend/src/features/approvals/pages/ApprovalPage.tsx:217-239" },
      "sources": ["frontend/tests/operationalStateActionRegistry.test.ts:422-458", "backend/src/IPCManagement.Api/Features/Approvals/Services/ApprovalWorkflowService.cs:61-69"],
      "exclusions": {
        "navigation": { "status": "RESOLVED", "evidence": "Route /approvals được render trong mọi viewport đo." },
        "viewport": { "status": "RESOLVED", "evidence": "Năm viewport không overflow." },
        "fixtureCondition": { "status": "RESOLVED", "evidence": "Control Duyệt/Từ chối được quan sát ở 5/5 identity." },
        "roleState": { "status": "UNRESOLVED", "evidence": "Operation, actor và permission canonical vẫn UNKNOWN." }
      },
      "consequence": "CHƯA-KẾT-LUẬN-ĐƯỢC",
      "disposition": "DEFERRED-CANONICAL-UNKNOWN",
      "pdCandidate": false
    },
    {
      "id": "U-COORD-DRAFT-FORECAST",
      "family": "CoordinationOrderScopeLifecycle",
      "scenarioId": "draft",
      "operation": "update-forecast",
      "actors": ["admin", "manager", "coordinator"],
      "viewports": "ALL-PC-VIEWPORTS",
      "canonicalUnknown": ["actor"],
      "controlEvidence": { "status": "OBSERVED", "selector": "label=/^Suất dự kiến của /", "source": "frontend/src/features/coordination/components/order-table.tsx:327" },
      "sources": ["frontend/src/features/coordination/coordinationOrderScopeLifecycleRegistry.test.ts:22-171", "backend/src/IPCManagement.Api/Features/Coordination/Services/OrderAdjustmentService.cs:166"],
      "exclusions": { "navigation": { "status": "RESOLVED", "evidence": "Route /meal-orders được render." }, "viewport": { "status": "RESOLVED", "evidence": "Năm viewport không overflow." }, "fixtureCondition": { "status": "RESOLVED", "evidence": "Input forecast được quan sát cho cả ba actor." }, "roleState": { "status": "UNRESOLVED", "evidence": "Registry chưa có actor canonical cho update-forecast." } },
      "consequence": "CHƯA-KẾT-LUẬN-ĐƯỢC", "disposition": "DEFERRED-CANONICAL-UNKNOWN", "pdCandidate": false
    },
    {
      "id": "U-COORD-FORECASTED-FORECAST",
      "family": "CoordinationOrderScopeLifecycle",
      "scenarioId": "forecasted",
      "operation": "update-forecast",
      "actors": ["admin", "manager", "coordinator"],
      "viewports": "ALL-PC-VIEWPORTS",
      "canonicalUnknown": ["actor"],
      "controlEvidence": { "status": "OBSERVED", "selector": "label=/^Suất dự kiến của /", "source": "frontend/src/features/coordination/components/order-table.tsx:327" },
      "sources": ["frontend/src/features/coordination/coordinationOrderScopeLifecycleRegistry.test.ts:22-171", "backend/src/IPCManagement.Api/Features/Coordination/Services/OrderAdjustmentService.cs:166"],
      "exclusions": { "navigation": { "status": "RESOLVED", "evidence": "Route /meal-orders được render." }, "viewport": { "status": "RESOLVED", "evidence": "Năm viewport không overflow." }, "fixtureCondition": { "status": "RESOLVED", "evidence": "Input forecast được quan sát cho cả ba actor." }, "roleState": { "status": "UNRESOLVED", "evidence": "Registry chưa có actor canonical cho update-forecast." } },
      "consequence": "CHƯA-KẾT-LUẬN-ĐƯỢC", "disposition": "DEFERRED-CANONICAL-UNKNOWN", "pdCandidate": false
    },
    {
      "id": "U-COORD-CONFIRMED-ADJUST",
      "family": "CoordinationOrderScopeLifecycle",
      "scenarioId": "confirmed",
      "operation": "request-adjustment",
      "actors": ["admin", "manager", "coordinator"],
      "viewports": "ALL-PC-VIEWPORTS",
      "canonicalUnknown": ["actor"],
      "controlEvidence": { "status": "OBSERVED", "selector": "label=/^Suất thực tế của /", "source": "frontend/src/features/coordination/components/order-table.tsx:355" },
      "sources": ["frontend/src/features/coordination/coordinationOrderScopeLifecycleRegistry.test.ts:22-171", "backend/src/IPCManagement.Api/Features/Coordination/Services/OrderAdjustmentService.cs:62"],
      "exclusions": { "navigation": { "status": "RESOLVED", "evidence": "Route /meal-orders được render." }, "viewport": { "status": "RESOLVED", "evidence": "Năm viewport không overflow." }, "fixtureCondition": { "status": "RESOLVED", "evidence": "Input actual được quan sát cho cả ba actor." }, "roleState": { "status": "UNRESOLVED", "evidence": "Registry chưa có actor canonical cho request-adjustment." } },
      "consequence": "CHƯA-KẾT-LUẬN-ĐƯỢC", "disposition": "DEFERRED-CANONICAL-UNKNOWN", "pdCandidate": false
    },
    {
      "id": "U-COORD-ADJUSTED-ADJUST",
      "family": "CoordinationOrderScopeLifecycle",
      "scenarioId": "adjusted",
      "operation": "request-adjustment",
      "actors": ["admin", "manager", "coordinator"],
      "viewports": "ALL-PC-VIEWPORTS",
      "canonicalUnknown": ["actor"],
      "controlEvidence": { "status": "OBSERVED", "selector": "label=/^Suất thực tế của /", "source": "frontend/src/features/coordination/components/order-table.tsx:355" },
      "sources": ["frontend/src/features/coordination/coordinationOrderScopeLifecycleRegistry.test.ts:22-171", "backend/src/IPCManagement.Api/Features/Coordination/Services/OrderAdjustmentService.cs:62"],
      "exclusions": { "navigation": { "status": "RESOLVED", "evidence": "Route /meal-orders được render." }, "viewport": { "status": "RESOLVED", "evidence": "Năm viewport không overflow." }, "fixtureCondition": { "status": "RESOLVED", "evidence": "Input actual được quan sát cho cả ba actor." }, "roleState": { "status": "UNRESOLVED", "evidence": "Registry chưa có actor canonical cho request-adjustment." } },
      "consequence": "CHƯA-KẾT-LUẬN-ĐƯỢC", "disposition": "DEFERRED-CANONICAL-UNKNOWN", "pdCandidate": false
    },
    {
      "id": "U-COORD-DRAFT-EXPORT",
      "family": "CoordinationOrderScopeLifecycle", "scenarioId": "draft", "operation": "export",
      "actors": ["admin", "manager", "coordinator"], "viewports": "ALL-PC-VIEWPORTS",
      "canonicalUnknown": ["actor", "frontendPermission"],
      "controlEvidence": { "status": "ABSENT-AS-PROJECTED", "selector": "none", "source": "frontend/src/features/coordination/components/action-toolbar.tsx:141-144" },
      "sources": ["frontend/src/features/coordination/coordinationOrderScopeLifecycleRegistry.test.ts:22-171", "backend/src/IPCManagement.Api/Features/Coordination/Controllers/CoordinationOrdersController.cs:15"],
      "exclusions": { "navigation": { "status": "RESOLVED", "evidence": "Route được render." }, "viewport": { "status": "RESOLVED", "evidence": "Năm viewport không overflow." }, "fixtureCondition": { "status": "RESOLVED", "evidence": "canExport false nên absence đúng projection." }, "roleState": { "status": "UNRESOLVED", "evidence": "Actor và frontend permission canonical vẫn UNKNOWN." } },
      "consequence": "CHƯA-KẾT-LUẬN-ĐƯỢC", "disposition": "DEFERRED-CANONICAL-UNKNOWN", "pdCandidate": false
    },
    {
      "id": "U-COORD-FORECASTED-EXPORT",
      "family": "CoordinationOrderScopeLifecycle", "scenarioId": "forecasted", "operation": "export",
      "actors": ["admin", "manager", "coordinator"], "viewports": "ALL-PC-VIEWPORTS",
      "canonicalUnknown": ["actor", "frontendPermission"],
      "controlEvidence": { "status": "ABSENT-AS-PROJECTED", "selector": "none", "source": "frontend/src/features/coordination/components/action-toolbar.tsx:141-144" },
      "sources": ["frontend/src/features/coordination/coordinationOrderScopeLifecycleRegistry.test.ts:22-171", "backend/src/IPCManagement.Api/Features/Coordination/Controllers/CoordinationOrdersController.cs:15"],
      "exclusions": { "navigation": { "status": "RESOLVED", "evidence": "Route được render." }, "viewport": { "status": "RESOLVED", "evidence": "Năm viewport không overflow." }, "fixtureCondition": { "status": "RESOLVED", "evidence": "canExport false nên absence đúng projection." }, "roleState": { "status": "UNRESOLVED", "evidence": "Actor và frontend permission canonical vẫn UNKNOWN." } },
      "consequence": "CHƯA-KẾT-LUẬN-ĐƯỢC", "disposition": "DEFERRED-CANONICAL-UNKNOWN", "pdCandidate": false
    },
    {
      "id": "U-COORD-COMPLETED-EXPORT",
      "family": "CoordinationOrderScopeLifecycle", "scenarioId": "completed", "operation": "export",
      "actors": ["admin", "manager", "coordinator"], "viewports": "ALL-PC-VIEWPORTS",
      "canonicalUnknown": ["actor", "frontendPermission"],
      "controlEvidence": { "status": "ABSENT-AS-PROJECTED", "selector": "none", "source": "frontend/src/features/coordination/components/action-toolbar.tsx:141-144" },
      "sources": ["frontend/src/features/coordination/coordinationOrderScopeLifecycleRegistry.test.ts:22-171", "backend/src/IPCManagement.Api/Features/Coordination/Controllers/CoordinationOrdersController.cs:15"],
      "exclusions": { "navigation": { "status": "RESOLVED", "evidence": "Route được render." }, "viewport": { "status": "RESOLVED", "evidence": "Năm viewport không overflow." }, "fixtureCondition": { "status": "RESOLVED", "evidence": "canExport false nên absence đúng projection." }, "roleState": { "status": "UNRESOLVED", "evidence": "Actor và frontend permission canonical vẫn UNKNOWN." } },
      "consequence": "CHƯA-KẾT-LUẬN-ĐƯỢC", "disposition": "DEFERRED-CANONICAL-UNKNOWN", "pdCandidate": false
    },
    {
      "id": "U-COORD-ARCHIVED-EXPORT",
      "family": "CoordinationOrderScopeLifecycle", "scenarioId": "archived", "operation": "export",
      "actors": ["admin", "manager", "coordinator"], "viewports": "ALL-PC-VIEWPORTS",
      "canonicalUnknown": ["actor", "frontendPermission"],
      "controlEvidence": { "status": "ABSENT-AS-PROJECTED", "selector": "none", "source": "frontend/src/features/coordination/components/action-toolbar.tsx:141-144" },
      "sources": ["frontend/src/features/coordination/coordinationOrderScopeLifecycleRegistry.test.ts:22-171", "backend/src/IPCManagement.Api/Features/Coordination/Controllers/CoordinationOrdersController.cs:15"],
      "exclusions": { "navigation": { "status": "RESOLVED", "evidence": "Route được render." }, "viewport": { "status": "RESOLVED", "evidence": "Năm viewport không overflow." }, "fixtureCondition": { "status": "RESOLVED", "evidence": "canExport false nên absence đúng projection." }, "roleState": { "status": "UNRESOLVED", "evidence": "Actor và frontend permission canonical vẫn UNKNOWN." } },
      "consequence": "CHƯA-KẾT-LUẬN-ĐƯỢC", "disposition": "DEFERRED-CANONICAL-UNKNOWN", "pdCandidate": false
    },
    {
      "id": "U-COORD-CANCELLED-EXPORT",
      "family": "CoordinationOrderScopeLifecycle", "scenarioId": "cancelled", "operation": "export",
      "actors": ["admin", "manager", "coordinator"], "viewports": "ALL-PC-VIEWPORTS",
      "canonicalUnknown": ["actor", "frontendPermission"],
      "controlEvidence": { "status": "ABSENT-AS-PROJECTED", "selector": "none", "source": "frontend/src/features/coordination/components/action-toolbar.tsx:141-144" },
      "sources": ["frontend/src/features/coordination/coordinationOrderScopeLifecycleRegistry.test.ts:22-171", "backend/src/IPCManagement.Api/Features/Coordination/Controllers/CoordinationOrdersController.cs:15"],
      "exclusions": { "navigation": { "status": "RESOLVED", "evidence": "Route được render." }, "viewport": { "status": "RESOLVED", "evidence": "Năm viewport không overflow." }, "fixtureCondition": { "status": "RESOLVED", "evidence": "canExport false nên absence đúng projection." }, "roleState": { "status": "UNRESOLVED", "evidence": "Actor và frontend permission canonical vẫn UNKNOWN." } },
      "consequence": "CHƯA-KẾT-LUẬN-ĐƯỢC", "disposition": "DEFERRED-CANONICAL-UNKNOWN", "pdCandidate": false
    },
    {
      "id": "U-COORD-MIXED-EXPORT",
      "family": "CoordinationOrderScopeLifecycle", "scenarioId": "mixed-confirmed-completed", "operation": "export",
      "actors": ["admin", "manager", "coordinator"], "viewports": "ALL-PC-VIEWPORTS",
      "canonicalUnknown": ["actor", "frontendPermission"],
      "controlEvidence": { "status": "ABSENT-AS-PROJECTED", "selector": "none", "source": "frontend/src/features/coordination/components/action-toolbar.tsx:141-144" },
      "sources": ["frontend/src/features/coordination/coordinationOrderScopeLifecycleRegistry.test.ts:22-171", "backend/src/IPCManagement.Api/Features/Coordination/Controllers/CoordinationOrdersController.cs:15"],
      "exclusions": { "navigation": { "status": "RESOLVED", "evidence": "Route được render." }, "viewport": { "status": "RESOLVED", "evidence": "Năm viewport không overflow." }, "fixtureCondition": { "status": "RESOLVED", "evidence": "canExport false nên absence đúng projection." }, "roleState": { "status": "UNRESOLVED", "evidence": "Actor và frontend permission canonical vẫn UNKNOWN." } },
      "consequence": "CHƯA-KẾT-LUẬN-ĐƯỢC", "disposition": "DEFERRED-CANONICAL-UNKNOWN", "pdCandidate": false
    },
    {
      "id": "U-COORD-EMPTY-EXPORT",
      "family": "CoordinationOrderScopeLifecycle", "scenarioId": "empty", "operation": "export",
      "actors": ["admin", "manager", "coordinator"], "viewports": "ALL-PC-VIEWPORTS",
      "canonicalUnknown": ["actor", "frontendPermission"],
      "controlEvidence": { "status": "ABSENT-AS-PROJECTED", "selector": "none", "source": "frontend/src/features/coordination/components/action-toolbar.tsx:141-144" },
      "sources": ["frontend/src/features/coordination/coordinationOrderScopeLifecycleRegistry.test.ts:22-171", "backend/src/IPCManagement.Api/Features/Coordination/Controllers/CoordinationOrdersController.cs:15"],
      "exclusions": { "navigation": { "status": "RESOLVED", "evidence": "Route được render." }, "viewport": { "status": "RESOLVED", "evidence": "Năm viewport không overflow." }, "fixtureCondition": { "status": "RESOLVED", "evidence": "canExport false nên absence đúng projection." }, "roleState": { "status": "UNRESOLVED", "evidence": "Actor và frontend permission canonical vẫn UNKNOWN." } },
      "consequence": "CHƯA-KẾT-LUẬN-ĐƯỢC", "disposition": "DEFERRED-CANONICAL-UNKNOWN", "pdCandidate": false
    },
    {
      "id": "U-COORD-LOADING-EXPORT",
      "family": "CoordinationOrderScopeLifecycle", "scenarioId": "loading-draft", "operation": "export",
      "actors": ["admin", "manager", "coordinator"], "viewports": "ALL-PC-VIEWPORTS",
      "canonicalUnknown": ["actor", "frontendPermission"],
      "controlEvidence": { "status": "ABSENT-AS-PROJECTED", "selector": "none", "source": "frontend/src/features/coordination/components/action-toolbar.tsx:141-144" },
      "sources": ["frontend/src/features/coordination/coordinationOrderScopeLifecycleRegistry.test.ts:22-171", "backend/src/IPCManagement.Api/Features/Coordination/Controllers/CoordinationOrdersController.cs:15"],
      "exclusions": { "navigation": { "status": "RESOLVED", "evidence": "Route được render." }, "viewport": { "status": "RESOLVED", "evidence": "Năm viewport không overflow." }, "fixtureCondition": { "status": "RESOLVED", "evidence": "canExport false nên absence đúng projection." }, "roleState": { "status": "UNRESOLVED", "evidence": "Actor và frontend permission canonical vẫn UNKNOWN." } },
      "consequence": "CHƯA-KẾT-LUẬN-ĐƯỢC", "disposition": "DEFERRED-CANONICAL-UNKNOWN", "pdCandidate": false
    },
    {
      "id": "U-DEMAND-PENDING",
      "family": "MaterialDemand", "scenarioId": "pending", "operation": "approval",
      "actors": ["admin", "manager"], "viewports": "ALL-PC-VIEWPORTS",
      "canonicalUnknown": ["backendPermission"],
      "controlEvidence": { "status": "OBSERVED", "selector": "role=link[name=\"Mở hàng đợi duyệt\"]", "source": "frontend/src/features/projects/weekly-menu/demand/MaterialDemandSection.tsx:37-128" },
      "sources": ["frontend/tests/operationalStateActionRegistry.test.ts:315-356", "backend/src/IPCManagement.Api/Features/Planning/Controllers/MaterialDemandController.cs:15-96"],
      "exclusions": { "navigation": { "status": "RESOLVED", "evidence": "Weekly-menu demand tab được render." }, "viewport": { "status": "RESOLVED", "evidence": "Năm viewport không overflow." }, "fixtureCondition": { "status": "RESOLVED", "evidence": "Link approval được quan sát cho actor khai báo." }, "roleState": { "status": "UNRESOLVED", "evidence": "Backend permission canonical vẫn UNKNOWN." } },
      "consequence": "CHƯA-KẾT-LUẬN-ĐƯỢC", "disposition": "DEFERRED-CANONICAL-UNKNOWN", "pdCandidate": false
    },
    {
      "id": "U-DEMAND-APPROVED",
      "family": "MaterialDemand", "scenarioId": "approved", "operation": "purchasing",
      "actors": ["admin", "manager"], "viewports": "ALL-PC-VIEWPORTS",
      "canonicalUnknown": ["backendPermission"],
      "controlEvidence": { "status": "OBSERVED", "selector": "role=link[name=\"Mở thu mua\"]", "source": "frontend/src/features/projects/weekly-menu/demand/MaterialDemandSection.tsx:37-128" },
      "sources": ["frontend/tests/operationalStateActionRegistry.test.ts:315-356", "backend/src/IPCManagement.Api/Features/Planning/Controllers/MaterialDemandController.cs:15-96"],
      "exclusions": { "navigation": { "status": "RESOLVED", "evidence": "Weekly-menu demand tab được render." }, "viewport": { "status": "RESOLVED", "evidence": "Năm viewport không overflow." }, "fixtureCondition": { "status": "RESOLVED", "evidence": "Link purchasing được quan sát cho actor khai báo." }, "roleState": { "status": "UNRESOLVED", "evidence": "Backend permission canonical vẫn UNKNOWN." } },
      "consequence": "CHƯA-KẾT-LUẬN-ĐƯỢC", "disposition": "DEFERRED-CANONICAL-UNKNOWN", "pdCandidate": false
    },
    {
      "id": "U-DEMAND-TERMINAL",
      "family": "MaterialDemand", "scenarioId": "terminal", "operation": "none",
      "actors": ["admin", "manager", "coordinator"], "viewports": "ALL-PC-VIEWPORTS",
      "canonicalUnknown": ["backendPermission", "frontendPermission"],
      "controlEvidence": { "status": "ABSENT-AS-PROJECTED", "selector": "none", "source": "frontend/src/features/projects/weekly-menu/demand/MaterialDemandSection.tsx:37-128" },
      "sources": ["frontend/tests/operationalStateActionRegistry.test.ts:315-356", "backend/src/IPCManagement.Api/Features/Planning/Controllers/MaterialDemandController.cs:15-96"],
      "exclusions": { "navigation": { "status": "RESOLVED", "evidence": "Demand tab được render." }, "viewport": { "status": "RESOLVED", "evidence": "Năm viewport không overflow." }, "fixtureCondition": { "status": "RESOLVED", "evidence": "Terminal projection không khai action." }, "roleState": { "status": "UNRESOLVED", "evidence": "Backend và frontend permission canonical vẫn UNKNOWN." } },
      "consequence": "CHƯA-KẾT-LUẬN-ĐƯỢC", "disposition": "DEFERRED-CANONICAL-UNKNOWN", "pdCandidate": false
    },
    {
      "id": "U-WAREHOUSE-ELIGIBLE",
      "family": "WarehouseFulfilment", "scenarioId": "eligible-demand", "operation": "KHÔNG-XÁC-ĐỊNH-ĐƯỢC",
      "actors": ["admin", "warehouse"], "viewports": "ALL-PC-VIEWPORTS",
      "canonicalUnknown": ["operation", "actor", "backendPermission", "frontendPermission"],
      "controlEvidence": { "status": "OBSERVED", "selector": "role=button[name=\"Tạo phiếu xuất kho\"]", "source": "frontend/src/features/warehouse/pages/WarehousePage.tsx:42-320" },
      "sources": ["frontend/tests/operationalStateActionRegistry.test.ts:460-489", "backend/src/IPCManagement.Api/Features/Inventory/Controllers/InventoryIssuesController.cs:1"],
      "exclusions": { "navigation": { "status": "RESOLVED", "evidence": "Route /warehouse được render." }, "viewport": { "status": "RESOLVED", "evidence": "Năm viewport không overflow." }, "fixtureCondition": { "status": "RESOLVED", "evidence": "Control tạo phiếu được quan sát." }, "roleState": { "status": "UNRESOLVED", "evidence": "Operation, actor và permissions canonical vẫn UNKNOWN." } },
      "consequence": "CHƯA-KẾT-LUẬN-ĐƯỢC", "disposition": "DEFERRED-CANONICAL-UNKNOWN", "pdCandidate": false
    },
    {
      "id": "U-WEEKLY-LOADING",
      "family": "WeeklyMenuLifecycle", "scenarioId": "active-loading", "operation": "KHÔNG-XÁC-ĐỊNH-ĐƯỢC",
      "actors": ["coordinator"], "viewports": "ALL-PC-VIEWPORTS",
      "canonicalUnknown": ["operation", "backendPermission", "frontendPermission"],
      "controlEvidence": { "status": "ABSENT-AS-PROJECTED", "selector": "none", "source": "frontend/src/features/projects/weekly-menu/lifecycle/weeklyMenuLifecycleModel.ts:39-45" },
      "sources": ["frontend/src/features/projects/weekly-menu/lifecycle/weeklyMenuLifecyclePa2Registry.test.ts:119-240", "frontend/src/features/projects/weekly-menu/lifecycle/weeklyMenuLifecycleModel.ts:39-45"],
      "exclusions": { "navigation": { "status": "RESOLVED", "evidence": "Route weekly-menu được render." }, "viewport": { "status": "RESOLVED", "evidence": "Năm viewport không overflow." }, "fixtureCondition": { "status": "RESOLVED", "evidence": "Loading projection không khai action." }, "roleState": { "status": "UNRESOLVED", "evidence": "Operation và permissions canonical vẫn UNKNOWN." } },
      "consequence": "CHƯA-KẾT-LUẬN-ĐƯỢC", "disposition": "DEFERRED-CANONICAL-UNKNOWN", "pdCandidate": false
    },
    {
      "id": "U-WEEKLY-ERROR",
      "family": "WeeklyMenuLifecycle", "scenarioId": "active-error", "operation": "KHÔNG-XÁC-ĐỊNH-ĐƯỢC",
      "actors": ["coordinator"], "viewports": "ALL-PC-VIEWPORTS",
      "canonicalUnknown": ["operation", "backendPermission", "frontendPermission"],
      "controlEvidence": { "status": "ABSENT-AS-PROJECTED", "selector": "none", "source": "frontend/src/features/projects/weekly-menu/lifecycle/weeklyMenuLifecycleModel.ts:39-45" },
      "sources": ["frontend/src/features/projects/weekly-menu/lifecycle/weeklyMenuLifecyclePa2Registry.test.ts:119-240", "frontend/src/features/projects/weekly-menu/lifecycle/weeklyMenuLifecycleModel.ts:39-45"],
      "exclusions": { "navigation": { "status": "RESOLVED", "evidence": "Route weekly-menu được render." }, "viewport": { "status": "RESOLVED", "evidence": "Năm viewport không overflow." }, "fixtureCondition": { "status": "RESOLVED", "evidence": "Error projection không khai action." }, "roleState": { "status": "UNRESOLVED", "evidence": "Operation và permissions canonical vẫn UNKNOWN." } },
      "consequence": "CHƯA-KẾT-LUẬN-ĐƯỢC", "disposition": "DEFERRED-CANONICAL-UNKNOWN", "pdCandidate": false
    },
    {
      "id": "U-WEEKLY-NO-SHORTAGE",
      "family": "WeeklyMenuLifecycle", "scenarioId": "active-no-shortage", "operation": "KHÔNG-XÁC-ĐỊNH-ĐƯỢC",
      "actors": ["coordinator"], "viewports": "ALL-PC-VIEWPORTS",
      "canonicalUnknown": ["operation", "backendPermission", "frontendPermission"],
      "controlEvidence": { "status": "ABSENT-AS-PROJECTED", "selector": "none", "source": "frontend/src/features/projects/weekly-menu/lifecycle/weeklyMenuLifecycleModel.ts:123-124" },
      "sources": ["frontend/src/features/projects/weekly-menu/lifecycle/weeklyMenuLifecyclePa2Registry.test.ts:119-240", "frontend/src/features/projects/weekly-menu/lifecycle/weeklyMenuLifecycleModel.ts:123-124"],
      "exclusions": { "navigation": { "status": "RESOLVED", "evidence": "Route weekly-menu được render." }, "viewport": { "status": "RESOLVED", "evidence": "Năm viewport không overflow." }, "fixtureCondition": { "status": "RESOLVED", "evidence": "No-shortage projection không khai action." }, "roleState": { "status": "UNRESOLVED", "evidence": "Operation và permissions canonical vẫn UNKNOWN." } },
      "consequence": "CHƯA-KẾT-LUẬN-ĐƯỢC", "disposition": "DEFERRED-CANONICAL-UNKNOWN", "pdCandidate": false
    },
    {
      "id": "U-WEEKLY-INCONSISTENT",
      "family": "WeeklyMenuLifecycle", "scenarioId": "inconsistent", "operation": "KHÔNG-XÁC-ĐỊNH-ĐƯỢC",
      "actors": ["coordinator"], "viewports": "ALL-PC-VIEWPORTS",
      "canonicalUnknown": ["operation", "backendPermission", "frontendPermission"],
      "controlEvidence": { "status": "ABSENT-AS-PROJECTED", "selector": "none", "source": "frontend/src/features/projects/weekly-menu/lifecycle/weeklyMenuLifecycleModel.ts:62-92" },
      "sources": ["frontend/src/features/projects/weekly-menu/lifecycle/weeklyMenuLifecyclePa2Registry.test.ts:119-240", "frontend/src/features/projects/weekly-menu/lifecycle/weeklyMenuLifecycleModel.ts:62-92"],
      "exclusions": { "navigation": { "status": "RESOLVED", "evidence": "Route weekly-menu được render." }, "viewport": { "status": "RESOLVED", "evidence": "Năm viewport không overflow." }, "fixtureCondition": { "status": "RESOLVED", "evidence": "Inconsistent projection không khai action." }, "roleState": { "status": "UNRESOLVED", "evidence": "Operation và permissions canonical vẫn UNKNOWN." } },
      "consequence": "CHƯA-KẾT-LUẬN-ĐƯỢC", "disposition": "DEFERRED-CANONICAL-UNKNOWN", "pdCandidate": false
    },
    {
      "id": "U-WEEKLY-SUPERSEDED",
      "family": "WeeklyMenuLifecycle", "scenarioId": "superseded", "operation": "KHÔNG-XÁC-ĐỊNH-ĐƯỢC",
      "actors": ["coordinator"], "viewports": "ALL-PC-VIEWPORTS",
      "canonicalUnknown": ["operation", "backendPermission", "frontendPermission"],
      "controlEvidence": { "status": "ABSENT-AS-PROJECTED", "selector": "none", "source": "frontend/src/features/projects/weekly-menu/lifecycle/weeklyMenuLifecycleModel.ts:94-130" },
      "sources": ["frontend/src/features/projects/weekly-menu/lifecycle/weeklyMenuLifecyclePa2Registry.test.ts:119-240", "backend/src/IPCManagement.Api/Features/Coordination/Services/MenuSchedulePolicy.cs:61-67"],
      "exclusions": { "navigation": { "status": "RESOLVED", "evidence": "Route weekly-menu được render." }, "viewport": { "status": "RESOLVED", "evidence": "Năm viewport không overflow." }, "fixtureCondition": { "status": "RESOLVED", "evidence": "Superseded projection không khai action." }, "roleState": { "status": "UNRESOLVED", "evidence": "Operation và permissions canonical vẫn UNKNOWN." } },
      "consequence": "CHƯA-KẾT-LUẬN-ĐƯỢC", "disposition": "DEFERRED-CANONICAL-UNKNOWN", "pdCandidate": false
    }
  ]
}
```

## Năm câu hỏi PD

Không có row thuộc bốn nhóm actionable mismatch nên không candidate nào được đưa sang implementation. Vì vậy
không có lower-layer operation, permission/precondition, reversibility/confirmation, PB placement hay
cross-screen duplication nào bị suy diễn để hợp thức hóa một nút mới. Nếu canonical UNKNOWN được giải quyết ở
phase sau, PC phải chạy lại trước khi mở một scope PD riêng.
