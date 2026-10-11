import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { describe, expect, it } from 'vitest'

/**
 * Static contract guard for the standalone MRX preview artifact.
 *
 * The preview is a sandbox HTML file, not application source, so its contract is
 * asserted by reading the file rather than by importing it. Every task in
 * docs/superpowers/plans/2026-10-12-mrx-live-preview.md appends to this file.
 */

const html = readFileSync(
  resolve(process.cwd(), 'preview/material-reconciliation.html'),
  'utf8',
)
const body = html.slice(html.indexOf('<body'))

describe('MRX preview carries no fabricated business data', () => {
  it('has no hardcoded calendar date in body markup', () => {
    expect(body).not.toMatch(/\d{1,2}\/\d{1,2}\/\d{4}/)
  })

  it('has no Vietnamese customer or batch identifiers', () => {
    expect(body).not.toMatch(/Khách hàng|Customer|batch-|LO-|Phiên đối chiếu/)
  })

  it('has no quantity rendered as a literal value', () => {
    // A number followed by a canonical unit is a fabricated quantity. A bare
    // unit token is not: single letters such as "l" and "g" occur inside ordinary
    // words, so the unit must be anchored to a preceding number.
    expect(body).not.toMatch(/\d[\d.,]*\s*(kg|ml|l|g)\b/i)
  })
})