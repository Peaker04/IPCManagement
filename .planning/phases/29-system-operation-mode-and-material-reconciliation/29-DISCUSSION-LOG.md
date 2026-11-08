# Phase 29: System Operation Mode and Material Reconciliation - Discussion Log

> **Audit trail only.** Do not use as input to planning, research, or execution agents.
> Decisions are captured in CONTEXT.md — this log preserves the alternatives considered.

**Date:** 2026-08-25
**Phase:** 29-system-operation-mode-and-material-reconciliation
**Areas discussed:** batch authority, purchased/issued authority, mode switching, correction lifecycle, completion, edge cases, prohibitions, autonomous implementation defaults

---

## Batch authority

| Option | Description | Selected |
|---|---|---|
| Import immediately creates immutable authority | Every committed import is frozen immediately | |
| Separate action creates batch after import | No batch exists until a later action | |
| Import creates draft; explicit readiness freezes authority | Diagnostics can be resolved before immutable history begins | ✓ |

**User's choice:** Import creates a draft batch; “Sẵn sàng đối chiếu” establishes immutable authority.
**Notes:** Preview/failed import is not authoritative. Empty or unresolved draft cannot become ready.

---

## Purchased actual authority

| Option | Description | Selected |
|---|---|---|
| Batch-owned direct entry | Purchasing enters actual per batch line without PR/PO/receipt/stock lifecycle | ✓ |
| Reuse PR/PO | Purchased values come from current procurement documents | |
| Derive from posted receipts | Purchased values come only from inventory receipts | |
| Support both in Phase 29 | Manual and document-derived authorities coexist | |

**User's choice:** Batch-owned direct entry.
**Notes:** Must retain actor/time/source identity and create no procurement or stock records.

---

## Mode switching with work in progress

| Option | Description | Selected |
|---|---|---|
| Always change immediately | Preserve data and block new excluded operations | |
| Block while any work remains | Mode cannot change until all work completes | |
| Allow change with mandatory reason when work is active | Preserve work, record explicit Admin rationale | ✓ |

**User's choice:** Allow the change, but require Admin reason when work is in progress.
**Notes:** Data is never deleted or rewritten. Server remains the authority after transition.

---

## Issued actual authority

| Option | Description | Selected |
|---|---|---|
| Batch-owned direct entry | Warehouse enters actual per batch line without issue/stock movement | ✓ |
| Derive from inventory issues | Reuse full warehouse lifecycle | |
| Manual then replace from documents | Authority can silently change source | |

**User's choice:** Batch-owned direct entry.
**Notes:** Preserve Warehouse permission; do not deduct or manufacture stock.

---

## Actual correction lifecycle

| Option | Description | Selected |
|---|---|---|
| Never correct; create new batch | Any mistake requires a replacement batch | |
| Append-only correction before completion | Old/new/actor/time/reason retained; demand/tolerance stay frozen | ✓ |
| Freely edit and keep final value only | No historical revisions | |
| Separate adjustment records only | Initial values immutable; deltas added | |

**User's choice:** Append-only correction before completion.
**Notes:** Concurrent stale writers are rejected; completed batches remain immutable.

---

## Completion meaning

| Option | Description | Selected |
|---|---|---|
| Values only | Every line has purchased/issued values | |
| Values plus exception disposition | Explicit zero allowed; every exceptional line has disposition/reason | ✓ |
| Admin may force incomplete completion | Missing lines allowed with reason | |
| No completion state | Reports always remain live | |

**User's choice:** Values plus exception disposition.
**Notes:** Empty batch cannot complete. Missing/null differs from explicit zero.

---

## Edge-completeness package

| Edge | Resolution | Selected |
|---|---|---|
| Invalid/missing mode | Fail closed; no implicit `DEFAULT` | ✓ |
| Mode switch racing with mutation | Revalidate inside transaction and backstop with concurrency test | ✓ |
| Empty/unresolved draft | Diagnostics allowed; readiness blocked | ✓ |
| Duplicate source contributors | Aggregate by ingredient ID + canonical unit and retain contributors | ✓ |
| Difference equals tolerance | Within tolerance; only strict greater-than is exceptional | ✓ |
| Concurrent actual correction | Optimistic concurrency; no last-write-wins | ✓ |
| Empty completion | Cannot become ready/completed | ✓ |
| Short identifier collision | Expand distinguishing segment/full value; held-out UI test | ✓ |

**User's choice:** Accepted the complete E1–E8 package.

---

## Prohibition package

| Prohibition | Verification | Selected |
|---|---|---|
| Mode cannot grant or disguise permissions | Role × mode × route/action/API matrix | ✓ |
| Actual entry cannot create fake procurement/stock lifecycle | DB before/after mutation inventory | ✓ |
| Current config/source edits cannot rewrite frozen history | Immutable-history regression | ✓ |
| Clarity cleanup cannot erase identity or business/error/audit meaning | Semantic DOM/runtime contracts plus judgment review | ✓ |

**User's choice:** Accepted P1–P4.

---

## Autonomous implementation defaults

The user issued `/goal` to complete Phase 29 end-to-end. The agent therefore selected all remaining implementation gray areas using the safest recommended defaults:

- durable singleton mode row with optimistic concurrency;
- centralized mode policy/operation registry composed before permissions;
- explicit `DRAFT → READY → IN_PROGRESS → COMPLETED` batch lifecycle;
- frozen ingredient/unit/source/tolerance snapshot;
- tolerance precedence ingredient → unit group → system default;
- separate Purchasing/Warehouse actual records with append-only revisions;
- retained-route placement rather than parallel top-level reconciliation routes;
- at-most-three lowest-owner clarity waves;
- layered unit/API/DB/frontend/headed verification on a newly controlled scope.

## the agent's Discretion

- Exact endpoint, class, component, migration and table names.
- Exact compact presentation inside current shared UI primitives.
- Pagination/filter arrangement and centralized disposition category names.

## Deferred Ideas

- Automatic legacy unit normalization.
- Deriving reconciliation actuals from full procurement/warehouse documents.
- Per-user/per-role modes.
- Physical warehouse consolidation or historical-ID removal.
- New UI framework or broad brand redesign.
