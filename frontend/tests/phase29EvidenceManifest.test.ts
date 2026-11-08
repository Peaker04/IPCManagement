import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { describe, expect, it } from 'vitest'

const root = resolve(import.meta.dirname, '../..')
const manifestOwnerPath = resolve(root, '.artifacts/shipyard-live/live-visual-audit.mjs')

const manifestOwner = () => readFileSync(manifestOwnerPath, 'utf8')

describe('Phase 29 evidence contract', () => {
  it('requires exhaustive protected evidence before a headed run', () => {
    const source = manifestOwner()
    for (const field of [
      'sourceCommit', 'dirtySourceFingerprint', 'database', 'headed', 'viewports', 'apiResponses',
      'consoleErrors', 'pageErrors', 'requestFailures', 'escapedMutations', 'phase29Contract',
    ]) expect(source).toContain(field)
    expect(source).toContain('1920x1080')
    expect(source).toContain('1365x900')
    expect(source).toContain('1280x900')
  })

  it('requires fresh quantity-import provenance and keeps the controlled scope read-only until preflight', () => {
    const source = manifestOwner()
    for (const field of [
      'freshWorkbookPath', 'freshWorkbookSha256', 'menuVersionId', 'contentFingerprint',
      'quantityImportBatchId', 'quantityPlanIds', 'quantityPlanLineIds', 'reconciliationBatchId',
    ]) expect(source).toContain(field)
    expect(source).toContain("customerCodes: ['ANV', 'AMANN']")
    expect(source).toContain("dateFrom: '2026-09-07'")
    expect(source).toContain("dateTo: '2026-09-12'")
    expect(source).toContain("disposition: 'READ_ONLY_PREFLIGHT_CANDIDATE'")
  })

  it('rejects missing historical workbook authority and Phase 5 fixture markers', () => {
    const source = manifestOwner()
    for (const rejected of [
      'weekly-menu-template-ANV-default.xlsx',
      'A7E734CEFBD409E7220C4FF19B3E1B7FDDD4E33D202A3F24E63309D60D4D5A01',
      'P5E2E0812SAFE',
      'ipc_e2e_template',
      'phase05',
    ]) expect(source).not.toContain(rejected)
  })

  it('names every prohibited database authority independently', () => {
    const sql = readFileSync(resolve(root, 'tools/database/phase29-e2e-invariants.sql'), 'utf8')
    for (const name of ['purchaseRequests', 'purchaseOrders', 'receipts', 'issues', 'movements', 'lots', 'snapshots', 'currentStock']) {
      expect(sql).toContain(name)
    }
  })
})
