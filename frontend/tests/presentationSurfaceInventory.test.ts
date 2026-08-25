import { createHash } from 'node:crypto'
import fs from 'node:fs'
import path from 'node:path'
import { describe, expect, it } from 'vitest'

type SurfaceCount = { path: string; tables: number; dialogs: number; switchers: number }

const frontendRoot = path.resolve(import.meta.dirname, '..')
const sourceRoot = path.join(frontendRoot, 'src')
const tableStylesPath = path.join(sourceRoot, 'styles/components/tables.css')
const tablePrimitivePath = path.join(sourceRoot, 'components/ui/table.tsx')

const productionTsxFiles = () => fs.readdirSync(sourceRoot, { recursive: true, withFileTypes: true })
  .filter((entry) => entry.isFile() && entry.name.endsWith('.tsx') && !/\.(?:test|spec)\.tsx$/.test(entry.name))
  .map((entry) => path.join(entry.parentPath, entry.name))

export const discoverPresentationSurfaces = (): SurfaceCount[] => productionTsxFiles().flatMap((file) => {
  const source = fs.readFileSync(file, 'utf8')
  const count = (pattern: RegExp) => [...source.matchAll(pattern)].length
  const item = {
    path: path.relative(frontendRoot, file).replaceAll('\\', '/'),
    tables: count(/<table(?:\s|>)/g),
    dialogs: count(/<(?:DialogContent|ConfirmDialog)(?:\s|>)/g),
    switchers: count(/<(?:ViewSwitcher|Tabs)(?:\s|>)/g),
  }
  return item.tables + item.dialogs + item.switchers > 0 ? [item] : []
}).sort((left, right) => left.path.localeCompare(right.path))

const fingerprint = (items: readonly SurfaceCount[]) => createHash('sha256')
  .update(items.map(({ path: owner, tables, dialogs, switchers }) => `${owner}|${tables}|${dialogs}|${switchers}`).join('\n'))
  .digest('hex')

describe('project-wide presentation surface inventory', () => {
  it('count-locks every production table, dialog and tab owner', () => {
    const items = discoverPresentationSurfaces()
    expect({
      owners: items.length,
      tables: items.reduce((sum, item) => sum + item.tables, 0),
      dialogs: items.reduce((sum, item) => sum + item.dialogs, 0),
      switchers: items.reduce((sum, item) => sum + item.switchers, 0),
      fingerprint: fingerprint(items),
    }).toEqual({
      owners: 55,
      tables: 50,
      dialogs: 34,
      switchers: 7,
      fingerprint: '68642fb8ca56fb439f0dd44bade109258a7c84eeb8f7b12711b5a036c0a3d1c3',
    })
  })

  it('count-locks route, drawer and action owners without runtime-instance duplication', () => {
    const files = productionTsxFiles()
    const sourceCounts = (pattern: RegExp) => files.map((file) => ({
      path: path.relative(frontendRoot, file).replaceAll('\\', '/'),
      count: [...fs.readFileSync(file, 'utf8').matchAll(pattern)].length,
    })).filter(({ count }) => count > 0)
    const actions = sourceCounts(/<(?:Button|button)(?:\s|>)/g)
    const drawers = sourceCounts(/<(?:DrawerContent|SheetContent)(?:\s|>)/g)
    const router = fs.readFileSync(path.join(sourceRoot, 'routes/AppRouter.tsx'), 'utf8')
    expect({
      routeOwners: 1,
      routes: [...router.matchAll(/<Route path=/g)].length,
      actionOwners: actions.length,
      actions: actions.reduce((sum, item) => sum + item.count, 0),
      drawerOwners: drawers.length,
      drawers: drawers.reduce((sum, item) => sum + item.count, 0),
    }).toEqual({ routeOwners: 1, routes: 14, actionOwners: 70, actions: 243, drawerOwners: 0, drawers: 0 })
  })

  it('keeps document reload out of production UI', () => {
    const offenders = productionTsxFiles().filter((file) => /(?:location\.reload|navigate\(\s*0\s*\))/.test(fs.readFileSync(file, 'utf8')))
    expect(offenders).toEqual([])
  })

  it('keeps the fixed-layout contract on every operational data table', () => {
    const tableStyles = fs.readFileSync(tableStylesPath, 'utf8')
    const tablePrimitive = fs.readFileSync(tablePrimitivePath, 'utf8')
    const dataTableRule = tableStyles.match(/\.ipc-data-table\s*\{(?<body>[\s\S]*?)\}/)?.groups?.body ?? ''
    expect(dataTableRule).toMatch(/table-layout:\s*fixed/)
    expect(tableStyles).not.toMatch(/table-layout:\s*auto/)
    expect(tablePrimitive).toContain('w-full table-fixed caption-bottom')

    const unownedTables = productionTsxFiles().flatMap((file) => {
      const source = fs.readFileSync(file, 'utf8')
      return [...source.matchAll(/<table(?<attributes>[\s\S]*?)>/g)]
        .filter((match) => !/ipc-data-table|data-slot=["']table["']/.test(match.groups?.attributes ?? ''))
        .map(() => path.relative(frontendRoot, file).replaceAll('\\', '/'))
    })
    expect(unownedTables).toEqual([])
  })

  it('keeps the Reports price exception work area mounted across query phases', () => {
    const source = fs.readFileSync(path.join(sourceRoot, 'features/reports/pages/ReportsPricePanel.tsx'), 'utf8')
    expect(source).toContain("priceSubView === 'lines' && (")
    expect(source).not.toContain("priceSubView === 'lines' && activePriceView.phase === 'ready'")
    expect(source).toContain("items={activePriceView.phase === 'ready' ? warningQueue : []}")
  })

  it('proves the inventory detector catches unreviewed surface growth', () => {
    const baseline = discoverPresentationSurfaces()
    expect(fingerprint([...baseline, { path: 'src/NewSurface.tsx', tables: 1, dialogs: 0, switchers: 0 }]))
      .not.toBe(fingerprint(baseline))
  })
})
