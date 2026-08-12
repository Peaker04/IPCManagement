# Phase 05 lane7 ServiceRun kernel migration runbook

## Scope and hard boundary

Wave 1 reviews files only. It opens no database connection and records
`protectedLaneConnectionAttempts = 0`. The only permitted later live target is exactly
`ipc_lane7`; every other name is rejected by the runner before any connection-capable command.

Reviewed artifacts:

- EF migration: `20260812170357_AddMultiCustomerServiceRunKernel`
- EF migration source: `backend/src/IPCManagement.Api/Migrations/20260812170357_AddMultiCustomerServiceRunKernel.cs`
- Reviewed SQL: `tools/db/phase05/phase05-service-run-ipc-lane7-reviewed.sql`
- Reviewed SQL SHA-256: `1180DA66DFB7842B943825815F89480C588EF0280182AA2365583303F6E28ACD`
- Runner: `tools/db/phase05/Invoke-Phase05Lane7Migration.ps1`

Plan 05-05 adds a second ordered, reviewed artifact after the ServiceRun kernel:

- EF migration: `20260812172709_AddPurchaseOrderCompatibilityScope`
- EF migration source: `backend/src/IPCManagement.Api/Migrations/20260812172709_AddPurchaseOrderCompatibilityScope.cs`
- Reviewed purchasing SQL: `tools/db/phase05/phase05-purchasing-ipc-lane7-reviewed.sql`
- Reviewed purchasing SQL SHA-256: `9ABB242D380703A58F85DDC769B2EBC6E7BF99FFF9D2C00FE68F5DD95C135E62`

The purchasing script adds explicit `receivingWarehouseId`, `purchasingTerms`, and PO
`proposedDeliveryDate` compatibility fields plus the two compatibility indexes. It does
not infer values for legacy orders. A legacy order without the complete four-field key
remains immutable until the existing backend decision queue resolves it; documents,
movements, audit rows and outbox history are preserved.

The SQL is additive. It retains `uqServiceRunsPlanShift` because an existing foreign key depends
on that legacy key, and adds `uqServiceRunsCustomerDateShiftTier` for the customer-scoped identity.
It also retains close snapshots, documents, stock movements, audit rows and outbox history. It backfills only a single-valued `customer × tier` source scope; legacy rows
with zero or multiple candidates remain unscoped and receive one decision item.

The reviewed ServiceRun SQL is compatible with MySQL 9.5: it does not use conditional
`ADD COLUMN`, `CREATE INDEX`, or `ADD CONSTRAINT` syntax. Each additive column, index, and
foreign key is guarded by `information_schema` metadata and an individual prepared DDL
statement, so a retry preserves forward-only, no-drop semantics.

## Required receipts

Every later migration attempt produces separate receipts; no receipt permits reset, seed, import,
or restore setup.

| Stage | Required evidence |
| --- | --- |
| PRE-FLIGHT | commit, target `ipc_lane7`, ordered migration heads, current lineage/counts, reviewed SQL hash, `protectedLaneConnectionAttempts = 0` before connection |
| CHECKPOINT | approved SQL hash, approved checkpoint pointer/hash, named responsible operator and continuation authorization |
| APPLY | runner command, target, ordered migration heads, actual SQL hash, start/end timestamp and exit result |
| POST-FLIGHT | EF history head, source-line/decision-item counts, schema/index/FK inventory and immutable document/movement/audit/outbox preservation evidence |
| ROLLBACK | forward-recovery disposition, checkpoint pointer/hash and confirmation that no destructive Down runs after lifecycle evidence exists |

For the purchasing addition, POST-FLIGHT must separately record existence of
`purchaselinesupplierdecisions.receivingWarehouseId`,
`purchaselinesupplierdecisions.purchasingTerms`, `purchaseorders.proposedDeliveryDate`,
`purchaseorders.receivingWarehouseId`, `purchaseorders.purchasingTerms`,
`ixPurchaseLineSupplierDecisionsCompatibility` and `ixPurchaseOrdersCompatibility`. ROLLBACK is forward-recovery only after any
durable lifecycle evidence exists: preserve both reviewed SQL receipts and resolve legacy
compatibility through the existing decision queue; do not execute destructive Down SQL.

## Inspect-first use

Wave 1 validates the contract with `-NoDatabase`; it does not run the runner against a database.
Later, inspection without `-Apply` outputs the expected manifest and still does not connect.
APPLY is refused unless all of these are present: `-Apply`, `-Database ipc_lane7`, the exact
`-ApprovedSqlSha256`, and an existing `-CheckpointReceipt`.

Plan 05-05 must add the ordered purchasing migration and its reviewed SQL. It is an addition to,
not a replacement for, this ServiceRun kernel artifact. Plan 05-04 owns the ordered live apply
and evidence consumption.
