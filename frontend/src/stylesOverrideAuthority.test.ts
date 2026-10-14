import { existsSync, readdirSync, statSync } from 'node:fs'
import { resolve } from 'node:path'
import { describe, expect, it } from 'vitest'

/**
 * The `redesign/` + `ui-redesign.css` override layer was deprecated and removed.
 * Global CSS is defined strictly by the base layer (index.css + components/*.css).
 * This test guarantees that no override layer exists to shadow the base layer.
 */

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

const RETIRED_OVERRIDE_FILES = [
  'ui-redesign.css',
  'planning-demand-preview-tokens.css',
  'redesign',
]

describe('base layer is authoritative with zero override layer shadowing', () => {
  it('reads every base layer file', () => {
    for (const file of BASE_LAYER_FILES) {
      expect(statSync(resolve(process.cwd(), 'src/styles', file)).isFile()).toBe(true)
    }
  })

  it('guarantees that deprecated override files and directories are completely removed', () => {
    for (const file of RETIRED_OVERRIDE_FILES) {
      expect(existsSync(resolve(process.cwd(), 'src/styles', file))).toBe(false)
    }
  })

  it('ensures no foreign CSS directories exist in src/styles other than components', () => {
    const entries = readdirSync(resolve(process.cwd(), 'src/styles'), { withFileTypes: true })
    const directories = entries.filter((e) => e.isDirectory()).map((e) => e.name)
    expect(directories).toEqual(['components'])
  })
})
