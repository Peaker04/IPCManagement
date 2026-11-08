import { realpathSync } from 'node:fs'
import { resolve } from 'node:path'
import { describe, expect, it } from 'vitest'
import { canonicalPotentialPath } from './canonicalPotentialPath'

describe('canonicalPotentialPath', () => {
  it('canonicalizes the nearest existing ancestor while preserving absent leaves', () => {
    expect(canonicalPotentialPath(resolve(__dirname, 'missing-output', 'run.json')))
      .toBe(resolve(realpathSync(__dirname), 'missing-output', 'run.json'))
  })
})
