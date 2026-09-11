---
updated: 2026-09-08
branch: feature/menu-amendment-reconciliation
observed_head: 1d2ae227
runtime_ports:
  frontend: 3001
  api: 8001
  shipyard: 8090
  mysql: 3306
  audit_frontend: 3010
  audit_api: 8010
  warehouse_dev_frontend: 3020
  warehouse_dev_api: 8020
  e2e_frontend: 3036
  e2e_api: 8036
db_lane: ipc_lane9
warehouse_cleanup_lane: ipc_dev_warehouse_20260812
e2e_lane: ipc_lane7
credentials_via: IPC_LANE7_<ROLE>_PASSWORD
---
# Working memory hiện hành

Đây là working set được auto-load sau `AGENTS.md`; không phải history hoặc domain store. Luôn revalidate source/runtime, branch/HEAD/status và checkpoint trước khi hành động.

## Requested task — NFR research/plan only (2026-09-10)

- Owner yêu cầu brainstorm/research chọn lọc 24 nhóm trong `C:/Users/Administrator/Pictures/NFR.txt`, lập plan/checklist khắc phục **chưa thực thi**.
- Owner đã duyệt tiếp tục; checkpoint: [.planning/notes/nfr-research-and-remediation-PLAN.md](.planning/notes/nfr-research-and-remediation-PLAN.md). Implemented: auth inactive/device transaction recheck, direct-host không tin forwarded headers, native Retry-After, fail-closed axe contrast oracle, approval shared Dialog/dirty/focus/outside-click, và safe reauth continuity. Backend aggregate 21/21 + isolated build PASS; approval/a11y frontend 34/34. Reauth reviews found route-overwrite, stale-history, backslash, dot-segment, case and encoded login-loop aliases; each was locked RED before the minimal fix. Current sanitizer uses native same-origin URL normalization plus safely decoded/case-folded login-boundary comparison; restore uses replace. Reauth aggregate 22/22, TS/scoped lint/build/route budgets PASS; final follow-up `4dfdac30-2d15-4446-b3ce-22cab519ee06` found no issue, Merge verdict OK. Relational refresh race infrastructure-BLOCKED: `IPC_TEST_CONNECTION_STRING` unset, MySQL CLI unavailable; không đọc secret/appsettings hoặc dùng current lane. Protected approval browser mutation BLOCKED vì không có aligned runtime/natural item; không seed. Owner delegated remaining NFR decisions. Decision package adopted in active plan: D02 direct browser/API + 30m access/24h absolute refresh family/60m idle+2m warn/cap3/revoke-all; D04 qualification envelope; D05 service window/SLO/RPO/RTO; D06 Chrome+Edge desktop envelope; D07 diagnostic/privacy separation; D08 `Asia/Ho_Chi_Minh`; D09 .NET 9 patch then .NET 10 LTS isolated. First D07/D08 source wave: user metadata moved localStorage→sessionStorage with legacy cleanup, routine auth logs remove username/UA/device/hash prefixes, canonical Vietnam timezone including host-independent `formatDateVN`; frontend 40/40, backend auth 15/15, TS/lint/frontend build/budgets PASS; reviewer `2034d440-3352-415d-9779-246e779f3397` and follow-up `cc9c55de-fae6-439e-816a-768dfa15b495` returned OK with bounded P2 notes; all corrected (formatter host timezone, stale F11/F13 and decision-register disposition text); isolated backend build with existing restore assets succeeded 0 warnings/0 errors. An earlier relocated-obj invocation failed only because the new obj lacked `project.assets.json`. D02 source wave now implemented: validated cap3/24h config, refresh rotation preserves family expiry, IdleSessionGuard 60m+2m invokes shared logout once, and Admin deactivate revokes all refresh sessions in same SaveChanges. Reviewer found concurrent login/deactivate gaps plus idle-copy/test breadth. Source now serializes login/refresh/deactivate on the same MySQL user row, rechecks login active state, expands both Admin deactivation paths with multi-token/other-user/already-revoked controls, and renders configured idle durations. Follow-up reviewer `dbb15b36-5d04-4dac-a547-f49c0ab65e47` confirmed prior P1s addressed at source seam and returned OK with one P2 timer-bound note. Fixed by rejecting invalid/non-positive/overflow durations above browser signed-32-bit delay; final follow-up `d3973327-4123-4da0-be59-a5ef1bcd31aa` found no issues, Merge verdict OK. Focused frontend auth/policy 45/45 and backend auth/admin/config/repository 25/25 PASS; TS/scoped lint, isolated backend build 0/0, frontend build 2,336 modules and route budgets PASS. Relational concurrency claims remain NEEDS_EVIDENCE until disposable MySQL two-connection gates. D04/D05 reviewer found overclaims. Corrected: k6 artifact renamed read-only throughput probe (one identity/GET only), requires run ID, zero dropped iterations and run-unique output; full 50-user/80-20/write/import/p99/business-invariant qualification remains OPEN. Health endpoint-options owner now locks live/ready partitions + ready 200/200/503, while real HTTP/outage/alert stays NEEDS_EVIDENCE. Recovery README downgraded to E21 data-integrity scope; snapshot-bound provenance/business oracle/RPO/RTO remain E22. No load, outage, alert, DB or restore run. Final follow-up `76c063e8-9c39-4d87-afda-eeff1a5e61c6` found no issues, Merge verdict OK. D06 reviewer corrected native-UA and denominator claims. Harness now defines 672 cells: Windows10/11 × Chrome/Edge × current/previous × 3 viewport × 2 motion × 2 zoom × 7 workflows; NVDA separate Chrome-current subset. Config uses native channel UA, no webServer, and operator-supplied URL/ref/run ID/OS/version-band; this metadata does not verify runtime identity. Root-font 200% remains reflow proxy; real version/zoom/keyboard/NVDA/workflow evidence NEEDS_EVIDENCE. No browser launched. Final follow-up `1f194ca4-2b3c-451d-aefd-f32d2d41f49a` found no issues, Merge verdict OK. Owner then authorized D09 package servicing: minimum SDK 9.0.313 in the 9.0.3xx latestPatch band (local run observed 9.0.313); Microsoft ASP.NET/EF production+test and CI dotnet-ef 9.0.20; IdentityModel JWT 8.19.2 required by JwtBearer; Pomelo/other packages/net9 unchanged. Restore, isolated build 0/0, focused package-sensitive 49/49, EF no-pending-model and vulnerable scan PASS. Broad 1,226-test attempt has 15 inherited fixture/lineage failures; OpenAPI generation succeeds but differs from inherited dirty contract bytes, originals restored, parity NEEDS_RECONCILIATION. No DB/migration/runtime. Reviewer `841398e7-94f0-49ce-a09e-a7270bc4774f` confirms package alignment but Merge BLOCKED by mandatory broad CI/OpenAPI reconciliation. P2 docs fixed: latestPatch semantics, Node22. Durable receipts indexed: D09 focused authoritative and broad run attempt. Old JWT ≤30m residual accepted; relational simultaneous refresh and runtime/host evidence remain NEEDS_EVIDENCE. Không tự đổi mode, seed/migrate/restore, package hoặc commit.

## Current task — Phase 34: UI/UX toàn bộ MRX, Wave 1 inventory/DoR

- GSD Phase 34 L2 đã được tạo với một objective/plan/checklist/ledger duy nhất:
  [34-CONTEXT](.planning/phases/34-chu-n-h-a-v-th-c-thi-ui-ux-to-n-b-ch-i-chi-u-nguy-n-li-u-the/34-CONTEXT.md),
  [34-PLAN](.planning/phases/34-chu-n-h-a-v-th-c-thi-ui-ux-to-n-b-ch-i-chi-u-nguy-n-li-u-the/34-01-PLAN.md),
  [34-CHECKLIST](.planning/phases/34-chu-n-h-a-v-th-c-thi-ui-ux-to-n-b-ch-i-chi-u-nguy-n-li-u-the/34-CHECKLIST.md).
- Wave 1 inventory/DoR đã `PASS_WITH_BLOCKERS`; authority, findings và sequencing:
  [34-BRIEF-AND-ACTION-MATRIX](.planning/phases/34-chu-n-h-a-v-th-c-thi-ui-ux-to-n-b-ch-i-chi-u-nguy-n-li-u-the/34-BRIEF-AND-ACTION-MATRIX.md).
  Phase 34 F01–F11 đã source/unit/build close `PASS_WITH_RESIDUAL`: URL/scope ownership, issue/disposition
  authority, legacy endpoint retirement, mutation/query states, permission parity, dead-owner removal, ledger-only
  comparison/completion, stale-disposition invalidation và late-response isolation. Final independent review
  `07ab9b3b-db0e-44e8-8a4f-d66f97185e88` zero findings. Owner sau đó duyệt viewports 1366×768/1440×900/
  1920×1080, Audit MRX-default + ALL, QuantityImportBatchId uniqueness và global ReportAccess customer scope.
  F13/F14 PASS. Owner cấp runtime/migration/mode/credential authority: `ipc_lane9` đã backup rồi apply 11 pending
  migrations, existing WH-SAMPLE activated sau invariant check, mode initialized và chuyển sang MRX v2. Task-owned
  Headed Chrome 3 route × 3 viewport PASS; F12 DOM red/green xóa blank 480/420px. Owner cho phép disposable lane:
  fresh public UI/API lifecycle tại `runs/20260909-224848/full` PASS 49/49 và DB oracle PASS (COMPLETED v6,
  84 frozen lines, 2 issues/85 movements, 1 confirmed return, supplemental + return exact invalidation). Live RED
  phát hiện supplemental lifecycle sequence reuse gây 500; fixed theo batch version, focused 23/23 PASS.
  Functional implementation/protected lifecycle PASS; ipc_lane9 không nhận E2E records. Independent research
  corrected whole-mode UI/UX verdict to `PASS_WITH_RESIDUAL`: three-viewport composition omitted MRX Dashboard
  and Reconciliation and lacked a full route/view/state denominator. Harness now requires claim envelope + cell
  reconciliation + namespaced verdicts. Root cause: `.artifacts/ui-ux-process-inventory/PHASE34-PASS-GAP-ROOT-CAUSE.md`.
  Runtime/Chrome teardown; evidence DB `ipc_mrx_full_e2e_phase34_20260909224848_f` retained temporarily.
- **Phase 35 active:** `.planning/phases/35-chu-n-h-a-ui-ux-to-n-b-mounted-frontend-theo-claim-envelope/35-CHECKLIST.md`.
  Owner expanded `/goal` to all mounted frontend owners in both DEFAULT and MATERIAL_RECONCILIATION, including
  semantic duplicate same-problem surfaces and closed dropdown label parity beyond supplied screenshots. Canonical
  V3 now clarifies semantic duplicates across adjacent surfaces; harness step 10 requires option→closed-trigger
  parity. Ledger: `.artifacts/ui-ux-process-inventory/PHASE35-INFORMATION-AND-SELECT-FINDINGS.md`. First focused
  implementation wave fixed Warehouse error+false-empty, Weekly duplicate catalog error, Approval duplicate empty,
  MRX issue-line ordinal-only selection, and Chef discriminator loss; 6 files/39 tests, TypeScript/scoped lint PASS.
  IU-05/IU-06 and CVP-03 are now fixed: Approvals/Advanced Settings use one live success channel, and Audit/
  menu-version/approval-rule options derive from owning label maps instead of duplicated literals; unknown audit area
  no longer masquerades as `Tất cả`. Expanded focused aggregate 10 files/67 tests, TypeScript/scoped lint PASS.
  CVP-04 is now source/focused PASS: shared Select exposes the complete projected label in `title`; all production
  `SelectValue` callsites explicitly project user labels and a zero-empty-occurrence guard prevents raw serialized-
  value flashes. Denominators are frozen at `.artifacts/ui-ux-process-inventory/phase35-denominators/`: closed-value
  DEFAULT 37 controls/74 cells and MRX 13/26 (PASS_SOURCE); information uniqueness DEFAULT 17 and MRX 5 states.
  MRX headed semantic receipt at `.artifacts/shipyard-live/phase35-mrx-semantic-composition-20260910/manifest.json`
  passes 4/5 state cells across all three viewports (12 observations): Weekly error ownership, reset live feedback,
  and dashboard overview/detail. DEFAULT headed semantic evidence on `ipc_lane7` DEFAULT v23 passes 16/17
  cells across all three viewports. Combined receipt is 20/22 state cells and 60/66 observations. Remaining:
  MRX all-matched with a naturally available selected batch and DEFAULT successful protected approval mutation.
  Residual states unavailable: approval inbox 0; no all-matched batch. No fabricated PASS; runtimes torn down.
  W1 inventory locked 14 mounted URLs and RED 5 failures. W2 first shared-seam wave GREEN 5 files/35 tests:
  mixed-uninitialized and Chef error priority, Admin compact blocking geometry, one-primary hierarchy on
  Warehouse/Approvals/Admin, Purchasing invisible spacer removed. TypeScript/scoped lint/harness/diff-check PASS.
  W2 Warehouse duplicate-state/history recovery GREEN; affected aggregate 9 files/67 tests, full build/lint PASS.
  Council memo `.artifacts/ui-ux-process-inventory/PHASE35-RESIDUAL-CLOSURE-BRAINSTORM.md` corrects browser
  Final reviewer `031a7ba9` BLOCK: candidate 147 runner did not activate DEFAULT local-state tabs, omitted full
  adjacency/scroll/focus/hit-target oracle and lacked verified runtime/source identity; S04/S05 lineage/fence also
  incomplete. Downgraded composition to 147 NEEDS_EVIDENCE, health to 138/147, S04/S05 to NEEDS_EVIDENCE.
  Geometry v2 has 95/95 source classifications only (`PASS_INVENTORY_ONLY`), not browser conformance.
- Model đã xác minh qua `PI_MODEL=gpt-5.6-sol`; HEAD `1d2ae227`, index rỗng. Giữ uncommitted governance docs
  và inherited frontend dirt; không tự reopen Phase 31/33, đổi mode, tạo dữ liệu, mutate protected batch hoặc commit.

## Application checkpoint — Phase 33 closeout awaiting commit

- Kỳ đã chấp nhận đóng Phase 31 `PASS_WITH_DECLARED_RESIDUAL`. Authority: [31-CHECKLIST](.planning/phases/31-full-system-ui-ux-audit-and-remediation-using-measurable-com/31-CHECKLIST.md), [31-VERIFICATION](.planning/phases/31-full-system-ui-ux-audit-and-remediation-using-measurable-com/31-VERIFICATION.md), handover: [.artifacts/subagents/mrx-screenshot-uiux-remediation-HANDOVER.md](.artifacts/subagents/mrx-screenshot-uiux-remediation-HANDOVER.md).
- Source/tests/final review PASS; reviewer `702ba5f4-69b0-4b5e-837a-7861cd7cecf9` tìm thấy zero issue trên `31c7d0a0`, `05b4acea`, `8ff0dd15`.
- Residual được giữ trung thực: protected completion mutation, mixed linked-issue runtime render và exact browser cells là `NEEDS_EVIDENCE` / `WAITING_FOR_BUSINESS_EVENT`. Đây không phải full protected MRX lifecycle certification; không tự reopen, đổi mode hoặc tạo dữ liệu.
- Phase 33 technically `PASS_WITH_RESIDUAL`: S1 `1fd019b9`, S2 `f629fe5d`, S3 `245924c3`; service/owner line counts lần lượt 475/164, 513/267, 544/250. Strict architecture-growth PASS, baseline SHA-256 `8d5e9c06...e0b4f8` giữ nguyên; aggregate focused backend 51/51, architecture unit 6/6, isolated API build 0 warning/error. Final reviewer `f49c5b8e-e861-4f6f-a157-b7939776757e` zero finding. Debug output build bị PID 2156 lock nhưng isolated output PASS; process không bị dừng. Authority: `.planning/phases/33-refactor-three-unbaselined-backend-services-to-restore-stric/33-CHECKLIST.md`; closeout report `.artifacts/phase33/closeout/independent-review.md`. Chờ commit closeout docs; không có product goal kế tiếp tự động.
- Controlled cleanup A–E và boundary/null remediation đã checkpoint qua `b6179012`, `2ca654d3`, `5a297cf7`, `1fd9c017`, `6d53cdf7`; main worktree normalized content/index/untracked sạch tại goal entry. Hai script REMOVE-CANDIDATE vẫn chưa được xóa; không tự resume cleanup/MRX.

## Completed harness checkpoint

- Phase 32 AH-00..AH-10 và acceptance audit P32-A01..A07 PASS cho Pi CLI-only: [checklist](.planning/phases/32-chu-n-h-a-ki-n-tr-c-ai-agent-harness-d-ng-chung-cho-pi-cli-v/32-CHECKLIST.md), [handover](.planning/phases/32-chu-n-h-a-ki-n-tr-c-ai-agent-harness-d-ng-chung-cho-pi-cli-v/32-HANDOVER.md). Fresh probes đã khóa docs/MRX/UI/resume/capability routing; same-size concurrent edit nay dùng SHA-256 pre-write gate. Independent final review không có finding; chưa cần plan nâng cấp harness mới. Codex app/CLI đã bị Kỳ loại khỏi workflow.
- Phase 32 không sửa FE/BE, database/schema/data/mode, không GitNexus, package/user-global config, hooks/extensions, commit hoặc push. Scoped backup: `D:/Temp/IPCManagement-agent-harness-20260908T041310Z`.

## Current application checkpoint

- MRX screenshot remediation source đã thực hiện qua các local commits `15de7a18`, `903a0fc5`, `218ece32`, `b0b13dba`, `0ac18d3d`, `31c7d0a0`, `05b4acea`, `8ff0dd15`; focused/full frontend, lint/build/route budgets và backend completion tests đã PASS. `05b4acea` cô lập settlement cũ bằng dialog-session token; `8ff0dd15` chuyển presentation/disablement khỏi hook-wide mutation loading sang pending state do chính session dialog sở hữu, nên close/reopen được bật ngay và settlement cũ không đổi session mới. Browser exact drawer/all-exact cells còn `NEEDS_EVIDENCE` do protected lane không có actionable state.
- Durable handover: [.artifacts/subagents/mrx-screenshot-uiux-remediation-HANDOVER.md](.artifacts/subagents/mrx-screenshot-uiux-remediation-HANDOVER.md).
- GSD authority vẫn ở [Phase 31 checklist](.planning/phases/31-full-system-ui-ux-audit-and-remediation-using-measurable-com/31-CHECKLIST.md). Không tạo dữ liệu, đổi operation mode hoặc chạy lại campaign trong Phase 32.

## Business contract và authority map

- `MATERIAL_RECONCILIATION`: [canonical domain contract](docs/domain/material-reconciliation.md). Phải đọc trước mọi task MRX; archive/narrative cũ không override.
- Tài liệu theo task: [docs/README.md](docs/README.md).
- AI Agent Harness: [docs/harness/README.md](docs/harness/README.md).
- Runtime/skills/subagents: [docs/harness/RUNTIMES.md](docs/harness/RUNTIMES.md).
- Delivery/debug lanes: [docs/harness/DELIVERY.md](docs/harness/DELIVERY.md).
- Evidence hash chỉ ở [docs/EVIDENCE-INDEX.md](docs/EVIDENCE-INDEX.md); completed history ở `HISTORY.md`; migration/restore/browser measurement phải đọc `LESSONS.md`.

## Runtime và dữ liệu

- Các port/lane ở front matter là pointer, không phải readiness proof. Trước browser/database action phải xác minh listener/build identity, authenticated operation mode/version/capabilities, readiness và exact target lane.
- Không thử credential mặc định, không dump auth/config secrets, không assume lane rỗng, không seed/reset/restore/direct-write để làm gate xanh.
- `DEFAULT` và `MATERIAL_RECONCILIATION` giữ authority/lineage tách biệt theo canonical contract.

## Fresh-session handover tối thiểu

Đọc `AGENTS.md` → file này → active checklist; compare cwd/branch/HEAD/status/index. Một bước active tại một thời điểm. Sau mỗi verified wave ghi changed paths, command/exit/result, evidence limits, blocker, owned process state và exact next step vào checklist; không dựa vào transcript chưa persist.
