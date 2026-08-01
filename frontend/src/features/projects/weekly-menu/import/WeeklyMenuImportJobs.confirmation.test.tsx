import { fireEvent, render, screen } from '@testing-library/react'
import { describe, expect, it, vi } from 'vitest'
import { WeeklyMenuImportJobs } from './WeeklyMenuImportJobs'
import type { WeeklyMenuImportWorkflow } from './useWeeklyMenuImport'

const job = {
  jobId: 'job-1',
  customerId: 'customer-1',
  customerCode: 'ANV',
  customerName: 'Nhà máy ANV',
  fileName: 'menu.xlsx',
  fileSize: 1024,
  file: new File(['menu'], 'menu.xlsx'),
  weekStartDate: '2026-07-27',
  priceTierAmount: 25_000,
  status: 'previewed',
  error: null,
  warnings: [],
  previewResult: { detectedLayout: { sections: [], dayColumns: [], rowsImported: 12 } },
}

const buildWorkflow = (commitJob: ReturnType<typeof vi.fn>, commitReadyJobs: ReturnType<typeof vi.fn>) => ({
  state: { jobs: [job] },
  selectedJob: job,
  readyJobs: [job],
  status: { isImporting: false, isPreviewing: false, isCommitting: false },
  actions: {
    selectJob: vi.fn(), previewAllJobs: vi.fn(), previewJob: vi.fn(), removeJob: vi.fn(),
    commitJob, commitReadyJobs,
  },
} as unknown as WeeklyMenuImportWorkflow)

describe('WeeklyMenuImportJobs confirmation contract', () => {
  it('does not commit a single file before scope-aware confirmation', () => {
    const commitJob = vi.fn()
    render(<WeeklyMenuImportJobs workflow={buildWorkflow(commitJob, vi.fn())} />)

    fireEvent.click(screen.getByRole('button', { name: 'Lưu' }))

    expect(commitJob).not.toHaveBeenCalled()
    expect(screen.getByRole('dialog', { name: 'Lưu file thực đơn này?' })).toHaveTextContent('ANV · tuần 2026-07-27 · menu.xlsx · 12 dòng món')
    fireEvent.click(screen.getByRole('button', { name: 'Lưu file' }))
    expect(commitJob).toHaveBeenCalledWith('job-1')
  })

  it('does not commit the ready batch before confirming its count and impact', () => {
    const commitReadyJobs = vi.fn()
    render(<WeeklyMenuImportJobs workflow={buildWorkflow(vi.fn(), commitReadyJobs)} />)

    fireEvent.click(screen.getByRole('button', { name: 'Lưu file hợp lệ' }))

    expect(commitReadyJobs).not.toHaveBeenCalled()
    expect(screen.getByRole('dialog', { name: 'Lưu 1 file hợp lệ?' })).toHaveTextContent('1 file với 12 dòng món sẽ được lưu tuần tự')
    expect(screen.getByRole('dialog', { name: 'Lưu 1 file hợp lệ?' })).toHaveTextContent('các file trước đó có thể đã được lưu')
    fireEvent.click(screen.getByRole('button', { name: 'Lưu các file hợp lệ' }))
    expect(commitReadyJobs).toHaveBeenCalledOnce()
  })
})
