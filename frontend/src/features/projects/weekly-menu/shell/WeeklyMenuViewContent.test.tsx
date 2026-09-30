import { render } from '@testing-library/react'
import { describe, expect, it } from 'vitest'
import { WeeklyMenuViewContent } from './WeeklyMenuViewContent'

describe('WeeklyMenuViewContent compatibility boundary', () => {
  it('does not own the Schedule workspace after the page-body replacement', () => {
    const { container } = render(<WeeklyMenuViewContent
      activeView={'schedule' as never}
      scheduleWorkflow={{} as never}
      productionPlanWorkflow={{} as never}
      demandWorkflow={{} as never}
      servingFeedback={null}
      menuCostWorkflow={{} as never}
      purchaseSummaryWorkflow={{} as never}
      dishMaterialsWorkflow={{} as never}
    />)

    expect(container).toBeEmptyDOMElement()
  })
})
