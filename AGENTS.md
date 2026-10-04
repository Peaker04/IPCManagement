# IPCManagement — project entry

Read this file, [documentation index](docs/README.md), and [.planning/WORK.md](.planning/WORK.md). Read [ROADMAP.md](ROADMAP.md) only for outcome priorities. No other memory/state/checkpoint/handover owner exists.

## Authority and safety
- User authorization and security/data safety come first. Current source, behavior tests and product contracts determine technical truth; stale plans/reviews never authorize actions. Surface contradictions rather than silently changing expected business behavior.
- Check `git status --short --branch`, `git rev-parse HEAD`, and `git diff --cached --name-only` at intake. Distinguish new work from an explicitly requested resume. Preserve inherited changes and untracked work; backup dirty owners outside the repo and check for intervening edits before replacement.
- Never reset/restore working code, commit/push/deploy, install packages, change auth/mode, or mutate schema/data without explicit scope and authorization. No seeds, fabricated credentials/business records or lowered gates to manufacture PASS.
- Keep DEFAULT and MATERIAL_RECONCILIATION source families separate. Before DB work read [database recovery](docs/operations/database-recovery.md), lineage and the matching domain contract. Never assume a database is disposable.
- Do not publish secrets, credentials, connection strings, private workbooks, personal data, authenticated profiles or business recovery bundles.
- Pi is the agent runtime. Other CLI runtimes and external tools require explicit request; do not auto-install or index a repository. Skills are optional bounded techniques, not process or permission owners. Global test-audit rules still apply to test changes.

## INTAKE → PLAN → EXECUTE → VERIFY → CLOSE
All task state lives in `.planning/WORK.md`: goal, scope, constraints, checklist, acceptance criteria, verification, status and next action. Update that same file after verified steps and before long commands/context switches. Keep it concise; replace completed task details at the next intake, not with an archive hierarchy.

1. **INTAKE:** capture request, HEAD/index/inherited dirt and missing authorization.
2. **PLAN:** choose actual source/contract owners, allowed files, exclusions and acceptance commands. One concept = one owner; link facts rather than copying them.
3. **EXECUTE:** surgical changes at existing owners. Update relevant product docs. Subagents only when requested and work is independent; compact packets, clear outputs, one writer per cwd. Parent verifies results.
4. **VERIFY:** run focused behavior checks then necessary build/lint/contracts; inspect diff, references and secrets. Report `PASS`, `FAIL`, `NEEDS_EVIDENCE` or `BLOCKED` per claim. Tool completion and scoped tests do not certify the whole product.
5. **CLOSE:** record results, limitations and exact next action in WORK; update outcome roadmap only if an outcome actually changed. No automatic commit or deployment.

## Product changes
Use the domain/grain/API owners before touching UI. Existing approved design rules constrain presentation; specimens never invent data, navigation, roles or permissions. Browser verification uses headed Chrome, real app URL and confirmed build/mode/actor/credential source; use a separate profile and never stop user-owned processes. Screenshots are candidates, not behavior proof. Persisted outcomes require control → request → state transition → reload. Performance claims require measured metrics and declared environment.
