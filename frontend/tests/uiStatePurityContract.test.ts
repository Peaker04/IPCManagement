import fs from 'node:fs'
import path from 'node:path'
import { createElement, type ReactElement } from 'react'
import { cleanup, render } from '@testing-library/react'
import { afterEach, describe, expect, it } from 'vitest'

import { DemandSummary } from '@/components/common/DemandSummary'
import { DocumentRail } from '@/components/common/DocumentRail'
import { StockMovementTable } from '@/components/common/StockMovementTable'
import { ToastProvider } from '@/components/common/ToastProvider'
import {
  HIDDEN_STATE_BASELINE,
  SAME_STATE_FIXTURES,
  SAME_STATE_PAIRS,
  assertHiddenStateBaseline,
  scanHiddenStateSources,
  sourceFromText,
  type ProjectionSelector,
  type SameStatePair,
  type UiProjection,
} from './uiStatePurityInventory'
import { findProductionImportsFromTests, readProductionSources } from './uiCanonSourceInventory'

const frontendRoot = path.resolve(import.meta.dirname, '..')

const sourceContains = (sourcePath: string, fragment: string) => fs
  .readFileSync(path.join(frontendRoot, sourcePath), 'utf8')
  .includes(fragment)

const normalize = (value: string) => value.replace(/\s+/g, ' ').trim()

const project = (container: HTMLElement, selectors: readonly ProjectionSelector[]) => selectors.flatMap(({ selector, attribute }) =>
  [...container.querySelectorAll(selector)].map((element) => normalize(attribute ? element.getAttribute(attribute) ?? '' : element.textContent ?? '')),
)

const projectUi = (container: HTMLElement, pair: SameStatePair): UiProjection => ({
  actions: project(container, pair.selectors.actions),
  statusLabels: project(container, pair.selectors.statusLabels),
  mandatoryFacts: project(container, pair.selectors.mandatoryFacts),
})

const elementFor = (pair: SameStatePair): ReactElement => {
  if (pair.kind === 'demand-summary') return createElement(DemandSummary, { lines: [...SAME_STATE_FIXTURES.demand] })
  if (pair.kind === 'document-rail') return createElement(DocumentRail, { documents: [...SAME_STATE_FIXTURES.document] })
  return createElement(StockMovementTable, { movements: [...SAME_STATE_FIXTURES.movement] })
}

const renderProjection = (pair: SameStatePair) => {
  const rendered = render(createElement(ToastProvider, null, elementFor(pair)))
  const projection = projectUi(rendered.container, pair)
  rendered.unmount()
  return projection
}

afterEach(cleanup)

describe('PF same-state permanent contract', () => {
  it('keeps at least three pairs source-linked to both callsites and one shared owner', () => {
    expect(SAME_STATE_PAIRS.length).toBeGreaterThanOrEqual(3)
    for (const pair of SAME_STATE_PAIRS) {
      expect(sourceContains(pair.left.sourcePath, pair.left.sourceFragment), `${pair.id} left callsite`).toBe(true)
      expect(sourceContains(pair.right.sourcePath, pair.right.sourceFragment), `${pair.id} right callsite`).toBe(true)
      expect(sourceContains(pair.sharedProjectionOwner.sourcePath, pair.sharedProjectionOwner.sourceFragment), `${pair.id} projection owner`).toBe(true)
    }
  })

  it.each(SAME_STATE_PAIRS)('$id projects equivalent actions, statuses and mandatory facts for equal state', (pair) => {
    const left = renderProjection(pair)
    const right = renderProjection(pair)
    expect(left).toEqual(right)
    expect(left).toEqual(pair.expected)
    expect(left.actions.length).toBeGreaterThan(0)
    expect(left.statusLabels.length).toBeGreaterThan(0)
    expect(left.mandatoryFacts.length).toBeGreaterThan(0)
  })
})

describe('PF hidden-state permanent contract', () => {
  it('keeps the exact production baseline classified across all five dependency categories', () => {
    const findings = scanHiddenStateSources(readProductionSources())
    assertHiddenStateBaseline(findings)
    expect(new Set(findings.map((finding) => finding.category))).toEqual(new Set(['local', 'global', 'time', 'order', 'cache']))
    expect(HIDDEN_STATE_BASELINE.every((entry) => entry.reason.trim().length > 0)).toBe(true)
  })

  it.each([
    {
      name: 'undeclared local visibility variable',
      source: sourceFromText('src/synthetic-local.tsx', `
        import { useState } from 'react'
        export const Probe = () => {
          const [showSecret] = useState(false)
          return <main>{showSecret && <aside>secret</aside>}</main>
        }
      `),
    },
    {
      name: 'storage read',
      source: sourceFromText('src/synthetic-storage.ts', `export const hidden = localStorage.getItem('hidden')`),
    },
    {
      name: 'wall-clock visibility dependency',
      source: sourceFromText('src/synthetic-clock.tsx', `export const Probe = () => <main>{new Date().getHours() > 12 && <aside>late</aside>}</main>`),
    },
  ])('rejects a synthetic $name', ({ source }) => {
    const findings = scanHiddenStateSources([source])
    expect(findings.length).toBeGreaterThan(0)
    expect(() => assertHiddenStateBaseline(findings)).toThrow(/UNCLASSIFIED/)
  })

  it('is never imported by production source', () => {
    expect(findProductionImportsFromTests(readProductionSources())).toEqual([])
  })
})
