import {describe,expect,it} from 'vitest'
import fs from 'node:fs'
import path from 'node:path'
import {validateEvidenceShape,validatePreservedEvidence} from './validateVisualReconciliation'
const source=path.resolve('../.planning/phases/27.1-reconcile-21-non-warehouse-visual-failures-before-phase-27-c/evidence')
const read=(n:string)=>JSON.parse(fs.readFileSync(`${source}/${n}`,'utf8'))
const values=()=>[read('failure-inventory.json'),read('packet-member-manifest.json'),read('phase-infrastructure-allowlist.json'),read('row-class-path-matrix.json'),read('attempt-ledger.json')] as [any,any,any,any,any]
describe('durable evidence validation',()=>{
 it('accepts exact 21/105 and immutable attempt statuses',()=>expect(validatePreservedEvidence(source)).toMatchObject({rows:21,members:105}))
 it('rejects 20/21, member omission, duplicate, hash drift and attempt relabel',()=>{
  let x=values();x[0].failures.pop();expect(()=>validateEvidenceShape(...x)).toThrow(/21/)
  x=values();x[1].members.pop();expect(()=>validateEvidenceShape(...x)).toThrow(/105/)
  x=values();x[1].members[1].path=x[1].members[0].path;expect(()=>validateEvidenceShape(...x)).toThrow(/105/)
  x=values();x[4].attempts[1].status='ACCEPTED';expect(()=>validateEvidenceShape(...x)).toThrow(/exactly-once/)
  x=values();x[2].paths=x[2].paths.filter((p:any)=>p.authorizationClass!=='preserved-packet').concat(x[2].paths.filter((p:any)=>p.authorizationClass==='preserved-packet').slice(0,104));expect(()=>validateEvidenceShape(...x)).toThrow(/authorization/)
 })
})
