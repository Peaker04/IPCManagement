import { describe, expect, it } from 'vitest'

import {
  HIDDEN_STATE_BASELINE,
  assertHiddenStateBaseline,
  scanHiddenStateSources,
} from '../uiStatePurityInventory'
import { readProductionSources } from '../uiCanonSourceInventory'

describe('PF hidden-state campaign baseline', () => {
  it('keeps the exact reviewed production baseline classified across all five dependency categories', () => {
    const findings = scanHiddenStateSources(readProductionSources())
    assertHiddenStateBaseline(findings)
    expect(new Set(findings.map((finding) => finding.category))).toEqual(new Set(['local', 'global', 'time', 'order', 'cache']))
    expect(HIDDEN_STATE_BASELINE.every((entry) => entry.reason.trim().length > 0)).toBe(true)
  })
})
