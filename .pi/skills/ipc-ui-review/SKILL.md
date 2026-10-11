---
name: ipc-ui-review
description: Review IPCManagement UI and accessibility against current design contracts and actual rendered behavior. Use for interaction, keyboard/focus, state feedback, layout or token-consistency review.
---

# UI and accessibility review

Advisory capability under [AGENTS](../../../AGENTS.md); [WORK](../../../.planning/WORK.md) remains the only task-state owner. This skill grants no execution or delegation authority.

Read the applicable sections of [DESIGN](../../../docs/DESIGN.md), actual shared primitives and the bounded feature contract. Use [ENGINEERING](../../../docs/ENGINEERING.md) for browser/measurement conventions. Historical specimens, external style catalogs and generated design systems do not define product policy.

## Bound the review

Identify the work object, actor/permissions, mode, data grain, route/scope and states affected by the request. Select relevant viewports and exits rather than running an unrelated whole-product checklist. Source-only review cannot certify rendered behavior.

For an authorized browser check, use a separate headed Chrome instance with confirmed URL/build/mode/actor and credential source. Do not reuse user tabs/profiles or mutate records merely to produce a screenshot.

## Check the actual interface

- **Meaning and access:** Semantic labels, headings, tables and control roles match real actions. Keyboard operation, visible unobscured focus, logical order, drag alternatives and non-color-only cues work. Modal focus/inert/scroll cleanup is verified for applicable close, cancel, confirm, Escape and navigation paths.
- **State and recovery:** Loading, refresh, empty, denial, error, prerequisite, conflict and readonly states remain distinct. Pending guards prevent duplicate writes; feedback gives an allowed next action. Check previous-key data leakage and draft loss against the bounded owner, not generic cache advice.
- **Composition:** Heading, scope, explanatory state and primary work surface have coherent reading order. Check clipping, natural Vietnamese text growth, zoom and horizontal-table behavior; do not force dense matrices into a generic no-scroll rule.
- **Consistency:** Inspect current primitive variants and computed token usage. Reuse the actual token/formatter/interaction owners; do not prescribe a new palette, typography dictionary, component family or persisted design MASTER file.
- **Motion and performance:** Required meaning remains available without animation and reduced motion is respected. Performance claims require comparable measurements, not appearance, screenshots or a source-code heuristic.

Use current DESIGN thresholds and exceptions; do not substitute universal target sizes or external branding. Preserve unresolved density, typography, decision-pair and nested-confirmation applicability decisions. If source/contract applicability conflicts, surface the decision rather than choosing policy.

## Findings and limits

For each finding give the rule/contract, source or DOM evidence, affected actor/state/viewport, reproduction and smallest root-owner remedy. Screenshots support triage, not persistence/performance certification. Persisted outcomes need the authorized control → request → transition → reload chain.

Report PASS/FAIL/NEEDS_EVIDENCE/BLOCKED only for the reviewed scope. Fixes, accessibility tests and browser/data operations still require their applicable authorization; use test-audit before changing tests. Do not install audit services, transmit private code/pages or create new acceptance/state owners.
