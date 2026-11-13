# MRX UI verdict closure — design specification

Status: proposed for user review. Execution method: native, same checkout.
Task state belongs only to `.planning/WORK.md`.

## Outcome and scope

Resolve the five findings from the MRX audit: unstable responsive tools, retry feedback layout movement, inaccessible identifier copy, repeated transfer feedback, and inconsistent decimal presentation. Primary surfaces: `/warehouse?view=mrx-daily`, `/weekly-menu?view=mrx-batch`, `/reconciliation`, `/chef?view=mrx-cooking`. Preserve DEFAULT behavior when changing shared primitives. No backend defect has yet been established; BE work is contract verification and repairs only if a concrete violation is reproduced in this scope.

Evidence baseline: 22 saved PNGs under `.artifacts/mrx-evidence/20261112t035659z_5b23bc/runtime/`. These are historical captures, not post-change proof. HEAD at intake: `bbd55009a77a6e83f79027a7784deb4b7f323928`; dirty tree is inherited and must be preserved.

## Requirements and acceptance

### V1 — Predictable responsive tools

Use explicit MRX layout regions instead of independent wrapping: title and primary actions; customer/batch/date scope; day navigation and secondary information. Region order remains constant at widths 960, 1024, 1280, 1366, 1440 and 1920. Labels stay attached to their controls; status changes must not move primary actions between regions. At narrow widths whole groups move to their defined next row. Remove oversized fixed reservation widths only where replaced by an equivalent stable layout.

Preserve D6 minimum 12px, D7 one primary action, T7 frozen identity/header, T8 36–40px ordinary rows and 44px input rows, M1.2 single blocking modal, N6 sidebar authority. Wide tables may scroll horizontally; page-wide clipping and inaccessible actions fail. Post-change screenshots and measured control rectangles are required for visual PASS.

### V2 — Stable retry and loading feedback

Reproduce the concrete sequence: existing data → failed refresh → retry pending → failed retry or success. Keep data and feedback geometry stable while retry is pending. Only clear the error when a successful result replaces it; pending feedback must be truthful and duplicate retry prevented. Preserve permission/mode/conflict precedence, stale-scope interaction locks and draft identity. Do not claim this one fix removes all reported flash. Route/day/batch changes need their own before/action/after evidence.

### V3 — Accessible copy

Copyable identifiers expose a focusable button with an accessible name identifying the code, visible focus and Enter/Space activation. Non-copyable identifiers remain text. Stop propagation so copying does not select or activate the row. Announce success only after clipboard success; a rejected clipboard operation must not report success. Preserve compatibility with shared DEFAULT callers.

### V4 — One useful transfer message

On transfer success, show one actionable feedback message explaining completion and the next step. Keep the persistent lifecycle/status owner, but avoid two adjacent banners repeating transfer. Footer content must contribute a distinct instruction or action. Error, conflict and source-reload warnings must remain visible and retain their recovery actions.

### V5 — Unambiguous quantity input

Present MRX editable quantities using Vietnamese comma decimals, matching `Num`. Editable text has no thousands separators: `79,773`, `2048,92`, `0,000001`. Convert at the input boundary to the existing canonical dot-decimal draft strings; preserve existing stored drafts, UUID recovery and JSON numeric payloads. Accept ungrouped dot-decimal paste as a compatibility input and normalize presentation on blur; never reinterpret `1.234` as 1234. Reject mixed separators/grouped paste and non-finite values explicitly. Empty and incomplete editing must not become zero or a valid submission. Keep the existing six-decimal quantity policy; do not silently round differently. Remove the recently added dot-decimal instructional hint after replacement.

Prove `79,773 → issuedQty 79.773`, `2048,92 → 2048.92`, `0,000001 → 0.000001`, legacy draft `79.773 → visible 79,773`, invalid/empty input blocks submit, and hidden-row drafts survive search. Verify C# request decimal fields and validation match. No schema or persistence change is planned.

## Validation and authority

Use existing local dependencies and focused tests. No install, commit, reset, clean, stash, new worktree, subagent, external AI CLI, source DB mutation, main restart, deploy, endurance or campaign rerun. Native means the current agent performs implementation and self-review. Generic Superpowers reviewer/commit/worktree instructions do not override these restrictions.

Use existing authorized screenshot/trace fixtures for diagnosis. Before any new runtime capture, identify the exact isolated server/build, credentials, mode and data; if none is available under current authorization, report visual/runtime NEEDS_EVIDENCE rather than start the old disposable campaign or invent fixtures. Unit/contract PASS cannot substitute for rendered or persistence evidence.

The whole-plan verdict remains `OPERATIONAL_QUALIFICATION_BLOCKED`. Closing these five items does not certify endurance, native zoom, recovery, delivery outbox or the complete T11 matrix.
