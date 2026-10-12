import { readdirSync, readFileSync, statSync } from 'node:fs'
import { join, resolve } from 'node:path'
import { describe, expect, it } from 'vitest'

/**
 * Vietnamese typography guard.
 *
 * Vietnamese has diacritics above (circumflex, acute, breve, dot) and below (grave, hook, tilde)
 * every vowel. `text-transform: uppercase` therefore does not produce a smaller, tighter form of
 * the text the way it does in English -- it produces tall, colliding glyphs whose marks overlap
 * the line above, and it adds wide letter-spacing to a script that was never designed for it.
 *
 * `docs/DESIGN.md` Foundations already bans "long all-caps" for exactly this reason. This test is
 * the executable form of that sentence, so the rule cannot decay back into prose that nobody runs.
 *
 * Legitimate exceptions are narrow and enumerated below, not open-ended.
 */

const srcRoot = resolve(process.cwd(), 'src')

function walk(dir: string, extensions: string[]): string[] {
  return readdirSync(dir).flatMap((entry) => {
    const full = join(dir, entry)
    if (statSync(full).isDirectory()) {
      if (entry === 'node_modules' || entry === 'dist') return []
      return walk(full, extensions)
    }
    return extensions.some((extension) => full.endsWith(extension)) ? [full] : []
  })
}

const tsxFiles = walk(srcRoot, ['.tsx'])
const cssFiles = walk(resolve(srcRoot, 'styles'), ['.css'])

const rel = (file: string) => file.slice(srcRoot.length + 1).replace(/\\/g, '/')

/** Diacritic-bearing Vietnamese characters, including the uppercase forms produced by the transform. */
const VIETNAMESE = /[àáảãạăằắẳẵặâầấẩẫậèéẻẽẹêềếểễệìíỉĩịòóỏõọôồốổỗộơờớởỡợùúủũụưừứửữựỳýỷỹỵđ]/i

describe('Vietnamese typography authority', () => {
  it('never renders Vietnamese copy through a Tailwind uppercase utility', () => {
    const violations: string[] = []

    for (const file of tsxFiles) {
      const lines = readFileSync(file, 'utf8').split('\n')
      lines.forEach((line, index) => {
        // Only presentation utilities count. `x.toUpperCase()` is data normalisation, not styling.
        if (!/(?:className|cn\(|cva\(|:\s*)["'`][^"'`]*\buppercase\b/.test(line)) return

        // Find text rendered on this element or the following lines of the same JSX element.
        const element = lines.slice(index, index + 4).join('\n')
        if (!VIETNAMESE.test(element)) return

        violations.push(`${rel(file)}:${index + 1}`)
      })
    }

    expect(violations).toEqual([])
  })

  it('never forces Vietnamese table headers or shell chrome through text-transform', () => {
    const violations: string[] = []
    const selectorsThatStyleText = /^\s*(?![@/])[.#a-zA-Z][^{]*\{\s*$/gm

    for (const file of cssFiles) {
      const source = readFileSync(file, 'utf8')
      const blocks = [...source.matchAll(/([^{}]+)\{([^{}]*)\}/g)]

      for (const [, rawSelector, body] of blocks) {
        if (!body.includes('text-transform')) continue

        const selector = rawSelector.trim()
        const transformsTo = /text-transform:\s*([^;]+)/.exec(body)?.[1]?.trim()

        if (transformsTo === 'uppercase') {
          // Headers and table geometry always carry Vietnamese column names in this product.
          if (/(^|[\s,>+~])(th|thead|\.ipc-[\w-]*table\b|\.ipc-table)/i.test(selector)) {
            violations.push(`${rel(file)} -> ${selector}`)
            continue
          }
        }

        // Any other text-transform on a Vietnamese-bearing selector is still worth reporting.
        if (/text-transform:\s*(capitalize|lowercase)/.test(body) && VIETNAMESE.test(selector)) {
          violations.push(`${rel(file)} -> ${selector}`)
        }
      }
    }

    expect(selectorsThatStyleText.test(readFileSync(resolve(srcRoot, 'styles/index.css'), 'utf8'))).toBe(true)
    expect(violations).toEqual([])
  })

  it('keeps the documented exceptions explicit rather than silent', () => {
    // `403` is a numeral: uppercase and letter-spacing are safe and intentional.
    const forbidden = tsxFiles.filter((file) => {
      const source = readFileSync(file, 'utf8')
      return /className="[^"]*\buppercase\b[^"]*"[^>]*>\s*(?![0-9])/.test(source) && VIETNAMESE.test(source)
    })

    expect(forbidden).toEqual([])
  })
})