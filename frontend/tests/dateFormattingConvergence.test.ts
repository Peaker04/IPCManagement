import fs from 'node:fs'
import path from 'node:path'
import { describe, expect, it } from 'vitest'
import {
  findDatePresentationCalls,
  findMethodCalls,
  findingLocations,
  readProductionSources,
} from './uiCanonSourceInventory'

const production = readProductionSources()

describe('date formatting convergence', () => {
  it('has no raw date presentation outside the shared formatter and shell clock', () => {
    const residuals = findDatePresentationCalls(production).filter(({ path: sourcePath }) => ![
      'src/app/layout/MainLayout.tsx',
      'src/lib/formatters.ts',
    ].includes(sourcePath))

    expect(findingLocations(residuals)).toEqual([])
    expect(findMethodCalls(production, 'toLocaleDateString')).toEqual([])
    expect(findMethodCalls(production, 'toLocaleTimeString')).toEqual([])
    expect(findingLocations(findMethodCalls(production, 'toLocaleString'))).toEqual([
      'src/features/projects/weekly-menu/model/formatters.ts:111',
      'src/features/projects/weekly-menu/model/formatters.ts:112',
      'src/lib/formatters.ts:47',
    ])
  })

  it('keeps formatImportDate as a direct compatibility wrapper', () => {
    const wrapperPath = path.resolve(import.meta.dirname, '../src/features/projects/weekly-menu/model/formatters.ts')
    const source = fs.readFileSync(wrapperPath, 'utf8')
    const wrapperStart = source.indexOf('export const formatImportDate')
    const wrapperEnd = source.indexOf('export const formatFileSize')
    const wrapper = source.slice(wrapperStart, wrapperEnd)

    expect(wrapper).toContain('formatDateOnly(value)')
    expect(wrapper).not.toMatch(/new Date|toLocaleDateString/)
  })
})
