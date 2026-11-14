# MRX menu import lifecycle design

## Intent

Give Coordination, Manager and Admin one predictable way to create or replace a weekly menu before the reconciliation batch is finalized, then route later source changes through the existing edit and approval workflow. The scope is one customer and ISO Monday week in `MATERIAL_RECONCILIATION` mode.

## Approved decision

| Current customer/week state | Import admission | Next action |
| --- | --- | --- |
| No menu version or schedules | New import, single or distinct-scope group | Publish and prepare quantity/batch as usual. |
| Existing menu, no reconciliation batch | Reimport same customer/week, subject to existing irreversible quantity-plan, downstream-document, schedule and tier rules | Supersede the old draft/projection; new schedules are DRAFT and must be published. |
| Reconciliation batch DRAFT, with no issue | One-file reimport through the MRX source-change and approval owner | Recompute the draft batch and preserve version, revision and audit lineage. |
| Batch READY, TRANSFERRED or IN_PROGRESS, or any linked issue even with an inconsistent DRAFT status | Reject current-week file reimport at preview and commit | Use the existing direct edit or approval request for open dates. Issued dates stay locked. |
| Batch COMPLETED | Reject current-week reimport and edits | Read history or select another week for a new import. |

The transition to READY closes whole-file import because it freezes the batch baseline. The first issue locks its service date for direct edits. These are different gates. A file for another customer/week is evaluated against that scope; a completed current week still permits choosing a different week.

## Approaches

1. **Chosen: close import at READY, keep source editing after READY.** This preserves the existing day-level edit workflow and gives whole-file replacement a clear stopping point.
2. Allow reimport until the first issue. This would let a whole-file command rewrite a READY/TRANSFERRED baseline and makes the handoff less meaningful.
3. Close import as soon as a DRAFT batch exists. This would force small edits during preparation even though the batch has not been finalized.

## Contracts and effects

- The backend owns admission. Preview must explain a closed import scope; commit must recheck current batch/issue state so a READY transition or first issue between requests cannot write or queue a reimport. Pending coordinator reimports must also be rejected on approval if the batch has since closed.
- Only the `REIMPORT` apply mode gains the whole-file gate. `DIRECT` and `APPROVED_REQUEST` retain the existing open-day rule, role checks, source/version checks, serializable transaction, recomputation, snapshot and revision behavior.
- The MRX workbench shows current-week import only while there is no batch or a clean DRAFT batch. At READY and later it keeps access to importing a *different* week and points current-week work to “Chỉnh sửa món”. Direct URL entry and a modal left open across a status change obey the backend gate.
- Existing DEFAULT import behavior, MRX group admission, tier validation, preview-token binding, irreversible downstream guards, completed read-only state and physical-stock isolation remain unchanged.
- Update the bounded weekly-menu and reconciliation contracts together. Existing tests that expect reimport on an IN_PROGRESS batch are superseded by this approved rule; retain their day-lock assertions under direct editing and test the new import rejection separately.

## Acceptance and coverage

- Cover all five rows of the matrix at API/service and UI action boundaries, including role variants (Admin/Manager direct, Coordinator request), identical-file/no-op reimport, group import, and direct URL access.
- Demonstrate a DRAFT no-issue reimport recomputes only its permitted scope and retains lineage; demonstrate READY/issue/COMPLETED rejection creates no menu version, amendment, revision or batch delta.
- Demonstrate preview-to-commit and pending-request-to-approval transitions to READY reject atomically; existing direct edit still changes an open date after READY and still rejects an issued date.
- Build, lint, relevant backend/frontend contract tests and diff review are required. MySQL or live-browser evidence is reported separately if unavailable; it is never inferred from unit tests.

## Constraints

No source database mutation, fixtures in production paths, package installation, deployment, new styling tokens or unprompted agents. Preserve the dirty workspace and keep `.planning/WORK.md` as the only task-state owner. MRX operational qualification remains blocked until its independent gates pass.
