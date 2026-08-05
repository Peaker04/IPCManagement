import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'

type UiSourceOwnershipManifestEntry = {
  scopeKey: string
  ownerId: string
  regionId: string
  sourceFile: string
  sourceSymbol: string
}

const buildUiSourceOwnershipKey = (entry: Pick<UiSourceOwnershipManifestEntry, 'scopeKey' | 'ownerId' | 'regionId'>) =>
  JSON.stringify([entry.scopeKey, entry.ownerId, entry.regionId])

let runtimeManifest: readonly UiSourceOwnershipManifestEntry[] = []

export type SourcePathVariant = {
  ownershipKey: string
  sourceFile: string
  kind: 'frontend-relative' | 'repository-relative' | 'windows-relative' | 'windows-absolute' | 'absolute-forward' | 'posix-rooted'
  value: string
}

export type SourcePathLeak = SourcePathVariant & { asset: string }

const frontendRoot = path.resolve(import.meta.dirname, '..')
const repositoryRoot = path.resolve(frontendRoot, '..')

export const buildManifestPathVariants = (
  manifest: readonly UiSourceOwnershipManifestEntry[] = runtimeManifest,
): SourcePathVariant[] => manifest.flatMap((entry) => {
  const frontendRelative = entry.sourceFile.replaceAll('\\', '/')
  const repositoryRelative = `frontend/${frontendRelative}`
  const absolute = path.resolve(frontendRoot, frontendRelative)
  const values: Array<Omit<SourcePathVariant, 'ownershipKey' | 'sourceFile'>> = [
    { kind: 'frontend-relative', value: frontendRelative },
    { kind: 'repository-relative', value: repositoryRelative },
    { kind: 'windows-relative', value: repositoryRelative.replaceAll('/', '\\') },
    { kind: 'windows-absolute', value: absolute.replaceAll('/', '\\') },
    { kind: 'absolute-forward', value: absolute.replaceAll('\\', '/') },
    { kind: 'posix-rooted', value: `/${repositoryRelative}` },
  ]
  return [...new Map(values.map((variant) => [variant.value, variant])).values()].map((variant) => ({
    ownershipKey: buildUiSourceOwnershipKey(entry),
    sourceFile: entry.sourceFile,
    ...variant,
  }))
})

export const scanTextForSourcePathLeaks = (
  text: string,
  asset: string,
  variants: readonly SourcePathVariant[] = buildManifestPathVariants(),
): SourcePathLeak[] => {
  const matchedValues = new Set([...new Set(variants.map((variant) => variant.value))].filter((value) => text.includes(value)))
  return variants.filter((variant) => matchedValues.has(variant.value)).map((variant) => ({ ...variant, asset }))
}

const textAsset = (file: string) => file.endsWith('.map') || ['.js', '.css', '.html', '.json', '.txt'].includes(path.extname(file).toLowerCase())

const walk = (directory: string): string[] => fs.readdirSync(directory, { withFileTypes: true }).flatMap((entry) => {
  const fullPath = path.join(directory, entry.name)
  return entry.isDirectory() ? walk(fullPath) : [fullPath]
})

export const scanDistTextAssets = (distRoot = path.join(frontendRoot, 'dist'), manifest: readonly UiSourceOwnershipManifestEntry[] = runtimeManifest) => {
  if (!fs.existsSync(distRoot) || !fs.statSync(distRoot).isDirectory()) throw new Error(`Missing frontend dist directory: ${distRoot}`)
  const assets = walk(distRoot).filter(textAsset).sort((left, right) => left.localeCompare(right))
  if (assets.length === 0) throw new Error(`No emitted text assets found under ${distRoot}`)
  const variants = buildManifestPathVariants(manifest)
  const leaks = assets.flatMap((file) => scanTextForSourcePathLeaks(
    fs.readFileSync(file, 'utf8'),
    path.relative(repositoryRoot, file).replaceAll('\\', '/'),
    variants,
  ))
  return { assets: assets.map((file) => path.relative(repositoryRoot, file).replaceAll('\\', '/')), leaks }
}

if (process.env.VITEST) {
  const { describe, expect, it } = await import('vitest')
  const { uiSourceOwnershipManifest } = await import('./uiSourceOwnershipManifest')
  runtimeManifest = uiSourceOwnershipManifest
  describe('Phase 26 source ownership leakage', () => {
  it('derives relative, Windows, absolute-forward, and POSIX-rooted variants for every manifest row', () => {
    const variants = buildManifestPathVariants()
    for (const entry of uiSourceOwnershipManifest) {
      const row = variants.filter((variant) => variant.ownershipKey === buildUiSourceOwnershipKey(entry))
      expect(new Set(row.map((variant) => variant.kind))).toEqual(new Set([
        'frontend-relative', 'repository-relative', 'windows-relative', 'windows-absolute', 'absolute-forward', 'posix-rooted',
      ]))
      expect(row.every((variant) => variant.value.length > 0)).toBe(true)
    }
  })

  it.each([
    ['DOM', '<main data-debug="frontend/src/features/auth/pages/LoginPage.tsx">'],
    ['CSS', '.owner{content:"src/features/auth/pages/LoginPage.tsx"}'],
    ['HTML', '<meta content="/frontend/src/features/auth/pages/LoginPage.tsx">'],
    ['source map', JSON.stringify({ sources: ['frontend/src/features/auth/pages/LoginPage.tsx'], sourcesContent: [] })],
  ])('reports the exact ownership key, asset, and variant for a synthetic %s leak', (asset, text) => {
    const leaks = scanTextForSourcePathLeaks(text, `synthetic-${asset}`)
    expect(leaks.length).toBeGreaterThan(0)
    expect(leaks[0]).toMatchObject({
      ownershipKey: buildUiSourceOwnershipKey(uiSourceOwnershipManifest.find((entry) => entry.sourceFile === 'src/features/auth/pages/LoginPage.tsx')!),
      asset: `synthetic-${asset}`,
    })
  })

  it('rejects a missing build instead of silently skipping bundle coverage', () => {
    expect(() => scanDistTextAssets(path.join(os.tmpdir(), 'phase-26-missing-dist'))).toThrow(/Missing frontend dist directory/)
  })

  it('scans every emitted text and source-map asset in the current production build', () => {
    const result = scanDistTextAssets()
    expect(result.assets).toContain('frontend/dist/index.html')
    expect(result.leaks).toEqual([])
  }, 30_000)
  })
}
