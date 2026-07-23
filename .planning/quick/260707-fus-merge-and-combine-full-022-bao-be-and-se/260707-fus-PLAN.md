# Quick Task 260707-fus: Merge and combine branch work

**Date:** 2026-07-07
**Status:** In progress

## Goal

Merge and combine these branches into the current integration branch:

- `origin/feature/full-022-account-lifecycle`
- `origin/Bao-BE`
- selected useful changes from `origin/feature/weekly-menu-api`

## Plan

1. Preserve current local work in an atomic commit.
2. Refresh GitNexus index for the current branch and inspect relevant flows.
3. Merge branches that fit the current structure cleanly.
4. Treat `feature/weekly-menu-api` as a source branch, not a direct merge target, because it conflicts broadly with the current structure.
5. Port only missing behavior that is still useful for the current project, adapting code to existing services, routes, and tests.
6. Run build/tests plus GitNexus `detect_changes` before final commit.

## Current Decision

- Merge `full-022-account-lifecycle` directly.
- Merge `Bao-BE` directly.
- Do not merge `weekly-menu-api` directly unless later analysis proves its full branch state is safe.
