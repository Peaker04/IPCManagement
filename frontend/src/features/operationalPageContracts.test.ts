import { describe, expect, it } from 'vitest'
import { ROUTES } from '@/routes/routeConfig'

describe('operational page route contracts', () => {
  it('keeps the three MVP workflows on their existing routes', () => {
    expect(ROUTES.WEEKLY_MENU).toBe('/weekly-menu')
    expect(ROUTES.PURCHASING).toBe('/purchasing')
    expect(ROUTES.CHEF_DASHBOARD).toBe('/chef-dashboard')
  })
})
