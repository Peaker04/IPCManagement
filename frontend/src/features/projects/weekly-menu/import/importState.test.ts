import { describe, expect, it } from 'vitest'
import { DEFAULT_BOM_PRICE_TIER } from '../../weeklyMenuPlanning'
import { initialWeeklyMenuImportState, weeklyMenuImportReducer } from './importState'
import type { WeeklyMenuImportJob } from '../model/types'

const makeJob = (customerId: string, fileName = `${customerId}.xlsx`): WeeklyMenuImportJob => ({
  jobId: `import-${customerId}`,
  customerId,
  customerCode: customerId.toUpperCase(),
  customerName: `Khách hàng ${customerId}`,
  weekStartDate: '2026-07-20',
  priceTierAmount: DEFAULT_BOM_PRICE_TIER,
  file: new File(['menu'], fileName),
  fileName,
  fileSize: 4,
  status: 'idle',
  previewResult: null,
  warnings: [],
  error: null,
})

describe('weekly menu import state machine', () => {
  it('opens with the active scope and closes back to a clean state', () => {
    const opened = weeklyMenuImportReducer(initialWeeklyMenuImportState, {
      type: 'open',
      customerId: 'dav',
      weekStartDate: '2026-07-20',
      priceTierAmount: DEFAULT_BOM_PRICE_TIER,
    })

    expect(opened).toMatchObject({ isOpen: true, draftCustomerId: 'dav', weekStartDate: '2026-07-20' })
    expect(weeklyMenuImportReducer(opened, { type: 'close' })).toEqual(initialWeeklyMenuImportState)
  })

  it('replaces a customer file instead of creating duplicate import jobs', () => {
    const first = weeklyMenuImportReducer(initialWeeklyMenuImportState, { type: 'upsert-job', job: makeJob('dav', 'old.xlsx') })
    const replaced = weeklyMenuImportReducer(first, { type: 'upsert-job', job: makeJob('dav', 'new.xlsx') })

    expect(replaced.jobs).toHaveLength(1)
    expect(replaced.jobs[0].fileName).toBe('new.xlsx')
    expect(replaced.selectedJobId).toBe('import-dav')
  })

  it('selects the next file after removing the active import job', () => {
    const withFirst = weeklyMenuImportReducer(initialWeeklyMenuImportState, { type: 'upsert-job', job: makeJob('dav') })
    const withSecond = weeklyMenuImportReducer(withFirst, { type: 'upsert-job', job: makeJob('ipc') })
    const selectedFirst = weeklyMenuImportReducer(withSecond, { type: 'select-job', jobId: 'import-dav' })
    const removed = weeklyMenuImportReducer(selectedFirst, { type: 'remove-job', jobId: 'import-dav' })

    expect(removed.jobs.map((job) => job.jobId)).toEqual(['import-ipc'])
    expect(removed.selectedJobId).toBe('import-ipc')
  })
})
