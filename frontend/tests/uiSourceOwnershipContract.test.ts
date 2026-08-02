import ts from 'typescript'
import { describe, expect, it } from 'vitest'
import { findProductionImportsFromTests, readProductionSources } from './uiCanonSourceInventory'
import {
  buildUiSourceOwnershipKey,
  compareUiSourceOwnershipSets,
  uiSourceOwnershipManifest,
  uiSourceOwnershipTargets,
  type UiSourceOwnershipManifestEntry,
} from './uiSourceOwnershipManifest'

const productionSources = readProductionSources()
const opaque = (value: string, prefix: string) => new RegExp(`^${prefix}-[a-z0-9]+$`).test(value)

const symbolDeclarations = (sourceFile: ts.SourceFile, symbol: string) => {
  const matches: ts.Node[] = []
  const visit = (node: ts.Node) => {
    const named = (ts.isFunctionDeclaration(node) || ts.isClassDeclaration(node) || ts.isVariableDeclaration(node)) && node.name && ts.isIdentifier(node.name) && node.name.text === symbol
    if (named) matches.push(node)
    ts.forEachChild(node, visit)
  }
  visit(sourceFile)
  return matches
}

const resolveManifestEntry = (entry: UiSourceOwnershipManifestEntry) => {
  const source = productionSources.find((item) => item.path === entry.sourceFile)
  if (!source) return false
  const declarations = symbolDeclarations(source.sourceFile, entry.sourceSymbol)
  if (declarations.length !== 1) return false
  const matches: ts.Node[] = []
  const visit = (node: ts.Node) => {
    if (entry.sourceFragment.kind === 'identifier' && ts.isIdentifier(node) && node.text === entry.sourceFragment.value) matches.push(node)
    ts.forEachChild(node, visit)
  }
  visit(declarations[0])
  return matches.length === 1
}

describe('Phase 26 source ownership manifest', () => {
  it('uses opaque non-semantic IDs and one root per scope', () => {
    expect(uiSourceOwnershipTargets).toHaveLength(new Set(uiSourceOwnershipTargets.map((entry) => entry.scopeKey)).size)
    uiSourceOwnershipTargets.forEach((entry) => {
      expect(opaque(entry.ownerId, 'uio')).toBe(true)
      expect(opaque(entry.regionId, 'uir')).toBe(true)
      expect(entry.parentRegionId).toBeNull()
      expect(entry.ownerId).not.toMatch(/route|src|\\|\//i)
      expect(entry.regionId).not.toMatch(/route|src|\\|\//i)
    })
  })

  it('resolves every manifest file, symbol, and fragment exactly once', () => {
    const resolutions = new Map(uiSourceOwnershipManifest.map((entry) => [buildUiSourceOwnershipKey(entry), resolveManifestEntry(entry)]))
    expect(compareUiSourceOwnershipSets(uiSourceOwnershipTargets, uiSourceOwnershipManifest, undefined, resolutions)).toEqual({ missing: [], duplicates: [], orphans: [], stale: [] })
  })

  it('reports missing, duplicate, orphan, and stale mappings by exact key', () => {
    const removed = uiSourceOwnershipManifest[0]
    expect(compareUiSourceOwnershipSets(uiSourceOwnershipTargets, uiSourceOwnershipManifest.slice(1)).missing).toEqual([buildUiSourceOwnershipKey(removed)])
    expect(compareUiSourceOwnershipSets(uiSourceOwnershipTargets, [...uiSourceOwnershipManifest, removed]).duplicates).toEqual([buildUiSourceOwnershipKey(removed)])
    const orphan = { ...removed, scopeKey: 'unknown-scope' as typeof removed.scopeKey }
    expect(compareUiSourceOwnershipSets(uiSourceOwnershipTargets, [orphan, ...uiSourceOwnershipManifest.slice(1)]).orphans).toEqual([buildUiSourceOwnershipKey(orphan)])
    const resolutions = new Map(uiSourceOwnershipManifest.map((entry) => [buildUiSourceOwnershipKey(entry), true]))
    resolutions.set(buildUiSourceOwnershipKey(removed), false)
    expect(compareUiSourceOwnershipSets(uiSourceOwnershipTargets, uiSourceOwnershipManifest, undefined, resolutions).stale).toEqual([buildUiSourceOwnershipKey(removed)])
  })

  it('rejects production imports of test-owned source knowledge', () => {
    expect(findProductionImportsFromTests(productionSources)).toEqual([])
  })
})
