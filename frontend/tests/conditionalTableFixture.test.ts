import { describe, expect, it } from 'vitest'
import { conditionalTableFixtures, readConditionalTableSource } from './conditionalTableFixture'

describe('Wave 2 conditional table read-only fixture', () => {
  it('covers the 16 unique conditional table owners exactly once', () => {
    expect(conditionalTableFixtures).toHaveLength(16)
    expect(new Set(conditionalTableFixtures.map((fixture) => fixture.id)).size).toBe(16)
    expect(new Set(conditionalTableFixtures.map((fixture) => `${fixture.sourceFile}:${fixture.tableIndex}`)).size).toBe(16)
  })

  it('keeps every fixture source-owned, conditional and renderable in loading/empty/ready states', () => {
    for (const fixture of conditionalTableFixtures) {
      const source = readConditionalTableSource(fixture)
      expect(source, fixture.id).toContain(fixture.sourceSymbol)
      expect(source, fixture.id).toMatch(fixture.condition)
      expect(fixture.states).toEqual(['loading', 'empty', 'ready'])
      expect(fixture.regionLabel.trim(), fixture.id).not.toBe('')
      expect(fixture.headerSignature.length, fixture.id).toBeGreaterThanOrEqual(3)
    }
  })

  it('is read-only by contract and never declares mutation methods or seeded data', () => {
    const fixtureSource = JSON.stringify(conditionalTableFixtures)
    expect(fixtureSource).not.toMatch(/(?:POST|PUT|PATCH|DELETE)\s+\/api/i)
    expect(fixtureSource).not.toMatch(/(?:seed|reset|mutat(?:e|ion))/i)
  })
})
