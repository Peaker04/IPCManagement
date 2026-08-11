import { render, screen } from '@testing-library/react'
import { describe, expect, it } from 'vitest'

import { ServiceRunTrackPanel } from './ServiceRunBlockerPanel'

describe('ServiceRunTrackPanel', () => {
  it('keeps planning, supply, execution and reconciliation distinct from backend blockers', () => {
    render(<ServiceRunTrackPanel run={{
      serviceRunId: 'run-1', planId: 'plan-1', planCode: 'KHSX-01', serviceDate: '2026-08-12', shiftName: 'MORNING', status: 'RECONCILIATION_REQUIRED',
      blockers: ['OPEN_SUPPLY', 'UNRESOLVED_VARIANCE'], canStartService: false, canRecordActualServings: false, canConfirmService: false,
      canWaiveServiceConfirmation: false, canResolveVariance: true, canResolveServingVariance: false, canClose: false, serviceConfirmationOutcome: 'PENDING',
      plannedServings: 40, actualServings: 39, materialRequestLineCount: 2, issueCount: 1, unreceivedIssueCount: 0, openSupplementalCount: 1,
      unreceivedReturnCount: 0, hasBomBlocker: false, adjustmentCount: 0,
    }} />)

    expect(screen.getByText('Kế hoạch')).toBeInTheDocument()
    expect(screen.getByText('Vật tư / cấp phát')).toBeInTheDocument()
    expect(screen.getByText('Thực hiện phục vụ')).toBeInTheDocument()
    expect(screen.getByText('Đối soát')).toBeInTheDocument()
    expect(screen.getByText('OPEN_SUPPLY')).toBeInTheDocument()
    expect(screen.getByText('UNRESOLVED_VARIANCE')).toBeInTheDocument()
  })
})
