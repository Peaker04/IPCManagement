import { execFileSync } from 'node:child_process'
import { describe,expect,it } from 'vitest'
import { buildPlaywrightArgv,resolveCliPaths,validateLauncherInput } from './runPhase271Playwright'
const valid={specs:['tests/visual-routes.spec.ts','tests/pagination-visual.spec.ts'],project:'chromium',workers:1,reporter:'json',config:'playwright.phase271-recovery.config.ts'}
describe('closed direct browser launcher',()=>{
 it('builds the exact canonical preflight argv',()=>expect(buildPlaywrightArgv('PW',valid,'preflight')).toEqual(['PW','test',...valid.specs,'--config=playwright.phase271-recovery.config.ts','--project=chromium','--workers=1','--list','--reporter=json']))
 it('builds source argv without command strings',()=>expect(buildPlaywrightArgv('PW',{...valid,outputRoot:'D:/Kì 7/out & | ; $ ` (x)'},'source').at(-1)).toBe('--output=D:/Kì 7/out & | ; $ ` (x)'))
 it.each(['command','visualCommand','npm','npx','shell','executable','argv','webServer','packageScript','unknown'])('rejects forbidden %s injection',(key)=>expect(()=>validateLauncherInput({...valid,[key]:'bad'})).toThrow(/forbidden/))
 it('rejects spec/config/project/worker drift',()=>{for(const x of [{...valid,specs:[valid.specs[0]]},{...valid,project:'webkit'},{...valid,workers:2},{...valid,config:'playwright.config.ts'}])expect(()=>validateLauncherInput(x)).toThrow(/drift/)})
 it('round-trips Unicode, spaces, quotes and shell metacharacters without interpretation',()=>{const values=['D:/Kì 7/output','embedded"quote','&','|',';','$','`','(x)','../traversal'];const got=JSON.parse(execFileSync(process.execPath,['-e','process.stdout.write(JSON.stringify(process.argv.slice(1)))',...values],{shell:false,encoding:'utf8'}));expect(got).toEqual(values)})
 it('resolves installed Playwright and Vite JS with hashes',()=>{const x=resolveCliPaths();expect(x.playwright.path).toMatch(/cli\.js$/);expect(x.vite.path).toMatch(/vite\.js$/);expect(x.playwright.sha256).toMatch(/^[a-f0-9]{64}$/)})
})
