# Phase 28 Context

## Locked sequence

1. Freeze SPEC and UI-SPEC.
2. Extend the existing Phase 27 measurement harness.
3. Run and seal a read-only baseline across the whole website.
4. Plan and implement evidence-backed UI/UX remediation in at most three waves.
5. Only after UI closeout, enforce exactly one active operational warehouse using an additive, fail-closed compatibility design.
6. Research physical database consolidation and migration retirement separately; do not execute them in Phase 28.

## Locked UI decisions

- Preserve IPCManagement’s current visual identity and shadcn/Base UI stack.
- Use SAP Fiori, Carbon, Atlassian and Polaris as pattern references, not dependencies.
- Audit information hierarchy, typography, spacing, cards/data containers, tables, query states, responsive behavior and WCAG 2.2 AA.
- Fix token → primitive → formatter/hook → layout → page, choosing the lowest demonstrated owner.
- Screenshot is review evidence only. DOM, ARIA, geometry, focus, computed style, request and performance records determine verdicts.
- Do not redesign from taste; every production path needs an exact finding and expected value.

## Locked warehouse decisions

- Business target is one operational warehouse.
- Phase 28 does not delete old warehouse rows, rewrite IDs, merge balances or edit old migrations.
- A later compatibility implementation will designate exactly one active warehouse; historical warehouses remain inactive/retired for provenance.
- Zero or multiple active warehouses fail closed; never choose by `First`, sort order or activity.
- Client selectors disappear only after server-side resolution and compatibility tests exist.
- Warehouse IDs remain internal wherever needed for FKs, stock grain, audit, source lineage and purchasing compatibility.

## Harness decisions

- Extend `frontend/tests/ui-audit.spec.ts` and its existing report/evidence path rather than introduce another runner.
- Inventory every route/state/table/container first; validator fails closed on missing identities.
- Every deterministic rule needs explicit expected values plus known-bad and known-clean proof.
- AI review is limited to hierarchy, grouping, balance and information architecture that cannot be deterministically decided.
- Baseline findings use `PASS`, `FAIL`, `NOT_APPLICABLE`, `NEEDS_EVIDENCE` or `UNRESOLVED`; only exact `FAIL` with an owner may authorize production work.

## Deferred

- Physical deletion or consolidation of warehouse data.
- Rewriting historical migrations or removing warehouse keys from persistence.
- New business workflows, permissions or API semantics unrelated to measured UI findings.
