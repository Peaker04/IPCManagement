import { describe, expect, it } from 'vitest'
import approvalQueue from '@/components/common/ApprovalQueue.tsx?raw'
import materialChecklist from '@/features/chef/components/material-checklist.tsx?raw'
import amendmentInbox from '@/features/approvals/components/MenuAmendmentInbox.tsx?raw'
import receiptLifecycle from '@/features/warehouse/WarehouseReceiptLifecyclePanel.tsx?raw'

const attributeValues = (source: string, tag: string, attribute: string) =>
  [...source.matchAll(new RegExp(`<${tag}\\b[^>]*\\b${attribute}\\s*=\\s*["']([^"']+)["'][^>]*>`, 'g'))]
    .map((match) => match[1])

const rawHeadersWithoutColumnScope = (source: string) =>
  [...source.matchAll(/<th\b[^>]*>/g)]
    .map((match) => match[0])
    .filter((tag) => !/\bscope\s*=\s*(?:["']col["']|\{\s*["']col["']\s*\})/.test(tag))

describe('table accessibility ownership', () => {
  it.each([
    [approvalQueue, 'Danh sách chứng từ cần duyệt', 'Bảng chứng từ cần duyệt', 'table'],
    [materialChecklist, 'Checklist ký nhận nguyên liệu bếp', 'Bảng ký nhận nguyên liệu bếp', 'Table'],
  ])('gives the viewport and nested table distinct accessible names', (source, viewportName, tableName, tableTag) => {
    expect(attributeValues(source, 'TableViewport', 'ariaLabel')).toContain(viewportName)
    expect(attributeValues(source, tableTag, 'aria-label')).toContain(tableName)
    expect(tableName).not.toBe(viewportName)
  })

  it('gives every raw column header an explicit scope regardless of attribute order', () => {
    expect(rawHeadersWithoutColumnScope(amendmentInbox)).toEqual([])
    expect(rawHeadersWithoutColumnScope(receiptLifecycle)).toEqual([])
  })
})
