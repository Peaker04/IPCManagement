# Current task — full-chain branch, runtime and protected squash integration

2026-11-14 user explicitly authorized resolving remaining findings, commit/push to a new branch and squash into main; confirmed all work in this conversation, including inherited MRX/housekeeping. Branch `chore/mrx-ci-cleanup-20261114` created from bbd55009a77a6e83f79027a7784deb4b7f323928. Current authority includes git/gh operations, relevant dependency restoration and hosted ephemeral CI via PR. Source DB mutation, local campaigns, main-service restart, forced push and subagents remain excluded. Preserve all evidence/backups and MRX OPERATIONAL_QUALIFICATION_BLOCKED.

- GitHub authenticated as repository admin; main previously unprotected, baseline Verify failed on the previously missing phase05 script. No Vercel credential/session found. Disable automatic Git deployment in repo config pending operational release qualification; do not pretend a Vercel account setting was changed.
- Runtime source/build verified: SDK/targets/container -> .NET10, ASP.NET packages10.0.12, Swashbuckle/CLI10.2.3, MySqlConnector2.6.2 fixes GHSA-473q-m89c-ghf8. EF/Pomelo remain9 (EF9 servicing9.0.23); EF10 provider replacement cannot be safely represented as a minor runtime update or qualification. Legacy migrations untouched. OpenAPI namespace/security builder compile RED observed and adapted to official v10 API; shared Swagger documentation HTTP regression now passes.
- Preserve transient two-file Vitest canary under .artifacts/ci-cd-audit/retained-canary; ignore its generated directory pattern instead of publishing scratch. No user source file removed.
- Runtime/source verified: .NET10 build PASS; OpenAPI v10 generation PASS and FE TypeScript/build PASS; fixture determinism PASS. Local BE core49+1530 PASS (gated MySQL methods are not local DB proof), native Windows contracts51/51 PASS. Existing FE674/674/JUnit and fast gates37 Node+8 Python/conformance retained; hosted full suite still required on committed source.
- Main protection applied/read back: strict verify + both CodeQL language checks from app15368, admin enforcement, PR required, no force pushes/deletes. Git-based Vercel deploy disabled in source for all branches; no live provider account changes or deployment.
- Additional gate repair: Windows PowerShell tests separated into required windows-contracts job, not skipped. Test child PSModulePath reset to avoid loading incompatible PowerShell7 modules into5.1. Stable verify requires FE, Linux BE and Windows success. Added native dev-documentation HTTP regression: RED404/500, now both documentation URLs use the same existing Swagger provider, no duplicate generator or raised schema limits; regression PASS and login path parity asserted.
- Secret/binary candidate review348paths: no private-key/token/AWS-key or new data/binary flags. Two generated canary files retained outside source. Full whitespace check PASS, no hook installed. Staged348 intended paths after zero secret/binary flags and whitespace cleanup. Next commit/push PR, required hosted checks, protected squash and remote/local verification. No bypass of failed checks. EF9 support debt and MRX operational qualification remain explicitly open.

# Previous task — CI/CD source verified / runtime and provider evidence OPEN

User approved all eight CI/CD verdicts. Execute natively in inherited working tree, no commits/subagents/worktree/install/deploy/hosted dispatch or source DB mutation. Plan: `docs/superpowers/plans/2026-11-13-lean-ci-cd.md`. WORK is sole progress owner; plan checkboxes describe steps, not a second mutable ledger.

- Implemented pending final verification: Python TRX/schema checks (8 behavioral tests GREEN after RED); split frontend/backend with stable verify aggregate; common quick/conformance; matching main/dev Verify+CodeQL; build solution before no-build/no-restore test stages; fixture build once/two DLL executions; selective diagnostics. Node workflow/entrypoint tests 25/25 GREEN after RED.
- Verified: verify:quick PASS (36 Node tests +8 Python cases + conformance); solution build --no-restore PASS; fixture determinism Python gate PASS (build once --no-restore, two independent workbook executions); final FE lint/build/dependency PASS; final full FE suite 674/674 tests, 60/60 files PASS with JUnit. Native final source/caller review complete; scoped whitespace PASS and index empty. Receipt `.artifacts/ci-cd-audit/RESULT.md`.
- Discovered/repair: dependency-cruiser initially FAIL on inherited AppShell -> routes/RouteWorkbenchLoadingFallback. Root App now supplies required loadingFallback ReactNode; existing consumers/tests pass the real fallback. Original dependency gate now PASS with unchanged baseline; shell regression RED -> GREEN, 19/19 focused shell tests PASS. Final FE build PASS.
- Ruling: preserve EF/Pomelo configuration until supported upgrade is proved. SDK 10 is installed, but upstream stable Pomelo support currently maps to EF9; no SDK-only claim of full EOL remediation.
- Ruling: execute approved design directly, no repeat approval, native self-review under explicit no-subagent restriction. No extra skill ledger/commit-based workspace; WORK and scoped test logs retain evidence.
- Ruling: preserve core-test placement after model schema setup, avoiding a new hidden prerequisite change; only frontend/backend are parallelized. Entry-point guard now parses folded YAML and follows npm groups rather than counting top-level lines.
- Ruling: repair the discovered dependency failure at the composition owner, not by weakening CI or adding baseline entries. AppShell/App and existing shell test compositions are the only product-facing expansion; same fallback UI/tokens/guards. Scoped UI gate emitted; impeccable launcher not run under no-install/external-CLI constraint, context read directly. This is a boundary repair, not a rendered design audit. AGENTS names operationalPageContracts/*.contract.test.tsx gates that are absent in this checkout; use existing shell and full FE tests, do not invent missing gate results.
- Remaining: runtime supported-stack upgrade OPEN (NuGet/upstream stable Pomelo9 -> EF9; EF9 also EOL); provider enforcement and hosted CI/timing NEEDS_EVIDENCE. No GitHub/Vercel connector available; no provider setting/deploy/push/dispatch performed. Build notes inherited NU1902 MySqlConnector2.4.0, nullable/async compiler warnings and frontend chunk-size warning; no warning threshold changed.
- Disposition: verdicts 3–8 implemented and locally verified within their source scope; verdict2 branch coverage fixed but provider promotion evidence missing; verdict1 supported-stack upgrade NOT implemented. Entire approved objective is not marked complete. No local service/DB operation or hosted release performed; MRX remains OPERATIONAL_QUALIFICATION_BLOCKED.
- Skill evaluation: using-superpowers/executing-plans; approved CI implementation; avoid skill skipping/repeated approval; native task sequence; correct; WORK-only ledger and no agents; user constraints preserved. TDD/test-audit/debugging/codebase-design/code-review/verification; CI scripts + discovered shell boundary; zero/partial evidence and inverted dependency; RED/GREEN and owner injection; correct; no baseline additions; hard gates retained. ipc-ui-review/impeccable; same fallback composition; preserve title/geometry; project context + actual shell tests; correct within source scope; no launcher/browser/design certification; no visual policy changes.

# Previous task — CI/CD audit CLOSED

User requested using-superpowers + ponytail-audit to evaluate lean CI/CD on 2026-11-13. Audit only; no workflow/product changes, installs, CI runs, DB operations or deployment in this task. Findings and source/official-document references: `.artifacts/ci-cd-audit/REVIEW.md` (supporting audit report, not another task-state owner).

Eight findings: .NET 9 end of support; dev deployment/Verify trigger mismatch with provider enforcement NEEDS_EVIDENCE; serial FE/BE; repeated build/restore; local/CI conformance gate drift; missing per-case migration execution guard; incomplete diagnostic artifact collection; inline schema/TRX logic. Proposed two execution jobs plus one aggregate in Verify, separate existing CodeQL, no new CI framework or weakened gate. No implementation approval requested or assumed. Hosted timing/provider settings and runtime remain unverified. MRX remains OPERATIONAL_QUALIFICATION_BLOCKED.

Skill evaluation: using-superpowers / CI audit / workflow selection / skills loaded / correct / no delegation / audit-only scope; ponytail-audit / CI-CD / distinguish source and runtime / concrete ranked findings / correct / no forced deletions / preserve data gates. Audit source mapping complete; implementation and performance validation NOT RUN.

# Previous task — architecture housekeeping CLOSED

## Authority and scope

User approved the findings and execution order in `.artifacts/cleanup-review/ARCHITECTURE-REVIEW.md` on 2026-11-13. Execute natively, no subagents, commits, installs, database writes/campaigns or main-service restart. Preserve dirty product work. This file is the sole mutable task-state owner.

The previous WORK history is preserved byte-for-byte in `.artifacts/cleanup-review/approved-archive/.planning__WORK.md.txt`; its SHA-256 and the original routers/runners are in `approved-archive/manifest.json`. The archive is historical evidence, not an active task ledger. Read it for older context; do not treat historical PASS/authorization as current permission.

## Baseline and protected facts

- Checkout: `D:/ki7/PRN222 Doanh Nghiệp/IPCManagement`; branch main; HEAD `bbd55009a77a6e83f79027a7784deb4b7f323928`. Inherited working tree dirty; index empty.
- MRX aggregate remains `OPERATIONAL_QUALIFICATION_BLOCKED`. Preserve all evidence, dumps, provider receipts, database backup folders and source inputs. Filesystem housekeeping does not resolve an interrupted database cleanup.
- Run `20261112t035659z_5b23bc` manual cleanup receipt is retained. Later interrupted run `20261113t112535z_57042b` cleanup remains unproven/BLOCKED after automatic approval rejection; do not retry it here.
- Main database migration/schema-only sync was a no-op; no data sync or DB deletion is authorized.
- Shipyard and shipyard-lanes are independent repositories; lane has 42 tracked dirty files. Do not alter either.
- Prior UI checks: 673/673 FE tests, 14/14 isolated Chrome tests. They are prior scoped UI evidence, not new cleanup/DB qualification.
- Prior generated-build cleanup: 1.874GiB verified removed. Receipt: `.artifacts/cleanup-review/receipt.json`. Do not count it again.

## Approved checklist

- [x] Preserve original WORK, routers and four old runners with hashes.
- [x] Add failing regressions for workflow npm entry points, ordinary Playwright campaign exclusion and fail-closed legacy runners. RED log: `entrypoints-red.log` under cleanup-review. No unsafe runner executed in RED.
- [x] Retire four fixed-name DB runners with capability-free error entry points; wire existing phase05 determinism test; align frontend Playwright exclusion; slim instruction routers.
- [x] Verify focused repository guards and ordinary test discovery; no DB campaign or package restore.
- [x] Archive139 log/result/NUL files with SHA-256, remove12 inactive root logs, test-results and ordinary NUL.
- [x] Repair only the `D:/IPCManagementCurrent` junction to the verified checkout.
- [x] Remove151454483bytes of inactive brainstorm profile; all17 non-profile design/session files preserved by hash.
- [x] Catalogue241plans/specs:2 current-owner references,208 historical references,31 snapshots retained pending semantic adjudication. Zero missing local Markdown links in the scanned current/historical docs. No plan deleted by age. Corrected current ARCHITECTURE/FLOWS source-owner descriptions/links against real code; originals retained.
- [x] Archive1429files from both external FE trees with per-file verification, preserving five/200unique files. Four inbound historical references updated before removing originals. Archive and manifest: `D:/IPCArchives/frontend-reference-snapshots/2026-11-13-frontend-references.*`.
- [x] Verify original archive hashes, protected manual cleanup receipt, source diff and CI configuration; review complete. Historical runner bodies remain private `.txt` archives; four DB and11visual entry points fail closed.

## Fresh verification and remaining limits

- 27/27 repository/tooling checks PASS (`.artifacts/cleanup-review/approved-checks-final.log`); frontend lint PASS; strict architecture PASS with the same four inherited BE findings; conformance PASS; diff whitespace PASS.
- Both ordinary Playwright configs list107tests/10files and exclude MRX campaigns. This is discovery, not107executed browser tests. No main service started/restarted.
- Full local document scan reports zero missing local links. Roots, archived originals and reference backups verified; current repo HEAD/index unchanged.
- MRX evidence remains10602.55MiB/46470files. Protected manual receipt hash matches the prior verified receipt. Existing895110174-byte external trace archive retained. No DB/provider backup directory or independent Shipyard repo changed.
- Main operational qualification remains BLOCKED. Hosted GitHub CI, Python fixture execution with its implicit dotnet restore, recovery drills and full application suites were not run for this filesystem/config/doc cleanup. Restoring the missing CI command is not a hosted-CI PASS claim.
- Receipts: `root-clutter-receipt.json`, `frontend-archive-receipt.json`, `approved-after.json`, `document-catalog.json` under `.artifacts/cleanup-review/`. The previous1.874GiB cleanup is separate; do not double-count it.

## Execution rulings

- The approved review is the plan; do not create another overlapping spec/plan for housekeeping.
- Archive raw obsolete runner implementations as `.txt`, so preserving provenance does not leave another executable destructive CLI.
- Restore the missing CI caller, retain its actual fixture test and quality gate. Local verification must not silently trigger `dotnet run` restore/install; distinguish command/config validation from hosted CI execution.
- Backup/evidence retention and provider recovery require their own concrete scope. Keep them intact in this cleanup.
- Document history may be catalogued without moving a still-referenced plan. No blanket archive by date or wholesale removal of integration directories.
