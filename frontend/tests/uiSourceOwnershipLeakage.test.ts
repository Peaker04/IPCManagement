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

type SourcePathMatcherNode = {
  transitions: Map<string, number>
  failure: number
  outputs: string[]
}

type CompiledSourcePathMatcher = {
  nodes: SourcePathMatcherNode[]
  variants: readonly SourcePathVariant[]
}

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

const compileSourcePathMatcher = (variants: readonly SourcePathVariant[]): CompiledSourcePathMatcher => {
  const nodes: SourcePathMatcherNode[] = [{ transitions: new Map(), failure: 0, outputs: [] }]
  for (const value of new Set(variants.map((variant) => variant.value))) {
    let state = 0
    for (const character of value) {
      const existing = nodes[state].transitions.get(character)
      if (existing !== undefined) {
        state = existing
        continue
      }
      const nextState = nodes.push({ transitions: new Map(), failure: 0, outputs: [] }) - 1
      nodes[state].transitions.set(character, nextState)
      state = nextState
    }
    nodes[state].outputs.push(value)
  }

  const queue = [...nodes[0].transitions.values()]
  for (let index = 0; index < queue.length; index += 1) {
    const state = queue[index]
    for (const [character, target] of nodes[state].transitions) {
      queue.push(target)
      let fallback = nodes[state].failure
      while (fallback !== 0 && !nodes[fallback].transitions.has(character)) fallback = nodes[fallback].failure
      nodes[target].failure = nodes[fallback].transitions.get(character) ?? 0
      nodes[target].outputs.push(...nodes[nodes[target].failure].outputs)
    }
  }
  return { nodes, variants }
}

const scanTextWithMatcher = (text: string, asset: string, matcher: CompiledSourcePathMatcher): SourcePathLeak[] => {
  const matchedValues = new Set<string>()
  let state = 0
  for (const character of text) {
    while (state !== 0 && !matcher.nodes[state].transitions.has(character)) state = matcher.nodes[state].failure
    state = matcher.nodes[state].transitions.get(character) ?? 0
    for (const value of matcher.nodes[state].outputs) matchedValues.add(value)
  }
  return matcher.variants
    .filter((variant) => matchedValues.has(variant.value))
    .map((variant) => ({ ...variant, asset }))
}

export const scanTextForSourcePathLeaks = (
  text: string,
  asset: string,
  variants: readonly SourcePathVariant[] = buildManifestPathVariants(),
): SourcePathLeak[] => scanTextWithMatcher(text, asset, compileSourcePathMatcher(variants))

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
  const matcher = compileSourcePathMatcher(variants)
  const leaks = assets.flatMap((file) => scanTextWithMatcher(
    fs.readFileSync(file, 'utf8'),
    path.relative(repositoryRoot, file).replaceAll('\\', '/'),
    matcher,
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

  it('preserves variant order and distinct ownership rows for overlapping and duplicate matcher values', () => {
    const variants: SourcePathVariant[] = [
      { ownershipKey: 'owner-a', sourceFile: 'src/example.ts', kind: 'repository-relative', value: 'frontend/src/example.ts' },
      { ownershipKey: 'owner-a', sourceFile: 'src/example.ts', kind: 'frontend-relative', value: 'src/example.ts' },
      { ownershipKey: 'owner-b', sourceFile: 'src/example.ts', kind: 'frontend-relative', value: 'src/example.ts' },
    ]
    expect(scanTextForSourcePathLeaks('prefix frontend/src/example.ts suffix', 'synthetic-overlap', variants)).toEqual(
      variants.map((variant) => ({ ...variant, asset: 'synthetic-overlap' })),
    )
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
