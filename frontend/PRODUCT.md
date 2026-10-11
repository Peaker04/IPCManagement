# Product

<!-- impeccable:product-schema 1 -->

## Platform

web

## Users

- **DEFAULT Mode (6 operational roles):**
  - **Điều phối (Coordination):** Customer/week/tier selection, weekly menu and servings planning, daily demand readiness, and kitchen handoff for service dates and shifts.
  - **Thu mua (Purchasing):** Shortage proposals, supplier quotations, quotation approvals, and purchase orders.
  - **Kho (Warehouse):** Receipt inspection, stock movements, snapshot audits, material issues, and supplemental line handling.
  - **Bếp (Kitchen):** Daily production plan verification, issue checklist inspections, whole-issue acknowledgement, and shortage/surplus/return logging.
  - **Quản lý (Manager):** Approvals and reviews with strict separation of duties (SoD).
  - **Quản trị viên (Admin):** Master data administration, permission governance, and authorized operational maintenance.
- **MATERIAL_RECONCILIATION / MRX Mode (4 distinct roles, strictly separated from DEFAULT):**
  - **Điều phối (MRX Coordinator):** Source line management, freeze, and transfer.
  - **Thủ kho (MRX Storekeeper):** Daily material issues under MRX contract.
  - **Quản lý (MRX Manager):** Discrepancy investigation and batch completion.
  - **Bếp trưởng (Head Chef):** Cooking consumption export.
  *(Note: MRX roles do not map 1:1 to DEFAULT roles; Bếp ≠ Bếp trưởng, Kho ≠ Thủ kho).*

## Product Purpose

IPCManagement coordinates industrial meal planning, procurement, warehouse logistics, and kitchen preparation across multi-tenant enterprise contracts. It guarantees physical stock and financial reconciliation accuracy, enforces strict separation of duties, and eliminates food waste and inventory drift without fabricated data.

## Positioning

Strict trace-auditable meal production supply chain based on flat 1-level BOM quantity per serving (6-decimal precision) and daily shift demand. Enforces a non-negotiable architectural boundary between `DEFAULT` operations (gross handoff history with separate compensating returns) and `MATERIAL_RECONCILIATION` (MRX daily lineage: batch × serviceDate × ingredient × unit, net confirmed returns), underpinned by an immutable stock ledger and an operational warehouse singleton.

## Operating Context

- **Environment:** On-site industrial canteens, central preparation kitchens, and industrial food warehouses.
- **Devices:** Desktop and tablet workstations (web-only; mobile phones not supported).
- **Service Window:** 05:00–22:00 Asia/Ho_Chi_Minh.
- **Handoffs & Rituals:** Daily shift meal ordering, locked servings, morning warehouse dispatch, whole-issue kitchen check-in, cooking shift completion, and daily reconciliation audits.

## Capabilities and Constraints

- **Architectural Boundary:** `DEFAULT != MATERIAL_RECONCILIATION` invariant. Shared master data and physical stock, but strictly separated workflow records, lineage, permissions, queries, and audit families.
- **BOM Precision:** Flat 1-level BOM with 6-decimal precision per serving (`weekly-menu.md`).
- **Financial Calculation:** Currency rounded to whole VND at financial boundaries; intermediate BOM quantities must never be rounded prematurely.
- **Immutable Stock Ledger:** No hard-deletion of issues, document lines, movements, returns, audit logs, contributors, or history.
- **Fixed Stock Movements:** MySQL `stockmovements.movementType` fixed enum: `RECEIPT | ISSUE | RETURN | ADJUSTMENT | RECEIPT_CORRECTION`.
- **MRX Lineage:** Frozen daily lineage partitioned strictly by `batch × serviceDate × ingredient × unit`.
- **Operational Warehouse Singleton:** Enforced by database migration `20260824161853_EnforceSingleOperationalWarehouse` (`OperationalSingletonKey` at-most-one unique fence).
- **Presentation Authority:** Governed by `docs/DESIGN.md` canonical rule IDs (P/D/L/S/T/M/I/C/F/E/A/N/V and Q0–Q3).
- **Data Authenticity:** Strict prohibition of fabricated page capacity, synthetic rows, or speculative zero/empty states prior to authoritative API resolution (C1/C2/C10).
- **Action Hierarchy:** One primary action with an optional destructive decision partner pattern (D7); density policy (T8) remains pending owner decision.

## Brand Commitments

- **Application Name:** IPCManagement.
- **Aesthetic Tone:** Quiet Operational — calm, flat cool-slate surfaces, hairline borders, dense tabular layouts tailored for food-service logistics; free from promotional marketing fluff or decorative excess.
- **Language & Labels:** Vietnamese operational vocabulary across all UI surfaces (`Điều phối`, `Thu mua`, `Kho`, `Bếp`, `Quản lý`, `Quản trị viên`, `Phiếu nhập`, `Phiếu xuất`, etc.). Technical keys, UUIDs, and foreign terms remain relegated to secondary metadata or copy affordances.

## Evidence on Hand

- **Canonical Specifications:** `docs/DOMAIN.md`, `docs/DESIGN.md`, `docs/OPERATIONS.md`, `docs/FLOWS.md`, `docs/domain/weekly-menu.md`, `docs/domain/warehouse-contract.md`, `docs/domain/material-reconciliation.md`.
- **Verified Migration:** `backend/src/IPCManagement.Api/Migrations/20260824161853_EnforceSingleOperationalWarehouse.cs`; runtime evidence in `Models/Entities/Warehouse.cs` (`IsOperationalActive`), `Features/Inventory/Persistence/InventoryEntityConfigurations.cs` (computed `OperationalSingletonKey` + unique index `uqWarehousesOperationalSingleton`), `Data/Repositories/WarehouseRepository.cs` (SQL reader of `IsOperationalActive = TRUE`), and `Migrations/IpcManagementContextModelSnapshot.cs` (DB schema mirror).
- **Verification Baselines:** Playwright test cohorts in `frontend/tests/browser/` (E2E, visual regression, audit) and Vitest suites in `frontend/tests/`.

## Product Principles

1. **Physical & Financial Truth First:** Zero tolerance for stock fabrication, synthetic rows, or guessed conversion units.
2. **Strict Separation of Duties & Mode Isolation:** Operational handoffs and permission boundaries between roles and modes must never bleed into one another.
3. **Quiet Operational Ergonomics:** High-density, high-legibility scanning designed for busy desktop and tablet workstations in operational food-service environments.
4. **Immutable Lineage:** Every stock event, approval, and handoff must leave an indelible, auditable footprint.

## Accessibility & Inclusion

- **Standard:** WCAG 2.2 AA conformance (text contrast >= 4.5:1, essential controls/focus indicators >= 3:1).
- **Ergonomics:** Complete keyboard accessibility for data grids, dialogs, and complex form interactions; touch-target compliance on tablet viewports.
- **Typography:** Inter Variable font with native line-height accommodation ensuring Vietnamese diacritical marks are never clipped at standard or zoomed scales.
