<!-- gitnexus:start -->
# GitNexus — Code Intelligence

This project is indexed by GitNexus as **IPCManagement** (8603 symbols, 25059 relationships, 300 execution flows). Use the GitNexus MCP tools to understand code, assess impact, and navigate safely.

> Index stale? Run `node .gitnexus/run.cjs analyze` from the project root — it auto-selects an available runner. No `.gitnexus/run.cjs` yet? `npx gitnexus analyze` (npm 11 crash → `npm i -g gitnexus`; #1939).

## Always Do

- **MUST run impact analysis before editing any symbol.** Before modifying a function, class, or method, run `impact({target: "symbolName", direction: "upstream"})` and report the blast radius (direct callers, affected processes, risk level) to the user.
- **MUST run `detect_changes()` before committing** to verify your changes only affect expected symbols and execution flows. For regression review, compare against the default branch: `detect_changes({scope: "compare", base_ref: "main"})`.
- **MUST warn the user** if impact analysis returns HIGH or CRITICAL risk before proceeding with edits.
- When exploring unfamiliar code, use `query({search_query: "concept"})` to find execution flows instead of grepping. It returns process-grouped results ranked by relevance.
- When you need full context on a specific symbol — callers, callees, which execution flows it participates in — use `context({name: "symbolName"})`.
- For security review, `explain({target: "fileOrSymbol"})` lists taint findings (source→sink flows; needs `analyze --pdg`).

## Never Do

- NEVER edit a function, class, or method without first running `impact` on it.
- NEVER ignore HIGH or CRITICAL risk warnings from impact analysis.
- NEVER rename symbols with find-and-replace — use `rename` which understands the call graph.
- NEVER commit changes without running `detect_changes()` to check affected scope.

## Resources

| Resource | Use for |
|----------|---------|
| `gitnexus://repo/IPCManagement/context` | Codebase overview, check index freshness |
| `gitnexus://repo/IPCManagement/clusters` | All functional areas |
| `gitnexus://repo/IPCManagement/processes` | All execution flows |
| `gitnexus://repo/IPCManagement/process/{name}` | Step-by-step execution trace |

## CLI

| Task | Read this skill file |
|------|---------------------|
| Understand architecture / "How does X work?" | `.claude/skills/gitnexus/gitnexus-exploring/SKILL.md` |
| Blast radius / "What breaks if I change X?" | `.claude/skills/gitnexus/gitnexus-impact-analysis/SKILL.md` |
| Trace bugs / "Why is X failing?" | `.claude/skills/gitnexus/gitnexus-debugging/SKILL.md` |
| Rename / extract / split / refactor | `.claude/skills/gitnexus/gitnexus-refactoring/SKILL.md` |
| Tools, resources, schema reference | `.claude/skills/gitnexus/gitnexus-guide/SKILL.md` |
| Index, status, clean, wiki CLI commands | `.claude/skills/gitnexus/gitnexus-cli/SKILL.md` |

<!-- gitnexus:end -->

<!-- cursor-rules:start -->
## Cursor Rules

This project uses **Cursor Rules** stored in `.cursor/rules/`. These provide persistent AI guidance for coding standards and design:

| Rule | Scope | Purpose |
|------|-------|---------|
| `core-coding-standards.mdc` | Always | Core coding principles (Karpathy guidelines) |
| `git-workflow.mdc` | Always | Git workflow, Conventional Commits |
| `gitnexus-integration.mdc` | Always | GitNexus code intelligence integration |
| `csharp-standards.mdc` | `backend/**/*.cs` | C#/.NET backend conventions |
| `typescript-react-standards.mdc` | `frontend/**/*` | TypeScript/React frontend conventions |
| `api-conventions.mdc` | `backend/**/*Controller.cs` | REST API conventions |
| `design.mdc` | `frontend/**/*` | Unified design skill routing |
| `ui-styling.mdc` | `frontend/**/*` | shadcn/ui + Tailwind CSS |
| `ui-ux-pro-max.mdc` | `frontend/**/*` | UI/UX design intelligence |
| `design-system.mdc` | `frontend/**/*` | Design tokens & specifications |
| `brand.mdc` | `frontend/**/*`, `docs/**/*` | Brand identity & voice |
| `slides.mdc` | `frontend/**/*` | HTML presentations with Chart.js |
| `banner-design.mdc` | `frontend/**/*` | Banner design for social/web/print |
| `taste-skill.mdc` | `frontend/**/*` | Anti-slop frontend design skill |

**IMPORTANT:** Cursor Rules take precedence for Cursor IDE. GitNexus rules remain available for Codex CLI.

<!-- cursor-rules:end -->

<!-- project-memory:start -->
## Project Memory

This project has a **MEMORY.md** file in `.cursor/MEMORY.md` that contains:
- Backend/frontend commands and troubleshooting
- Current phase status (Phase 6: BOM cutover)
- User preferences and coding patterns
- Key file locations and tech stack
- Dev fallback data shapes

**Read `.cursor/MEMORY.md` for project-specific context before starting new tasks.**
<!-- project-memory:end -->
