import { Blob as NodeBlob } from 'node:buffer'
import { afterEach, expect, it, vi } from 'vitest'
import { downloadPlanningCsv } from './downloadPlanningCsv'

afterEach(() => { vi.restoreAllMocks(); vi.unstubAllGlobals() })
it('downloads exact quantities and quoted text without spreadsheet formula execution, then releases the URL', async () => {
  vi.stubGlobal('Blob', NodeBlob)
  let blob!: NodeBlob
  const create = vi.fn((value: NodeBlob) => { blob = value; return 'blob:planning' })
  const revoke = vi.fn()
  vi.stubGlobal('URL', { createObjectURL: create, revokeObjectURL: revoke })
  const click = vi.spyOn(HTMLAnchorElement.prototype, 'click').mockImplementation(function (this: HTMLAnchorElement) {
    expect(this.download).toBe('BOM.csv')
    expect(this.isConnected).toBe(true)
  })
  downloadPlanningCsv('BOM.csv', [['Nguyên liệu', 'Lượng'], ['=SUM(1,2)', 0.064777], ['Rau "xanh"', 0], ['\t@command', 1]])
  expect(await blob.text()).toContain('"\'=SUM(1,2)","0.064777"')
  expect(await blob.text()).toContain('"Rau ""xanh""","0"')
  expect(await blob.text()).toContain('"\'\t@command","1"')
  expect(click).toHaveBeenCalledOnce()
  expect(revoke).toHaveBeenCalledWith('blob:planning')
  expect(document.querySelector('a[download]')).toBeNull()
})
