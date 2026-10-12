import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { describe, expect, it } from 'vitest'

/**
 * `--color-slate-*` is bridged to the `--ipc-slate-*` primitives so Tailwind `slate-*` utilities and
 * hand-written component CSS render from one authority. The bridge is only safe while the two scales
 * stay the same slate ramp; if someone edits an `--ipc-slate-*` value into a different hue, every one
 * of the ~1176 raw-palette callsites silently changes with no type error and no other test reporting it.
 *
 * This test pins the resolved value of each bridge entry against Tailwind's own `theme.css`, so a drift
 * in either direction fails loudly instead of shipping as a visual regression.
 */

const indexStyles = readFileSync(resolve(process.cwd(), 'src/styles/index.css'), 'utf8')
const tailwindTheme = readFileSync(
  resolve(process.cwd(), '../node_modules/tailwindcss/theme.css'),
  'utf8',
)

const SHADES = [50, 100, 200, 300, 400, 500, 600, 700, 800, 900, 950] as const

function ipcSlateValue(shade: number): string {
  const match = indexStyles.match(new RegExp(`--ipc-slate-${shade}:\\s*(#[0-9a-fA-F]{6})`))
  expect(match, `--ipc-slate-${shade} must be a hex literal`).not.toBeNull()
  return match![1].toLowerCase()
}

function tailwindSlateOklch(shade: number): [number, number, number] {
  const match = tailwindTheme.match(
    new RegExp(`--color-slate-${shade}:\\s*oklch\\(\\s*([0-9.]+)%\\s+([0-9.]+)\\s+([0-9.]+)\\s*\\)`),
  )
  expect(match, `tailwind --color-slate-${shade} must be oklch`).not.toBeNull()
  return [Number(match![1]), Number(match![2]), Number(match![3])]
}

/** CSS Color 4 oklch → sRGB, so the comparison is against the same space `--ipc-slate-*` uses. */
function oklchToHex([lightnessPercent, chroma, hue]: [number, number, number]): string {
  const lightness = lightnessPercent / 100
  const hueRadians = (hue * Math.PI) / 180
  const a = chroma * Math.cos(hueRadians)
  const b = chroma * Math.sin(hueRadians)

  const lRoot = lightness + 0.3963377774 * a + 0.2158037573 * b
  const mRoot = lightness - 0.1055613458 * a - 0.0638541728 * b
  const sRoot = lightness - 0.0894841775 * a - 1.291485548 * b

  const l = lRoot ** 3
  const m = mRoot ** 3
  const s = sRoot ** 3

  const red = 4.0767416621 * l - 3.3077115913 * m + 0.2309699292 * s
  const green = -1.2684380046 * l + 2.6097574011 * m - 0.3413193965 * s
  const blue = -0.0041960863 * l - 0.7034186147 * m + 1.707614701 * s

  const encode = (channel: number) => {
    const value = channel <= 0.0031308 ? 12.92 * channel : 1.055 * channel ** (1 / 2.4) - 0.055
    return Math.max(0, Math.min(255, Math.round(value * 255)))
  }

  return (
    '#' +
    [encode(red), encode(green), encode(blue)]
      .map((value) => value.toString(16).padStart(2, '0'))
      .join('')
  )
}

function channelDelta(hexA: string, hexB: string): number {
  const channels = [0, 1, 2].map((index) => {
    const a = Number.parseInt(hexA.slice(1 + index * 2, 3 + index * 2), 16)
    const b = Number.parseInt(hexB.slice(1 + index * 2, 3 + index * 2), 16)
    return Math.abs(a - b)
  })
  return Math.max(...channels)
}

describe('tailwind slate palette is bridged to the ipc slate primitives', () => {
  it('bridges every slate shade to an --ipc-slate-* primitive', () => {
    for (const shade of SHADES) {
      expect(indexStyles, `--color-slate-${shade} bridge`).toContain(
        `--color-slate-${shade}: var(--ipc-slate-${shade});`,
      )
    }
  })

  it('declares an --ipc-slate-* primitive for every shade it bridges', () => {
    for (const shade of SHADES) {
      expect(indexStyles, `--ipc-slate-${shade} declaration`).toMatch(
        new RegExp(`--ipc-slate-${shade}:\\s*#[0-9a-fA-F]{6}`),
      )
    }
  })

  it('does not bridge a shade the primitives do not define', () => {
    const bridged = [...indexStyles.matchAll(/--color-slate-(\d+):\s*var\(--ipc-slate-(\d+)\)/g)]
    for (const [, bridgeShade, targetShade] of bridged) {
      expect(targetShade, `--color-slate-${bridgeShade} must point at its own tier`).toBe(bridgeShade)
    }
  })

  it('keeps each bridged shade within the measured 4/255 of tailwind own value', () => {
    for (const shade of SHADES) {
      const expected = oklchToHex(tailwindSlateOklch(shade))
      const actual = ipcSlateValue(shade)
      const delta = channelDelta(expected, actual)

      expect(
        delta,
        `--ipc-slate-${shade} is ${actual} but tailwind resolves to ${expected} (delta ${delta}/255). ` +
          'A delta this large means a bridge would visibly recolour existing slate-* utilities.',
      ).toBeLessThanOrEqual(4)
    }
  })

  it('keeps the slate ramp monotonic in lightness', () => {
    const luminance = SHADES.map((shade) => {
      const hex = ipcSlateValue(shade)
      const channels = [0, 1, 2].map((index) => {
        const value = Number.parseInt(hex.slice(1 + index * 2, 3 + index * 2), 16) / 255
        return value <= 0.04045 ? value / 12.92 : ((value + 0.055) / 1.055) ** 2.4
      })
      return 0.2126 * channels[0] + 0.7152 * channels[1] + 0.0722 * channels[2]
    })

    for (let index = 1; index < luminance.length; index += 1) {
      expect(
        luminance[index],
        `--ipc-slate-${SHADES[index]} must be darker than --ipc-slate-${SHADES[index - 1]}`,
      ).toBeLessThan(luminance[index - 1])
    }
  })
})