import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { describe, expect, it } from 'vitest'
import fixture from './fixtures/phase271-attempt-v2-sanitized-result.json'
import golden from './fixtures/phase271-golden-21-identities.json'
import { classifyExpectedVisualMismatches, hashGoldenManifest, type StructuredResult } from './visualReconciliationEvidence'

const fresh = () => structuredClone(fixture.results) as StructuredResult[]
const identities = golden.identities
const reject = (mutate:(rows:StructuredResult[])=>void) => { const rows=fresh(); mutate(rows); expect(()=>classifyExpectedVisualMismatches(rows,identities)).toThrow() }

describe('Phase 27.1 exact structured classifier',()=>{
  it('pins the complete 76-test fixture and exact golden hash',()=>{
    expect(fixture.results).toHaveLength(76)
    expect(hashGoldenManifest(identities)).toBe(golden.goldenIdentityManifestSha256)
    expect(classifyExpectedVisualMismatches(fresh(),identities)).toHaveLength(21)
  })
  it('includes mobile Login by exact identity without viewport title parsing',()=>{
    const login=identities.find(x=>x.snapshotName==='login-mobile-expected.png')!
    expect(login.canonicalTitle).toBe('visual-routes.spec.ts › visual routes › mobile › login visual baseline')
    expect(login.viewport).toEqual({width:390,height:844})
  })
  it.each([
    ['title',(x:StructuredResult)=>x.canonicalTitle+=' changed'],['snapshot',(x:StructuredResult)=>x.snapshotName='changed-expected.png'],
    ['project',(x:StructuredResult)=>x.project='webkit'],['spec',(x:StructuredResult)=>x.normalizedSpecPath='tests/other.spec.ts'],
    ['viewport',(x:StructuredResult)=>x.viewport.width++],['nonvisual',(x:StructuredResult)=>x.failureKind='nonvisual'],
  ])('rejects changed %s metadata',(_name,change)=>reject(rows=>change(rows.find(x=>x.status==='failed')!)))
  it('rejects duplicate, missing and extra failures independently',()=>{
    reject(rows=>rows.push(structuredClone(rows.find(x=>x.status==='failed')!)))
    reject(rows=>rows.find(x=>x.status==='failed')!.status='passed')
    reject(rows=>rows.find(x=>x.status==='passed')!.status='failed')
  })
  it('rejects missing visual and diagnostic attachments',()=>{
    reject(rows=>rows.find(x=>x.status==='failed')!.attachments=rows.find(x=>x.status==='failed')!.attachments.filter(x=>!x.name.endsWith('-diff.png')))
    reject(rows=>rows.find(x=>x.status==='failed')!.attachments=rows.find(x=>x.status==='failed')!.attachments.filter(x=>x.name!=='trace'))
  })
  it('waits for named Chef and Purchasing semantic owners instead of a timing heuristic',()=>{
    const source=readFileSync(resolve('tests/visual-routes.spec.ts'),'utf8')
    expect(source).toContain("routeName === 'chef-dashboard'")
    expect(source).toContain("getByRole('heading', { name: 'Kế hoạch điều phối trong ngày' })")
    expect(source).toContain("routeName === 'purchasing'")
    expect(source).toContain("getByText('Một luồng sáu giai đoạn từ nhu cầu đã duyệt đến tiến độ nhập kho.')")
    expect(source).not.toContain('await page.waitForTimeout(500)')
  })
})
