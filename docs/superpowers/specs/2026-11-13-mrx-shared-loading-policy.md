# MRX shared loading policy and coverage audit

The user requests a systemic fix for recurring flash, rather than another list of isolated modal patches. This continues the already-authorized native loading repair; it does not authorize DB mutations, campaigns, installs, main-service restarts or subagents. WORK is the sole task-state owner.

## Proven causes

1. StateBoundary only suppressed descendants individually tagged by callers. An unmarked custom placeholder could paint text, backgrounds and dividers before150ms. Default widget skeleton also left its card background/border visible. The boundary must own the whole decorative subtree while preserving layout and accessible status.
2. useDeferredSkeleton hid a visible indicator through a zero-delay timer. A second read before that timer fired could cancel it and inherit the previous visible indicator. Each default-policy loading cycle must reset before paint, wait150ms, and release ready data immediately.
3. Two reachable callers still bypassed the intended read policy: source-week metadata and BOM batch-import metadata. Pending announcements belong outside visual flow; stable controls remain mounted and locked as appropriate.

## Decision

Use the existing hook, StateBoundary, WorkbenchSkeleton and existing UI styles. Own the150ms default in one exported constant. StateBoundary gates the entire custom/widget subtree, so callers only provide geometry, not paint-control annotations. Remove the redundant annotations from Dashboard, Warehouse and Chef custom skeletons. Keep explicit legacy minimum-duration support, but default MRX presentation has no artificial hold. Do not alter cache keys, API contracts, business states, RBAC, mutation behavior or error precedence.

Changing every query library or disabling global motion would exceed the demonstrated cause. Leaving the policy dependent on per-caller markup would recreate the same defect. No new loading component family is needed.

## Coverage map

Derived from CANONICAL_ROUTES, including shared operational surfaces available in MRX. This is a source/caller inventory; it is not authenticated runtime certification.

| Route/leaf | Data/presentation owner traced | Loading/transition coverage |
| --- | --- | --- |
| `/` MRX | ReconciliationDashboardPage; paged local read; StateBoundary | Custom metric/table subtree now governed centrally; previous scope retained/busy. |
| weekly `mrx-batch` | useMrxBatchWorkspace/useMrxSourceEdit; MrxBatchWorkbench | Query generation and source grain retained; source metadata pending label made sr-only; matrix boundary unchanged. |
| weekly `mrx-materials`, `mrx-plans` | MrxQuantityInspectionPage and its workspace | Shared query/boundary; explicit incompatible material/plan schemas remain separate; not a reason to show foreign rows. |
| warehouse `mrx-daily` | MrxDailyIssueWorkbench; shared query | Shared boundary owns custom toolbar/table paint; old daily issue actions remain locked during scope change. |
| warehouse `mrx-preparation` | MrxMultiCustomerPreparationWorkbench | Shared scoped query; retained previous-scope data/status; export authority unchanged. |
| warehouse `mrx-issues` | WarehousePage source-history branch | Scoped/paged shared boundary; filter identity/retry and read-only separation retained. |
| chef `mrx-cooking` | MrxCookingWorkbench | Shared custom skeleton gate, schema/scope checks, retained list/detail and shift selectors. |
| reconciliation lines | ReconciliationPage/useReconciliationWorkspace | Stable blocker/day controls; same-batch pending read retains presentation, foreign-scope conclusions suppressed. |
| reconciliation variances, transactions | ReconciliationReportTables and branches | LocalizedBoundary cold geometry and retained exact-schema report paging; no decorative progress stroke. |
| reconciliation audit (both tabs) | ReconciliationAuditBranch/report owner | Independent report schema, server search/page, shared cold placeholder; prior-page actions locked. |
| reconciliation completed | ReconciliationCompletedBranch/report owner | Historical filters and paged read use existing retained report boundary. |
| admin ingredients, dishes | AdminCatalogBranch/useWorkbenchQuery | Shared boundary, composed/debounced search, retained page identity and explicit error handling. |
| admin BOM | AdminBomBranch; editor/batch-import modals | Shared table boundary; editor/frozen modals already use shared geometry. Batch-import metadata no longer inserts transient paragraphs. |
| admin customers | AdminCustomersBranch | Shared boundary, retained list/search/selection, existing dirty guards. |
| settings advanced/mode | AdvancedSettingsPage/auth context | No independent query skeleton; mode mutation feedback/confirmation is meaningful and remains visible. |
| shared modals | Batch picker, source import/history/preview, frozen dishes, issue detail, BOM editor/import, dirty confirmation | Existing shared placeholder or reserved controls; async read announcements distinguished from mutation/error/confirmation feedback. |

DEFAULT-only DashboardPage/ChefDashboardPage are not MRX callers. ReconciliationQueueCards has no reachable caller; its pulse is not evidence of a live MRX defect. Login/forbidden are shared authentication exits, not business data-loading tables. Intentional modal entrance/focus/hover/mutation feedback is retained. Historical interrupted-clone cleanup and DB qualification remain outside this audit.

## Verification contract

RED/GREEN regressions must include unmarked custom decoration and consecutive loading cycles without an intervening timer tick. Real Chrome must measure computed visibility and geometry at960/1920 across slow→ready→slow reads, in addition to prior fast40/80ms, slow320ms, warm report, scope-focus and modal checks. Run the full FE suite because the owners are shared, plus build/lint, architecture/conformance and whitespace checks. Browser fixtures block business API access and never count as source-DB qualification. No claim of all-runtime-flash absence follows from isolated component probes.
