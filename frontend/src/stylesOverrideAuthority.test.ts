import { readdirSync, readFileSync, statSync } from 'node:fs'
import { resolve } from 'node:path'
import { describe, expect, it } from 'vitest'

/**
 * The `redesign/` + `ui-redesign.css` layer is applied unconditionally by `MainLayout`, and those files
 * are imported after `components/`. A `.ipc-redesign-shell .x` rule therefore beats a `.x` rule in the
 * base layer on both specificity and order, so the base declaration is unreachable rather than merely
 * overridden: editing it produces no visible change and no other test reports it.
 *
 * The existing allow-list test in `designAuthorityInventory.test.ts` prevents NEW files from joining the
 * layer, but it cannot see an already-allow-listed file shadowing the base layer. This test closes that
 * gap.
 *
 * Overrides themselves are a deliberate product decision (UI-KIT 20.13), so this test PINS the current
 * set rather than banning overrides. It fails when a new base selector starts being shadowed, which is
 * the moment a change needs an explicit owner decision. A new override is legitimate: add it here with
 * the properties it shadows, so the next reviewer sees the intent instead of discovering it by accident.
 */

/** Files that define the base layer. A shadowed declaration here is unreachable. */
const BASE_LAYER_FILES = [
  'index.css',
  'components/dashboard.css',
  'components/tables.css',
  'components/shell.css',
  'components/operations.css',
  'components/documents.css',
  'components/domain-pages.css',
  'components/responsive.css',
]

/** Files in the override layer. Anything restating a base selector with the shell ancestor wins. */
const OVERRIDE_LAYER_FILES = [
  'ui-redesign.css',
  'redesign/fiori.css',
  'redesign/demand.css',
  'redesign/responsive.css',
  'redesign/dashboard.css',
]

type Rule = { selector: string; declarations: string }

function readStyles(relativePath: string): string {
  return readFileSync(resolve(process.cwd(), 'src/styles', relativePath), 'utf8')
}

/**
 * Minimal CSS block splitter. Safe here because this repository uses no nested selectors — every brace
 * pair inside a block belongs to `@media`/`@supports`. Tracking depth is enough; no CSS semantics needed.
 */
function parseRules(css: string): Rule[] {
  const rules: Rule[] = []
  let buffer = ''
  let depth = 0
  let selector = ''
  let insideBlock = false

  for (const character of css) {
    if (character === '{') {
      depth += 1
      if (depth === 1) {
        selector = buffer.trim()
        buffer = ''
        insideBlock = true
      }
      continue
    }
    if (character === '}') {
      depth -= 1
      if (depth === 0 && insideBlock) {
        rules.push({ selector, declarations: buffer })
        insideBlock = false
      }
      buffer = ''
      continue
    }
    buffer += character
  }

  return rules
}

function declaredProperties(declarations: string): Set<string> {
  return new Set(
    [...declarations.matchAll(/(?:^|[;{])\s*([-a-z]+)\s*:/g)].map((match) => match[1]),
  )
}

/** Strips the `.ipc-redesign-shell ` prefix so a base and its override can be compared as one element. */
function baseSelectorOf(selector: string): string | null {
  const match = selector.match(/^\.ipc-redesign-shell\s+([^,]+)$/)
  return match ? match[1].trim() : null
}

function collectShadowedSelectors(): Map<string, Set<string>> {
  const baseRules: Rule[] = BASE_LAYER_FILES.flatMap((file) => parseRules(readStyles(file)))
  const baseBySelector = new Map<string, Rule[]>()
  for (const rule of baseRules) {
    baseBySelector.set(rule.selector, [...(baseBySelector.get(rule.selector) ?? []), rule])
  }

  const shadowed = new Map<string, Set<string>>()

  for (const file of OVERRIDE_LAYER_FILES) {
    for (const rule of parseRules(readStyles(file))) {
      const baseSelector = baseSelectorOf(rule.selector)
      if (!baseSelector) continue

      for (const baseRule of baseBySelector.get(baseSelector) ?? []) {
        const overrideProperties = declaredProperties(rule.declarations)
        const baseProperties = declaredProperties(baseRule.declarations)
        const shared = [...overrideProperties].filter((property) => baseProperties.has(property))
        if (shared.length === 0) continue

        shadowed.set(baseSelector, new Set([...(shadowed.get(baseSelector) ?? []), ...shared]))
      }
    }
  }

  return shadowed
}

/**
 * Current shadowing state, measured 2026-10-12. Every entry is a base selector the override layer
 * restates, with the properties the override wins.
 */
const KNOWN_SHADOWED_SELECTORS: Record<string, string[]> = {
  '.ipc-advanced-settings-link': ['background'],
  '.ipc-brand': ['padding', 'border-bottom'],
  '.ipc-brand-subtitle': ['color'],
  '.ipc-brand-title': ['letter-spacing'],
  '.ipc-header': ['background'],
  '.ipc-logout-button': ['color', 'background'],
  '.ipc-logout-button:hover': ['background'],
  '.ipc-nav': ['gap', 'padding'],
  '.ipc-nav-link': ['min-height', 'border', 'border-radius', 'font-weight'],
  '.ipc-nav-link:hover': ['background', 'border-color'],
  '.ipc-nav-link.is-active': ['background', 'border-color', 'color', 'font-weight'],
  '.ipc-sidebar': ['background', 'box-shadow'],
  '.ipc-sidebar-footer': ['padding', 'border-top'],
  '.ipc-user-card': ['background'],
}

describe('base layer is not silently shadowed by the override layer', () => {
  it('reads every layer file it compares', () => {
    for (const file of [...BASE_LAYER_FILES, ...OVERRIDE_LAYER_FILES]) {
      expect(statSync(resolve(process.cwd(), 'src/styles', file)).isFile()).toBe(true)
    }
    expect(readdirSync(resolve(process.cwd(), 'src/styles/redesign'))).toHaveLength(4)
  })

  it('pins every base selector that the override layer currently restates', () => {
    const shadowed = collectShadowedSelectors()

    expect([...shadowed.keys()].sort()).toEqual(Object.keys(KNOWN_SHADOWED_SELECTORS).sort())
  })

  it('pins which properties the override wins for each shadowed selector', () => {
    const shadowed = collectShadowedSelectors()

    for (const [selector, expected] of Object.entries(KNOWN_SHADOWED_SELECTORS)) {
      expect([...(shadowed.get(selector) ?? [])].sort(), `${selector} shadowed properties`).toEqual(
        [...expected].sort(),
      )
    }
  })

  it('never counts a selector that only exists in the override layer as shadowed', () => {
    const baseSelectors = new Set(
      BASE_LAYER_FILES.flatMap((file) => parseRules(readStyles(file))).map((rule) => rule.selector),
    )

    for (const selector of collectShadowedSelectors().keys()) {
      expect(baseSelectors.has(selector)).toBe(true)
    }
  })
})