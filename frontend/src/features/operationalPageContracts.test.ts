import { describe, expect, it } from 'vitest'
import { ROUTES } from '@/routes/routeConfig'
import weeklyMenuPageSource from './projects/pages/WeeklyMenuPage.tsx?raw'
import weeklyMenuFormattersSource from './projects/weekly-menu/model/formatters.ts?raw'
import weeklyMenuScopeSource from './projects/weekly-menu/model/scope.ts?raw'
import weeklyMenuImportValidationSource from './projects/weekly-menu/import/importValidation.ts?raw'
import purchasingPageSource from './workflow/pages/PurchasingPage.tsx?raw'
import chefDashboardPageSource from './chef/pages/ChefDashboardPage.tsx?raw'

describe('operational page refactor contracts', () => {
  it('keeps the three MVP workflows on their existing routes', () => {
    expect(ROUTES.WEEKLY_MENU).toBe('/weekly-menu')
    expect(ROUTES.PURCHASING).toBe('/purchasing')
    expect(ROUTES.CHEF_DASHBOARD).toBe('/chef-dashboard')
  })

  it('keeps weekly menu import, demand and schedule actions wired to real APIs', () => {
    const source = [weeklyMenuPageSource, weeklyMenuFormattersSource, weeklyMenuScopeSource, weeklyMenuImportValidationSource].join('\n')

    expect(source).toContain('usePreviewWeeklyMenuImportMutation')
    expect(source).toContain('useCommitWeeklyMenuImportMutation')
    expect(source).toContain('useGenerateMaterialDemandMutation')
    expect(source).toContain('useUpdateWeeklyMenuBulkMutation')
    expect(source).toContain('Nhập Excel')
    expect(source).toContain("{ id: 'demand', label: 'Nhu cầu' }")
  })

  it('keeps purchasing paging and purchase mutations wired to real APIs', () => {
    const source = purchasingPageSource

    expect(source).toContain('useGetMaterialRequestCandidatePageQuery')
    expect(source).toContain('pageSize: 8')
    expect(source).toContain('useCreatePurchaseRequestFromDemandMutation')
    expect(source).toContain('useSubmitPurchaseRequestMutation')
    expect(source).toContain('useRecordPurchaseOrderReceiptMutation')
    expect(source).toContain('Tạo đề xuất mua')
  })

  it('keeps kitchen receipt and supplemental request mutations wired to real APIs', () => {
    const source = chefDashboardPageSource

    expect(source).toContain('useConfirmInventoryIssueReceiptMutation')
    expect(source).toContain('useCreateSupplementalMaterialRequestMutation')
    expect(source).toContain('useCreateInventoryReturnMutation')
    expect(source).toContain('Đã ký nhận nguyên liệu')
    expect(source).toContain('Đã gửi yêu cầu bổ sung tới kho')
  })
})
