import { readFileSync, readdirSync } from 'node:fs'
import { join, relative } from 'node:path'
import * as ts from 'typescript'
import { describe, expect, it } from 'vitest'
import {
  queryBoundaryAdapterCalls,
  queryBoundaryExceptions,
  type QueryBoundaryException,
} from './queryBoundaryInventory'

type QueryOwnerSource = { path: string; source: string; hookNames: readonly string[] }

const normalizePath = (value: string) => value.replaceAll('\\', '/')

const sourceFiles = (root: string): string[] => readdirSync(root, { withFileTypes: true }).flatMap((entry) => {
  const path = join(root, entry.name)
  if (entry.isDirectory()) return sourceFiles(path)
  if (!/\.(ts|tsx)$/.test(entry.name) || /\.(test|spec)\./.test(entry.name)) return []
  return [path]
})

const queryHookCalls = (source: string, path: string) => {
  const parsed = ts.createSourceFile(path, source, ts.ScriptTarget.Latest, true, path.endsWith('x') ? ts.ScriptKind.TSX : ts.ScriptKind.TS)
  const calls = new Set<string>()
  const visit = (node: ts.Node) => {
    if (ts.isCallExpression(node) && ts.isIdentifier(node.expression) && /^use[A-Z][A-Za-z0-9]*Query$/.test(node.expression.text)) {
      calls.add(node.expression.text)
    }
    ts.forEachChild(node, visit)
  }
  visit(parsed)
  return [...calls].sort()
}

const discoverQueryOwners = (): QueryOwnerSource[] => {
  const root = join(process.cwd(), 'src')
  return sourceFiles(root).flatMap((path) => {
    const source = readFileSync(path, 'utf8')
    const hookNames = queryHookCalls(source, path)
    return hookNames.length === 0 ? [] : [{ path: normalizePath(relative(process.cwd(), path)), source, hookNames }]
  }).sort((left, right) => left.path.localeCompare(right.path))
}

const classifyOwners = (
  owners: readonly QueryOwnerSource[],
  exceptions: Readonly<Record<string, QueryBoundaryException>>,
) => {
  const discovered = new Set(owners.map(({ path }) => path))
  const staleExceptions = Object.keys(exceptions).filter((path) => !discovered.has(path)).sort()
  const uncovered = owners.filter(({ path, source }) => {
    if (exceptions[path]) return false
    return !queryBoundaryAdapterCalls.some((adapter) => source.includes(`${adapter}(`))
  }).map(({ path, hookNames }) => `${path}: ${hookNames.join(', ')}`)
  return { staleExceptions, uncovered }
}

describe('production query boundary inventory', () => {
  it('classifies every source-discovered query owner without stale exceptions', () => {
    const owners = discoverQueryOwners()
    const result = classifyOwners(owners, queryBoundaryExceptions)

    expect(result.staleExceptions).toEqual([])
    expect(result.uncovered).toEqual([])
    expect(new Set(owners.map(({ path }) => path)).size).toBe(owners.length)
  })

  it('keeps every specialized exception reasoned and source-anchored', () => {
    const owners = new Map(discoverQueryOwners().map((owner) => [owner.path, owner]))
    for (const [path, exception] of Object.entries(queryBoundaryExceptions)) {
      expect(exception.rationale.length, `${path} needs a concrete rationale`).toBeGreaterThan(50)
      expect(exception.requiredMarkers.length, `${path} needs source markers`).toBeGreaterThan(1)
      const source = owners.get(path)?.source ?? ''
      for (const marker of exception.requiredMarkers) {
        expect(source, `${path} exception marker drifted: ${marker}`).toContain(marker)
      }
    }
  })

  it('reports a new unadapted owner and a stale exception by exact path', () => {
    const synthetic = [{ path: 'src/features/example/useLegacy.ts', source: 'useGetLegacyQuery()', hookNames: ['useGetLegacyQuery'] }]
    expect(classifyOwners(synthetic, {}).uncovered).toEqual([
      'src/features/example/useLegacy.ts: useGetLegacyQuery',
    ])
    expect(classifyOwners([], {
      'src/features/removed.ts': { rationale: 'Removed source', requiredMarkers: ['removed'] },
    }).staleExceptions).toEqual(['src/features/removed.ts'])
  })
})
