# Session and Template Cleanup Implementation Plan

> **For agentic workers:** Use superpowers:executing-plans inline. No delegation or commits authorized.

**Goal:** Deliver approved idle/logout, durable reauthentication and readable, scoped templates.
**Architecture:** AuthProvider owns session; a small real-consumer idle hook owns activity timing; AppShell/LoginPage display feedback. Existing download owner reads safe server names only when no explicit name is supplied. Existing backend template services/builders own names and layout.
**Tech Stack:** React, TypeScript, Vitest, .NET, xUnit, OpenXML ZIP/XML (no new dependencies).
**Spec:** ../specs/2026-11-10-session-template-cleanup-design.md

## Global Constraints
- 60-minute default idle limit; warning 2 minutes before. Background network activity does not reset it.
- Preserve MRX/DEFAULT, permissions, parser coordinates and hidden metadata; do not mutate business data.
- Preserve inherited work. Do not commit/push/install/deploy. State only in WORK.md.

## Review Focus
- Sleep/background tab waking after deadline must expire before accepting new activity (task 1).
- Failed revoke cannot leave local authentication active; fresh user/role/mode must survive remount (task 1).
- Malformed/path-bearing Content-Disposition must not control download paths (task 2).
- Optional-week filename matches actual normalized workbook week; customer scopes cannot share names (task 2).
- Long Vietnamese names/notes remain readable without changing imported values, styles/protection or tier identity (task 3).

## Task 1 — Session continuity
Files: authContext.tsx, useAuth.ts, SessionExpiredModal.tsx, AppShell.tsx, LoginPage.tsx; new hooks/useIdleSession.ts; existing Auth.test.tsx.
Extend expiry owner test through login and remount: new token/user persisted, latest name shown, same draft element retained. Add fake-time idle cases: warning at58, activity resets,60 expires despite pending revoke; elapsed sleep rejected. Run from frontend: node ../node_modules/vitest/vitest.mjs run src/__tests__/Auth.test.tsx (RED). Implement full-response identity-bound restore with authoritative mode; idle hook and nonblocking warning/login notice. Repeat focused checks (GREEN).

## Task 2 — Scoped template names
Files: fileDownload.ts; WeeklyMenuImportModal.tsx; DishBomBatchImportModal.tsx; BE IDishBomTemplateService/DishBomTemplateService/DishBomImportsController and WeeklyMenu template query controller; existing FileDownload, WeeklyMenu, DishCatalog/controller tests.
Extend boundary tests for server UTF-8 name and safe fallback; assert approved customer/week/tier names at backend file boundary. Run RED; migrate actual callers, preserve explicit report filename behavior; run GREEN. Use shared filename-segment sanitizer only for actual two template owners, not a general export framework.

## Task 3 — Workbook readability
Files: BomTemplateWorkbookBuilder.cs, WeeklyMenuTemplateWorkbookBuilder.cs, existing DishBomImportServiceTests/WeeklyMenuImportParserTests.
Extend existing builder tests for long text row sizing/wrap and main/instruction print ranges; weekly equal day widths/expandable input rows/readable zoom/landscape fit width. Run focused RED, edit existing XML owners without replacing parser schema, then GREEN including populated import roundtrip.

## Verification
Run full FE unit suite, lint/build; compile and run BE template/auth owner selection and MRX/Reconciliation lane; git diff --check. Report real failures and live-browser/Excel limitations. Update WORK.md to IDLE with evidence and no production-readiness overclaim.
