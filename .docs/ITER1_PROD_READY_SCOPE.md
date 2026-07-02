# Iter1 Production-Ready Scope

Date locked: 2026-07-02
Source of truth: `Project_Tracking (1).xlsx`, sheet `Iter1_ProdReady_Plan`

This document closes PRD-001 by turning the Iter1 tracker into the official release acceptance checklist. The workbook remains the detailed task board; this file records how reviewers should read it and what must be true before LAN/prod release.

## Signed Scope

Iter1 production-ready scope is the operational kitchen workflow:

Contract -> Menu -> Order -> Demand -> Purchase -> Approval -> Warehouse -> Kitchen -> Reports -> Release

The scope is accepted only when every P0 row in `Iter1_ProdReady_Plan` has:

- Owner: the role responsible for delivery or verification.
- Surface: screen, API, report, config, or runbook where the work is visible.
- Trigger: when the task applies.
- Rule: business validation or release gate.
- Output: artifact, record, report, or UI state created by the task.
- Acceptance: the concrete check a stakeholder or QA can repeat.
- Evidence: note with command, test result, commit, or manual verification date.

## Tracker Snapshot

Current tracker count after PRD-110:

| Status | Count |
| --- | ---: |
| Done | 45 |
| Backlog | 35 |
| Total | 80 |

Open P0 scope remains:

| Area | PRD rows |
| --- | --- |
| Governance | PRD-002, PRD-003 |
| Warehouse | PRD-111, PRD-112, PRD-113, PRD-114 |
| Reports | PRD-130, PRD-131, PRD-132, PRD-133 |
| Data Quality | PRD-140, PRD-141, PRD-143 |
| Deployment | PRD-150, PRD-151, PRD-152, PRD-153 |
| E2E / QA | PRD-170, PRD-171 |
| Documentation | PRD-180, PRD-181 |
| Hardening | PRD-190, PRD-191 |

P1 rows may remain open if they are explicitly documented as follow-up and do not block the P0 happy path.

## Release Acceptance Checklist

Before release, the reviewer should confirm:

1. Tracker hygiene: every P0 row is `Done` or explicitly blocked with owner, reason, and next action.
2. Build gate: backend build, frontend build/lint, backend tests, smoke tests, seed reset, and selected E2E tests have dated evidence from `.docs/ITER1_RELEASE_QUALITY_GATE.md`.
3. Role gate: direct API calls are rejected when the actor lacks the required role or permission.
4. UAT gate: `.docs/ITER1_UAT_MATRIX.md` has at least one happy path and one exception path for each actor.
5. Workflow gate: menu import, quantity confirmation, demand generation, purchase submission, approval, receipt, issue, kitchen signoff, and reports are connected by persisted records.
6. Data gate: missing BOM, missing conversion, price warning, stock shortage, orphan document, and stale workflow data are visible as data-quality issues or validation errors.
7. Deployment gate: environment config, migration plan, seed mode, and release verification command are documented.
8. Documentation gate: actor runbook and daily checklist are current with the implemented UI/API labels.

## Evidence Rules

Use short evidence notes in the tracker:

`[YYYY-MM-DD] Done: <what changed>. Commit: <sha>. Verify: <commands or manual check>.`

If a task is blocked, use:

`[YYYY-MM-DD] Blocked: <reason>. Needed: <dependency or decision>.`

Do not mark a row `Done` based only on implementation intent. It needs repeatable evidence in code, docs, tests, or a checked workbook/runbook artifact.

## Reviewer Path

For a stakeholder read-through:

1. Start at `Iter1_ProdReady_Plan`.
2. Filter `Ưu tiên = P0`.
3. Filter `Trạng thái != Done`.
4. Review the remaining rows against this scope file.
5. Run the current release gates from PRD-002 when that row is complete.

For a demo read-through, use `.docs/MVP_MANUAL_RUNBOOK.md` and `.docs/MVP_DEMO_DATA.md`.
