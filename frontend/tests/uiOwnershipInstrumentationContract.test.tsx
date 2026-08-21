import { render, screen } from '@testing-library/react'
import { describe, expect, it, vi } from 'vitest'
import mainLayoutSource from '@/app/layout/MainLayout.tsx?raw'
import operationalFrameSource from '@/components/common/OperationalFrame.tsx?raw'
import viewSwitcherSource from '@/components/common/ViewSwitcher.tsx?raw'
import loginPageSource from '@/features/auth/pages/LoginPage.tsx?raw'
import forbiddenPageSource from '@/features/auth/pages/ForbiddenPage.tsx?raw'
import {
  OperationalFrame,
  UiOwnershipContext,
  type OperationalFrameProps,
} from '@/components/common/OperationalFrame'
import { ViewSwitcher, type ViewSwitcherProps } from '@/components/common/ViewSwitcher'
import { findProductionImportsFromTests, readProductionSources } from './uiCanonSourceInventory'
import { buildUiFloorplanScopeKey, uiFloorplanScopeRegistry } from './uiFloorplanScopeRegistry'
import { uiFloorplanContracts } from './uiFloorplanContracts'
import { uiSourceOwnershipManifest, uiSourceOwnershipTargets } from './uiSourceOwnershipManifest'

type OwnershipTuple = { ownerId: string; floorplanId: string; regionId: string }

const tupleByScope = new Map(uiFloorplanScopeRegistry.map((entry, index) => [
  buildUiFloorplanScopeKey(entry),
  {
    ownerId: uiSourceOwnershipTargets[index].ownerId,
    floorplanId: `uif-${index.toString(36)}`,
    regionId: uiSourceOwnershipTargets[index].regionId,
  },
]))

const tupleFor = (surfaceId: string) => {
  const entry = uiFloorplanScopeRegistry.find((candidate) => candidate.surfaceId === surfaceId)
  if (!entry) throw new Error(`Missing canonical surface ${surfaceId}`)
  const tuple = tupleByScope.get(buildUiFloorplanScopeKey(entry))
  if (!tuple) throw new Error(`Missing canonical tuple ${surfaceId}`)
  return tuple
}

const tupleLiteral = (tuple: OwnershipTuple) =>
  `ownerId: '${tuple.ownerId}', floorplanId: '${tuple.floorplanId}', regionId: '${tuple.regionId}'`

const bindingPattern = /'([^']+)\\0([^']+)': \{ ownerId: '([^']+)', floorplanId: '([^']+)', regionId: '([^']+)' \}/g
const productionBindings = [...viewSwitcherSource.matchAll(bindingPattern)].map((match) => ({
  key: `${match[1]}\0${match[2]}`,
  surfaceId: match[2],
  tuple: { ownerId: match[3], floorplanId: match[4], regionId: match[5] },
}))

const compareBindings = (bindings: typeof productionBindings) => {
  const expected = uiFloorplanScopeRegistry.filter((entry) => entry.surfaceKind !== 'route')
  const expectedIds = new Set(expected.map((entry) => entry.surfaceId))
  const duplicateKeys = bindings.filter((entry, index) => bindings.findIndex((candidate) => candidate.key === entry.key) !== index).map((entry) => entry.key)
  return {
    missing: expected.filter((entry) => !bindings.some((binding) => binding.surfaceId === entry.surfaceId)).map((entry) => entry.surfaceId).sort(),
    duplicates: [...new Set(duplicateKeys)].sort(),
    orphans: bindings.filter((entry) => !expectedIds.has(entry.surfaceId)).map((entry) => entry.key).sort(),
    wrongTuple: bindings.filter((entry) => expectedIds.has(entry.surfaceId) && JSON.stringify(entry.tuple) !== JSON.stringify(tupleFor(entry.surfaceId))).map((entry) => entry.key).sort(),
  }
}

const forbiddenSourceTerms = uiFloorplanScopeRegistry.flatMap((entry) => [
  entry.routeKey,
  entry.routePath,
  entry.surfaceId,
  buildUiFloorplanScopeKey(entry),
]).concat(uiSourceOwnershipManifest.flatMap((entry) => [
  entry.sourceFile,
  entry.sourceSymbol,
  entry.sourceFile.replaceAll('/', '\\'),
]))

const expectOpaqueTuple = (tuple: OwnershipTuple) => {
  expect(tuple.ownerId).toMatch(/^uio-[a-z0-9]+$/)
  expect(tuple.floorplanId).toMatch(/^uif-[a-z0-9]+$/)
  expect(tuple.regionId).toMatch(/^uir-[a-z0-9]+$/)
  for (const value of Object.values(tuple)) {
    expect(forbiddenSourceTerms.filter(Boolean).some((term) => value.includes(term))).toBe(false)
  }
}

describe('Phase 26 opaque instrumentation contract', () => {
  it('joins every route root to the approved scope, floorplan, owner, and region contracts', () => {
    expect(uiFloorplanContracts.map((entry) => entry.scopeKey)).toEqual(uiFloorplanScopeRegistry.map(buildUiFloorplanScopeKey))
    expect(uiSourceOwnershipTargets.map((entry) => entry.scopeKey)).toEqual(uiFloorplanScopeRegistry.map(buildUiFloorplanScopeKey))

    for (const entry of uiFloorplanScopeRegistry.filter((candidate) => candidate.surfaceKind === 'route')) {
      const tuple = tupleFor(entry.surfaceId)
      expectOpaqueTuple(tuple)
      if (entry.routeKey === 'LOGIN') {
        expect(loginPageSource).toContain('data-ui-owner="uio-l" data-ui-floorplan="uif-l" data-ui-region="uir-l"')
      } else if (entry.routeKey === 'FORBIDDEN') {
        expect(forbiddenPageSource).toContain('data-ui-owner="uio-k" data-ui-floorplan="uif-k" data-ui-region="uir-k"')
        expect(mainLayoutSource).toContain(`[ROUTES.FORBIDDEN]: { ${tupleLiteral(tuple)} }`)
      } else {
        expect(mainLayoutSource).toContain(`[ROUTES.${entry.routeKey}]: { ${tupleLiteral(tuple)} }`)
      }
    }
  })

  it('closes every exact ariaLabel plus tab id binding in both directions', () => {
    expect(compareBindings(productionBindings)).toEqual({ missing: [], duplicates: [], orphans: [], wrongTuple: [] })
    productionBindings.forEach((binding) => expectOpaqueTuple(binding.tuple))

    const removed = productionBindings.slice(1)
    expect(compareBindings(removed).missing).toEqual([productionBindings[0].surfaceId])
    expect(compareBindings([...productionBindings, productionBindings[0]]).duplicates).toEqual([productionBindings[0].key])
    expect(compareBindings([...productionBindings, { ...productionBindings[0], key: 'other\0orphan', surfaceId: 'orphan' }]).orphans).toEqual(['other\0orphan'])
    expect(compareBindings([{ ...productionBindings[0], tuple: { ...productionBindings[0].tuple, ownerId: 'uio-wrong' } }, ...productionBindings.slice(1)]).wrongTuple).toEqual([productionBindings[0].key])
    expect(new Set(productionBindings.map((binding) => binding.key)).size).toBe(productionBindings.length)
    expect(productionBindings.filter((binding) => binding.surfaceId.startsWith('bom-'))).toHaveLength(0)
    expect(productionBindings.filter((binding) => binding.surfaceId.startsWith('price-sub-'))).toHaveLength(4)
  })

  it('keeps production source blind to test-owned contracts and semantic locators', () => {
    expect(findProductionImportsFromTests(readProductionSources())).toEqual([])
    const instrumentationSource = [mainLayoutSource, operationalFrameSource, viewSwitcherSource, loginPageSource, forbiddenPageSource].join('\n')
    expect(instrumentationSource).not.toContain('uiFloorplanScopeRegistry')
    expect(instrumentationSource).not.toContain('uiFloorplanContracts')
    expect(instrumentationSource).not.toContain('uiSourceOwnershipManifest')
    for (const binding of productionBindings) expectOpaqueTuple(binding.tuple)
  })

  it('adds only inert ownership attributes to OperationalFrame with compatible props', () => {
    const compatibleProps = { title: 'Tiêu đề', children: <span>Nội dung</span> } satisfies OperationalFrameProps
    const inherited = { ownerId: 'uio-a', floorplanId: 'uif-a', regionId: 'uir-a' } as const
    const { rerender } = render(
      <UiOwnershipContext.Provider value={inherited}>
        <OperationalFrame {...compatibleProps} />
      </UiOwnershipContext.Provider>,
    )
    const section = screen.getByText('Nội dung').closest('section')
    expect(section).toHaveClass('ipc-operational-frame')
    expect(section).toHaveAttribute('data-ui-region', 'uir-a')
    expect(section).not.toHaveAttribute('data-ui-owner')
    expect(section).not.toHaveAttribute('data-ui-floorplan')

    rerender(<OperationalFrame {...compatibleProps} uiOwnership={{ ownerId: 'uio-z', floorplanId: 'uif-z', regionId: 'uir-z' }} />)
    const overriddenSection = screen.getByText('Nội dung').closest('section')
    expect(overriddenSection).toHaveAttribute('data-ui-owner', 'uio-z')
    expect(overriddenSection).toHaveAttribute('data-ui-floorplan', 'uif-z')
    expect(overriddenSection).toHaveAttribute('data-ui-region', 'uir-z')
  })

  it('emits active and per-tab tuples without changing tab semantics', () => {
    const props = {
      ariaLabel: 'Chọn góc nhìn kho',
      activeTab: 'warehouse-demand',
      onTabChange: vi.fn(),
      tabs: [
        { id: 'warehouse-movement', label: 'Luân chuyển' },
        { id: 'warehouse-demand', label: 'Nhu cầu xuất' },
        { id: 'warehouse-exceptions', label: 'Ngoại lệ' },
      ],
    } satisfies ViewSwitcherProps
    render(<ViewSwitcher {...props} />)

    const tablist = screen.getByRole('tablist', { name: props.ariaLabel })
    const activeTuple = tupleFor('warehouse-demand')
    expect(tablist).toHaveAttribute('aria-orientation', 'horizontal')
    expect(tablist).toHaveAttribute('data-ui-owner', activeTuple.ownerId)
    expect(tablist).toHaveAttribute('data-ui-floorplan', activeTuple.floorplanId)
    expect(tablist).toHaveAttribute('data-ui-region', activeTuple.regionId)

    props.tabs.forEach((tab) => {
      const element = screen.getByRole('tab', { name: tab.label })
      const tuple = tupleFor(tab.id)
      expect(element).toHaveClass('ipc-view-tab')
      expect(element).toHaveAttribute('data-ui-owner', tuple.ownerId)
      expect(element).toHaveAttribute('data-ui-floorplan', tuple.floorplanId)
      expect(element).toHaveAttribute('data-ui-region', tuple.regionId)
      expect(element).toHaveAttribute('aria-selected', String(tab.id === props.activeTab))
      expect(element).toHaveAttribute('tabindex', tab.id === props.activeTab ? '0' : '-1')
    })
  })
})
