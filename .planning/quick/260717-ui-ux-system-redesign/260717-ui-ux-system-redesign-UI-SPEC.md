---
name: 260717-ui-ux-system-redesign
status: approved-for-wave-1
system: existing shadcn-style local primitives
---

# UI Design Contract

## Visual language

- Operational B2B, calm and legible; variance 3/10, motion 2/10, density 5/10.
- One accent: `--ipc-primary`; neutrals use the existing IPC slate tokens.
- Small consistent radius from the existing token scale; no mixed decorative card styles.
- Lucide outline icons remain the only icon family because the project already depends on it.
- Existing font stack remains; no font download or new typography dependency.

## Shared page anatomy

`MainLayout` owns navigation and page context. Each route owns one page header, one primary action region, one content region and one feedback region. Repeated descriptions move into helper text or tooltips; repeated headings are removed.

## Table contract

- Native `<table>` semantics, caption/aria label, sticky opaque header.
- Local `overflow: auto` viewport with `scrollbar-gutter: stable` and fixed minimum height per table family.
- Loading, error, empty and no-result states stay inside the same viewport and preserve header/columns.
- Actions use `inline-flex`, `white-space: nowrap`; long text wraps inside bounded cells.
- Pagination is visible only when needed and uses Vietnamese copy with total count.

## Copy contract

- User-facing text is Vietnamese and task-oriented.
- Technical identifiers remain selectable in monospace but receive a plain-language label.
- Status uses label + visual tone; color alone is never the only signal.
- Required fields say `Bắt buộc`; reasons say why the action is needed.

## Accessibility contract

- Keyboard-visible focus with existing IPC focus token.
- Correct `aria-current`, `aria-label`, `aria-describedby`, table region labels and dialog names.
- Reduced-motion mode disables nonessential transitions.
- Target touch controls remain at least 36px high in compact desktop controls and expand on mobile.
