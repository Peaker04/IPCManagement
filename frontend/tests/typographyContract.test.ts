import { existsSync, readFileSync, readdirSync } from 'node:fs'
import { extname, relative, resolve } from 'node:path'
import { describe, expect, it } from 'vitest'
import { typography } from '../src/lib/typography'

const projectRoot = process.cwd()
const sourceRoot = resolve(projectRoot, 'src')

const readSource = (path: string) => readFileSync(resolve(projectRoot, path), 'utf8')

const sourceFiles = (directory: string): string[] => readdirSync(directory, { withFileTypes: true })
  .flatMap((entry) => {
    const path = resolve(directory, entry.name)
    return entry.isDirectory() ? sourceFiles(path) : [path]
  })
  .filter((path) => ['.css', '.ts', '.tsx'].includes(extname(path)))

const arbitrarySizeAllowlist: Readonly<Record<string, string>> = {
  'src/components/ui/toggle.tsx': 'shadcn size variant geometry',
  'src/features/purchasing/pages/PurchasingPage.tsx': '20px local workbench display heading has no matching shared role',
}

const semanticWeightOverrideAllowlist: Readonly<Record<string, string>> = {
  'src/app/pages/admin-data/AdminAuditPanel.tsx': 'audit new value remains bold while code role owns family and metrics',
  'src/app/pages/admin-data/AdminContractsPanel.tsx': 'contract labels retain the established strong form hierarchy',
  'src/components/common/ContextStrip.tsx': 'context label/value contrast is a component-level hierarchy contract',
  'src/components/common/EmptyState.tsx': 'empty-state title remains emphasized within the body role',
  'src/components/common/StockMovementTable.tsx': 'movement identifiers and quantities retain compact table emphasis',
  'src/components/ui/input.tsx': 'file input text has its own nested control emphasis',
  'src/features/chef/components/chef-header.tsx': 'headline date and meal total retain dashboard emphasis',
  'src/features/chef/components/material-checklist.tsx': 'received quantities retain checklist emphasis',
  'src/features/chef/components/operational-actions.tsx': 'action metadata retains its established emphasis',
  'src/features/coordination/components/header-info.tsx': 'countdown remains bold for cutoff salience',
  'src/features/projects/weekly-menu/demand/MaterialDemandSection.tsx': 'approval document code retains compact emphasis',
  'src/features/projects/weekly-menu/schedule/WeeklyScheduleEditorDialog.tsx': 'locked-slot caption keeps emphasis within the compact weekly editor',
  'src/features/purchasing/PurchaseDecisionPanel.tsx': 'decision values retain their existing emphasis',
  'src/features/purchasing/PurchaseWorkflowGuide.tsx': 'workflow stage labels retain compact emphasis',
  'src/features/reports/pages/ReportsPricePanel.tsx': 'report price annotations retain existing emphasis',
  'src/features/warehouse/WarehouseReceiptLifecyclePanel.tsx': 'receipt code remains emphasized within the code role',
}

const featureRoleContracts: Readonly<Record<string, readonly string[]>> = {
  'src/features/projects/pages/WeeklyMenuPage.tsx': ['typography.body'],
  'src/features/projects/weekly-menu/import/WeeklyMenuImportJobs.tsx': ['typography.body', 'typography.sectionTitle', 'typography.numeric'],
  'src/features/projects/weekly-menu/demand/MaterialDemandSection.tsx': ['typography.code'],
  'src/components/common/ApprovalQueue.tsx': ['typography.body', 'typography.sectionTitle', 'typography.code', 'typography.numeric'],
  'src/features/warehouse/pages/WarehousePage.tsx': ['typography.body'],
  'src/features/warehouse/WarehouseReceiptLifecyclePanel.tsx': ['typography.body', 'typography.sectionTitle', 'typography.caption', 'typography.code'],
  'src/features/chef/pages/ChefDashboardPage.tsx': ['typography.body'],
  'src/features/chef/components/chef-header.tsx': ['typography.body', 'typography.label', 'typography.numeric'],
  'src/features/chef/components/material-checklist.tsx': ['typography.body', 'typography.code', 'typography.numeric'],
  'src/features/chef/journal/ChefDocumentsSection.tsx': ['typography.body'],
  'src/features/reports/pages/ReportsPage.tsx': ['typography.body', 'typography.code'],
  'src/features/reports/pages/ReportsDataQualityPanel.tsx': ['typography.label', 'typography.caption'],
  'src/app/pages/admin-data/AdminAuditPanel.tsx': ['typography.code'],
}

describe('typography contract', () => {
  it('owns font families through IPC primitives without self-reference', () => {
    const css = readSource('src/styles/index.css')
    const html = readSource('index.html')
    const packageJson = readSource('package.json')

    expect(css.match(/@font-face/g)).toHaveLength(3)
    expect(css).toContain('inter-vietnamese-standard-normal.woff2')
    expect(css).toContain('inter-latin-ext-standard-normal.woff2')
    expect(css).toContain('inter-latin-standard-normal.woff2')
    expect(packageJson).toContain('"@fontsource-variable/inter"')
    expect(css).toContain('--ipc-font-sans:')
    expect(css).toContain('--ipc-font-mono:')
    expect(css).toContain('--font-sans: var(--ipc-font-sans)')
    expect(css).toContain('--font-heading: var(--ipc-font-sans)')
    expect(css).toContain('--font-mono: var(--ipc-font-mono)')
    expect(css).not.toMatch(/--([\w-]+):\s*var\(--\1\)/)
    expect(html).not.toContain('fonts.googleapis.com')
    expect(html).not.toContain('fonts.gstatic.com')
  })

  it('defines the locked semantic type scale and companion values', () => {
    const css = readSource('src/styles/index.css')
    const roles = ['page-title', 'section-title', 'body', 'label', 'caption', 'code']

    for (const role of roles) {
      expect(css).toContain(`--text-${role}:`)
      expect(css).toContain(`--text-${role}--line-height:`)
      expect(css).toContain(`--text-${role}--font-weight:`)
    }
  })

  it('defines component typography tokens without widening the public helper', () => {
    const css = readSource('src/styles/index.css')
    const componentRoles = [
      'button', 'button-compact', 'input', 'input-compact', 'badge',
      'card', 'card-title', 'card-title-compact', 'table', 'table-header',
    ]

    for (const role of componentRoles) {
      expect(css).toContain(`--text-${role}:`)
      expect(css).toContain(`--text-${role}--line-height:`)
      expect(css).toContain(`--text-${role}--font-weight:`)
    }
    expect(Object.keys(typography)).toEqual(['pageTitle', 'sectionTitle', 'body', 'label', 'caption', 'code', 'numeric'])
  })

  it('locks the helper to static semantic role classes', () => {
    const helperPath = resolve(sourceRoot, 'lib/typography.ts')
    expect(existsSync(helperPath)).toBe(true)
    if (!existsSync(helperPath)) return

    const helper = readFileSync(helperPath, 'utf8')
    expect(helper).toContain("pageTitle: 'font-heading text-page-title'")
    expect(helper).toContain("sectionTitle: 'font-heading text-section-title'")
    expect(helper).toContain("body: 'font-sans text-body'")
    expect(helper).toContain("label: 'font-sans text-label'")
    expect(helper).toContain("caption: 'font-sans text-caption'")
    expect(helper).toContain("code: 'font-mono text-code'")
    expect(helper).toContain("numeric: 'font-sans text-body tabular-nums'")
    expect(helper).toContain('export type TypographyRole = keyof typeof typography')
    expect(helper).not.toMatch(/(?:text|font|leading)-\$\{/)
    expect(typography).toEqual({
      pageTitle: 'font-heading text-page-title',
      sectionTitle: 'font-heading text-section-title',
      body: 'font-sans text-body',
      label: 'font-sans text-label',
      caption: 'font-sans text-caption',
      code: 'font-mono text-code',
      numeric: 'font-sans text-body tabular-nums',
    })
  })

  it('rejects dynamic Tailwind typography fragments', () => {
    const violations = sourceFiles(sourceRoot).flatMap((path) => {
      const source = readFileSync(path, 'utf8')
      return /(?:text|font|leading)-\$\{/.test(source)
        ? [relative(projectRoot, path).replaceAll('\\', '/')]
        : []
    })

    expect(violations).toEqual([])
  })

  it('keeps hard-coded font stacks inside the canonical owner', () => {
    const violations = sourceFiles(sourceRoot).flatMap((path) => {
      const source = readFileSync(path, 'utf8')
      const sourcePath = relative(projectRoot, path).replaceAll('\\', '/')
      if (sourcePath === 'src/styles/index.css') return []
      const declarations = source.match(/font-family\s*:[^;]+;/g) ?? []
      return declarations.some((declaration) => !/var\(--font-(?:sans|heading|mono)\)/.test(declaration))
        ? [sourcePath]
        : []
    })

    expect(violations).toEqual([])
  })

  it('routes every JSX monospace owner through the semantic code role', () => {
    const violations = sourceFiles(sourceRoot).flatMap((path) => {
      const sourcePath = relative(projectRoot, path).replaceAll('\\', '/')
      if (sourcePath === 'src/lib/typography.ts' || extname(path) === '.css') return []
      return readFileSync(path, 'utf8').includes('font-mono') ? [sourcePath] : []
    })

    expect(violations).toEqual([])
  })

  it('keeps typography as class data and leaves semantic HTML with callers', () => {
    const helper = readSource('src/lib/typography.ts')
    const wrapperNames = sourceFiles(sourceRoot)
      .map((path) => relative(sourceRoot, path).replaceAll('\\', '/'))
      .filter((path) => /(?:^|\/)(?:Text|Typography)\.tsx$/.test(path))

    expect(helper).not.toMatch(/(?:React|JSX|createElement|<\/?[A-Za-z])/)
    expect(wrapperNames).toEqual([])
    expect(readSource('src/components/common/SectionPanel.tsx')).toContain("const HeadingTag = `h${headingLevel}` as 'h2' | 'h3' | 'h4'")
    expect(readSource('src/components/common/ApprovalQueue.tsx')).toContain('<h4 className={typography.sectionTitle}>')
    expect(readSource('src/features/warehouse/WarehouseReceiptLifecyclePanel.tsx')).toContain('<h3 id="receipt-lifecycle-title"')
  })

  it('dispositions every semantic token weight override', () => {
    const semanticRole = /(?:typography\.[A-Za-z]+|text-(?:page-title|section-title|body|label|caption|code|button|button-compact|input|input-compact|badge|card|card-title|table|table-header))/
    const explicitWeight = /font-(?:normal|medium|semibold|bold|black)/
    const overridePaths = sourceFiles(sourceRoot).flatMap((path) => {
      if (extname(path) === '.css') return []
      const sourcePath = relative(projectRoot, path).replaceAll('\\', '/')
      const hasOverride = readFileSync(path, 'utf8').split(/\r?\n/)
        .some((line) => semanticRole.test(line) && explicitWeight.test(line))
      return hasOverride ? [sourcePath] : []
    })
    const unowned = overridePaths.filter((path) => !(path in semanticWeightOverrideAllowlist))
    const stale = Object.keys(semanticWeightOverrideAllowlist).filter((path) => !overridePaths.includes(path))

    expect(unowned).toEqual([])
    expect(stale).toEqual([])
  })

  it('locks representative feature waves to semantic roles', () => {
    for (const [path, roles] of Object.entries(featureRoleContracts)) {
      const source = readSource(path)
      for (const role of roles) expect(source, `${path} must use ${role}`).toContain(role)
    }
  })

  it('does not grow the documented arbitrary font-size baseline', () => {
    const occurrences = sourceFiles(sourceRoot)
      .filter((path) => !/\.(?:test|spec)\.[cm]?[jt]sx?$/.test(path))
      .flatMap((path) => {
      const source = readFileSync(path, 'utf8')
      const matches = source.match(/text-\[(?:\d+(?:\.\d+)?)(?:px|rem)\]/g) ?? []
      const sourcePath = relative(projectRoot, path).replaceAll('\\', '/')
      return matches.map((utility) => ({ sourcePath, utility }))
    })
    const unownedPaths = [...new Set(occurrences.map(({ sourcePath }) => sourcePath))]
      .filter((path) => !(path in arbitrarySizeAllowlist))
    const staleAllowlistPaths = Object.keys(arbitrarySizeAllowlist)
      .filter((path) => !occurrences.some(({ sourcePath }) => sourcePath === path))

    expect(unownedPaths).toEqual([])
    expect(staleAllowlistPaths).toEqual([])
    expect(occurrences.length).toBeLessThanOrEqual(29)
  })
})
