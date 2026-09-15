import { createHash } from 'node:crypto';
import { copyFile, mkdir, readFile, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { chromium } from 'playwright';

const source = process.argv[2];
if (!source) throw new Error('Usage: node tools/ui-screenshot-intake.mjs <image> [output-root]');

const sourceName = path.basename(source);
const extension = path.extname(sourceName).toLowerCase();
const mimeTypes = new Map([
  ['.png', 'image/png'],
  ['.jpg', 'image/jpeg'],
  ['.jpeg', 'image/jpeg'],
]);
const mime = mimeTypes.get(extension);
if (!mime) throw new Error(`Unsupported screenshot extension "${extension || '(none)'}". Expected .png, .jpg, or .jpeg.`);

const bytes = await readFile(source);
const sha256 = createHash('sha256').update(bytes).digest('hex');
const runId = new Date().toISOString().replace(/[:.]/g, '-');
const outputRoot = path.resolve(process.argv[3] ?? '.artifacts/ui-screenshot-intake');
const runDir = path.join(outputRoot, `${runId}-${sha256.slice(0, 12)}`);
const copiedPath = sourceName;
const normalizedPath = path.join(runDir, copiedPath);
await mkdir(runDir, { recursive: true });
await copyFile(source, normalizedPath);

let browser;
let dimensions;
try {
  browser = await chromium.launch({ channel: 'chrome', headless: true });
  const page = await browser.newPage();
  dimensions = await page.evaluate(async ({ data, mimeType }) => {
    const image = new Image();
    image.src = `data:${mimeType};base64,${data}`;
    await image.decode();
    return { width: image.naturalWidth, height: image.naturalHeight, aspectRatio: image.naturalWidth / image.naturalHeight };
  }, {
    data: bytes.toString('base64'),
    mimeType: mime,
  });
} finally {
  await browser?.close();
}

const manifest = {
  schemaVersion: 1,
  runId,
  source: { fileName: sourceName, copiedPath, bytes: bytes.length, sha256 },
  image: dimensions,
  classification: 'CANDIDATE_ONLY',
  requiredOracleLinkage: { route: null, actor: null, operationMode: null, state: null, viewport: dimensions, domSelector: null, sourceOwner: null, ruleId: null },
  verdict: 'NEEDS_EVIDENCE',
  note: 'Screenshot establishes a visual candidate only. Link it to DOM/source and a repeatable behavior or geometry oracle before PASS/FAIL.',
};
await writeFile(path.join(runDir, 'manifest.json'), `${JSON.stringify(manifest, null, 2)}\n`);
console.log(JSON.stringify({ runDir, manifest: path.join(runDir, 'manifest.json'), ...dimensions, sha256 }, null, 2));
