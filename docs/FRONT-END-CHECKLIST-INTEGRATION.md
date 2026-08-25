---
title: Front-End Checklist integration for IPCManagement
status: adopted-quality-adapter
scope: frontend-review-and-ui-ux-change-discipline
owner: GSD
upstream: https://github.com/thedaviddias/Front-End-Checklist
reviewed_revision: 30756a79b2f7d4363ac592710146c8e28fa9f1b5
reviewed_at: 2026-08-26
---

# Front-End Checklist integration

IPCManagement installs the upstream `frontend-checklist-global` skill as a project-local quality adapter:

- `.agents/skills/frontend-checklist-global/` — agent-neutral project installation;
- `.pi/skills/frontend-checklist-global/` — Pi project installation.

The inspected upstream revision contains 385 English rules across HTML, CSS, JavaScript, performance,
accessibility, SEO, security, images, testing, privacy and internationalization. The upstream project also
provides a hosted MCP server and a monorepo-local CLI; its CLI package is currently private and designed for
that monorepo, so IPCManagement does **not** add it as a runtime npm dependency or vendor the upstream app.
The reusable skill is the supported project integration surface.

## Authority and precedence

Front-End Checklist is a review and retrieval corpus, not a second IPCManagement design system.
Apply authorities in this order:

1. Data safety, permission, operation-mode and domain contracts.
2. [`DASHBOARD-UI-RULES.md`](DASHBOARD-UI-RULES.md), the normative IPCManagement UI contract.
3. [`UI-PHILOSOPHY.md`](UI-PHILOSOPHY.md), project-specific product and interaction interpretation.
4. [`UI-UX-EXECUTION-HARNESS.md`](UI-UX-EXECUTION-HARNESS.md), evidence and execution process.
5. Front-End Checklist rules as an external quality adapter for coverage, explanations and remediation ideas.

An upstream recommendation MUST NOT silently override an IPCManagement rule. Record the conflict and apply
the project precedence above. Examples of contextual rules rather than automatic requirements include PWA,
dark mode, print styles, public-site SEO, CDN, service workers and mobile-only behavior.

## Required workflow for UI/UX changes

For every frontend implementation, UI review or UX remediation:

1. Classify the work object: route/component, actor/permission, operation mode, state, data grain and mutation
   boundary.
2. Identify applicable IPCManagement rule IDs first. Use `frontend-checklist-global` to broaden coverage for
   HTML semantics, accessibility, performance, security, images, testing and i18n.
3. Report only findings supported by source, semantic DOM, request/state evidence or runtime measurement.
   Prefer fewer high-confidence findings over speculative checklist dumping.
4. Map each external finding to the lowest owner: token → primitive → shared formatter/hook/query/action →
   feature layout. Do not create parallel components or local CSS patches when the defect is shared.
5. Use verdicts `PASS`, `GAP`/`FAIL`, `NOT_APPLICABLE`, `NEEDS_EVIDENCE` or `UNRESOLVED`. A checklist item is
   not PASS merely because no automated detector reported it.
6. Critical/high accessibility, security, form semantics, focus, layout stability and runtime performance
   findings block completion when applicable. Medium/low recommendations require project-context evaluation;
   they are not automatic scope expansion.
7. Add a regression at the owning seam, then run focused tests and the existing lint/build/UI gates. Browser
   claims require headed Chrome evidence under the project harness; screenshots remain reviewer artifacts.

## IPCManagement interpretation of major categories

| Upstream category | Apply directly to | Contextual or generally N/A without evidence |
| --- | --- | --- |
| HTML | semantic structure, forms, labels, document language, viewport, unique IDs | PWA/`noscript` requirements unless product scope adopts them |
| CSS | focus indicators, overflow, responsive units, token use, reduced motion, animation cost | mandatory dark mode, print stylesheet, experimental CSS features |
| JavaScript | type safety, errors, cleanup, code splitting, DOM/main-thread cost | introducing a new runtime-validation library without a planned need |
| Performance | CLS, INP/long tasks, loading feedback, bundle/DOM cost, virtualization | CDN/HTTP deployment decisions owned by deployment architecture |
| Accessibility | keyboard, names, focus order/return, dialogs, tables, contrast, touch targets | none when the rule applies; verify through semantic/runtime evidence |
| Security/privacy | unsafe execution/rendering, external links, secrets, consent/data minimization | public marketing-cookie patterns when the internal app does not use them |
| SEO | document title and meaningful metadata where relevant | public discovery, social cards, sitemap and rich-result rules for authenticated routes |
| Images | alt semantics, stable dimensions, responsive assets, lazy loading | forcing content semantics onto decorative assets |
| Testing | semantic queries, interaction/accessibility/browser coverage | replacing project business/E2E evidence with generic audits |
| i18n | Vietnamese language metadata, formatter/vocabulary consistency, expandable layout | enabling RTL/locales not in product scope without a requirement |

## Conservative review rules inherited from upstream

- Do not flag `alt=""` when an image is demonstrably decorative.
- Do not treat a React component as a complete HTML document.
- Do not demand traditional `method`/`action` when a form has explicit client submit handling.
- For simple tables, prioritize real header associations before speculative caption findings.
- Do not infer missing metadata when a framework-level metadata owner exists.
- Do not convert low-confidence preference changes into defects.

## Validation and updates

Run:

```bash
npm run check:frontend-checklist
```

When updating the upstream skill, inspect the new revision and rule-count/category changes before replacing
both project copies. Update `reviewed_revision`, re-evaluate conflicts and rerun the checker. Do not install all
hundreds of rule-specific skills by default; the global skill is the bounded entry point and retrieves focused
guidance only when needed.
