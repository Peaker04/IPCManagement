import { describe, expect, it } from 'vitest'
import { ROUTES } from '@/routes/routeConfig'
import weeklyMenuPageSource from './projects/pages/WeeklyMenuPage.tsx?raw'
import weeklyMenuFormattersSource from './projects/weekly-menu/model/formatters.ts?raw'
import weeklyMenuScopeSource from './projects/weekly-menu/model/scope.ts?raw'
import weeklyMenuImportValidationSource from './projects/weekly-menu/import/importValidation.ts?raw'
import weeklyMenuImportStateSource from './projects/weekly-menu/import/importState.ts?raw'
import weeklyMenuImportWorkflowSource from './projects/weekly-menu/import/useWeeklyMenuImport.ts?raw'
import weeklyMenuImportDialogSource from './projects/weekly-menu/import/WeeklyMenuImportDialog.tsx?raw'
import weeklyMenuImportJobsSource from './projects/weekly-menu/import/WeeklyMenuImportJobs.tsx?raw'
import weeklyMenuImportReviewSource from './projects/weekly-menu/import/WeeklyMenuImportReview.tsx?raw'
import weeklyScheduleStateSource from './projects/weekly-menu/schedule/scheduleState.ts?raw'
import weeklyScheduleWorkflowSource from './projects/weekly-menu/schedule/useWeeklyScheduleEditor.ts?raw'
import weeklyScheduleEditorSource from './projects/weekly-menu/schedule/WeeklyScheduleEditorDialog.tsx?raw'
import weeklyProductionPlanWorkflowSource from './projects/weekly-menu/production-plan/useWeeklyProductionPlan.ts?raw'
import weeklyProductionPlanSectionSource from './projects/weekly-menu/production-plan/ProductionPlanSection.tsx?raw'
import materialDemandWorkflowSource from './projects/weekly-menu/demand/useMaterialDemand.ts?raw'
import materialDemandSectionSource from './projects/weekly-menu/demand/MaterialDemandSection.tsx?raw'
import weeklyMenuCommandSource from './projects/weekly-menu/shell/WeeklyMenuCommandBar.tsx?raw'
import purchasingPageSource from './workflow/pages/PurchasingPage.tsx?raw'
import chefDashboardPageSource from './chef/pages/ChefDashboardPage.tsx?raw'

describe('operational page refactor contracts', () => {
  it('keeps the three MVP workflows on their existing routes', () => {
    expect(ROUTES.WEEKLY_MENU).toBe('/weekly-menu')
    expect(ROUTES.PURCHASING).toBe('/purchasing')
    expect(ROUTES.CHEF_DASHBOARD).toBe('/chef-dashboard')
  })

  it('keeps weekly menu import, demand and schedule actions wired to real APIs', () => {
    const source = [
      weeklyMenuPageSource,
      weeklyMenuFormattersSource,
      weeklyMenuScopeSource,
      weeklyMenuImportValidationSource,
      weeklyMenuImportStateSource,
      weeklyMenuImportWorkflowSource,
      weeklyMenuImportDialogSource,
      weeklyMenuImportJobsSource,
      weeklyMenuImportReviewSource,
      weeklyScheduleStateSource,
      weeklyScheduleWorkflowSource,
      weeklyScheduleEditorSource,
      weeklyProductionPlanWorkflowSource,
      weeklyProductionPlanSectionSource,
      materialDemandWorkflowSource,
      materialDemandSectionSource,
      weeklyMenuCommandSource,
    ].join('\n')

    expect(source).toContain('usePreviewWeeklyMenuImportMutation')
    expect(source).toContain('useCommitWeeklyMenuImportMutation')
    expect(source).toContain('useReducer(weeklyMenuImportReducer')
    expect(source).toContain('await commitImport')
    expect(source).toContain('.unwrap()')
    expect(source).toContain('if (closeOnSuccess) close()')
    expect(source).toContain('useGenerateMaterialDemandMutation')
    expect(source).toContain('useGetIngredientDemandAggregatePageQuery')
    expect(source).toContain('pageSize: 20')
    expect(source).toContain('useGetProductionPlansQuery')
    expect(source).toContain('<ProductionPlanSection workflow={productionPlanWorkflow}')
    expect(source).toContain('<MaterialDemandSection')
    expect(source).toContain('useUpdateWeeklyMenuBulkMutation')
    expect(source).toContain('useUpsertQuickServingsMutation')
    expect(source).toContain('useReducer(weeklyScheduleReducer')
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
