import { readFileSync } from 'node:fs'
import { describe, expect, it } from 'vitest'

const source = readFileSync('src/features/projects/weekly-menu/cost/MenuCostSection.tsx', 'utf8')

describe('weekly menu daily cost presentation', () => {
  it('names the selected-day dish-line and ingredient-unit grains without touching calculation ownership', () => {
    expect(source).toContain('Giá vốn từng dòng món theo ngày, ca và số suất')
    expect(source).toContain('Nguyên liệu theo ngày, đơn vị và các món trong kế hoạch')
    expect(source).toContain('key={`cost-${row.key}`}')
    expect(source).toContain('key={`day-material-${identityKey}`}')
    expect(source).toContain('actions.selectDay(')
  })
  it('scopes both table variants and identifies displayed counts, quantities and currency', () => {
    expect((source.match(/<th scope="col"/g) ?? [])).toHaveLength(14)
    expect((source.match(/data-cell-role="numeric"/g) ?? [])).toHaveLength(7)
    expect(source).toContain('Chưa có kế hoạch ngày để liên kết giá vốn.')
    expect(source).toContain('Chưa có nguyên liệu cho ngày này.')
  })
})
