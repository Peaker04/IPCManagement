import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { describe, expect, it } from 'vitest'
import mainSource from '@/main.tsx?raw'

const indexStyles = readFileSync(resolve(process.cwd(), 'src/styles/index.css'), 'utf8')
const tableStyles = readFileSync(resolve(process.cwd(), 'src/styles/components/tables.css'), 'utf8')
const responsiveStyles = readFileSync(resolve(process.cwd(), 'src/styles/components/responsive.css'), 'utf8')
const weeklyReadinessSource = readFileSync(resolve(process.cwd(), 'src/features/projects/weekly-menu/shell/WeeklyMenuReadiness.tsx'), 'utf8')
const importedLayoutMatrixSource = readFileSync(resolve(process.cwd(), 'src/features/projects/components/ImportedLayoutMatrix.tsx'), 'utf8')

const allowedGlobalStyles = [
  './styles/index.css',
  './styles/components/dashboard.css',
  './styles/components/tables.css',
  './styles/components/shell.css',
  './styles/components/operations.css',
  './styles/components/documents.css',
  './styles/components/domain-pages.css',
  './styles/components/responsive.css',
]

describe('design authority implementation inventory', () => {
  it('keeps one explicit global stylesheet entry list with zero deprecated redesign layers', () => {
    const imports = [...mainSource.matchAll(/import '([^']+\.css)'/g)].map((match) => match[1])
    expect(imports).toEqual(allowedGlobalStyles)
  })

  it('keeps shared data-table geometry in the table stylesheet only', () => {
    expect(indexStyles).not.toMatch(/\.ipc-data-table/)
    expect(responsiveStyles).not.toMatch(/\.ipc-data-table/)
    expect(tableStyles).toContain('.ipc-data-table {')
    expect(tableStyles).toContain('.ipc-data-table th {')
    expect(tableStyles).toContain('.ipc-data-table td {')
    expect(tableStyles).toContain('transition: background-color var(--ipc-transition-fast)')
  })

  it('preserves weekly schedule and matrix table class semantics', () => {
    expect(weeklyReadinessSource).toContain('ipc-weekly-readiness-strip')
    expect(importedLayoutMatrixSource).toContain('className="ipc-data-table ipc-matrix-grid-table')
  })

  it('prevents any redesign or override layer from existing or becoming a silent authority', () => {
    const styles = import.meta.glob('./styles/**/*.css', { eager: true, query: '?raw', import: 'default' })
    const redesignFiles = Object.keys(styles)
      .map((path) => path.replace(/^\.\//, './'))
      .filter((path) => path.includes('/redesign/') || path.endsWith('/ui-redesign.css'))
      .sort()
    expect(redesignFiles).toEqual([])
  })
})
