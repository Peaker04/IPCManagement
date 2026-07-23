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

This project uses **Cursor Rules** stored in `.cursor/rules/`. These provide persistent AI guidance for coding standards:

| Rule | Scope | Purpose |
|------|-------|---------|
| `core-coding-standards.mdc` | Always | Core coding principles (Karpathy guidelines) |
| `git-workflow.mdc` | Always | Git workflow, Conventional Commits |
| `gitnexus-integration.mdc` | Always | GitNexus code intelligence integration |
| `csharp-standards.mdc` | `backend/**/*.cs` | C#/.NET backend conventions |
| `typescript-react-standards.mdc` | `frontend/**/*` | TypeScript/React frontend conventions |
| `api-conventions.mdc` | `backend/**/*Controller.cs` | REST API conventions |

<!-- cursor-rules:end -->

<!-- karpathy-guidelines:start -->
# Karpathy Coding Guidelines

> Source: [multica-ai/andrej-karpathy-skills](https://github.com/multica-ai/andrej-karpathy-skills)  
> Derived from [Andrej Karpathy's observations](https://x.com/karpathy/status/2015883857489522876) on LLM coding pitfalls.

**Tradeoff:** These guidelines bias toward caution over speed. For trivial tasks, use judgment.

## Think Before Coding

**Don't assume. Don't hide confusion. Surface tradeoffs.**

Before implementing:
- State your assumptions explicitly. If uncertain, ask.
- If multiple interpretations exist, present them — don't pick silently.
- If a simpler approach exists, say so. Push back when warranted.
- If something is unclear, stop. Name what's confusing. Ask.

## Simplicity First

**Minimum code that solves the problem. Nothing speculative.**

- No features beyond what was asked.
- No abstractions for single-use code.
- No "flexibility" or "configurability" that wasn't requested.
- No error handling for impossible scenarios.
- If you write 200 lines and it could be 50, rewrite it.

Ask yourself: "Would a senior engineer say this is overcomplicated?" If yes, simplify.

## Surgical Changes

**Touch only what you must. Clean up only your own mess.**

When editing existing code:
- Don't "improve" adjacent code, comments, or formatting.
- Don't refactor things that aren't broken.
- Match existing style, even if you'd do it differently.
- If you notice unrelated dead code, mention it — don't delete it.

When your changes are done, verify: "Did I touch anything outside the task scope?" If yes, revert it.

## Goal-Driven Execution

**Define success before you start. Know when you're done.**

Before coding:
- State the goal explicitly: "This is done when X."
- Write a test or check first if possible (TDD mindset).
- Identify the simplest verifiable signal that the task is complete.

After coding:
- Run the check you defined.
- If it passes, stop. Don't add more.
- If it fails, debug the goal — not the code.
<!-- karpathy-guidelines:end -->
