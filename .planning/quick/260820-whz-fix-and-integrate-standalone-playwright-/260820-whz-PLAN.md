---
quick_id: 260820-whz
status: in_progress
date: 2026-08-20
---

# Integrate and harden the standalone performance probe

GSD quick initialization could not use the normal workflow because this checkout has no
`.planning/ROADMAP.md`. This local quick record preserves the task scope without inventing a roadmap.

## Task 1 — Integrate the probe

- Add the single-file ESM probe under `frontend/scripts/` so workspace Playwright resolves normally.
- Replace guessed routes with `routeConfig.ts` values.
- Select each tab through its real accessible tab control and verify selection before sampling.
- Bootstrap authentication once from environment credentials and keep storage state in memory.
- Fail closed on redirects, login, missing shells, missing tabs, and route mismatch.

## Task 2 — Restore contracts and commands

- Restore the accidentally emptied canonical UI-rules file from `HEAD`.
- Add `perf:load`, `perf:inp`, and `perf:overflow` package scripts.

## Task 3 — Verify and commit

- Run Node syntax/import checks and probe self-checks that do not mutate runtime data.
- Run package JSON validation and `git diff --check`.
- Commit only files owned by this quick task; preserve all unrelated working-tree changes.
