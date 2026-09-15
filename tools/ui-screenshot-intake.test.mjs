import assert from 'node:assert/strict';
import { execFileSync, spawnSync } from 'node:child_process';
import { mkdtemp, mkdir, readFile, readdir, rm, writeFile } from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import test from 'node:test';

const script = path.resolve('tools/ui-screenshot-intake.mjs');
const validPng = Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNk+A8AAQUBAScY42YAAAAASUVORK5CYII=', 'base64');

function ownedChromeProcesses() {
  const command = [
    "$items = Get-CimInstance Win32_Process -Filter \"Name = 'chrome.exe'\" |",
    "Where-Object { $_.CommandLine -match '--remote-debugging-pipe|playwright_chromiumdev_profile' } |",
    'Select-Object ProcessId, ParentProcessId, CommandLine;',
    'if ($items) { $items | ConvertTo-Json -Compress } else { Write-Output "[]" }',
  ].join(' ');
  const output = execFileSync('powershell.exe', ['-NoProfile', '-Command', command], { encoding: 'utf8' }).trim();
  const parsed = JSON.parse(output || '[]');
  return Array.isArray(parsed) ? parsed : [parsed];
}

async function assertNoNewOwnedChrome(before) {
  const baseline = new Set(before.map(({ ProcessId }) => ProcessId));
  let leaked = [];
  for (let attempt = 0; attempt < 20; attempt += 1) {
    leaked = ownedChromeProcesses().filter(({ ProcessId }) => !baseline.has(ProcessId));
    if (leaked.length === 0) return;
    await new Promise((resolve) => setTimeout(resolve, 250));
  }
  assert.deepEqual(leaked, [], `owned Chrome processes leaked: ${JSON.stringify(leaked)}`);
}

async function findManifests(root) {
  const manifests = [];
  async function visit(directory) {
    let entries;
    try {
      entries = await readdir(directory, { withFileTypes: true });
    } catch (error) {
      if (error.code === 'ENOENT') return;
      throw error;
    }
    for (const entry of entries) {
      const entryPath = path.join(directory, entry.name);
      if (entry.isDirectory()) await visit(entryPath);
      else if (entry.name === 'manifest.json') manifests.push(entryPath);
    }
  }
  await visit(root);
  return manifests;
}

async function fixture(name, bytes) {
  const root = await mkdtemp(path.join(os.tmpdir(), 'ipc-screenshot-intake-'));
  const inputDir = path.join(root, 'private-input');
  const outputRoot = path.join(root, 'output');
  await mkdir(inputDir);
  const source = path.join(inputDir, name);
  await writeFile(source, bytes);
  return { root, source, outputRoot };
}

function runCli(source, outputRoot) {
  return spawnSync(process.execPath, [script, source, outputRoot], {
    cwd: path.resolve('.'),
    encoding: 'utf8',
    timeout: 30_000,
  });
}

test('valid PNG creates a redacted manifest and closes owned Chrome', async () => {
  const paths = await fixture('valid.png', validPng);
  const before = ownedChromeProcesses();
  try {
    const result = runCli(paths.source, paths.outputRoot);
    assert.equal(result.status, 0, result.stderr);
    const output = JSON.parse(result.stdout);
    const manifestText = await readFile(output.manifest, 'utf8');
    const manifest = JSON.parse(manifestText);
    assert.deepEqual(manifest.image, { width: 1, height: 1, aspectRatio: 1 });
    assert.deepEqual(manifest.source, {
      fileName: 'valid.png',
      copiedPath: 'valid.png',
      bytes: validPng.length,
      sha256: output.sha256,
    });
    assert.equal(manifestText.includes(path.resolve(paths.source)), false);
    assert.equal(manifestText.includes(path.resolve(paths.outputRoot)), false);
    await assertNoNewOwnedChrome(before);
  } finally {
    await rm(paths.root, { recursive: true, force: true });
  }
});

test('unsupported extension exits nonzero before Chrome and writes no manifest', async () => {
  const paths = await fixture('unsupported.gif', Buffer.from('GIF89a'));
  const before = ownedChromeProcesses();
  try {
    const result = runCli(paths.source, paths.outputRoot);
    assert.notEqual(result.status, 0);
    assert.match(result.stderr, /Unsupported screenshot extension.*\.png, \.jpg, or \.jpeg/s);
    assert.deepEqual(await findManifests(paths.outputRoot), []);
    await assertNoNewOwnedChrome(before);
  } finally {
    await rm(paths.root, { recursive: true, force: true });
  }
});

test('corrupt PNG exits nonzero, writes no manifest, and closes owned Chrome', async () => {
  const paths = await fixture('corrupt.png', Buffer.from('not a png'));
  const before = ownedChromeProcesses();
  try {
    const result = runCli(paths.source, paths.outputRoot);
    assert.notEqual(result.status, 0);
    assert.match(result.stderr, /EncodingError|decode|image/i);
    assert.deepEqual(await findManifests(paths.outputRoot), []);
    await assertNoNewOwnedChrome(before);
  } finally {
    await rm(paths.root, { recursive: true, force: true });
  }
});
