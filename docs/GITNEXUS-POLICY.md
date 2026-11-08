---
title: GitNexus opt-in analysis policy
status: canonical-adapter
owner: GSD
---
# GitNexus — optional graph adapter

Read only when Kỳ explicitly requests GitNexus, impact/blast radius, graph context or detect_changes for the current task. Otherwise use source/tests, do not call MCP/CLI, inspect index or generate graph evidence. Merely inventorying installed tooling is not opt-in to graph execution. GSD remains the sole process/state owner.

## Classify the intended final diff before any graph call

Mixed diffs take the highest lane; directory/file extension alone does not downgrade behavior-bearing content.

| Lane | Criteria | Required evidence |
|---|---|---|
| Graph-free | Pure docs/planning/rules, inert metadata, leaf assertions/snapshots not defining shared harness/interface/discovery/runtime config or behavior vocabulary | No graph calls. Relevant checks, declared scope, secret/stub scan, git diff --check. Graph risk N/A, not LOW. |
| Lightweight graph | Shared test fixture/harness/interface, source-aware checker, test/discovery/build config, behavior-bearing permission/role/route/state/action/API/cache/serializer/migration/schema literals | Confirm indexed repo/branch once, source-aware/AST closure, targeted tests and final explicit-branch detect_changes. Per-symbol impact not required by default. |
| Full analysis | Production executable symbol, public/API contract, auth/policy, migration/data integrity, sensitive source→sink, rename/refactor, mixed diff containing these | Branch-aware two-way pre-edit impact, complete pagination, appropriate includeTests, affected-process disposition, regressions and final detect_changes. |

Escalate graph-free to lightweight if a supposedly inert value defines behavior, a helper becomes shared or closure cannot be established locally. Escalate lightweight to full if detect_changes/manual inspection finds a production edge/process, public contract impact, unresolved mapping, low-confidence evidence required for the conclusion or a sensitive trust boundary. Never lower lane to avoid a gate.

## Mechanics

- list_repos once per session, again only if slots may have changed. Every branch-aware call specifies repo=IPCManagement and branch=current working branch. Do not rely on another branch's primary/default slot.
- Full lane: anchor by UID where available, otherwise name + file_path/kind. Run upstream (dependants) and downstream (dependencies) before editing production symbols.
- includeTests=false is not evidence that tests are unaffected. Use true for test/fixture/test-callsite scope. For hubs start summaryOnly, then page every depth until hasMore=false, partial=false, truncated=false.
- Raw risk is returned closure. Effective risk is rigor after verifying directed production/control/data flow. Record both; never erase raw evidence.
- Re-index only when the chosen lane needs graph evidence and its branch slot is absent/stale, dirty production source requires mapping, required symbol/process cannot resolve, or full CRITICAL needs a missing PDG layer. Never re-index graph-free work.
- When opting into graph-aware rename, use semantic rename, not find-and-replace. Without GitNexus use language-aware tooling and callsite verification, not blind string substitution.

## Full-analysis rigor

- LOW: complete two-way impact, targeted regression and final detect.
- MEDIUM: additionally context for each directly affected symbol before edits and regression coverage.
- HIGH: warn Kỳ; lock complete scope in GSD plan, trace relevant cross-cluster directed chains, handle all callsites on the same branch, gitnexus-pr-review.
- CRITICAL effective risk: warn Kỳ. Auth/trust boundaries, credentials/session, payment, migration-write/data integrity or sensitive source→sink require branch PDG where supported, anchored explain/pdg_query, complete scope and review. Domain/folder alone does not make CRITICAL; zero taint findings never prove safety.
- Import-only closure with unchanged production signatures/control/data flow and no affected process may be dispositioned as one reconciled group. Unresolved/partial/truncated or confidence <0.8 cannot lower effective risk.

## Done and reporting

- Graph-free: final paths match declared scope and relevant checks pass. Report Lane | Scope | Checks | Graph reason; no calls to manufacture LOW.
- Lightweight: source-aware closure and targeted tests pass; final explicit-branch detect has no undispositioned production edge/process, otherwise escalate.
- Full: all pre-edit impact directions fully paged, changed/directed/low-confidence nodes and processes handled or verified unnecessary, final detect reconciled, HIGH/CRITICAL review passes. Any deferred/unresolved item in required scope blocks closure.
- Full report includes Symbol | Callers found | Handled | Deferred + reason, repo/branch, raw/effective risk, includeTests, pagination and affected-process evidence. Reconcile final detect before an authorized commit; never commit merely because a workflow says to.

## Skill resolution

Read the matching SKILL.md on demand from the runtime's discovered path or ~/.agents/skills/gitnexus-<name>/SKILL.md after verifying it exists. Names: exploring, debugging, impact-analysis, refactoring, pr-review, taint-analysis, pdg-query, guide, cli. Do not rely on the removed historical .claude/skills/gitnexus/<skill> paths. If the necessary MCP/CLI capability is unavailable, report the limitation rather than claiming graph evidence.
