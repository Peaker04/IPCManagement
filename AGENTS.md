# IPCManagement — agent entry contract

## Authority and startup

- Pi CLI is the primary runtime; Codex CLI is the secondary adapter. A Codex API/model connection inside Pi is not a Codex CLI session. Claude Code is outside the target workflow.
- GSD is the only process/state owner. Follow `docs/LEAN-DELIVERY-AND-DEBUGGING-STANDARD.md` for L0/L1/L2 and `docs/AGENT-HARNESS.md` for runtime/skill/subagent mapping. No parallel task system from Shipyard, Ponytail or another skill.
- Start with this file, then `MEMORY.md`; compare branch and `git status --short --branch`. Follow the active checkpoint pointer before resuming. Source/runtime wins over stale narrative; do not ask Kỳ to repeat the whole chat.
- Use `docs/README.md` as the authority map. Do not auto-load HISTORY, LESSONS, all docs, planning trees or evidence. Read `LESSONS.md` before migration, restore or browser measurement; read relevant evidence/lineage before touching a database lane.
- Task state/checklist stays in GSD `.planning/`; MEMORY holds current pointers/runtime, HISTORY holds completed work, evidence hashes belong only in `docs/EVIDENCE-INDEX.md`. Link rather than copy gates or counters.

## Non-negotiable boundaries

- Preserve inherited dirty files. No unsolicited commit/push, reset/restore, seed, operation-mode switch, schema/data mutation or destructive cleanup. A skill's auto-commit/ship instruction is not user authorization.
- Never assume a database lane is empty. Do not create credentials, default accounts, BOMs, inventory, lineage or business records merely to make a test pass. Preserve DEFAULT/MATERIAL_RECONCILIATION separation and the current business contract in MEMORY.
- No secrets, tokens, real connection strings or personal data in docs/reports. Read only required configuration metadata; do not dump auth files or secret environments.
- Never rename symbols with blind find-and-replace. Use language-aware tooling/callsite verification; opt-in graph-aware changes follow the policy below.
- Code changes require relevant docs updated in the same task. Preserve invariants, input validation, data-loss handling, security and accessibility regardless of Ponytail simplification.

## GitNexus: opt-in only

Do not call GitNexus MCP/CLI, inspect index or generate graph evidence unless Kỳ explicitly requests GitNexus/impact/blast radius/context/detect_changes for this task. Then read `docs/GITNEXUS-POLICY.md` before the first call: classify final diff, use branch-aware rigor and warn on HIGH/CRITICAL. Graph-free work requires no graph calls even when the tool is installed. Missing graph capability is a limitation, not fabricated evidence.

## Skill routing

Read the selected SKILL.md before applying it. In Pi use `read` or `/skill:<name>`; `Skill(...)`, `Task(...)`, `Agent(...)` and Codex `spawn_agent` are not Pi tools. Use only live capabilities. Runtime mapping and on-demand source paths: `docs/AGENT-HARNESS.md`.

| Task | Minimum discipline |
|---|---|
| Code write/review/refactor | `karpathy-guidelines` |
| Runtime/repeated bug | add `diagnosing-bugs`, lock a red-capable seam first |
| Behavior regression | add `tdd`; behavior tests over source-string assertions when feasible |
| Any frontend/UI review or change | project UI rules → `frontend-checklist-global` |
| React/shadcn/Tailwind interface implementation | add `ui-styling` |
| SAP Fiori Template Studio, range mapping, validation/diagnostics | `sketch-findings-ipcmanagement` |
| Docs/rules | `gsd-docs-update` discipline, inline for bounded changes |
| Planning/task execution | matching GSD skill + Lean lane; not mandatory fan-out |

- L0/L1 uses at most three discipline skills by default, aside from the GSD process selection and already-active Ponytail. Do not add skill layers simply because descriptions overlap. If mandatory domain coverage exceeds the default, name the reason and keep scope fixed.
- Design-system/brand/banner/slides and UX pattern lookup are on-demand, not mandatory for UI bugs. `ui-ux-pro-max` may fill an undecided interaction, never override Fiori/project contracts. `design-taste-frontend` is not for dashboards/data tables/multi-step product UI.
- `qa` collects issues, not fixes. External `handoff` may create an OS-temp draft only; the GSD parent fact-checks and promotes it. `implement`, `to-spec`, `to-tickets`, `triage`, `wayfinder`, `ask-matt`, Claude-only routers and Shipyard feature orchestration are not execution paths here.

## UI and browser evidence

- Before UI audit/change read `docs/UI-UX-EXECUTION-HARNESS.md`; before JSX lock floorplan/surface/geometry using `docs/DESIGN.md`. Normative rules: `docs/DASHBOARD-UI-RULES.md`; checklist adaptation: `docs/FRONT-END-CHECKLIST-INTEGRATION.md`.
- A screenshot showing orphan controls/headings, blank surfaces or duplicate state is a candidate finding: convert it into a DOM/source oracle. Do not ignore it, and do not use screenshot alone as PASS/FAIL.
- Browser-use must open real headed Chrome directly on the app URL, not a blank tab followed by API-only tests. Resolve current ports, lane, credential source and viewport matrix from MEMORY; do not try stale/default passwords. Add tablet/mobile only when Kỳ asks.
- Before actions/capture, verify aligned FE/BE listener/build identity and authenticated operation-mode/version/capabilities. Stale/dev-only runtime cannot certify production performance. Do not switch the user's mode to obtain evidence.
- If agent-browser is unavailable, use `.artifacts/shipyard-live/live-visual-audit.mjs` from project root, not frontend/. It uses a separate persistent profile `.artifacts/browser-use-visual-audit`, not the user's existing Chrome tabs. Reusing an existing browser requires a real attach/CDP session.
- Evidence: immutable run directory, final screenshot, post-action API request/response, console/page errors, DOM/focus measurements; add long tasks/CLS when claiming performance. Mutation E2E requires FE control → BE request → DB transition → reload render, not API-only PASS.
- Refresh locators/snapshots after navigation/DOM changes. On helper failure verify timestamp/content of live-visual-audit-error.txt. Stop only helper/Chrome processes created by the current run, never all Chrome.
- Chrome DevTools is on-demand diagnostics only, not a replacement for Playwright JSON gates. Configured in Codex does not mean available in Pi.

## Completion and context limits

Use Lean standard's per-claim PASS/FAIL/NEEDS_EVIDENCE/BLOCKED gates. Distinguish tool/report-parser failure from test failure and task acceptance; never promote focused tests to whole-UI PASS. One plan/checklist per objective, one writer per cwd, checkpoint after each verified step and before long commands/context switches. On timeout preserve evidence, record the exact command and owned processes, then resume only the missing gate. Do not automatically continue a paused campaign.

Monitor practical context pressure rather than inventing an unsupported exact token limit. Before a long gate or when a session is becoming hard to hand off safely, finish the current verified wave, update the active checklist/MEMORY pointer, and write a fresh-session handover containing the goal, completed commits, current HEAD/status/index, exact next step, tests/evidence, owned processes, blockers and authoritative pointers. When commit authority exists, make a bounded local checkpoint that stages only task-owned hunks, verify the cached diff, and do not push. Resume in a fresh session from those durable pointers, or stop with the exact resume command; a new session does not inherit unpersisted chat state.
