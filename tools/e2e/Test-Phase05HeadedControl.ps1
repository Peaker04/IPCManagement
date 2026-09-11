[CmdletBinding()]
param(
    [string]$ArtifactRoot = '.artifacts/shipyard-live/phase-05-multi-customer-lifecycle/preflight',
    [string]$RuntimeUrl,
    [string]$TargetSelector,
    [string]$ExpectedDomSelector,
    [string]$ExpectedRequestPattern,
    [string]$CdpEndpoint,
    [string]$LoginUsername,
    [string]$PasswordEnvironmentVariable,
    [switch]$ValidateOnly
)

$ErrorActionPreference = 'Stop'

function Write-ControlReceipt {
    param([hashtable]$Receipt)
    New-Item -ItemType Directory -Force -Path $ArtifactRoot | Out-Null
    [System.IO.File]::WriteAllText(
        (Join-Path $ArtifactRoot 'browser-control.json'),
        ($Receipt | ConvertTo-Json -Depth 8),
        [System.Text.UTF8Encoding]::new($false))
}

if ($ValidateOnly) {
    foreach ($required in @('PHYSICAL_INPUT_PASS', 'WORKAROUND_ONLY', 'isTrusted', 'connectOverCDP', 'pointer', 'keyboard', 'workaroundAccepted')) {
        if ((Get-Content -Raw -LiteralPath $PSCommandPath) -notmatch [regex]::Escape($required)) {
            throw "Headed-control contract is missing $required."
        }
    }
    Write-Host 'PASS static headed-control contract; no browser or runtime was started.'
    return
}

if ([string]::IsNullOrWhiteSpace($RuntimeUrl) -or [string]::IsNullOrWhiteSpace($TargetSelector) -or
    [string]::IsNullOrWhiteSpace($ExpectedDomSelector) -or [string]::IsNullOrWhiteSpace($ExpectedRequestPattern)) {
    throw 'RuntimeUrl, TargetSelector, ExpectedDomSelector, and ExpectedRequestPattern are mandatory for physical input proof. No browser was started.'
}
if ([string]::IsNullOrWhiteSpace($LoginUsername) -xor [string]::IsNullOrWhiteSpace($PasswordEnvironmentVariable)) {
    throw 'Physical login requires both LoginUsername and PasswordEnvironmentVariable. No browser was started.'
}
if ($PasswordEnvironmentVariable -and [string]::IsNullOrWhiteSpace([Environment]::GetEnvironmentVariable($PasswordEnvironmentVariable))) {
    throw "The required in-memory credential '$PasswordEnvironmentVariable' is not available. No browser was started."
}

$receipt = [ordered]@{
    formatVersion = 1
    verdict = 'NEEDS_RUNTIME'
    workaroundAccepted = $false
    runtimeUrl = $RuntimeUrl
    targetSelector = $TargetSelector
    expectedDomSelector = $ExpectedDomSelector
    expectedRequestPattern = $ExpectedRequestPattern
    strategy = if ($CdpEndpoint) { 'attached-cdp-remediation' } else { 'run-owned-headed-chrome' }
    login = if ($LoginUsername) { @{ username = $LoginUsername; succeeded = $false } } else { $null }
    pointer = @{ trusted = $false }
    keyboard = @{ trusted = $false }
    protectedLaneConnectionAttempts = 0
    attemptedAtUtc = (Get-Date).ToUniversalTime().ToString('O')
}

# The runtime proof is deliberately delegated to Node's installed Playwright package. It uses real locator
# mouse/keyboard dispatch only. DOM invocation, page.evaluate and API requests are never used as a fallback.
$nodeProgram = @'
const fs = require('fs');
const { chromium } = require('@playwright/test');
const [out, runtimeUrl, targetSelector, expectedDomSelector, expectedRequestPattern, suppliedCdpEndpoint, loginUsername, passwordEnvironmentVariable] = process.argv.slice(1);
const cdpEndpoint = suppliedCdpEndpoint === '__NO_CDP__' ? '' : suppliedCdpEndpoint;
const receipt = JSON.parse(fs.readFileSync(out, 'utf8').replace(/^\uFEFF/, ''));
(async () => {
  let browser, context, page;
  try {
    if (cdpEndpoint) { browser = await chromium.connectOverCDP(cdpEndpoint); context = browser.contexts()[0]; page = context.pages()[0] || await context.newPage(); }
    else { context = await chromium.launchPersistentContext(`${out}.profile`, { channel: 'chrome', headless: false }); page = await context.newPage(); }
    await page.addInitScript(() => {
      window.__phase05Input = { pointer: false, keyboard: false };
      addEventListener('pointerdown', e => { if (e.isTrusted) window.__phase05Input.pointer = true; }, true);
      addEventListener('keydown', e => { if (e.isTrusted) window.__phase05Input.keyboard = true; }, true);
    });
    const requests = [];
    const responses = [];
    page.on('request', request => requests.push(`${request.method()} ${request.url()}`));
    page.on('response', response => {
      if (response.url().includes('/api/auth/login')) responses.push({ status: response.status(), url: response.url() });
    });
    await page.goto(runtimeUrl, { waitUntil: 'domcontentloaded', timeout: 15000 });
    if (loginUsername) {
      const password = process.env[passwordEnvironmentVariable];
      if (!password) throw new Error(`Missing in-memory credential ${passwordEnvironmentVariable}`);
      await page.locator('#username').click({ timeout: 10000 });
      await page.keyboard.type(loginUsername);
      await page.locator('#password').click({ timeout: 10000 });
      await page.keyboard.type(password);
      const loginRequestsStart = requests.length;
      await page.locator('form button[type="submit"]').click({ timeout: 10000 });
      try { await page.waitForURL(url => !url.pathname.endsWith('/login'), { timeout: 15000 }); } catch { }
      receipt.login.succeeded = !new URL(page.url()).pathname.endsWith('/login');
      receipt.login.requestObserved = requests.slice(loginRequestsStart).some(request => request.includes('POST') && request.includes('/api/auth/login'));
      receipt.login.responses = responses;
      receipt.login.alert = await page.locator('[role="alert"]').allTextContents();
      if (!receipt.login.succeeded) throw new Error(`Physical login did not navigate; responses=${JSON.stringify(responses)} alerts=${JSON.stringify(receipt.login.alert)}`);
    }
    const target = page.locator(targetSelector);
    await target.waitFor({ state: 'visible', timeout: 10000 });
    receipt.target = { visible: await target.isVisible(), enabled: await target.isEnabled(), receivesEvents: true };
    const actionRequestsStart = requests.length;
    await target.click({ timeout: 10000 });
    await page.keyboard.press('Tab');
    const input = await page.evaluate(() => window.__phase05Input);
    receipt.pointer.trusted = input.pointer === true;
    receipt.keyboard.trusted = input.keyboard === true;
    receipt.focused = await page.evaluate(() => document.activeElement?.outerHTML?.slice(0, 300) || null);
    receipt.domExpected = await page.locator(expectedDomSelector).count() > 0;
    receipt.requestObserved = requests.slice(actionRequestsStart).some(request => request.includes(expectedRequestPattern));
    receipt.verdict = receipt.pointer.trusted && receipt.keyboard.trusted && receipt.domExpected && receipt.requestObserved
      && (!loginUsername || (receipt.login.succeeded && receipt.login.requestObserved))
      ? 'PHYSICAL_INPUT_PASS' : 'PHYSICAL_INPUT_FAIL';
  } catch (error) { receipt.verdict = 'PHYSICAL_INPUT_FAIL'; receipt.failure = String(error.stack || error); }
  finally { receipt.completedAtUtc = new Date().toISOString(); fs.writeFileSync(out, `${JSON.stringify(receipt, null, 2)}\n`); if (context && !cdpEndpoint) await context.close(); if (browser && cdpEndpoint) await browser.close(); }
  process.exit(receipt.verdict === 'PHYSICAL_INPUT_PASS' ? 0 : 1);
})();
'@

Write-ControlReceipt -Receipt $receipt
if ([string]::IsNullOrWhiteSpace($CdpEndpoint)) { $CdpEndpoint = '__NO_CDP__' }
& node --input-type=commonjs -e $nodeProgram (Join-Path $ArtifactRoot 'browser-control.json') $RuntimeUrl $TargetSelector $ExpectedDomSelector $ExpectedRequestPattern $CdpEndpoint $LoginUsername $PasswordEnvironmentVariable
exit $LASTEXITCODE
