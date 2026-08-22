# Phase 27: Warehouse Data Workspace contract pilot - Discussion Log

> **Audit trail only.** Do not use as input to planning, research, or execution agents.
> Decisions are captured in CONTEXT.md — this log preserves the alternatives considered.

**Date:** 2026-08-22
**Phase:** 27-Warehouse Data Workspace contract pilot
**Areas discussed:** Pilot surface, Evidence states, Deterministic rules, AI review boundary

---

## Pilot surface

| Decision | Options considered | Selected |
|---|---|---|
| Detailed surface | Movement only; all tabs; Movement detailed plus three-tab shell | Movement detailed plus three-tab shell |
| Responsive rail | Always side-by-side; rail may stack below; collapsible rail | Rail may stack below |
| Dataset hierarchy | Peer datasets; primary stock plus supporting history; combined switcher | Primary stock plus supporting history |
| Document rail | Tab-level supporting rail; selection-contextual rail; movement-only rail | Tab-level supporting rail |

**Notes:** Detailed scope includes current stock, stock movements, documents, searches, pagination, query states and responsive split. Shell scope covers active-tab semantics, names, keyboard/focus, preserve-visited lifecycle and geometry. Stacked rail preserves DOM/focus order and is not duplicated.

---

## Evidence states

| Decision | Options considered | Selected |
|---|---|---|
| Actors | Warehouse keeper only; keeper plus forbidden actor; broad role matrix | Keeper plus forbidden actor |
| State evidence | All browser states; risk-based two tiers; ready browser only | Risk-based two tiers |
| Ready data | Normal; representative upper-bound; normal plus stress | Representative upper-bound |
| Empty browser state | All empty; mixed empty; both scenarios | Mixed empty |

**Notes:** Browser runs ready/mixed-empty/forbidden at five viewports. Structural tests own loading/refreshing/error/all-empty unless geometry proves escalation. Fixture data remains domain-valid and stable across viewports.

---

## Deterministic rules

| Decision | Options considered | Selected |
|---|---|---|
| Blocking scope | Geometry only; core contract; all UI rules | Core contract |
| Owner resolution | Semantic/test-owned mapping; metadata everywhere; DOM inference | Semantic/test-owned mapping |
| Spacing | All computed spacing; contracted region spacing; AI-only | Contracted region spacing |
| Severity | Every deterministic violation blocks; high/blocker only; blocker only | Every deterministic violation blocks |

**Notes:** A blocking rule requires known expected value, machine-readable evidence and owner. Ownership resolution order is semantic locator → test manifest → source-aware map → local metadata. Browser rounding receives explicit tolerance.

---

## AI review boundary

| Decision | Options considered | Selected |
|---|---|---|
| Evidence selection | All captures; risk-selected set; deterministic failures only | Risk-selected set |
| Finding authority | Description only; expected outcome plus owner; prescribe solution | Expected outcome plus owner |
| FAIL validity | Confidence only; evidence-complete confidence policy; advisory only | Evidence-complete confidence policy |
| Re-review | Same reviewer with diff; fresh evidence-only reviewer; deterministic only | Fresh evidence-only reviewer |

**Notes:** All 15 captures remain in the manifest. AI receives a reasoned subset and cannot expand it. AI does not select components, write CSS, change tokens, auto-fix or plan implementation. FAIL requires complete evidence and confidence >= 0.8. Fresh re-review hides implementation rationale and solution diff.

## the agent's Discretion

- Technical file boundaries and helper structure.
- Exact measured breakpoint within the existing viewport matrix.
- Documented tolerance for browser rounding.

## Deferred Ideas

- Admin Data validation after Warehouse closeout.
- Purchasing Data Workspace/Workflow boundary after Admin Data validation.
- Generic UI framework, page renderer, component-stack replacement and redesign mockups.
