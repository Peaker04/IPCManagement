import { describe, expect, it } from 'vitest'
import coordinationApiSource from '@/api/coordinationApi.ts?raw'
import importWorkflowSource from './useWeeklyMenuImport.ts?raw'

describe('weekly menu preview token contract', () => {
  it('sends the exact preview token with the commit multipart request', () => {
    expect(coordinationApiSource).toContain("formData.append('previewToken', previewToken)")
    expect(importWorkflowSource).toContain('previewToken: job.previewResult.previewToken ?? undefined')
  })
})
