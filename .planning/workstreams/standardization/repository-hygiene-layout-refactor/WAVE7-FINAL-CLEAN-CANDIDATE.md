# Wave 7 — final clean-candidate verification and commit boundaries

Date: 2026-09-24
Candidate: `D:/Temp/ipcmanagement-wave7-final-candidate`
Base: detached `44124e091783765e3c52411d28cc5ee78c192986`

The candidate was created with a binary tracked diff overlay plus all visible untracked task files. No commit, push, database, runtime or browser action occurred.

## Final source/CI gate

`npm ci` completed successfully. `npm run verify` passed end-to-end after two clean-candidate defects were fixed at their owners:

1. Phase 29/30 migration tests discovered repository root by requiring `.git` to be a directory and failed in a linked worktree where `.git` is a file. They now start from the process working directory and locate root `package.json`.
2. Shared date input lazy-loaded its accessible control behind an aria-hidden fallback; under the aggregate test load it repeatedly remained fallback-only beyond the query timeout. The small canonical date input is now imported synchronously, eliminating the blank accessibility state.

Root `verify` was aligned with GitHub clean-CI semantics:

- backend uses `Category!=EvidenceOwned`, excludes integration and Windows-only recovery contracts from the clean unit lane;
- frontend builds before emitted-asset unit contracts;
- frontend unit launcher defaults `CI=true`, excluding explicitly documented campaign/evidence validators;
- historical `test:ui-completeness` remains a separately owned campaign gate rather than blocking clean product verification.

Final `npm run verify` result:

- ignore policy 4/4 PASS;
- frontend taxonomy 1/1 PASS;
- frontend launcher 2/2 PASS;
- Phase 05 deterministic fixtures 1/1 PASS;
- architecture comparator 6/6 PASS;
- strict architecture baseline PASS at exact 9 findings / 2 `PLAN_REQUIRED` / zero test debt;
- backend build PASS, 0 warnings/errors;
- Application tests 49/49 PASS;
- API clean-CI tests 1,350 PASS / 3 intentional skips;
- frontend lint 0 errors / 1 inherited hook warning;
- dependency-cruiser 0 errors / 2 known orphan warnings;
- frontend production build PASS, 2,334 modules;
- frontend CI unit 277 files / 1,608 PASS / 2 SKIP.

## Additional gates

- OpenAPI generation/parity: PASS.
- EF pending-model check: PASS, no model changes after last migration.
- Evidence-bearing working tree scanner: 353 references / 0 mismatch / 0 missing.
- Candidate `git diff --check`: PASS.
- Main worktree `git diff --check`: PASS.
- Main Git index: clean.

A first isolated tool build using `--no-restore` failed `NETSDK1004` because its new artifacts path had no assets file; rerun with restore passed 0 warnings/errors. A first full backend command without the clean-CI filter correctly exposed evidence-owned tests missing local ignored receipts; the CI-shaped filtered run passed. These were command/lane failures, not promoted product regressions.

The clean candidate itself reports 309 missing ignored retained-evidence references (308 `.artifacts`, one `.planning`) because those local evidence owners are intentionally absent from a clean checkout. Evidence validation therefore remains an evidence-bearing lane; clean source CI validates hermetic contracts only. The original evidence-bearing tree is fully green at 353/0/0.

`npm ci` reported 18 dependency audit findings (1 low, 8 moderate, 9 high). No dependency update or audit-fix was authorized in this refactor.

## Proposed commit boundaries

No files are staged. Suggested bounded local commits, in dependency order:

1. **Build/output and clean-CI contracts**
   - `Directory.Build.props`, backend source-root helpers/tests, Phase 42 traits/runner/gates, root `verify`, workflow and testing docs.
   - Include Phase 29/30 worktree-root fixes and frontend launcher/build-order correction.

2. **Repository ignore and generated-output hygiene**
   - `.gitignore`, `.dockerignore`, `.vscode/settings.json`, ignore-policy test, generated-root removals and empty `.gitkeep` retirement.

3. **Frontend taxonomy/config/docs migration**
   - Playwright config moves, frontend test taxonomy/evidence moves, UI token/MVP documentation moves and associated consumers.

4. **Historical executable retirement**
   - 65 `tools/e2e` deletions, 12 root-script deletions, retained frontend launcher gate and W7.3 receipts.

5. **Product regressions discovered by clean verification**
   - Dashboard lazy-boundary fix and synchronous canonical date input, with their focused tests/contracts.

6. **Evidence scanner, owner migration and deterministic fixtures**
   - scanner/tests, evidence-index edits, root/frontend performance evidence moves, deterministic workbook builder/tool/fixtures, and W7.5 receipts.

7. **Planning archive and repository-hygiene closeout docs**
   - `.planning/archive/v1.4/quick`, enriched ledger, W7.4/W7.5 reports, PLAN/CHECKLIST closeout.

Before any commit, stage only one boundary, inspect `git diff --cached --stat` and `git diff --cached`, rerun its smallest gate, and verify unrelated dirty files are not included. In particular, `.agents/skills/diagram-design/`, `docs/diagrams/` and `scripts/diagram_tool.py` were already present as untracked non-Wave-7 surfaces and are outside every proposed boundary. Do not push without separate authorization.
