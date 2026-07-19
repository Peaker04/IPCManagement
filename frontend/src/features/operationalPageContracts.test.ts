import { readFile } from 'node:fs/promises'
import path from 'node:path'
import { describe, expect, it } from 'vitest'
import { ROUTES } from '@/routes/routeConfig'

const readFrontendSource = (relativePath: string) =>
  readFile(path.resolve(process.cwd(), 'src', relativePath), 'utf8')

describe('operational page refactor contracts', () => {
  it('keeps the three MVP workflows on their existing routes', () => {
    expect(ROUTES.WEEKLY_MENU).toBe('/weekly-menu')
    expect(ROUTES.PURCHASING).toBe('/purchasing')
    expect(ROUTES.CHEF_DASHBOARD).toBe('/chef-dashboard')
  })

  it('keeps weekly menu import, demand and schedule actions wired to real APIs', async () => {
    const source = await readFrontendSource('features/projects/pages/WeeklyMenuPage.tsx')

    expect(source).toContain('usePreviewWeeklyMenuImportMutation')
    expect(source).toContain('useCommitWeeklyMenuImportMutation')
    expect(source).toContain('useGenerateMaterialDemandMutation')
    expect(source).toContain('useUpdateWeeklyMenuBulkMutation')
    expect(source).toContain('Nhập Excel')
    expect(source).toContain("{ id: 'demand', label: 'Nhu cầu' }")
  })

  it('keeps purchasing paging and purchase mutations wired to real APIs', async () => {
    const source = await readFrontendSource('features/workflow/pages/PurchasingPage.tsx')

    expect(source).toContain('useGetMaterialRequestCandidatePageQuery')
    expect(source).toContain('pageSize: 8')
    expect(source).toContain('useCreatePurchaseRequestFromDemandMutation')
    expect(source).toContain('useSubmitPurchaseRequestMutation')
    expect(source).toContain('useRecordPurchaseOrderReceiptMutation')
    expect(source).toContain('Tạo đề xuất mua')
  })

  it('keeps kitchen receipt and supplemental request mutations wired to real APIs', async () => {
    const source = await readFrontendSource('features/chef/pages/ChefDashboardPage.tsx')

    expect(source).toContain('useConfirmInventoryIssueReceiptMutation')
    expect(source).toContain('useCreateSupplementalMaterialRequestMutation')
    expect(source).toContain('useCreateInventoryReturnMutation')
    expect(source).toContain('Đã ký nhận nguyên liệu')
    expect(source).toContain('Đã gửi yêu cầu bổ sung tới kho')
  })
})
