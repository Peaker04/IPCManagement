import { existsSync, realpathSync } from 'node:fs'
import { basename, dirname, resolve } from 'node:path'

export function canonicalPotentialPath(path: string) {
  let existing = resolve(path)
  const missing: string[] = []

  while (!existsSync(existing)) {
    const parent = dirname(existing)
    if (parent === existing) throw new Error(`No existing ancestor for path: ${path}`)
    missing.unshift(basename(existing))
    existing = parent
  }

  return resolve(realpathSync(existing), ...missing)
}
