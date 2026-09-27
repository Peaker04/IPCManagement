import { describe, expect, it } from 'vitest'
import demandSource from './demand/MaterialDemandSection.tsx?raw'
import scheduleSource from './schedule/WeeklyScheduleSection.tsx?raw'
import matrixSource from '../components/ImportedLayoutMatrix.tsx?raw'

describe('Wave 4 Weekly Menu schedule/demand BOTH family', () => {
  it('retains the schedule matrix business table contract used by both modes', () => {
    expect(scheduleSource).toContain('<ImportedLayoutMatrix')
    expect(matrixSource).toContain('ariaLabel="Bố cục thực đơn theo file khách hàng"')
    expect(matrixSource).toContain('caption="Bố cục thực đơn theo file khách hàng"')
    expect(matrixSource).toContain('scope="col"')
    expect(matrixSource).toContain('Chưa có dữ liệu thực đơn từ file cho khách hàng và tuần đang chọn.')
  })

  it('names and scopes the daily production-plan table without changing its day grain', () => {
    expect(demandSource).toContain('ariaLabel="Kế hoạch sản xuất theo ngày từ thực đơn tuần"')
    expect(demandSource).toContain('caption={`Kế hoạch sản xuất ngày ${activeDay ? `${activeDay.label} ${activeDay.date}` : \'đang xem\'}`}')
    expect(demandSource.match(/scope="col"/g)).toHaveLength(5)
    expect(demandSource).toContain('data-cell-role="numeric"')
    expect(demandSource).toContain('Chưa có kế hoạch sản xuất trong ngày đang xem.')
  })
})
