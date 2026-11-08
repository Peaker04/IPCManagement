import { spawn, type ChildProcess } from 'node:child_process'
import { createHash } from 'node:crypto'
import fs from 'node:fs'
import path from 'node:path'
import { createRequire } from 'node:module'

export type LauncherInput={specs:string[];project:string;workers:number;grep?:string;reporter:string;outputRoot?:string;config:string;env?:Record<string,string>}
const allowed=new Set(['specs','project','workers','grep','reporter','outputRoot','config','env'])
const canonicalSpecs=['tests/visual-routes.spec.ts','tests/pagination-visual.spec.ts']
export const validateLauncherInput=(raw:unknown):LauncherInput=>{
  if(!raw||typeof raw!=='object'||Array.isArray(raw))throw new Error('launcher input must be an object')
  for(const k of Object.keys(raw))if(!allowed.has(k))throw new Error(`forbidden launcher key: ${k}`)
  const x=raw as LauncherInput
  if(JSON.stringify(x.specs)!==JSON.stringify(canonicalSpecs)||x.project!=='chromium'||x.workers!==1||x.config!=='playwright.phase271-recovery.config.ts')throw new Error('canonical launcher contract drift')
  if(!['json','list'].includes(x.reporter))throw new Error('unsupported reporter')
  if(x.grep!==undefined&&(typeof x.grep!=='string'||!x.grep))throw new Error('invalid grep')
  return x
}
const hashFile=(p:string)=>createHash('sha256').update(fs.readFileSync(p)).digest('hex')
export const resolveCliPaths=(frontendCwd=path.resolve('frontend'))=>{
  const require=createRequire(path.join(frontendCwd,'package.json'))
  const pw=path.resolve(path.dirname(require.resolve('@playwright/test/package.json')),'cli.js')
  const vite=path.resolve(path.dirname(require.resolve('vite/package.json')),'bin/vite.js')
  return {playwright:{path:pw,sha256:hashFile(pw)},vite:{path:vite,sha256:hashFile(vite)}}
}
export const buildPlaywrightArgv=(cli:string,input:LauncherInput,mode:'preflight'|'source'|'focused')=>{
  validateLauncherInput(input)
  const argv=[cli,'test',...canonicalSpecs,`--config=${input.config}`,`--project=${input.project}`,`--workers=${input.workers}`]
  if(mode==='preflight')return [...argv,'--list','--reporter=json']
  if(input.grep)argv.push(`--grep=${input.grep}`)
  argv.push('--reporter=json')
  if(input.outputRoot)argv.push(`--output=${input.outputRoot}`)
  return argv
}
const waitForHealth=async(url:string,child:ChildProcess)=>{for(let i=0;i<120;i++){if(child.exitCode!==null)throw new Error(`Vite exited ${child.exitCode}`);try{const r=await fetch(url);if(r.ok)return}catch{/* retry health check */}await new Promise(r=>setTimeout(r,250))}throw new Error('Vite health timeout')}
export async function runPhase271Playwright(raw:unknown,mode:'preflight'|'source'|'focused'){
  const input=validateLauncherInput(raw),cwd=path.resolve('frontend'),cli=resolveCliPaths(cwd),env={...process.env,...input.env,VITE_ENABLE_MOCK_LOGIN:'true'}
  const viteArgv=[cli.vite.path,'--host','127.0.0.1','--port','5173','--strictPort']
  const vite=spawn(process.execPath,viteArgv,{cwd,env,shell:false,stdio:['ignore','pipe','pipe']})
  try{
    await waitForHealth('http://127.0.0.1:5173/login',vite)
    const argv=buildPlaywrightArgv(cli.playwright.path,input,mode)
    const child=spawn(process.execPath,argv,{cwd,env,shell:false,stdio:['ignore','pipe','pipe']})
    let stdout='',stderr='';child.stdout!.on('data',x=>stdout+=x);child.stderr!.on('data',x=>stderr+=x)
    const exitCode=await new Promise<number>(resolve=>child.on('close',c=>resolve(c??1)))
    return {exitCode,stdout,stderr,attestation:{nodeExecutable:process.execPath,playwrightCli:cli.playwright,viteCli:cli.vite,playwrightArgv:argv,viteArgv,cwd,shell:false,jsonOutputFile:env.PLAYWRIGHT_JSON_OUTPUT_FILE||null}}
  }finally{if(vite.exitCode===null)vite.kill('SIGTERM')}
}
