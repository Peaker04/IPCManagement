import fs from 'node:fs';
import path from 'node:path';
import process from 'node:process';

const root = process.cwd();
const strict = process.argv.includes('--strict');
const findings = [];

const readText = (file) => fs.readFileSync(file, 'utf8');
const physicalLines = (text) => text.replaceAll('\r\n', '\n').split('\n').length;
const relative = (file) => path.relative(root, file).replaceAll('\\', '/');

const walk = (directory, predicate) => {
  if (!fs.existsSync(directory)) return [];
  const files = [];
  for (const entry of fs.readdirSync(directory, { withFileTypes: true })) {
    const fullPath = path.join(directory, entry.name);
    if (entry.isDirectory()) files.push(...walk(fullPath, predicate));
    else if (predicate(fullPath)) files.push(fullPath);
  }
  return files;
};

const addFinding = (kind, name, files, lines, actions, level, reasons) => {
  findings.push({ kind, name, files: files.map(relative), lines, actions, level, reasons });
};

const controllerRoot = path.join(root, 'backend', 'src', 'IPCManagement.Api', 'Features');
for (const file of walk(controllerRoot, (candidate) => candidate.endsWith('Controller.cs'))) {
  const source = readText(file);
  const lines = physicalLines(source);
  const actions = (source.match(/\[Http(?:Get|Post|Put|Patch|Delete)\b/g) ?? []).length;
  const reasons = [];
  if (lines > 250) reasons.push(`lines ${lines}>250`);
  if (actions > 12) reasons.push(`actions ${actions}>12`);
  if (reasons.length === 0) continue;
  const level = lines > 400 || actions > 20 ? 'PLAN_REQUIRED' : 'WARNING';
  addFinding('controller', path.basename(file), [file], lines, actions, level, reasons);
}

const serviceFiles = walk(controllerRoot, (candidate) =>
  candidate.endsWith('.cs') && candidate.split(path.sep).includes('Services'));
const serviceGroups = new Map();
for (const file of serviceFiles) {
  const source = readText(file);
  const match = source.match(/\b(?:partial\s+)?class\s+([A-Za-z0-9_]+Service)\b/);
  if (!match) continue;
  const group = serviceGroups.get(match[1]) ?? { files: [], lines: 0 };
  group.files.push(file);
  group.lines += physicalLines(source);
  serviceGroups.set(match[1], group);
}
for (const [service, group] of serviceGroups) {
  if (group.lines <= 600) continue;
  addFinding(
    'service',
    service,
    group.files,
    group.lines,
    undefined,
    group.lines > 1000 ? 'PLAN_REQUIRED' : 'WARNING',
    [`lines ${group.lines}>600`],
  );
}

const frontendRoot = path.join(root, 'frontend', 'src');
for (const file of walk(frontendRoot, (candidate) => /\.(?:ts|tsx)$/.test(candidate))) {
  const normalized = relative(file);
  if (normalized.includes('/shared/api/contracts/')) continue;
  if (/\.(?:test|spec)\.(?:ts|tsx)$/.test(file) || file.endsWith('.d.ts')) continue;
  const lines = physicalLines(readText(file));
  if (lines <= 600) continue;
  addFinding('frontend', normalized, [file], lines, undefined, 'WARNING', [`lines ${lines}>600`]);
}

const testRoots = [
  path.join(root, 'backend', 'tests'),
  path.join(root, 'frontend', 'src'),
  path.join(root, 'frontend', 'tests'),
];
const seenTests = new Set();
for (const testRoot of testRoots) {
  for (const file of walk(testRoot, (candidate) =>
    candidate.endsWith('.cs') || /\.(?:test|spec)\.(?:ts|tsx)$/.test(candidate))) {
    if (seenTests.has(file)) continue;
    seenTests.add(file);
    const lines = physicalLines(readText(file));
    if (lines <= 1500) continue;
    addFinding('test', relative(file), [file], lines, undefined, 'WARNING', [`lines ${lines}>1500`]);
  }
}

findings.sort((left, right) =>
  left.kind.localeCompare(right.kind)
  || right.lines - left.lines
  || left.name.localeCompare(right.name));

console.log('Architecture growth report (warning baseline)');
console.log('Thresholds: controller >250 lines/>12 actions; plan >400/>20; service >600, plan >1000; FE >600; test >1500.');
for (const finding of findings) {
  const actionText = finding.actions === undefined ? '' : `, actions=${finding.actions}`;
  console.log(`[${finding.level}] ${finding.kind} ${finding.name}: lines=${finding.lines}${actionText}; ${finding.reasons.join(', ')}`);
  if (finding.files.length > 1) console.log(`  files: ${finding.files.join(', ')}`);
}
console.log(`Summary: ${findings.length} finding(s), ${findings.filter((item) => item.level === 'PLAN_REQUIRED').length} require a split plan.`);

if (strict && findings.length > 0) {
  console.error('Strict architecture growth gate failed. Resolve or baseline the findings before enabling strict mode in CI.');
  process.exitCode = 1;
}
