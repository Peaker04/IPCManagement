import { describe, expect, it } from 'vitest'
import weeklyMenuPageSource from '../src/features/projects/pages/WeeklyMenuPage.tsx?raw'
import weeklyMenuCommandBarSource from '../src/features/projects/weekly-menu/shell/WeeklyMenuCommandBar.tsx?raw'
import weeklyFixtureSource from './weekly-menu-lifecycle-pa2b-fixture.ts?raw'

// Retained permission contract; no historical disposition ledger or receipt authority.
describe('Weekly menu publish permission contract', () => {
  it('preserves the intentionally stricter frontend publish boundary', () => {
    expect(weeklyFixtureSource).toContain('manager: { backendAvailable: true, frontendAvailable: false }')
    expect(weeklyFixtureSource).toContain('coordinator: { backendAvailable: true, frontendAvailable: false }')
    expect(weeklyMenuPageSource).toContain('const canPublishWeeklyMenu = useHasRole([])')
    expect(weeklyMenuPageSource).toContain('canPublish={canPublishWeeklyMenu && Boolean(publishableSchedule)}')
    expect(weeklyMenuCommandBarSource).toContain('Xuất bản tuần')
  })
})
