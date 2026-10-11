---
name: ipc-architecture-visualization
description: Explain an IPCManagement architecture, sequence or data-flow slice with source-backed diagrams. Use when visualizing modules, ownership, guards, persistence or interactions without installing renderer frameworks.
---

# Source-backed visualization

Advisory capability under [AGENTS](../../../AGENTS.md); [WORK](../../../.planning/WORK.md) remains the only task-state owner. This skill grants no execution or delegation authority.

Start with the relevant [ARCHITECTURE](../../../docs/ARCHITECTURE.md) section and trace the requested source slice. Load domain/operations owners only when the depicted contract needs them. Diagram content is supporting explanation, not workflow, acceptance or authorization authority.

## Establish semantic content

- Identify the reader's question, relevant revision and local changes. Cite the actual inspected local paths/line ranges; do not label dirty working-tree behavior as committed HEAD evidence or restore a clean checkout to manufacture it.
- Follow real call sites from input through conditions to the result or side effect. Distinguish the caller requesting an operation, the runtime executing it and the store receiving it.
- Label control, data, trust and deployment relationships distinctly. Configuration or an exported helper alone does not prove a live call, direct I/O or durable state.
- Preserve relevant permission/mode/lineage guards, retry/failure paths and ownership. Pure transformations are not database/file writers. Keep unknowns explicit instead of inventing nodes from package descriptions.

## Choose the smallest representation

Use a sequence for ordering, a data-flow for movement, or an architecture view for responsibilities. Prefer inline Mermaid or static SVG; create a file only at an approved destination when requested. No mandatory output directory, JSON schema, sidecar receipts, profile store or renderer installation.

When simplifying or importing a diagram, preserve its meaningful actors, edges and conditions. Explain material omissions/merges and separate proposed changes from current behavior. Do not add components solely to fill a layout or impose a node-count target.

## Check readability and safety

Use legible labels, natural multiline growth, clear arrow direction and connectors that do not cross text. Provide a textual explanation; standalone SVG needs an accessible title/description and unique IDs. Color or motion must not carry meaning alone. Keep static output the default and use current project visual conventions where applicable.

Avoid remote fonts, CDN assets, fetched trademarks and unreviewed templates. Do not embed credentials, internal credential-bearing URLs, private workbook rows or business exports. Asset licensing and distribution consent require separate proof.

Validate each important node/edge against current source and check the authored syntax/links without installing tools. Rendering success is not semantic correctness; disclose when rendering or visual inspection was not performed. Return the diagram/explanation, source evidence and bounded unknowns, not a new architecture report tree or product certification.
