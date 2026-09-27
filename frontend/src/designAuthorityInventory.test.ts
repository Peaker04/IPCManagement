import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { describe, expect, it } from 'vitest'
import mainSource from '@/main.tsx?raw'

const indexStyles = readFileSync(resolve(process.cwd(), 'src/styles/index.css'), 'utf8')
const tableStyles = readFileSync(resolve(process.cwd(), 'src/styles/components/tables.css'), 'utf8')
const responsiveStyles = readFileSync(resolve(process.cwd(), 'src/styles/components/responsive.css'), 'utf8')
const redesignResponsiveStyles = readFileSync(resolve(process.cwd(), 'src/styles/redesign/responsive.css'), 'utf8')
const uiRedesignStyles = readFileSync(resolve(process.cwd(), 'src/styles/ui-redesign.css'), 'utf8')
const fioriStyles = readFileSync(resolve(process.cwd(), 'src/styles/redesign/fiori.css'), 'utf8')
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
  './styles/ui-redesign.css',
  './styles/redesign/fiori.css',
  './styles/redesign/demand.css',
  './styles/redesign/responsive.css',
  './styles/redesign/dashboard.css',
]

describe('design authority implementation inventory', () => {
  it('keeps one explicit global stylesheet entry list during migration', () => {
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

  it('keeps shared viewport base and sticky geometry out of redesign responsive overrides', () => {
    expect(redesignResponsiveStyles).not.toMatch(/\.ipc-table-viewport\s*\{/)
    expect(redesignResponsiveStyles).not.toMatch(/\.ipc-table-viewport thead th\s*\{/)
    expect(redesignResponsiveStyles).not.toContain('.ipc-table-viewport.ipc-weekly-menu-shell--viewport-fill')
    expect(redesignResponsiveStyles).toContain('.ipc-table-viewport[data-vertical-scroll="bounded"]')
  })

  it('keeps only live redesign table-width specializations', () => {
    expect(redesignResponsiveStyles).not.toContain('.ipc-redesign-shell .ipc-table-container > .ipc-table')
    expect(redesignResponsiveStyles).toContain('.ipc-redesign-shell .ipc-warehouse-table-shell > .ipc-data-table')
  })

  it('removes the orphan approval action alias while retaining live action owners', () => {
    expect(redesignResponsiveStyles).not.toContain('.ipc-approval-actions')
    expect(redesignResponsiveStyles).toContain('.ipc-warehouse-actions')
    expect(redesignResponsiveStyles).toContain('.ipc-purchasing-actions')
  })

  it('removes superseded weekly schedule and readiness redesign selectors', () => {
    for (const orphanClass of ['ipc-schedule-table', 'ipc-weekly-readiness', 'ipc-weekly-readiness-summary', 'ipc-weekly-readiness-checkpoints', 'ipc-weekly-readiness-checkpoint']) {
      expect(uiRedesignStyles).not.toContain(`.${orphanClass}`)
    }
    expect(weeklyReadinessSource).toContain('ipc-weekly-readiness-strip')
    expect(importedLayoutMatrixSource).toContain("className=\"ipc-data-table ipc-matrix-grid-table")
  })

  it('removes orphan Fiori compatibility selectors without deleting live semantic owners', () => {
    for (const orphanClass of ['ipc-input', 'ipc-select', 'ipc-inline-status', 'ipc-table-shell', 'ipc-cost-table']) {
      expect(fioriStyles).not.toContain(`.${orphanClass}`)
    }
    expect(fioriStyles).toContain('.ipc-fiori-object-card .ipc-data-table')
    expect(fioriStyles).toContain('.ipc-fiori-disclosure .ipc-data-table')
  })

  it('prevents another redesign override layer from becoming a silent authority', () => {
    const styles = import.meta.glob('./styles/**/*.css', { eager: true, query: '?raw', import: 'default' })
    const redesignFiles = Object.keys(styles)
      .map((path) => path.replace(/^\.\//, './'))
      .filter((path) => path.includes('/redesign/') || path.endsWith('/ui-redesign.css'))
      .sort()
    expect(redesignFiles).toEqual(allowedGlobalStyles.filter((path) => path.includes('/redesign/') || path.endsWith('/ui-redesign.css')).sort())
  })
})
