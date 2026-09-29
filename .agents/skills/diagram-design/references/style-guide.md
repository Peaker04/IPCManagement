<!-- diagram-design-profile
name: NOVYX GreenOps
slug: novyx
source-url: DESIGN.md
created: 2026-09-19
updated: 2026-09-19
notes: Active and authoritative visual profile for NOVYX GreenOps diagrams
-->
# Style Guide — NOVYX GreenOps Authoritative Profile

**The single authoritative source of truth for diagram colors, typography, spacing, and tokens in NOVYX GreenOps.**

> **Authority & Provenance:**
> - Derived directly from project visual authority: [`DESIGN.md`](../../../../DESIGN.md) & `@novyx/ui`.
> - Project Marker: `.diagram-design` in repository root selects `profile: novyx`.
> - Localization standard: [`localization-vi.md`](localization-vi.md) (Vietnamese diacritic safety).
> - Strict geometry & validation oracle: [`scripts/diagram_tool.py`](../../../../scripts/diagram_tool.py).

---

## 1. Tokens

### Semantic roles

Every diagram token is referred to by **semantic role**. Exact hex values adhere strictly to `DESIGN.md`:

| Role | Purpose | Light Theme (Default) | Dark Theme | Source Token (`DESIGN.md`) |
|---|---|---|---|---|
| `paper` | Page background, canvas | `#fcfcf7` | `#112116` | `colors.snowWhite` |
| `diagram-canvas` | High-contrast standalone diagram canvas | `#fbfbf9` | `#0d1710` | Derived high-contrast canvas |
| `paper-2` | Container bg, lane fill, stepper track | `#eeeee9` | `#1a2e21` | `colors.warmStone` |
| `card` | Card / node surface with high contrast | `#ffffff` | `#15261b` | High-contrast card surface |
| `ink` | Primary text, titles, high-contrast borders | `#13231a` | `#fcfcf7` | `colors.ink` (`forestDepths`) |
| `muted` | Secondary text, descriptions, default lines | `#64748b` | `#94a3b8` | `colors.pewter` |
| `soft` | Sublabels, boundary labels, metadata | `#94a3b8` | `#64748b` | `colors.muted` |
| `rule` | Hairline dividers (1px) | `rgba(19,35,26,0.12)` | `rgba(252,252,247,0.12)` | `colors.hairlineBorder` at opacity |
| `rule-solid` | Solid borders, baselines | `#e6ede3` | `#23412a` | `colors.hairlineBorder` solid |
| `accent` | Authority stroke, primary decision gates | `#1c3a13` | `#84cc16` | `colors.forestDepths` |
| `accent-focal` | Punctuation badge, active step highlight | `#d3fa99` | `#84cc16` | `colors.limePulse` |
| `accent-tint` | Verified step bg, success badge bg | `#e7f6df` | `rgba(132,204,22,0.15)` | `colors.primarySoft` |
| `success` | Approved terminal state, positive paths | `#236236` | `#4ade80` | `colors.primaryDark` |
| `warning` | Waiting review, overdue warning | `#9f7115` | `#fbbf24` | `colors.amber` |
| `warning-tint` | Waiting review card fill, banner bg | `#fffae0` | `rgba(217,119,6,0.15)` | `colors.amberSoft` |
| `danger` | Rework required, blocked issues, prohibited | `#c92c4a` | `#f87171` | `colors.danger` |
| `danger-tint` | Error banner bg, rework callout fill | `#fff1f2` | `rgba(220,38,38,0.15)` | `colors.dangerSoft` |
| `link` / `info` | In-progress tasks, GPS in-progress | `#1c7890` | `#38bdf8` | `colors.sky` |
| `info-tint` | In-progress badge bg, info card fill | `#eef8fb` | `rgba(28,120,144,0.15)` | `colors.skySoft` |

> [!IMPORTANT]
> **No false token aliases:** If referencing a token from `DESIGN.md`, use its exact hex value (e.g. `snowWhite` is `#fcfcf7`). If a diagram requires a derived print/readability color, name it with its own semantic token (e.g. `diagram-canvas` is `#fbfbf9`). Never state `#fbfbf9 = snowWhite`.

---

## 2. Vietnamese Typography Rules

| Role | Family | Size | Weight | Usage |
|---|---|---|---|---|
| `title` | `Noto Serif`, Georgia, serif | 1.75rem–2.1rem | 600 | Page H1 |
| `subtitle` | `Noto Sans`, system-ui, sans-serif | 0.92rem–1.0rem | 400 | Page description (`muted`) |
| `node-name` | `Noto Sans`, system-ui, sans-serif | 12px–16px | 600–700 | Primary node headers |
| `body` | `Noto Sans`, system-ui, sans-serif | 11px–12px | 400 | Node bullet points and descriptions |
| `sublabel` | `Geist Mono`, monospace | 11px | 500–600 | Technical IDs, enum values, DTOs |
| `badge` | `Geist Mono` / `Noto Sans` | 11px | 600–700 | Status badges, gate pills (uppercase) |
| `arrow-label` | `Geist Mono` / `Noto Sans` | 11px–12px | 600 | Transition annotations with background pill |

### Hard Typography Requirements:
1. **Typography Floor:** Strictly $\ge 11\text{px}$ for all Vietnamese text. Never use 7px–9px font sizes.
2. **Vietnamese Diacritic Line Height:** Multi-line text must use `<tspan>` with `dy="1.35em"` to `1.5em"` (recommended `1.4em`) to prevent accent collision.
3. **No ForeignObject:** Use static SVG `<tspan>` with pre-calculated line wrapping for full standalone portability.
4. **Never Shrink Font to Save a Box:** Wrap text into multiple lines, widen the box, and reposition neighbor nodes.

---

## 3. Geometry & Safe Padding Constraints

Every text label inside a semantic owner card or pill MUST satisfy:
- $\text{text.left} \ge \text{owner.left} + \text{paddingLeft}$ ($\text{paddingLeft} \ge 6\text{px}$, min hard floor $4\text{px}$)
- $\text{text.right} \le \text{owner.right} - \text{paddingRight}$ ($\text{paddingRight} \ge 6\text{px}$, min hard floor $4\text{px}$)
- $\text{text.top} \ge \text{owner.top} + \text{paddingTop}$ ($\text{paddingTop} \ge 4\text{px}$)
- $\text{text.bottom} \le \text{owner.bottom} - \text{paddingBottom}$ ($\text{paddingBottom} \ge 4\text{px}$)

### Content-Driven Sizing Formula:
$$\text{Box Width} \ge \text{measuredTextWidth} + 2 \times \text{safeHorizontalPadding}$$
$$\text{Box Height} \ge \text{measuredTextHeight} + 2 \times \text{safeVerticalPadding}$$

For multi-line cards:
$$\text{Box Height} \ge \text{headerHeight} + (\text{lineCount} \times \text{lineHeight}) + 2 \times \text{paddingY}$$

---

## 4. Connector & Arrow Collision Rules

1. Arrow labels must have opaque background pills (`<rect fill="#FFF" ...>`) to prevent the connector line from crossing through the text.
2. Endpoints of connectors must terminate cleanly at node borders; lines must not pass through unrelated cards or text blocks.
3. Connectors between columns must maintain minimum 16px clearance from neighbor cards.
