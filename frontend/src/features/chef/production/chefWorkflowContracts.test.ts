import { describe, expect, it } from 'vitest'
import { ROUTES } from '@/routes/routeConfig'
import pageSource from '../pages/ChefDashboardPage.tsx?raw'
import exceptionSource from '../exceptions/useChefExceptions.ts?raw'
import receiptSource from '../receipts/useKitchenReceipts.ts?raw'
import productionSource from './useChefProductionPlan.ts?raw'

describe('chef workflow decomposition contracts', () => {
  const workflowSource = [pageSource, exceptionSource, receiptSource, productionSource].join('\n')

  it('keeps the dashboard on one route with its existing views', () => {
    expect(ROUTES.CHEF_DASHBOARD).toBe('/chef-dashboard')
    expect(pageSource).toContain("{ id: 'chef-production', label: 'Ca sản xuất' }")
    expect(pageSource).toContain("{ id: 'chef-documents', label: 'Chứng từ bếp' }")
  })

  it('keeps all kitchen mutations in the extracted workflows', () => {
    expect(workflowSource).toContain('useSendDailyProductionPlanToKitchenMutation')
    expect(workflowSource).toContain('useConfirmInventoryIssueReceiptMutation')
    expect(workflowSource).toContain('useCreateSupplementalMaterialRequestMutation')
    expect(workflowSource).toContain('useCreateInventoryReturnMutation')
    expect(workflowSource).toContain('.unwrap()')
  })

  it('keeps receipt, supplemental request and return feedback copy', () => {
    expect(workflowSource).toContain('Đã ký nhận nguyên liệu')
    expect(workflowSource).toContain('Đã gửi yêu cầu bổ sung tới kho')
    expect(workflowSource).toContain('Đã tạo phiếu trả kho')
  })
})
