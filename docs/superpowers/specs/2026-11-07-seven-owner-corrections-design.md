# Seven owner corrections — approved design

Owner approved the integrated proposal in chat, including mandatory Impeccable review for frontend changes. WORK.md is the only execution ledger.

## Outcomes
1. Customer management has no fixed price column or price entry on creation. New customer creation needs code/name, optional note, not an invented priced contract. Import retains explicit supported tiers 25000/30000/34000. Existing explicit legacy contract callers and historical contract/frozen prices remain compatible. Active/inactive actions update customer state/audit only, never reprice schedules; authorized action, confirmation, pending guard, visible errors and server-returned state required.
2. Known shift labels are Sáng / Chiều; wire enums do not change.
3. Dish names on `/admin-data?view=bom` open the existing BOM dialog in read-only mode, keyboard accessible. Editing remains a separate action with its existing authorization.
4. Protected requests attempt the existing HttpOnly-cookie refresh endpoint once before expiring an authenticated session. Concurrent failures share one refresh. Changed/logged-out sessions cannot be restored by late refresh results. Refresh rejection is terminal; network/5xx/rate-limit failures retain credentials and report errors. No TTL extension, refresh credential in browser storage, automatic retry of uncertain writes or weakening of security guards. Downloads use the same authenticated transport.
5. Operational week is Monday–Saturday, including preparation controls and workbook ranges. Sunday is rejected for new service imports/daily writes, not removed from the Gregorian date picker or erased from historical records. Historical reports retain access to saved records. Existing source/scope is never silently rewritten.
6. Center only the variance empty state in its available content region below the header/toolbars; preserve the short copy. Warehouse prerequisite guidance is not globally moved.
7. Already-issued day tags use the existing success badge, retaining their text and lock behavior. Other lock reasons are not recolored as success.

## Existing-owner approach
Use current CustomerContractService/controller/API, AdminCustomersBranch/CreateCustomerModal, AdminBomBranch/DishBomEditorModal, api/client + AuthProvider + fileDownload, date-strip/preparation query/import/daily-policy owners, ReconciliationVariancesBranch and MrxSourceEditGrid. No new route, modal family, dependency, style tokens or pricing subsystem. Customer-only creation omits shift/contract controls that cannot honestly be persisted without a priced contract; legacy explicit-price API still creates contracts.

## Safety and proof
Preserve DOM-MODE-1, RBAC, audit, frozen lineage/units/precision, transaction and idempotency fences. Existing tests at actual persistence/network/UI boundaries own new behavior, not duplicated class-only assertions. UI verification uses Impeccable/canonical DESIGN and bounded dedicated fixtures, never owner profiles or real business mutations. No deployment, package install, migration, cleanup, restart, credential access, staging, commit or delegation is authorized. Source/automatic/rendered/real-owner acceptance stay distinct.
