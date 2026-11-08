---
title: Pi CLI runtime and skill adapter
status: canonical-adapter
owner: GSD
---
# Runtime and skill adapter

This file owns runtime integration, not a second delivery process. Lanes, feedback loops and Done remain in [delivery standard](DELIVERY.md); task state stays in GSD. Startup rules are in [AGENTS.md](../../AGENTS.md). No provider keys or live database values belong here.

## 1. Runtime contract

- Pi CLI is the sole active runtime. Its configured API/provider/model supplies inference, not a second CLI/app or its MCP registry.
- Codex app, Codex CLI and Claude Code are outside the target workflow unless Kỳ explicitly opens a separate task for them. Do not use them as fallback, copy credentials/session data, or create a second GSD state owner.
- Claude Code is excluded from active execution. Existing .claude junctions, worktrees, settings and shared core are retained, not loaded into Pi or deleted as cleanup. Their presence is not permission to run hooks/installers.
- Pi skill invocation: `/skill:name` or read the actual SKILL.md. Resolve referenced paths relative to that skill. A skill hidden from discovery can still be read by exact verified path when requested; hidden does not mean uninstalled.
- Native GSD for Pi is installed under `~/.pi/agent/gsd-core` with its `.gsd-runtime` set to `pi`; `/gsd` is registered by `~/.pi/agent/extensions/gsd.js`. Older Codex-named core/assets are retained as external provenance only; do not route Pi through them or delete historical assets.

## 2. GSD → Pi mapping

| Upstream instruction | Pi implementation |
|---|---|
| Skill(name) or $gsd-x | Read discovered SKILL.md; interactive `/skill:gsd-x` when surfaced |
| Read/Grep/Glob/Bash | Available native read/bash (rg/find), or exact tools shown in the current registry |
| AskUserQuestion/request_user_input | Ask a plain-text question and wait when a decision is required |
| Task/Agent/spawn_agent | Never call nonexistent tools. GSD parent applies the approved Lean lane; if delegation is justified, use pi-subagents after reading its skill and listing executable agents |
| Quick planner/executor boilerplate | L0/L1 may run inline per project Lean policy, retaining scope, verification and checkpoint; not a claim of native typed GSD execution |
| Full typed agent/isolation requirement | Stop if the required capability is unavailable; no unlabelled generic-agent substitution |
| Auto commit/ship/merge | Requires separate user authorization; otherwise report uncommitted verified work |
| MEMORY/STATE/verification writes | Parent reconciles evidence and updates the single GSD owner, not each advisor |

The imported ~/.pi/agent/agents/gsd copies are project-disabled until individually adapted and tested. Keep their source for reference only; do not auto-enable them after an update. A new imported name must be reviewed before use. For ordinary scoped work use inline execution or the bounded builtin roles below, not a 34-agent manual port.

## 3. Skill surface and selection

`.pi/settings.json` is the exact discovery/configuration source. Do not copy upstream skills into another tree to make them visible.

- Project skill `.agents/skills/harness-maintenance` is repository-owned and Pi-active through project settings.
- Default engineering discipline remains in the retained `.codex/skills` paths: karpathy-guidelines, diagnosing-bugs, tdd, ui-styling, sketch-findings-ipcmanagement. The directory name is retained provenance/storage, not authorization to run Codex app/CLI. The first skill also has inherited local edits, so Phase 32 does not move these files. Front-End-Checklist remains a project Pi skill.
- GSD commands use the native Pi `/gsd <family> [subcommand]` extension. Legacy `~/.agents/skills/gsd-*` copies are hidden from routine Pi discovery; do not mix their Codex adapter text into the native command path.
- GitNexus skills are also hidden from routine discovery and remain available by exact path under `~/.agents/skills/gitnexus-<name>/SKILL.md` only after explicit opt-in. See [policy](../GITNEXUS-POLICY.md).
- On-demand project engineering: codebase-design, domain-modeling, design-an-interface, improve-codebase-architecture, request-refactor-plan, code-review, research, resolving-merge-conflicts, prototype. Load from .codex/skills/<name>/SKILL.md only after scope/role review; none owns task state.
- On-demand design: ui-ux-pro-max, design-system, ui-styling references, brand, banner-design, slides, design. Never impose generic landing-page aesthetics on MRX.
- Teaching/writing/personal-productivity skills: retain installed but outside default project workflow. No need to delete learning/prose tools to reduce coding context.
- Do not route through claude-handoff, git-guardrails-claude-code, installer/setup skills, broad loop/router skills, or disabled-skills/mattpocock-process. Setup/pre-commit changes require their own explicit task, not automatic remediation.
- Ponytail is a simplification discipline, not scope/acceptance authority. Its audit/review is optional and produces findings, not a second checklist. No hard coding of a smaller test requirement when the project contract requires more.

## 4. Subagent contract

Use inline execution for routine L0/L1. Before delegating read pi-subagents SKILL.md and the matching reference. List agents first; never launch disabled agents. Use one top-level async workflowScript for composed work, with stable child keys and awaited results. Do not poll/sleep to wait; use notifications, or the wait tool for a user-requested run-to-completion result.

Default project roles: worker, reviewer, scout, oracle, delegate. All use explicit medium thinking and fresh context; model remains inherited. Researcher is disabled until its web tools/provider are actually available. Reviewer has only read/grep/find/ls: parent runs tests and fixes, reviewer does not edit or start broad suites. These are tool restrictions, not a filesystem sandbox for mutation-capable roles.

Every launch packet includes:

```text
Task ID + checkpoint path; exact cwd/allowed files; goal and acceptance;
required reads (small list); forbidden actions; smallest test command;
output path or compact return; escalation boundary; timeout.
```

- Set explicit timeoutMs (normally 900000) and toolTimeoutMs (normally 180000) on execution calls; choose a larger bound before launch only when a measured command justifies it. These are launch arguments, not invented settings.json keys.
- Do not impose a hard read-tool/turn budget on a writer that can leave partial edits. Ask for a checkpoint after a bounded step; read-only probes/review may have turn/tool budgets.
- No nested fanout unless explicitly assigned and permitted; one writer per cwd. No automatic mission scheduler/state store in parallel with GSD.
- Fresh context still receives project safeguards. Explicitly pass only the skill(s) required; do not inherit the entire catalog or entire parent transcript by default.
- Check `/subagents-models` in the live TUI after reload; file parsing alone does not prove the provider used medium. Live probe must have a receipt before making that claim.

## 5. Context-pressure checkpoint and fresh-session handover

Do not claim a fixed 250k/300k session API unless the active runtime actually exposes one. Monitor practical pressure instead: remaining work versus verification cost, command duration, repeated compaction, and whether the current state can still be reviewed safely. Checkpoint after every verified wave and before a long gate.

The active GSD checklist remains the task-state owner; `MEMORY.md` stores only its current pointer. Before leaving a pressured session, write one fresh-session handover with:

- goal and exact current wave/task;
- completed bounded commit hashes;
- current branch/HEAD plus worktree and index status;
- task-owned paths versus inherited owner dirt;
- exact remaining command or edit;
- tests, evidence paths and residual evidence limits;
- owned listeners/runners and teardown state;
- blockers and authoritative resume pointers.

When the user has authorized local checkpoints, stage only task-owned files or hunks, inspect `git diff --cached`, run the wave gate, commit locally, then verify the index is empty. Never push implicitly. Start the next wave in a fresh child/session with a minimal packet, or stop and provide the exact resume pointer/command. The receiving session must re-read source/runtime and compare HEAD/status/index; it does not inherit unpersisted chat merely because a handover exists.

## 6. Acceptance and recovery adapter

Keep three distinct results: runner/tool completion, test/evidence result, GSD task verdict. A schema-rejected report is not a failing regression; a successful runner is not evidence of a correct implementation.

For a writer use only the installed pi-subagents acceptance schema (or a verified host gate). Read its current contract before requesting machine-readable output. Never invent fields/enums such as custom NEEDS_EVIDENCE values inside its schema. Put evidence limitations in the permitted residual-risk fields or ordinary narrative/checklist. Read-only review omits writer acceptance; do not weaken a writer's contract to silence parsing errors.

After parser failure preserve the original report, inspect diff, independently rerun the smallest missing check and reconcile the GSD verdict. Do not rerun a whole worker merely to reformat its response. Required runtime/browser evidence remains missing even when focused tests pass.

## 7. Installed-source disposition

This is the durable source/role map, not a live-version database. Exact versions and observed commits belong in the task's verification receipt; re-read manifests before updates.

| Source/component | Location/provenance | Disposition |
|---|---|---|
| earendil-works/pi | user npm package @earendil-works/pi-coding-agent | Primary runtime; no automatic major/toolchain update |
| nicobailon/pi-subagents | user Pi npm package, source in package.json | Keep version-pinned; configure at project scope and rerun loader/runtime smoke after update |
| DietrichGebert/ponytail | user Pi git package | Keep; floating source must not be auto-updated during tasks; pin only after clean-checkout/ref review |
| open-gsd/gsd-core | native Pi core/extension under ~/.pi/agent; older Codex core and legacy ~/.agents skill copies retained | Native `/gsd` is process entry; hide legacy skill copies and do not use imported named-agent ports |
| mattpocock/skills | project skills-lock.json + .codex/skills | Selected engineering discipline; process routers remain disabled |
| thedaviddias/Front-End-Checklist | skills-lock.json, .pi/skills, .artifacts/vendor-research/front-end-checklist | Active adapter vs reference clone; don't load both copies |
| multica-ai/andrej-karpathy-skills | source field in karpathy-guidelines/SKILL.md | Core code discipline |
| minhduc2803/shipyard | sibling repo referenced by shipyard/shipyard.manifest.json | Tooling only; no ship-feature/plan/PR state owner. No reset/seed/bootstrap/update just to run checks |
| abhigyanpatwari/GitNexus | global npm + ~/.agents/skills/gitnexus-* | Optional graph adapter; inventory is not execution authorization |
| openai/skills | ~/.codex/vendor_imports/skills | Codex secondary assets, not automatically imported into Pi |
| OpenAI/Vercel plugins | Codex config + plugin-cache manifests | Codex only unless separately integrated/tested in Pi; cache presence is not active capability |
| ClaudeKit design family | metadata author/version in project skill copies | On-demand; upstream/ref not fully verified, no automatic overwrite/update |
| UI UX Pro Max / taste-skill | project .codex/skills and user ~/.codex/skills | On-demand; upstream/ref unresolved. Taste explicitly excludes dashboard/data-table/product flows |
| browser-use | tools/browser-use/pyproject.toml + uv.lock | Retain; Python environment/live usage must be verified before execution |
| Playwright / axe-core | project npm installed manifests + lockfile | Browser/accessibility oracle tooling; no dependency upgrade in harness cleanup |
| docs/ui-audit-kit | local reference/script kit | Reference, not a second normative UI rule set; provenance unresolved |

Codex-configured MCP names (not Pi capability claims): notebooklm, stitch, html-to-design, gitnexus, chrome-devtools, node_repl, cua_repl. Do not add a network bridge or transfer credentials just to eliminate this distinction.

## 8. Updates, rollback and trust

- No broad pi update --all, installer rerun or skill sync during application work. Update one reviewed source with version/ref, diff, license/executable hooks, dependency/network review, focused test and rollback.
- A pinned Git ref may cause Pi reconciliation to reset/clean the package clone. First check its working tree and current ref; never use pinning to discard local edits.
- Pi packages/extensions execute with host privileges; skill instructions can request tools. Documentation is not a sandbox. No new extension/MCP network access without explicit review.
- Current Pi package removal syntax is `pi remove <source>` (verify local help before use), e.g. `pi remove git:github.com/DietrichGebert/ponytail`. This removes the registration/package, not permission to run Ponytail's broad external-state cleanup script. Do not repeat the earlier unverified `pi uninstall ponytail` guidance.
- Project config rollback: restore only the scoped pre-task bytes after comparing intervening edits, then reload/restart Pi. User-scope packages and shared .claude/.codex assets stay intact.
- New project settings require trust and reload. Do not claim the already-running parent changed its discovered catalog until it has actually reloaded.
