import { existsSync, readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { describe, expect, it } from 'vitest'

const root = process.cwd()
const css = readFileSync(resolve(root, 'src/styles/index.css'), 'utf8')
const fontSources = [...css.matchAll(/src:\s*url\("([^"]+)"\)/g)].map((match) => match[1])

describe('self-hosted typography font loading', () => {
  it('is local-only and remains compatible with font-src self CSP', () => {
    expect(fontSources).toHaveLength(3)
    for (const source of fontSources) {
      expect(source).not.toMatch(/^(?:https?:|data:|\/\/)/)
      expect(source).toMatch(/^@fontsource-variable\/inter\/files\/.+\.woff2$/)
      const localAsset = resolve(root, 'node_modules', source)
      const workspaceAsset = resolve(root, '..', 'node_modules', source)
      expect(existsSync(localAsset) || existsSync(workspaceAsset)).toBe(true)
    }
    expect(css).not.toMatch(/fonts\.(?:googleapis|gstatic)\.com/)
  })
})
