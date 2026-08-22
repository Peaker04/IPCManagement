import { createHash } from 'node:crypto'

export type CanonicalIdentity = {
  project: string
  normalizedSpecPath: string
  canonicalTitle: string
  snapshotName: string
  viewport: { width: number; height: number }
}

export type StructuredResult = CanonicalIdentity & {
  status: 'passed' | 'failed'
  failureKind?: 'screenshot-mismatch' | 'nonvisual'
  attachments: { name: string; path?: string; contentType: string }[]
}

export const canonicalJson = (value: unknown): string => JSON.stringify(value, Object.keys(value as object).sort())
export const sha256 = (value: string | Buffer): string => createHash('sha256').update(value).digest('hex')

const key = (x: Pick<CanonicalIdentity, 'project'|'normalizedSpecPath'|'canonicalTitle'|'snapshotName'>) =>
  [x.project, x.normalizedSpecPath, x.canonicalTitle, x.snapshotName].join('\u0000')

export function hashGoldenManifest(rows: CanonicalIdentity[]): string {
  const ordered = [...rows].sort((a,b) => key(a).localeCompare(key(b)))
  return sha256(JSON.stringify(ordered))
}

export function classifyExpectedVisualMismatches(results: StructuredResult[], golden: CanonicalIdentity[]) {
  if (golden.length !== 21) throw new Error(`golden identity count ${golden.length}, expected 21`)
  const expected = new Map(golden.map(row => [key(row), row]))
  if (expected.size !== golden.length) throw new Error('duplicate golden identity')
  const failures = results.filter(row => row.status === 'failed')
  if (failures.length !== 21) throw new Error(`failure count ${failures.length}, expected 21`)
  const seen = new Set<string>()
  for (const failure of failures) {
    if (failure.failureKind !== 'screenshot-mismatch') throw new Error(`nonvisual failure: ${failure.canonicalTitle}`)
    const identityKey = key(failure)
    const match = expected.get(identityKey)
    if (!match) throw new Error(`unexpected identity: ${failure.canonicalTitle}`)
    if (seen.has(identityKey)) throw new Error(`duplicate result identity: ${failure.canonicalTitle}`)
    seen.add(identityKey)
    if (failure.viewport.width !== match.viewport.width || failure.viewport.height !== match.viewport.height)
      throw new Error(`viewport metadata mismatch: ${failure.canonicalTitle}`)
    for (const suffix of ['-expected.png','-actual.png','-diff.png']) {
      if (!failure.attachments.some(a => a.name === failure.snapshotName.replace('-expected.png', suffix)))
        throw new Error(`missing ${suffix} attachment: ${failure.canonicalTitle}`)
    }
    if (!failure.attachments.some(a => a.name === 'error-context') || !failure.attachments.some(a => a.name === 'trace'))
      throw new Error(`missing diagnostic attachment: ${failure.canonicalTitle}`)
  }
  if (seen.size !== expected.size) throw new Error('missing expected failure')
  return [...seen].sort()
}
