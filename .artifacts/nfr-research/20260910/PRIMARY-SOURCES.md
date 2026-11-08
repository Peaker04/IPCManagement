# NFR — selective primary-source research

Research-only, retrieved 2026-09-10 UTC. No application/runtime/database verification was performed.
User input: `C:/Users/Administrator/Pictures/NFR.txt` (24 NFR groups).
Repository: `feature/menu-amendment-reconciliation`, HEAD `1d2ae2278d8503fb25c995c7e112fe3439227157`; working tree contains extensive inherited edits; index empty at entry.

## Method and installed skills

- `research`: installed `.codex/skills/research/SKILL.md`; `skills-lock.json` identifies `mattpocock/skills`. Primary source first; bounded background source inventories, no implementation.
- `karpathy-guidelines`: `.codex/skills/karpathy-guidelines/SKILL.md`, provenance `multica-ai/andrej-karpathy-skills`; separate facts, assumptions and owner decisions, smallest safe scope.
- `diagnosing-bugs`: `.codex/skills/diagnosing-bugs/SKILL.md`, `mattpocock/skills`; plan red-capable reproduction before diagnosing/fixing candidates. No runtime diagnosis completion claimed in a planning-only task.
- `frontend-checklist-global`: `.pi/skills/frontend-checklist-global/SKILL.md`, `thedaviddias/Front-End-Checklist`; conservative source-supported findings under project UI authority. Checklist MCP tools are not present in this session; no claim to have run `review_code`, `audit_url` or the complete 385-rule corpus.
- Ponytail already active: reuse native ASP.NET Core/EF/RTK Query/installed UI primitives; no speculative infrastructure. GSD owns the draft checklist; Pi subagents supply read-only evidence, not another task system.
- Not selected: UI styling (no JSX implementation), Template Studio discipline (no range/template design), GitNexus (not authorized), broad SEO/landing-page design, full-repo complexity audit, installers/skill updates.

## Retrieved sources and decision implications

All six URLs below returned HTTP 200 without redirection on 2026-09-10, approximately 03:24 UTC. Fetch used Python standard-library HTTPS, no auth/cookies, no project data sent. Relevant text was inspected; this is selective research, not a full standards audit. Temporary extracted text is at `D:/Temp/ipc-nfr-primary-dkrr65pe/`; this summary and URLs are the durable reference, not the temp directory.

### S1 — WCAG 2.2

https://www.w3.org/TR/WCAG22/

- AA includes Focus Not Obscured (Minimum) 2.4.11, Target Size (Minimum) 2.5.8 and Accessible Authentication (Minimum) 3.3.8.
- Target-size baseline is 24×24 CSS px, with explicit exceptions including spacing. Do not mislabel the stricter 44px enhanced criterion as universal AA.
- 1.4.4 covers text resize to 200% without lost content/functionality; 1.4.10 covers reflow at equivalent 320 CSS px width, with exceptions for content requiring two-dimensional layout.
- Local source reconciliation: `docs/DASHBOARD-UI-RULES.md:429-445` already adopts WCAG 2.2 AA. Preserve that contract; owner decisions concern evidence/support envelope, not whether to adopt AA again. Axe is only an automated subset; add keyboard, focus, screen-reader and zoom checks. Existing desktop viewport PASS is not whole-WCAG conformance. Desktop zoom/reflow is not automatically a new mobile-product support commitment; any added test matrix still requires approval.

### S2 — Google Web Vitals

https://web.dev/articles/vitals

- Good targets: LCP ≤2.5s, INP ≤200ms, CLS ≤0.1, evaluated at the 75th percentile and segmented by device category.
- Core Web Vitals are primarily field metrics; lab measurement is useful for pre-release regressions but does not replace field evidence.
- Local source reconciliation: `docs/DASHBOARD-UI-RULES.md:338` already requires these thresholds at p75. Preserve them; add sampling window, route/device/network population and metric collection definition. API p95/p99 are separate metrics. A dev navigation timing, long-task count or one screenshot cannot certify production INP or field CWV.
- No new analytics dependency is approved. First evaluate existing probes; add minimal privacy-safe collection only if needed and approved.

### S3 — OWASP Session Management Cheat Sheet

https://cheatsheetseries.owasp.org/cheatsheets/Session_Management_Cheat_Sheet.html

- Session timeout must be enforced server-side; client-side timers are only complementary UX.
- Idle and absolute session lifetimes are distinct. Values must balance business usage and risk; the cited ranges are examples, not universal requirements for IPCManagement.
- Simultaneous logons are an explicit application-design decision. Logout/session expiry require server-side invalidation; responses containing session identifiers should use `Cache-Control: no-store`.
- Current page explicitly advises against auth/JWT/refresh-token storage in localStorage or sessionStorage because same-origin JavaScript can read it; recommends HttpOnly/Secure/SameSite cookies or BFF.
- Implication: inspect the current complete auth chain and classify any browser-readable credential storage as exposure under XSS, not proof that an XSS exploit exists. Compare minimal cookie-based refresh + in-memory access against existing-token hardening; do not silently change auth transport. Cookie changes require CSRF/origin/CORS/proxy/logout testing and a migration decision, not a storage-only patch.

### S4 — ASP.NET Core health checks (version-specific)

https://learn.microsoft.com/en-us/aspnet/core/host-and-deploy/health-checks?view=aspnetcore-9.0

- Liveness answers whether the process is alive; readiness answers whether it should receive traffic. Dependency startup/failure need not require restarting a live process.
- Native health-check tags/predicates support separate endpoints.
- Implication: first verify existing endpoint predicates and consumer behavior. Do not propose adding health middleware if already present; decide whether a given `Degraded` dependency makes readiness 200 or 503 from the actual operation-mode contract. No orchestrator/Kubernetes requirement follows merely from the docs.

### S5 — ASP.NET Core rate limiting (version-specific)

https://learn.microsoft.com/en-us/aspnet/core/performance/rate-limit?view=aspnetcore-9.0

- Native middleware supports partitioned policies (user/IP/API key etc.). Policies require load testing and review before deployment.
- `OnRejected` can communicate retry information; lease metadata may expose `RetryAfter`. Do not invent a precise recovery interval when the limiter cannot provide it.
- Middleware rate limiting is not comprehensive DDoS protection.
- Implication: inspect current registration, partition identity, middleware order and trusted-proxy behavior. Verify 429/error envelope/Retry-After and legitimate-user fairness under the approved traffic profile; do not choose limits or add Redis/WAF automatically.

### S6 — Microsoft .NET support policy

https://dotnet.microsoft.com/en-us/platform/support/policy/dotnet-core

Page marked updated 2026-09-08; retrieved table:

| Release | Listed latest patch | Support phase | End of support |
|---|---|---|---|
| .NET 9 | 9.0.20 | Maintenance (STS) | 2026-11-10 |
| .NET 10 | 10.0.12 | Active (LTS) | 2028-11-14 |

- Source `backend/src/IPCManagement.Api/IPCManagement.Api.csproj:4,11-12,17-23` targets `net9.0` and pins several Microsoft packages at `9.0.16`.
- This is a support/patch-planning signal, NOT proof of a specific CVE or the installed production runtime version. .NET 9 is still supported on the research date; do not repeat an obsolete end-of-support assumption.
- Plan a compatibility-reviewed patch assessment and an LTS decision before the published deadline, including Pomelo/EF compatibility, migration SQL diff, CI/runtime images and rollback. No dependency update, SDK install or migration is authorized by this research.

## Local synthesis and arbitration

Read-only scout reports retained as source inventories, not application verification:
- [Backend source context](BACKEND-SOURCE-CONTEXT.md): B01–B08.
- [Frontend source context](FRONTEND-SOURCE-CONTEXT.md): FE-01–FE-07.

Parent re-read AuthService, RefreshTokenRepository, AuthController cookie helpers, refresh persistence mapping, transaction runner, admin account status mutation, Program proxy/limiter/health pipeline, deployment validator, ApprovalDecisionDialog + parent close/submit, shared Dialog, uiAuditAxe + Warehouse consumer, SessionTimeoutModal + LoginPage, authStorage, formatters and recovery comparator. Concrete disposition and planned acceptance live only in the [GSD draft](../../../.planning/notes/nfr-research-and-remediation-PLAN.md).

Important corrections/limits:
- Refresh token already uses HttpOnly cookie and hash-at-rest; do not propose implementing that from scratch. Parent additionally confirmed access token is persisted in sessionStorage (`frontend/src/lib/auth/authStorage.ts:67-85`); that is browser-JavaScript exposure under XSS, not proof of an XSS exploit. Any transport change requires an approved bootstrap/reload/CSRF contract because current refresh also consumes an access token.
- Atomic refresh race remains a candidate requiring a two-connection relational RED; re-reading under ReadCommitted and a stable uncertain-commit verifier do not themselves prove single-use consumption.
- Proxy source explicitly clears trust lists and only warns when empty. Production network exposure is unknown; do not label exploitation reproduced.
- Contrast filter can suppress raw serious findings without a computed contrast ratio. This invalidates the sufficiency of that filter, not every historical UI PASS.
- Recovery comparator reads raw CHECKSUM rows and compares global binlog/GTID metadata. Treat cross-database/host portability as candidate; no database was queried or restored.
- Geometry 95/95 and composition 147/147 are inherited Phase35 claims, not newly rerun in this task. Only the existing semantic residuals remain linked; performance stays NOT_CLAIMED for Phase35.

Workflow completed with two children. Notification omitted saved-output references, but full outputs were recovered from workflow status and copied here. A parent extraction command initially failed on Windows stdout encoding (`UnicodeEncodeError`); the corrected extraction succeeded. This was report plumbing, not test failure or child infrastructure failure. No child rerun or external execution fallback occurred.

## Evidence limitations

Local source proves implementation paths, not deployed configuration or runtime behavior. Operational SLO/SLA, concurrency/RPS, volume, data retention, legal applicability, RPO/RTO and restore success need owner/ops evidence. This report does not declare the application secure, accessible, fast, highly available or fully NFR-compliant.
