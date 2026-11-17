# MRX completion inbox implementation plan

> Execute inline using superpowers:executing-plans. Task state belongs only to .planning/WORK.md.

**Goal:** MRX pending inbox contains actual completion decisions rather than all active batches.
**Architecture:** Extract completion prerequisites to one read-only owner, reuse in transactional completion and existing paged MRX batch source; preserve existing command authority.
**Tech Stack:** C#, EF Core, xUnit, React, Vitest.
**Spec:** ../specs/2026-11-16-mrx-completion-inbox.md

## Constraints and review focus
MRX only; no migrations, stock mutations, added approvals, dependencies or styling. Preserve inherited work. Check empty/legacy batches, pending supplemental demands, resolved versus unresolved variance, pagination after filtered records, stale detail and completed history. Source failures must remain partial.

## Tasks
- [x] Add regression tests demonstrating ordinary in-progress batches are absent and ready/completed batches have correct routes/history.
- [x] Extract existing completion validation without changing command behavior; filter pending source after bounded bulk daily reads, preserving raw-page HasMore.
- [x] Update MRX-specific badge/history copy with existing primitives and add frontend behavioral assertions.
- [x] Run focused backend/frontend tests, required contracts, build/lint, scoped review and local runtime readback; record actual evidence and limitations in WORK.md.

Verification results and limitations are recorded in .planning/WORK.md; completion of these steps does not assert an all-green full suite or production mutation qualification.
