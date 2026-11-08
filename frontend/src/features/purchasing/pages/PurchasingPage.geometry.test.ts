import { describe, expect, it } from 'vitest'
import purchasingSource from './PurchasingPage.tsx?raw'

describe('Purchasing command geometry', () => {
  it('does not reserve invisible action width when no next action exists', () => {
    expect(purchasingSource).not.toContain('<span className="hidden min-w-[10.25rem] sm:inline-block" aria-hidden="true" />')
  })
})
