import { existsSync, readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { describe, expect, it } from 'vitest'

const root = process.cwd()
const read = (file: string) => readFileSync(resolve(root, file), 'utf8')
const has = (file: string, pattern: RegExp | string) => pattern instanceof RegExp ? pattern.test(read(file)) : read(file).includes(pattern)

const findingIds = () => {
  const findings: string[] = []
  const login = read('src/features/auth/pages/LoginPage.tsx')
  if (/Fallback dev:|\badmin\/admin\b|\bquanly\/quanly\b/.test(login)) findings.push('COPY-01')

  const workflow = read('src/lib/workflowConfig.ts')
  const serviceRuns = read('src/features/reports/pages/ServiceRunReportPanel.tsx')
  if (!workflow.includes('getServiceRunStatusPresentation') || /label\[lifecycle\.status\]\s*\?\?\s*lifecycle\.status/.test(serviceRuns)) findings.push('STATUS-01')

  if (has('src/components/ui/button.tsx', /(?:bg|text)-(?:teal|amber|white)(?:-|\b)/)) findings.push('FOUND-01')
  if (!has('src/styles/index.css', '--ipc-color-text:')) findings.push('FOUND-02')
  if (has('src/styles/components/tables.css', /(?:color|background|border(?:-bottom)?):\s*#(?:[0-9a-f]{3}){1,2}/i)) findings.push('FOUND-03')
  if (has('src/styles/index.css', '--ipc-space-5: 18px')) findings.push('FOUND-04')
  if (!has('src/styles/index.css', /size-adjust:|ascent-override:|descent-override:|line-gap-override:/)) findings.push('FONT-01')
  if (!existsSync(resolve(root, 'scripts/check-route-budgets.mjs'))) findings.push('FOUND-05')

  const dialog = read('src/components/ui/dialog.tsx')
  if (!/size.*(?:sm|md|lg|full)/s.test(dialog) || !/max-h-|overflow-y-auto/.test(dialog)) findings.push('DIALOG-01')
  if (!/onClose.*reason|reason.*onClose/s.test(dialog)) findings.push('DIALOG-02')
  if (!/inert|focus.*return|return.*focus/s.test(dialog)) findings.push('DIALOG-03')
  if (!/aria-labelledby/.test(dialog)) findings.push('DIALOG-04')

  if (!has('src/styles/components/tables.css', 'ipc-table-sticky-identifier')) findings.push('TABLE-01')
  if (!has('src/components/common/TableViewport.tsx', 'data-table-viewport')) findings.push('TABLE-02')
  if (!has('src/components/common/DataTableShell.tsx', 'data-ui-table-shell')) findings.push('TABLE-03')
  if (!has('src/components/ui/table.tsx', 'scope="col"')) findings.push('TABLE-04')
  if (!has('src/components/common/StatusBadge.tsx', 'aria-live')) findings.push('STATUS-02')
  if (!has('src/components/common/StatusBadge.tsx', 'min-w-')) findings.push('STATUS-03')
  if (!has('src/components/ui/badge.tsx', 'status')) findings.push('STATUS-04')
  return findings
}

describe('dashboard UI rule contracts', () => {
  it('reports every in-scope gap with an exact requirement ID', () => {
    const found = findingIds()
    const expectedAuditGaps = [
      'FOUND-01', 'FOUND-02', 'FOUND-03', 'FOUND-04', 'FONT-01',
      'FOUND-05', 'DIALOG-01', 'DIALOG-02', 'DIALOG-03', 'DIALOG-04',
      'TABLE-01', 'TABLE-02', 'TABLE-03', 'TABLE-04', 'STATUS-02', 'STATUS-03', 'STATUS-04',
    ]
    expect(found).toEqual(process.env.IPC_DASHBOARD_RULES_EXPECT_GAPS === '1' ? expectedAuditGaps : [])
  })
})
