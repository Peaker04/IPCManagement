# IPCManagement — NFR research và remediation plan/checklist

Status: ACTIVE_W1_W2 — IMPLEMENTATION_AUTHORIZED_2026-09-10 — PROTECTED_DB/MODE/SEED/COMMIT_NOT_AUTHORIZED
Task ID: NFR-20260910
Owner: GSD parent; đây là một draft plan/checklist duy nhất, không phải full typed GSD phase đã qua gate.
Input: `C:/Users/Administrator/Pictures/NFR.txt` (24 nhóm).
Source baseline: branch `feature/menu-amendment-reconciliation`, HEAD `1d2ae2278d8503fb25c995c7e112fe3439227157`, index rỗng; nhiều inherited dirty files phải giữ nguyên.

## 1. Mục tiêu và ranh giới

Task bắt đầu bằng research chọn lọc rồi được owner mở quyền thực hiện W1/W2. Current source đã có các remediation và focused verification ghi ở §6; các wave/gate còn lại giữ OPEN/BLOCKED/NEEDS_EVIDENCE.

- Research stage đã đọc source/docs/skill và primary sources, tạo plan/checklist.
- Execution authority hiện có: sửa FE/BE/test/docs và chạy local focused/build/lint gates cho W1/W2.
- Vẫn không được làm: protected/runtime DB access, seed/migrate/restore/backup, đổi mode, cài/nâng package, GitNexus, stage/commit/push hoặc protected browser mutation.
- Sau khi duyệt plan: các bước auth/public-contract/multi-feature/data thuộc L2; bug seam đơn thuộc L1. Quyền thực thi code không bao hàm quyền protected DB, migration, mode switch hoặc mutation E2E.
- Phase 35 vẫn giữ ownership các UI finding/residual hiện hành. Draft này không reopen campaign, không thay denominator, không copy checklist của Phase 35.
- `.planning/STATE.md` còn narrative Phase 33; dùng MEMORY và active Phase35 checklist để đối chiếu hiện trạng, không tự resume từ STATE cũ.

Authority: [Lean delivery](../../docs/harness/DELIVERY.md), [documentation map](../../docs/README.md), [current UI checkpoint](../phases/35-chu-n-h-a-ui-ux-to-n-b-mounted-frontend-theo-claim-envelope/35-CHECKLIST.md).
Primary research: [PRIMARY-SOURCES](../../.artifacts/nfr-research/20260910/PRIMARY-SOURCES.md).

## 2. Quy tắc phân loại

| Loại | Ý nghĩa | Hành động |
|---|---|---|
| SOURCE_CONFIRMED | Current reachable source có gap/contract mismatch; chưa phải runtime reproduction | Lập red-capable behavior test trước fix |
| CANDIDATE | Có nghi vấn nhưng còn thiếu caller/repro/contract | Xác minh hoặc bác bỏ; chưa ra lệnh sửa |
| NEEDS_EVIDENCE | Chưa có phép đo/receipt đúng môi trường hoặc đủ matrix | Thu thập evidence sau khi được phép; không suy là defect |
| DECISION_REQUIRED | Chưa chốt yêu cầu business/ops/security/legal | Đề xuất lựa chọn và owner duyệt |
| EXISTING_CONTROL | Đã thấy cơ chế hiện hữu | Reuse và kiểm chứng; không tạo cơ chế song song |

Verdict gate vẫn dùng PASS / FAIL / NEEDS_EVIDENCE / BLOCKED theo từng claim. Severity phản ánh tác động, không phản ánh độ chắc chắn. Không gọi thiếu một technology là defect nếu chưa có requirement tương ứng.

## 3. Ma trận applicability — đủ 24 nhóm

Đây là phạm vi đã research/disposition, không phải 24 lỗi được xác nhận. Baseline theo từng nhóm và source ranges nằm trong [backend context](../../.artifacts/nfr-research/20260910/BACKEND-SOURCE-CONTEXT.md) và [frontend context](../../.artifacts/nfr-research/20260910/FRONTEND-SOURCE-CONTEXT.md). Parent đã đối chiếu trực tiếp các finding trọng yếu ở §5; các control ngoài phạm vi đọc sâu vẫn là inventory, không phải certification.

Đã có: native rate limiting, JWT + HttpOnly refresh cookie/hash-at-rest, shared transaction/commit-verification, live/ready checks, Serilog/correlation, encrypted backup/provider scripts, bounded upload/paging, RTK Query single-flight/cache, shared Dialog, Intl và architecture/test gates. Không xây lại các cơ chế này.

| # | NFR | Hướng phù hợp dự án / quyết định cần chốt | Acceptance cần lập trước execute |
|---|---|---|---|
| 1 | UI/UX / Interaction | Dùng project Fiori rules và shared query/dialog/toast owners; không redesign đồng loạt | Route × view × state × actor × viewport × action; loading/empty/error/refresh/validation/back/dirty-state/double-click có oracle |
| 2 | Accessibility | WCAG 2.2 AA đã adopted ở DASHBOARD-UI-RULES §A; chỉ chốt evidence/support envelope | Axe subset + keyboard/focus/screen reader/contrast/text resize/reflow; không chứng nhận AA chỉ từ axe |
| 3 | Performance | F1 đã chốt CWV p75; dùng existing budgets/probes, API p95/p99 chốt riêng | Production-equivalent cold/warm + dataset/tải/network/sample window; chưa có baseline không nói chậm |
| 4 | Capacity / Scalability | Chốt peak shift users/RPS, customer/menu/import/file/DB volumes; giữ monolith trước | Load profile có think-time/read-write mix/duration/headroom; giới hạn import/file và memory phải đo |
| 5 | Availability | Chốt giờ phục vụ, SLO trước SLA, downtime/maintenance owner | Good requests / eligible requests và cửa sổ; external synthetic checks + alert owner |
| 6 | Reliability | Reuse transaction/retry fences; không retry mutation mù hoặc thêm circuit breaker khi không có external dependency | Timeout/cancel/transient/replay/partial commit tests; uncertain outcome có recovery path |
| 7 | Security | Threat model role/customer/mode/record boundaries + transport/secrets | Deny-by-default/cross-role/cross-customer/mode-stale, XSS/CSRF/CORS/rate/secret checks theo threat model |
| 8 | Session/Auth | Đã có cookie refresh; access token ở sessionStorage. Chốt risk/transport, idle/absolute lifetime, revoke/logout-all/MFA/concurrency policy | Server-time expiry, token rotation/reuse/logout, multi-tab/late-401 behavior; không chỉ FE timer |
| 9 | Data | Giữ transaction, version/lineage/stock invariants; chốt retention và deletion policy | Concurrent update/replay/rollback; date-only vs instant, exact decimal/unit, append-only business history |
| 10 | Backup/Recovery | RPO/RTO theo mất dữ liệu chấp nhận được, không theo khả năng script sẵn có | Restore rehearsal riêng DB/file/config/keys dưới authority riêng; measured RPO/RTO + integrity |
| 11 | API | Reuse error envelope/OpenAPI/paging; chốt compatibility/idempotency contracts | Actual HTTP middleware/validation/auth/rate/not-found responses; DTO/generated client parity |
| 12 | Integration | Inventory external services trước; internal modules không tự thành integration | Nếu có dependency: timeout/retry-budget/429/partial outage/webhook replay-signature tests; nếu không, N/A có source |
| 13 | Browser/Device | Giữ Chrome headed desktop hiện hành; đề xuất thêm Edge stable/stable-1 chỉ khi khách hàng cần và owner duyệt | Duyệt browser-version matrix; giữ 1366×768/1440×900/1920×1080; không tự mở tablet/mobile |
| 14 | Error Handling | User-facing message ổn định + request ID; không lộ exception internals | 400/401/403/404/409/413/429/500/503/network-timeout; retry/redirect rules không làm mất form |
| 15 | Logging/Monitoring | Reuse Serilog/correlation/audit; quyết định metrics/alert/retention tối thiểu | Correlation xuyên FE→API/log, redaction, cardinality, latency/error/rate/backup alerts; no secrets/PII bodies |
| 16 | Health Check | Inspect existing liveness/readiness/check predicates và response exposure | Live vẫn khỏe khi DB unavailable; readiness phản ánh khả năng phục vụ đúng mode, external consumer diễn giải đúng |
| 17 | Rate Limiting | Inspect current partition/middleware/proxy/trust; không chọn limit tùy ý | Fairness nhiều user sau NAT, auth brute-force, 429 envelope và Retry-After semantics |
| 18 | Maintainability | Reuse strict dependency/growth gates, giữ owner boundaries | Không baseline expansion để che regression; same-pattern scan scope rõ |
| 19 | Testability | Behavior tests tại root seam + focused suite; không coverage % tùy ý | Mỗi finding có RED→GREEN; test harness/parser outcome khác application outcome; no whole-system PASS từ focused tests |
| 20 | Deployment | Patch/support planning + environment parity + rollback/migration policy | Build identity, preflight, compatibility, read-only smoke, rollback rehearsal riêng; no auto-upgrade |
| 21 | Configuration | Metadata-only review; chốt environment/secret source/fail-fast | Required options invalid→startup reject; no default credential/sample bootstrap ở production |
| 22 | Localization | vi-VN/VND/Unicode và business timezone cần canonical owner | Locale-independent roundtrip; timezone-edge/date-only/decimal/Unicode/unknown-enum tests |
| 23 | Privacy/Compliance | Data inventory, lawful purpose/retention/access/export/delete owner; không mặc định GDPR áp dụng | No PII/secrets trong logs/evidence; retention/audit immutability reconciliation được business/legal duyệt |
| 24 | Safety/User protection | Confirm dựa hậu quả; UI guard không thay server idempotency; undo không phá ledger | Double-submit/replay/lost-response/cancel-close/reload; protected mutation→DB transition→reload chain |

## 4. Research checklist — task hiện tại

- [x] NFR-R01 Đọc input 24 nhóm, entry contract, MEMORY, git branch/HEAD/status/index.
- [x] NFR-R02 Đọc skill chọn lọc và authority map; xác minh installed provenance, không cài thêm.
- [x] NFR-R03 Fetch và đọc phần liên quan của 6 primary sources chính chủ; lưu claim/source/limits.
- [x] NFR-R04 Đối chiếu active Phase35 checkpoint; giữ UI evidence residual và không reopen passed cells.
- [x] NFR-R05 Hai source inventories completed; parent đã re-read shared auth/repository/controller/transaction/proxy/validator và UI dialog/parent/axe/session/formatter/recovery seams.
- [x] NFR-R06 Ledger §5 phân loại source gaps, candidate và decision/evidence gaps; không gọi refresh cookie/health/backup là missing; không reopen geometry hoặc gọi race là reproduced.
- [x] NFR-R07 Waves §6 khóa owners, planned RED seams, dependencies, same-pattern scan và quyền cần duyệt.
- [x] NFR-R08 Document check PASS: relative links tồn tại, whitespace/secret-like scan sạch, 24/24 nhóm, 15 finding IDs không trùng, không checkbox execution nào được đánh dấu, existing planned test paths tồn tại. Scoped `git diff --check` exit0; đây là kiểm tài liệu, không application tests.

Read-only research run: `2f2306dd-f7a8-4e18-8b2e-8f42d93c72ae`; two managed outputs, no application writes authorized.

## 5. Finding ledger — một nơi giữ disposition

P1: ưu tiên security/data safety/oracle correctness trước certification. P2: continuity/contract/support hardening. OPS: phụ thuộc authority và evidence vận hành, không mặc định là lỗi sản phẩm. W1/W2 dispositions hiện hành nằm ở §6; các mục ngoài đó chưa thực thi. Source ranges thuộc working tree đọc ngày 2026-09-10, cần revalidate trước edit.

| ID / mapping | Priority / loại | Evidence, current disposition và tác động | Quyết định xử lý tối thiểu / acceptance |
|---|---|---|---|
| NFR-F01 / B02 | P1 RESOLVED_SOURCE/FOCUSED_PASS | Pre-change AuthService refresh không kiểm `stored.User.IsActive`; current source rechecks inactive both before and inside transaction, with no successor. §6 NFR-E03: RED→GREEN, AuthService 11/11; AuthController 2/2. | Source/focused PASS. Relational cross-transaction race remains separate F02; old access-JWT revocation remains D02. |
| NFR-F02 / B03 | P1 CANDIDATE race; source thiếu atomic consume | AuthService:125-157 check flags trước transaction, đọc lại rồi set flags; mapping `Features/Auth/Persistence/AuthEntityConfigurations.cs:75-137` chỉ unique token hash; `Data/Transactions/EfTransactionRunner.cs:68-115` ReadCommitted + verifier không thay single-use fence. | RED bằng hai MySQL connections cùng token; nếu tái hiện, conditional consume trong transaction hiện hữu, affectedRows=1 trước successor. Đúng 1 success/1 successor, replay bị từ chối có chủ ý, uncertain commit không duplicate. Không dùng mock transaction để close race. |
| NFR-F03 / B01 | P1 RESOLVED_SOURCE/BUILD_PASS | Owner confirmed no reverse proxy is currently used. Pre-change source enabled forwarded headers fail-open; current direct-host source removes forwarded-header registration/middleware, so untrusted `X-Forwarded-*` is not consumed and rate partition uses direct peer address. | Source/build PASS for current topology. A future reverse proxy requires a separate trusted-proxy allowlist + integration-test change; not prebuilt now. |
| NFR-F04 / B04 | P2 RESOLVED_SOURCE/FOCUSED_PASS | Pre-change rotation omitted `DeviceInfo`; current AuthService passes stored device identity into successor. §6 NFR-E03 focused test PASS. | Source/focused PASS. UA remains a heuristic, not a security-grade device identity or proven strict concurrent cap. |
| NFR-F05 / FE-01 | P1 RESOLVED_SOURCE/FOCUSED_PASS M2.3/M2.4/I4/I8 | Pre-change approval modal bypassed shared Dialog, lacked trap/inert, reset dirty reason on close and disabled blank rejection. Current consumer reuses shared Dialog, same-layer dirty confirmation, reachable outside-click, explicit focus handoffs and submit-to-validation. §6 NFR-E10–E12: affected aggregate 34/34 + type/lint/build/budgets PASS. | Source/focused PASS. Headed protected mutation remains BLOCKED/NEEDS_EVIDENCE without authorized business item/runtime. |
| NFR-F06 / FE-02 | P1 RESOLVED_ORACLE/FOCUSED_PASS | Pre-change axe helper dropped contrast findings using placeholder color heuristics without a ratio. Current helper retains every serious/critical finding; two negative controls and affected source guards PASS. §6 NFR-E08–E09. | Oracle source/focused PASS. Browser-rendered contrast campaign was not rerun, so no retroactive whole-UI accessibility verdict. |
| NFR-F07 / B05 | P2 RESOLVED_SOURCE/FOCUSED_PASS | Pre-change 429 omitted retry metadata. Current `RateLimitRejectionWriter` writes JSON 429 and rounds native lease `RetryAfter` up to whole seconds; omits the header when metadata is absent. Two focused tests PASS. | Source/focused PASS. Full limiter window/partition/health host behavior remains runtime evidence, not implied by writer unit tests; clients must not auto-retry mutations blindly. |
| NFR-F08 / FE-03 | P2 RESOLVED_SOURCE/FOCUSED_PASS | Pre-change timeout retained only pathname and login always navigated Dashboard. Current source preserves same-app pathname/query/hash, rejects unsafe/login-loop return values, and leaves route/mode/role guards authoritative. Focused RED→GREEN and auth aggregate PASS. | Source/focused PASS. Auto-redirect duration and server session lifetime are unchanged; sensitive form drafts are not persisted. |
| NFR-F09 / B06 | P1-OPS NEEDS_EVIDENCE; comparator CANDIDATE | `scripts/database-recovery/Invoke-DatabaseRecovery.ps1:73-110` so raw CHECKSUM rows và global binlog/GTID; source/target names khác có thể làm comparator false-fail. Có encrypted/provider workflow, không thiếu backup. | Pure synthetic comparator RED trước live drill; cùng table/checksum khác DB name phải so identity đúng; altered checksum/missing metadata fail. Tách restore data integrity với recovery-point/binlog provenance, không xóa provenance checks để xanh. Ops duyệt schedule/retention/RPO/RTO và offsite exact-version restore. |
| NFR-F10 / B07 + FE-04 | P1-OPS TARGET_RESOLVED / NEEDS_EVIDENCE | Program.cs có live/ready, Degraded→200 chủ ý; Serilog đã có. Phase35 performance NOT_CLAIMED; stub/dev Playwright không phải production metric. | D04/D05 now define qualification workload, latency/SLO/alert/health targets. Production-equivalent measurement and alert/outage drills remain NEEDS_EVIDENCE. Ready DB/migration critical fail→503, live→200; Degraded outbox remains 200+alert until a tested critical threshold. |
| NFR-F11 / B08 + parent | P1 PARTIAL/RESOLVED_SOURCE; P2 OPS NEEDS_EVIDENCE | Current source keeps access JWT and user metadata in tab-scoped sessionStorage, removes legacy persistent auth, and leaves refresh credential in HttpOnly cookie. Routine auth logs no longer contain username/full name/User-Agent/device or token/hash prefixes; synthetic marker tests cover username/password/User-Agent non-disclosure. No XSS exploit or legal breach was reproduced. | D07 storage/log-minimization source slice PASS. D02 absolute refresh family, idle, cap3, revoke-all/config remains OPEN; relational race and host log access/rotation/30-day retention remain NEEDS_EVIDENCE. Keep current cookie/direct API; no BFF or business-audit deletion. |
| NFR-F12 / FE-05 | P2 TARGET_RESOLVED / NEEDS_EVIDENCE | Current Playwright source is Chrome-only + reduced motion, so it does not yet certify the full chosen envelope. WCAG 2.2 AA remains adopted. | D06 supports Windows Chrome+Edge current/previous, three desktop viewports, 100/200% zoom, keyboard/pointer, normal/reduced motion and NVDA critical flows. Firefox/Safari/mobile/tablet are not claimed. Browser/runtime matrix remains NEEDS_EVIDENCE. |
| NFR-F13 / FE-06 | P2 RESOLVED_SOURCE/FOCUSED_PASS | `BUSINESS_TIME_ZONE='Asia/Ho_Chi_Minh'` now owns operational instant, display-date and service-calendar formatting; date-only remains lexical and host-timezone independent. Focused tests cover UTC→ICT day/year boundaries, UTC-host display date, leap/date validation and existing quantity precision. | D08 source/focused PASS. Vietnamese-only, shared Intl/VND/quantity policy retained; no i18n framework or per-user timezone. Rendered critical-flow certification belongs to D06 browser evidence. |
| NFR-F14 / primary S6 | P2 PLAN_RESOLVED / PACKAGE_AUTHORITY_PENDING | Backend remains net9.0 with Microsoft package 9.0.16; official research baseline identified 9.0.20 and .NET9 EoS 2026-11-10. | D09 selects coherent 9.0.20 servicing first, then isolated .NET10 LTS transition by 2026-10-15 after exact Pomelo/provider compatibility. Package edit/build/runtime evidence remains OPEN; no CVE or migration claim. |
| NFR-F15 / FE-07 | Existing NEEDS_EVIDENCE, không finding mới | [Phase35 checklist](../phases/35-chu-n-h-a-ui-ux-to-n-b-mounted-frontend-theo-claim-envelope/35-CHECKLIST.md) còn approval-success DEFAULT và all-matched MRX semantic cells. | Ownership giữ ở Phase35; link chứ không duplicate checklist. Không reopen geometry95/95/composition147/147, không seed hoặc sửa all-matched chưa reproduced. |

### Brainstorm chọn lọc — lựa chọn và phương án loại bỏ

- **Auth rotation:** chọn sửa shared owner + atomic database condition sau RED; loại FE-only single-flight/global process lock vì không bảo vệ cross-client/multi-instance. Không tăng isolation toàn hệ thống để chữa một command.
- **Modal:** chọn existing Dialog/close veto, confirmation view cùng modal; loại thêm framework/ModalV2 hoặc chỉ thêm aria-modal (đã có nhưng chưa trap/inert).
- **Axe:** chọn giữ raw finding và evidence-based disposition; loại allowlist màu rộng hơn hoặc hạ threshold để làm test xanh. Gate đúng phải đi trước certification.
- **Reliability/performance:** chọn existing transaction/RTK/native limiter và đo trước; loại retry mọi POST, cache tùy tiện, microservices/Redis/circuit breaker khi chưa có bottleneck/dependency cần thiết.
- **Recovery/observability:** chọn existing provider script/health/Serilog + ops contract; loại backup script mới hoặc stack telemetry mới chỉ vì checklist nhắc tới. Offsite receipt/restore phải thật, không local-copy giả chứng minh.
- **Security/privacy:** ưu tiên revoke/rotation/proxy defects rõ trước auth redesign lớn. MFA, logout-all, BFF, GDPR và multi-region không tự thành yêu cầu chỉ vì NFR.txt liệt kê.

## 6. Execution waves/checklist — W1/W2 + SAFE W3 SLICE ĐÃ THỰC THI

Một writer trong cwd, chạy tuần tự. Có thể duyệt từng wave, không cần duyệt cả campaign. W0 chỉ khóa decisions phụ thuộc wave đầu; decisions về ops không cần chặn fix UI độc lập. Không tự gọi full typed GSD execution từ draft này; khi owner duyệt, reconcile vào GSD active objective và đọc skill `tdd` trước behavior-regression implementation; UI implementation thêm `ui-styling`/DESIGN brief đúng scope.

### W0 — approval, baseline và requirement lock

- [x] NFR-E00 Owner duyệt khuyến nghị W1/W2 và code+test execution qua yêu cầu 2026-09-10; model revalidated `PI_MODEL=gpt-5.6-sol`, branch/HEAD `feature/menu-amendment-reconciliation` / `1d2ae227`, index rỗng, inherited dirt giữ nguyên. Protected DB/migration/mode/seed/mutation browser/commit vẫn chưa được cấp quyền.
- [x] NFR-E01 Owner later confirmed current backend does not use a reverse proxy; D01 resolved as direct-host. Inactive refresh + DeviceInfo + native Retry-After implemented without changing session lifetime. Old-JWT/session-storage redesign remains outside W1/W2; relational race NEEDS_EVIDENCE without disposable DB authority.
- [x] NFR-E02 Target seams/callers frozen: AuthService/RefreshTokenRepository/AuthController; axe helper with 6 production-query consumers + 2 source guards; ApprovalDecisionDialog/ApprovalPage/shared Dialog. Pre-change baseline: AuthService 8/8 PASS, existing dialog 14/14 PASS. New RED: auth 2 failures, frontend 5 failures; exact outputs captured in session.

### W1 — auth/proxy/rate safety (F01–F04/F07, L2)

- [x] NFR-E03 AuthService tests RED→GREEN: inactive/no-successor, inactive between precheck/transaction, active rotation and preserved DeviceInfo. Final focused 11/11 PASS. Public controller/DTO/cookie contract unchanged; uncertain-commit verifier retained.
- [ ] NFR-E04 NEEDS_EVIDENCE/BLOCKED: relational race test không chạy vì chưa có disposable DB authority. Source now rechecks user/token state inside transaction, but ReadCommitted cross-transaction single-use remains unproven; no speculative DB schema/isolation change.
- [x] NFR-E05 Direct-host decision implemented by deletion: removed forwarded-header options and middleware, so current runtime does not trust client-supplied forwarding headers. No speculative proxy profile/config added. Docs require separate trusted-proxy tests if topology changes.
- [x] NFR-E06 Added minimal `RateLimitRejectionWriter` seam and 2 behavior tests: JSON 429, ceil native RetryAfter to seconds, omit header when lease has no delay. No limit changes, dependency additions or protected host startup.
- [x] NFR-E07 PASS_WITH_RESIDUAL: Auth focused 11/11, AuthController 2/2, rate writer 2/2 and isolated API build 0 warnings/errors PASS. CONFIGURATION/ARCHITECTURE/TESTING/DEPLOYMENT updated. Reviewer `22597ef3-d044-43f8-8141-e4b53b89c40c` found 2 UI P1 + plan P2; fixes applied. Follow-up reviewer `8666c2af-fccb-4822-8469-9cc28a6d82d6` confirms P1 resolved/no new defect, verdict OK with plan note corrected. Relational race remains NEEDS_EVIDENCE.

**Success W1:** inactive refresh không issue, replay/race không duplicate successor, device continuity đúng, untrusted forwarding không ảnh hưởng partition, 429 hợp contract. F02 thiếu relational proof ⇒ NEEDS_EVIDENCE, không full auth PASS.

### W2 — a11y oracle trước, rồi approval safety (F06→F05, L1/L2 theo phạm vi)

- [x] NFR-E08 Added `frontend/tests/uiAuditAxe.test.ts`; 2 negative controls RED→GREEN. Shared helper now conservatively retains all serious/critical axe findings instead of color heuristics.
- [x] NFR-E09 Same-pattern scope frozen at 6 production-query consumers + 2 source guards. Shared helper fixed once; no historical receipt rewrite or claim that prior UI currently fails contrast.
- [x] NFR-E10 Dialog behavior RED→GREEN for blank rejection submit, focus trap and dirty discard; existing close/Enter/pending/error tests retained. Final frontend focused aggregate 3 files/18 tests PASS.
- [x] NFR-E11 Approval consumer now reuses shared Dialog focus/inert/portal/scroll owners; dirty discard is a view within the same blocking layer. Design brief recorded in execution commentary; page/route/permission/business transition/geometry unchanged.
- [x] NFR-E12 PASS_WITH_BLOCKERS: affected frontend aggregate 6 files/34 tests, TypeScript, scoped quiet ESLint, production build 2,334 modules and route budgets PASS after reviewer fixes. Two stale source guards now require fail-closed filtering. Full `depcruise` FAIL is inherited/out-of-scope at `src/components/common/CommandBar.actionHierarchy.test.tsx → features/warehouse/pages/WarehousePageHeader.tsx`; no baseline/edit. Headed DEFAULT approval mutation remains BLOCKED without existing authorized item/credential/runtime authority.

**Success W2:** oracle bắt negative control, focus không thoát nền, dirty reason không bị close/reset ngoài ý muốn, validation tới được bằng keyboard. Không dùng component unit PASS thay whole-WCAG AA hoặc protected mutation PASS.

### W3 — session continuity, privacy và localization decisions (F08/F11/F13)

- [x] NFR-E13 Owner instruction “Thực hiện” accepted for the safe, decision-complete slice. First implementation RED 5→GREEN but reviewer `987cea08-4105-4141-a0f4-10e49e5a5005` found logout route overwrite, backslash/login-boundary bypass, and stale login history. Follow-up reviewer then found a normalized dot-segment login alias. Successive RED cases were locked before each fix. Current implementation snapshots the original path before route guard redirect; parses same-origin paths with the native URL parser; safely decodes and case-folds the route boundary; rejects external/protocol-relative/backslash/relative plus normalized, encoded, and case-variant login aliases; returns normalized pathname/search/hash; and restores normal/dev success with `replace:true`. Existing route/mode/role guards remain authoritative. Final focused auth aggregate 4 files/22 tests, TypeScript and scoped ESLint PASS; production build/route budgets PASS. Final read-only follow-up `4dfdac30-2d15-4446-b3ce-22cab519ee06`: no issues, Merge verdict OK. Auto-redirect duration/session lifetime unchanged.
- [x] NFR-E14 D02/D07 source/focused PASS_WITH_RESIDUAL: user metadata is tab-scoped sessionStorage with legacy cleanup; routine auth logs omit username/User-Agent/device/token/hash prefixes; access default 30m; refresh family default 24h absolute/non-sliding; validated cap target defaults 3; idle guard uses configurable 60m + 2m defaults with matching accessible copy and shared logout-once; Admin employee Update/UpdateStatus revoke all applicable sessions with multi-token controls. Login, refresh and deactivate now acquire the same MySQL user-row lock before session mutation. Focused frontend auth/policy 7 files/45 tests and backend auth/admin/config/repository 25 tests PASS after follow-up additions. Idle config rejects invalid/non-positive and browser-timer-overflow values. Final D02 follow-up `d3973327-4123-4da0-be59-a5ef1bcd31aa` found no issues, Merge verdict OK. Old access JWT residual ≤30m accepted; concurrent login-cap, deactivate interleavings, simultaneous refresh and host retention remain NEEDS_EVIDENCE pending disposable MySQL. No audit/history deletion.
- [x] NFR-E15 D08 approved and source-focused PASS: canonical `BUSINESS_TIME_ZONE='Asia/Ho_Chi_Minh'` owns instant and Vietnam calendar formatting; boundary tests cover UTC→ICT day/year transitions, date-only/leap/quantity existing behavior. No i18n framework or per-user timezone.

**Current W3 verdict:** reauth continuity, D08 timezone and D02/D07 source-focused implementation PASS_WITH_RESIDUAL. Relational simultaneous refresh, protected runtime behavior and operational privacy retention remain NEEDS_EVIDENCE; existing access JWTs retain a documented ≤30m residual window. No schema/data migration.

### W4 — measurement/capacity/availability/browser envelope (F10/F12)

- [ ] NFR-E16 D04/D05/D06 approved→freeze routes/actions, both modes, actors, desktop/device/network/dataset volume, cold/warm, sample count/window, read/write mix, duration/headroom. Chỉ dùng lane và record được cấp quyền, không populate protected DB để load test.
- [ ] NFR-E17 PARTIAL source probe PASS/full qualification OPEN: audited existing k6/browser/route-budget owners; added explicitly named `read-only-throughput-probe.js` for 10 RPS/15m + 30 RPS/60s GET diagnostics, zero dropped iterations and run-unique output. It uses one identity and does not claim 50 authenticated users, 20 active workers, 80/20 writes, import, p99 class budgets or business invariants. Full D04 workload remains OPEN pending disposable data/identities/actions; no measurement run. Final read-only follow-up `76c063e8-9c39-4d87-afda-eeff1a5e61c6` found no issue, Merge verdict OK.
- [ ] NFR-E18 Measure field/lab namespaces riêng: CWV p75 LCP≤2.5s/INP≤200ms/CLS≤0.1 theo F1; actual API p95/p99/error rate/throughput/memory theo D04. EventTiming/CLS algorithm/observer support và denominator rõ, click-to-stable không phải INP. Không đủ mẫu/observer ⇒ NEEDS_EVIDENCE.
- [ ] NFR-E19 PARTIAL source PASS/runtime NEEDS_EVIDENCE: health response writer and endpoint-options owner extracted; tests lock live/ready tag partitions, machine-readable Healthy/Degraded/Unhealthy and ready 200/200/503 mapping. Authorized DB-unavailable/migration/outbox and real alert-delivery drills remain open. No monitoring platform installed.
- [ ] NFR-E20 PARTIAL source harness PASS/runtime NEEDS_EVIDENCE: D06 policy freezes 672 cells across Windows10/11, Chrome/Edge, current/previous, three desktop viewports, normal/reduced motion, 100/200% and seven critical workflows; NVDA is a separate Chrome-current subset. Dedicated Playwright preflight has no webServer/versioned device descriptor and requires operator-supplied URL/source ref/run ID/OS/version band; native UA is checked, but runtime/build alignment remains independently verified; source tests 14/14 PASS before denominator correction. Root-font 200% is explicitly a text-reflow proxy. Current/previous browser receipts, real browser zoom, keyboard/focus, NVDA and workflow evidence remain open; no mobile/tablet or whole Phase35 rerun. Final follow-up `1f194ca4-2b3c-451d-aefd-f32d2d41f49a` found no issues, Merge verdict OK.

**Success W4:** per-population budgets có data/evidence; không 1 PASS chung cho performance/availability/a11y. API budget chưa duyệt chặn certification, không được lấy CWV làm API SLO.

### W5 — recovery và supported deployment (F09/F14 + F10 ops)

- [x] NFR-E21 pure comparator source PASS: extracted non-destructive `RestoreOracle.ps1`; CHECKSUM TABLE rows normalize to checksum value independent of source/target DB name; data equality excludes GTID/binlog while expected-manifest provenance remains mandatory. Synthetic PowerShell controls pass same data/different names and reject malformed checksum/missing provenance. No destructive script dot-source or database action.
- [ ] NFR-E22 Backup/restore drill authority riêng: encrypted exact-version offsite object→new run-owned target→schema/FK/row/business oracle→measured recovery point/RPO and elapsed RTO→teardown đúng ownership. Không restore đè current lane; không bỏ GTID/binlog checks nếu chưa thay bằng provenance oracle đúng nghĩa.
- [x] NFR-E23 D09 servicing PASS_WITH_RESIDUAL: owner authorized package change; minimum SDK 9.0.313 in the 9.0.3xx latestPatch band (local run observed 9.0.313); ASP.NET/EF production+test family and CI dotnet-ef moved 9.0.16→9.0.20; direct IdentityModel JWT moved 8.12.1→8.19.2 because JwtBearer 9.0.20 requires it; Pomelo/unrelated packages/target framework unchanged. Restore, isolated build 0/0, focused 49/49, no pending model changes and vulnerable scan PASS. Broad 1,226-test attempt has 15 inherited fixture/lineage failures; generated OpenAPI differs from inherited dirty contract files, restored exactly, so full suite/API parity remain NEEDS_RECONCILIATION. No migration/data/runtime action. D09 focused servicing is PASS_WITH_RESIDUAL but merge remains BLOCKED: mandatory backend CI and OpenAPI parity are not green/reconciled on the inherited dirty worktree; no gate was weakened.
- [ ] NFR-E24 Deployment promotion/rollback gate: aligned build, readiness, schema compatibility, auth/read-only business smoke; có procedure/config/secret-key recovery theo D05. Không claim zero-downtime khi chưa đo. Update DEPLOYMENT/CONFIGURATION/recovery README/TESTING đúng owner.

### W6 — closeout (mọi wave được duyệt)

- [ ] NFR-E25 Per-finding RED→GREEN + same-pattern disposition + focused suite; build/lint/parity/security/a11y/browser/relational gates đúng diff. Independent review auth/public-contract changes; reviewer không thay oracle.
- [ ] NFR-E26 Reconcile PASS/FAIL/NEEDS_EVIDENCE/BLOCKED per claim; F15 chỉ link Phase35 khi event/authority sẵn có, không tự resume. Record immutable evidence/index, owned processes+teardown, scoped diff; không stage/commit/push nếu chưa duyệt riêng.

## 7. Commands và failure signals

Các command W1/W2 đã chạy được ghi ở §6/§9; bảng này giữ command contract cho rerun và các seam chưa có harness. Việc ghi command không tự tạo PASS; chỉ output thực tế được checkpoint mới là evidence.

| Scope | Planned command từ repo root | Fail / thiếu evidence khi |
|---|---|---|
| Existing auth seam W1 | `dotnet test backend/tests/IPCManagement.Api.Tests/IPCManagement.Api.Tests.csproj --filter FullyQualifiedName~AuthServiceTests` | Exit khác0, có failing test, hoặc expected named regression không được discover/run; baseline cũ green không chứng minh case mới |
| Existing validator seam W1 | `dotnet test backend/tests/IPCManagement.Api.Tests/IPCManagement.Api.Tests.csproj --filter FullyQualifiedName~DeploymentConfigurationValidatorTests` | Exit khác0, 0 test hoặc thiếu direct/proxy/invalid-trust cases |
| Existing dialog seam W2 | `npm run test:unit -w frontend -- src/features/approvals/pages/ApprovalDecisionDialog.test.tsx src/components/ui/dialog.contract.test.tsx` | Exit khác0, 0 test, hoặc chưa có dirty/focus/validation negative control cần thiết |
| Existing reauth/date seams W3 | `npm run test:unit -w frontend -- src/features/auth/components/SessionTimeoutModal.test.tsx src/lib/formatters.test.ts` | Exit khác0 hoặc không exercise login return roundtrip/timezone policy; phải thêm mounted LoginPage case trước close |
| Architecture after affected code | `npm run depcruise -w frontend` | Exit khác0/new violation; không chạy depcruise:baseline để giấu finding |
| Route budgets after production build | `npm run check:route-budgets -w frontend` | Exit khác0/missing build output/route over budget; không thay thresholds để pass |
| Relational race / proxy-host / browser contrast fixture / restore pure comparator | Chưa có complete runnable command; create/validate harness trong wave được duyệt, ghi exact selection vào cùng checklist trước production fix | Harness chưa có ⇒ NEEDS_EVIDENCE, không được dùng mock success, shell echo hay source-string guard thay oracle |

Các script browser lịch sử có ports/output fixed phải được audit và cấp immutable run-output trước dùng, không copy invocation để ghi đè evidence. Không hardcode production lane/credential trong command hoặc report.

## 8. Decision register — đề xuất, chưa áp đặt

| ID / owner | Cần chốt | Đề xuất có chọn lọc / phần bị chặn |
|---|---|---|
| D01 Kỳ + ops | **RESOLVED 2026-09-10:** current backend has no reverse proxy | Direct-host selected: runtime does not enable forwarded headers. Future proxy deployment must reopen this decision and add exact trusted hops + integration tests before enabling. |
| D02 **RESOLVED by owner delegation 2026-09-10** | Session/token/storage/revocation policy | Keep direct browser→API; no BFF/cookie access-token/denylist/MFA now. Access JWT remains tab-scoped `sessionStorage`, 30m; refresh cookie remains HttpOnly/Secure outside Development/SameSite=Lax with 24h absolute non-sliding family; idle 60m + 2m warning; max 3 active refresh sessions configurable; logout current and admin/deactivation revoke-all. Old access JWT residual ≤30m accepted. Runtime values require validated configuration and behavior tests; relational simultaneous refresh still NEEDS_EVIDENCE. |
| D03 Kỳ | **RESOLVED by owner instruction + minimal safety default:** reauth continuity | Same-app pathname/query/hash restored after login; unsafe/login-loop values fall back Dashboard and existing role/mode guards arbitrate. Sensitive drafts are not persisted; timeout duration unchanged. |
| D04 **RESOLVED target, evidence pending 2026-09-10** | Capacity/performance qualification | Single API+MySQL target: 50 authenticated users, 20 active workers, 10 RPS/15m sustained, 30 RPS/60s burst, 80/20 read/write. p95/p99: reads 0.8/1.5s, writes 1.5/3s, reports 3/5s, import preview 30/45s; <1% 5xx/timeouts and zero business-integrity violations. CWV stays separate. These are selected qualification targets, not measured production claims. |
| D05 **RESOLVED target, evidence pending 2026-09-10** | Service/recovery policy | Service window 05:00–22:00 `Asia/Ho_Chi_Minh`; internal monthly SLO 99.5% eligible successful requests, no implied customer SLA. Encrypted backup ≤4h, retention 14d, RPO≤4h, RTO≤30m, quarterly restore rehearsal. Primary alert ack≤5m, backup escalation≤10m. live200 while process responds; ready503 for DB/migration/config critical failure; Degraded outbox initially remains 200+alert. Runtime/provider certification remains NEEDS_EVIDENCE. |
| D06 **RESOLVED target, evidence pending 2026-09-10** | Browser/accessibility envelope | Windows 10/11; Chrome and Edge current+previous stable; viewports 1366×768, 1440×900, 1920×1080; 100% and critical-flow 200% zoom; keyboard+pointer; normal+reduced motion; NVDA current with Chrome current for critical workflows; WCAG 2.2 AA. Firefox/Safari/mobile/tablet are not claimed. Missing browser/runtime cells remain NEEDS_EVIDENCE. |
| D07 **RESOLVED baseline 2026-09-10** | Privacy/log/audit policy | Diagnostic/security logs: 30d target, operator-only; never log secrets/tokens/passwords/hash prefixes/request bodies or routine username/full-name/User-Agent. Opaque user ID allowed when needed; remote IP only for security events; correlation ID retained. Business audit/stock/approval history stays append-only until separate legal/domain retention authority. Browser user metadata moves from localStorage to sessionStorage; synthetic evidence only. Host retention/access proof remains NEEDS_EVIDENCE. |
| D08 **RESOLVED 2026-09-10** | Vietnam localization/time semantics | Canonical business zone `Asia/Ho_Chi_Minh`; backend instants UTC, rendered operational instants in business zone; date-only/service-date values remain lexical calendar dates and never shift through UTC. Vietnamese-only, centralized Intl VND/quantity precision, no i18n framework or per-user timezone. |
| D09 **RESOLVED plan, package authority pending 2026-09-10** | .NET support path | First patch the coherent .NET/ASP.NET/EF 9 line to 9.0.20 without unrelated upgrades or schema changes; then isolate .NET 10 LTS transition by 2026-10-15 after exact Pomelo/provider compatibility and rollback checks. Package edits remain separately authorized; no DB migration/mutation in servicing work. |

W1/W2 đã được duyệt và triển khai; D01–D09 now have owner-delegated decisions/targets. D02 implementation plus D04–D06/D09 runtime, browser, package, provider and recovery evidence remain open under their separate safety authorities; no credentials are needed in chat.

## 9. Research closeout / exact next step

- Research done: local selected-skill review + 6 official sources + 2 independent read-only inventories + parent fact-check; 24 nhóm đều có disposition, 15 ledger entries gồm source gaps/candidates/decisions/residual, không phải 15 runtime bugs.
- W1/W2 đã chạy focused backend/frontend tests, TypeScript, scoped ESLint, isolated backend build, production frontend build và route budgets. Không chạy browser/load/security scanner, DB access/mutation, migration/mode switch. Product-wide NFR compliance vẫn **NEEDS_EVIDENCE**, không PASS.
- Task-owned files: plan này; `.artifacts/nfr-research/20260910/{PRIMARY-SOURCES,BACKEND-SOURCE-CONTEXT,FRONTEND-SOURCE-CONTEXT}.md`; một pointer section mới trong MEMORY. Inherited FE/BE/governance dirt giữ nguyên.
- Research workflow and three focused review passes completed; no child remains active. Final direct-host/rate reviewer `960bb7e2-56d5-400a-bbb8-89f352b2d2cc` found no implementation defect and returned OK with one stale-plan note, now corrected. No FE/BE/Chrome/DB listener was created. Full research outputs preserved locally after notification omitted saved-output metadata; no fallback runtime.
- Verification limits: draft/research files được lưu local trong ignored planning/artifact trees, nên scoped Git diff không tự bao phủ chúng; đã kiểm nội dung/link/whitespace trực tiếp bằng Python. MEMORY có inherited diff; task chỉ thêm pointer section, không claim toàn MEMORY diff là task-owned. Git cảnh báo LF→CRLF, không whitespace error; index vẫn rỗng, HEAD vẫn `1d2ae227`.
- Exact next step: W1/W2 plus safe W3 reauth slice implemented. Relational race is infrastructure-BLOCKED until `IPC_TEST_CONNECTION_STRING` points to a disposable MySQL database; MySQL listener alone is insufficient and CLI is unavailable. Protected approval browser evidence remains BLOCKED without aligned runtime/credentials/natural business item. Auth storage/lifetime, timezone and W4/W5 operational targets remain decision-gated. Session mới đọc AGENTS→MEMORY→plan này, đối chiếu HEAD/status và source findings trước hành động.
