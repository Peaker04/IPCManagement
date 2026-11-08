---
updated: 2026-09-11
branch: main
observed_base_head: 919426f4
runtime_ports:
  frontend: 3001
  api: 8001
  mysql: 3306
db_lane: ipc_lane9
e2e_lane: ipc_lane7
credentials_via: IPC_LANE7_<ROLE>_PASSWORD
---
# Working memory hiện hành

Đây là working set được auto-load sau `AGENTS.md`; không phải history hoặc domain store. Luôn revalidate branch/HEAD/status, runtime, database lane và active checkpoint trước khi hành động.

## Current checkpoint

- `main` includes PR #43 at merge commit `dbffa5ad` and CI base-ref hardening at `919426f4`.
- Post-merge Verify, CodeQL C#/JavaScript-TypeScript, Dependabot and Vercel passed. Follow-up `919426f4` also passed Verify and both CodeQL language analyses.
- Phase 35 closes as **`PASS_WITH_DECLARED_RESIDUAL`**. Authority:
  `.planning/phases/35-chu-n-h-a-ui-ux-to-n-b-mounted-frontend-theo-claim-envelope/35-CHECKLIST.md`.
- NFR execution authority:
  `.planning/notes/nfr-research-and-remediation-PLAN.md`.
- No new application goal is active after Phase 35 closure. Do not silently reopen Phase 31/33/34/35 campaigns.

## Phase 35 final envelope

Source/focused claims complete:

- source ownership 14/14 `PASS`;
- rule applicability 7/7 `PASS_INVENTORY`;
- async composition 7/7 and action hierarchy 3/3 `PASS_FOCUSED`;
- closed-value projection DEFAULT 74/74 and MRX 26/26 `PASS_SOURCE`;
- geometry 95/95 inventoried as `PASS_INVENTORY_ONLY`;
- changed-flow lifecycle `PASS_BASELINE`;
- screenshot/modal S01–S03 `PASS_SOURCE_REGRESSION`.

Declared residuals, not blockers to source closeout:

- information uniqueness DEFAULT 16/17; successful protected approval mutation remains `NEEDS_EVIDENCE`;
- information uniqueness MRX 4/5; naturally available all-matched batch remains `NEEDS_EVIDENCE`;
- browser health 138/147; nine identity-unverified observations remain `NEEDS_EVIDENCE`;
- browser composition 0/147 promoted because the candidate runner did not activate all retained views or prove complete adjacency/scroll/focus/hit-target/identity facts;
- screenshot/modal S04–S05 remain `NEEDS_EVIDENCE`;
- usability and performance remain `NOT_CLAIMED`.

Do not create business records, directly write database state, switch operation mode or inject synthetic responses merely to manufacture these PASS cells.

## NFR state

Implemented and source/focused verified:

- inactive-user refresh rejection and device continuity;
- direct-host topology does not trust forwarded headers;
- native ASP.NET Core `Retry-After` handling;
- fail-closed serious/critical axe oracle;
- shared accessible approval dialog and safe reauthentication return-path handling;
- session-scoped browser auth storage, minimized routine auth logs and `Asia/Ho_Chi_Minh` rendering;
- 30-minute access token, absolute 24-hour refresh family, cap 3, 60-minute idle + 2-minute warning, deactivate revocation and shared user-row serialization;
- health endpoint predicates, non-destructive recovery oracle, read-only k6 probe and browser-support source harness;
- coherent .NET 9 servicing: SDK 9.0.313 latestPatch band, Microsoft 9.0.20 family and IdentityModel JWT 8.19.2.

Runtime/provider evidence still open:

- disposable MySQL two-connection auth interleavings;
- full D04 write/import/multi-identity performance qualification;
- real outage/alert/SLO evidence;
- provider/off-host restore and measured RPO/RTO;
- Windows 10/11 current/previous Chrome/Edge, real 200% browser zoom and NVDA certification.

Missing authority remains `NEEDS_EVIDENCE`, never permission to seed, mutate a protected lane, read secrets or claim PASS.

## Database and runtime boundaries

- Port/lane values above are pointers, not readiness proof.
- Before browser/database work verify listener/build/ref identity, authenticated operation mode/version/capabilities, exact database target and credential source.
- MySQL listening or a credential environment variable alone does not authorize schema/data mutation.
- Preserve DEFAULT/MATERIAL_RECONCILIATION separation and `docs/domain/material-reconciliation.md`.
- Migration replay and schema parity passed in disposable CI MySQL. No production/protected migration was applied by the Phase 35 closeout.

## Authority map

- Documentation map: `docs/README.md`.
- Material reconciliation: `docs/domain/material-reconciliation.md`.
- Delivery gates: `docs/harness/DELIVERY.md`.
- Runtime/skills/subagents: `docs/harness/RUNTIMES.md`.
- Harness governance: `docs/harness/README.md` and `docs/harness/GOVERNANCE.md`.
- Evidence hashes: `docs/EVIDENCE-INDEX.md` only.
- Migration/restore/browser measurement: read `LESSONS.md` first.

## Resume protocol

Read `AGENTS.md` → `MEMORY.md` → active checklist. Compare cwd, branch, HEAD, index and worktree. Keep one writer per cwd. Record exact commands/results, evidence limits and blockers in the owning GSD checklist. Preserve inherited dirty work; do not commit/push, migrate, restore, seed or change operation mode without current task authority.
