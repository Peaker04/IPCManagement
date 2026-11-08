import fs from 'node:fs';
import path from 'node:path';
import process from 'node:process';
import { spawnSync } from 'node:child_process';

const BASELINE_VERSION = 1;
const DEFAULT_BASELINE = 'scripts/architecture-growth-baseline.json';
const LEVEL_RANK = { WARNING: 1, PLAN_REQUIRED: 2 };
const THRESHOLDS = {
  controllerLines: 250,
  controllerActions: 12,
  controllerPlanLines: 400,
  controllerPlanActions: 20,
  serviceLines: 600,
  servicePlanLines: 1000,
  frontendLines: 600,
  testLines: 1500,
};

const readText = (file) => fs.readFileSync(file, 'utf8');
const physicalLines = (text) => text.replaceAll('\r\n', '\n').split('\n').length;
const relative = (root, file) => path.relative(root, file).replaceAll('\\', '/');

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

const findingId = ({ kind, name }) => `${kind}:${name}`;

const addFinding = (root, findings, kind, name, files, lines, actions, level, reasons) => {
  findings.push({
    id: findingId({ kind, name }),
    kind,
    name,
    files: files.map((file) => relative(root, file)).sort(),
    lines,
    ...(actions === undefined ? {} : { actions }),
    level,
    reasons,
  });
};

const scanFindings = (root) => {
  const findings = [];
  const controllerRoot = path.join(root, 'backend', 'src', 'IPCManagement.Api', 'Features');
  for (const file of walk(controllerRoot, (candidate) => candidate.endsWith('Controller.cs'))) {
    const source = readText(file);
    const lines = physicalLines(source);
    const actions = (source.match(/\[Http(?:Get|Post|Put|Patch|Delete)\b/g) ?? []).length;
    const reasons = [];
    if (lines > THRESHOLDS.controllerLines) reasons.push(`lines ${lines}>${THRESHOLDS.controllerLines}`);
    if (actions > THRESHOLDS.controllerActions) reasons.push(`actions ${actions}>${THRESHOLDS.controllerActions}`);
    if (reasons.length === 0) continue;
    const level = lines > THRESHOLDS.controllerPlanLines || actions > THRESHOLDS.controllerPlanActions
      ? 'PLAN_REQUIRED'
      : 'WARNING';
    addFinding(root, findings, 'controller', path.basename(file), [file], lines, actions, level, reasons);
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
    if (group.lines <= THRESHOLDS.serviceLines) continue;
    addFinding(
      root,
      findings,
      'service',
      service,
      group.files,
      group.lines,
      undefined,
      group.lines > THRESHOLDS.servicePlanLines ? 'PLAN_REQUIRED' : 'WARNING',
      [`lines ${group.lines}>${THRESHOLDS.serviceLines}`],
    );
  }

  const frontendRoot = path.join(root, 'frontend', 'src');
  for (const file of walk(frontendRoot, (candidate) => /\.(?:ts|tsx)$/.test(candidate))) {
    const normalized = relative(root, file);
    if (normalized.includes('/shared/api/contracts/')) continue;
    if (/\.(?:test|spec)\.(?:ts|tsx)$/.test(file) || file.endsWith('.d.ts')) continue;
    const lines = physicalLines(readText(file));
    if (lines <= THRESHOLDS.frontendLines) continue;
    addFinding(
      root,
      findings,
      'frontend',
      normalized,
      [file],
      lines,
      undefined,
      'WARNING',
      [`lines ${lines}>${THRESHOLDS.frontendLines}`],
    );
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
      if (lines <= THRESHOLDS.testLines) continue;
      addFinding(
        root,
        findings,
        'test',
        relative(root, file),
        [file],
        lines,
        undefined,
        'WARNING',
        [`lines ${lines}>${THRESHOLDS.testLines}`],
      );
    }
  }

  return findings.sort((left, right) =>
    left.kind.localeCompare(right.kind)
    || right.lines - left.lines
    || left.name.localeCompare(right.name));
};

const parseArgs = (argv) => {
  const options = { strict: false, root: process.cwd(), baseline: DEFAULT_BASELINE, baseRef: undefined };
  for (let index = 0; index < argv.length; index++) {
    const argument = argv[index];
    if (argument === '--strict') options.strict = true;
    else if (argument === '--root' || argument === '--baseline' || argument === '--base-ref') {
      const value = argv[++index];
      if (!value) throw new Error(`${argument} requires a value.`);
      if (argument === '--root') options.root = value;
      if (argument === '--baseline') options.baseline = value;
      if (argument === '--base-ref') options.baseRef = value;
    }
    else throw new Error(`Unknown argument: ${argument}`);
  }
  options.root = path.resolve(options.root);
  options.baseline = path.isAbsolute(options.baseline)
    ? options.baseline
    : path.resolve(options.root, options.baseline);
  return options;
};

const sameJson = (left, right) => JSON.stringify(left) === JSON.stringify(right);

const parseBaseline = (text, source) => {
  let baseline;
  try {
    baseline = JSON.parse(text);
  }
  catch (error) {
    throw new Error(`${source} is not valid JSON: ${error.message}`);
  }
  if (baseline?.version !== BASELINE_VERSION) {
    throw new Error(`${source} must use version ${BASELINE_VERSION}.`);
  }
  if (!sameJson(baseline.thresholds, THRESHOLDS)) {
    throw new Error(`${source} thresholds do not match the executable policy.`);
  }
  if (!Array.isArray(baseline.findings)) {
    throw new Error(`${source} findings must be an array.`);
  }

  const ids = new Set();
  for (const finding of baseline.findings) {
    if (!finding || typeof finding !== 'object') throw new Error(`${source} contains an invalid finding.`);
    if (finding.kind === 'test') throw new Error(`${source} must not baseline test debt (${finding.id ?? finding.name}).`);
    if (!['controller', 'service', 'frontend'].includes(finding.kind)) {
      throw new Error(`${source} contains unsupported kind ${finding.kind}.`);
    }
    if (finding.id !== findingId(finding)) throw new Error(`${source} has a non-canonical id for ${finding.name}.`);
    if (ids.has(finding.id)) throw new Error(`${source} contains duplicate id ${finding.id}.`);
    if (!Array.isArray(finding.files) || finding.files.length === 0) {
      throw new Error(`${source} finding ${finding.id} must list its files.`);
    }
    if (!Number.isInteger(finding.lines) || finding.lines <= 0) {
      throw new Error(`${source} finding ${finding.id} has invalid lines.`);
    }
    if (finding.actions !== undefined && (!Number.isInteger(finding.actions) || finding.actions < 0)) {
      throw new Error(`${source} finding ${finding.id} has invalid actions.`);
    }
    if (!(finding.level in LEVEL_RANK)) throw new Error(`${source} finding ${finding.id} has invalid level.`);
    ids.add(finding.id);
  }

  return baseline;
};

const loadBaselineFile = (file) => {
  if (!fs.existsSync(file)) throw new Error(`Baseline file not found: ${file}`);
  return parseBaseline(readText(file), file);
};

const comparableFinding = (finding) => ({
  id: finding.id,
  kind: finding.kind,
  name: finding.name,
  files: [...finding.files].sort(),
  lines: finding.lines,
  ...(finding.actions === undefined ? {} : { actions: finding.actions }),
  level: finding.level,
});

const compareCurrentToBaseline = (findings, baseline) => {
  const issues = [];
  const tests = findings.filter((finding) => finding.kind === 'test');
  for (const finding of tests) issues.push(`TEST_DEBT ${finding.name}: ${finding.lines} lines.`);

  const actual = new Map(findings.filter((finding) => finding.kind !== 'test').map((finding) => [finding.id, finding]));
  const expected = new Map(baseline.findings.map((finding) => [finding.id, finding]));
  for (const [id, finding] of actual) {
    const baselineFinding = expected.get(id);
    if (!baselineFinding) {
      issues.push(`NEW_DEBT ${id}: lines=${finding.lines}${finding.actions === undefined ? '' : `, actions=${finding.actions}`}.`);
      continue;
    }
    const currentComparable = comparableFinding(finding);
    const baselineComparable = comparableFinding(baselineFinding);
    if (!sameJson(currentComparable, baselineComparable)) {
      const direction = finding.lines > baselineFinding.lines
        || (finding.actions ?? 0) > (baselineFinding.actions ?? 0)
        || LEVEL_RANK[finding.level] > LEVEL_RANK[baselineFinding.level]
        ? 'WORSENED_DEBT'
        : 'BASELINE_SHRINK_REQUIRED';
      issues.push(`${direction} ${id}: baseline=${JSON.stringify(baselineComparable)}, current=${JSON.stringify(currentComparable)}.`);
    }
  }
  for (const id of expected.keys()) {
    if (!actual.has(id)) issues.push(`BASELINE_SHRINK_REQUIRED ${id}: finding resolved but baseline entry remains.`);
  }
  return issues;
};

const loadBaselineFromRef = (root, baseRef, baselineFile) => {
  const relativeBaseline = relative(root, baselineFile);
  if (relativeBaseline.startsWith('../') || path.isAbsolute(relativeBaseline)) {
    throw new Error('--base-ref requires the baseline file to stay inside --root.');
  }
  const verify = spawnSync('git', ['rev-parse', '--verify', `${baseRef}^{commit}`], { cwd: root, encoding: 'utf8' });
  if (verify.status !== 0) throw new Error(`Base ref is not a valid commit: ${baseRef}.`);
  const show = spawnSync('git', ['show', `${baseRef}:${relativeBaseline}`], {
    cwd: root,
    encoding: 'utf8',
    maxBuffer: 4 * 1024 * 1024,
  });
  if (show.status !== 0) return { bootstrap: true, baseline: undefined };
  return { bootstrap: false, baseline: parseBaseline(show.stdout, `${baseRef}:${relativeBaseline}`) };
};

const compareBaselineToBase = (current, base) => {
  const issues = [];
  const baseFindings = new Map(base.findings.map((finding) => [finding.id, finding]));
  for (const finding of current.findings) {
    const previous = baseFindings.get(finding.id);
    if (!previous) {
      issues.push(`BASELINE_EXPANSION_NEW ${finding.id}: new debt cannot be grandfathered.`);
      continue;
    }
    if (finding.lines > previous.lines
      || (finding.actions ?? 0) > (previous.actions ?? 0)
      || LEVEL_RANK[finding.level] > LEVEL_RANK[previous.level]) {
      issues.push(`BASELINE_EXPANSION_METRIC ${finding.id}: base=${JSON.stringify(comparableFinding(previous))}, current=${JSON.stringify(comparableFinding(finding))}.`);
    }
  }
  return issues;
};

const printFindings = (findings) => {
  console.log('Architecture growth report (strict production baseline)');
  console.log('Thresholds: controller >250 lines/>12 actions; plan >400/>20; service >600, plan >1000; FE >600; test >1500.');
  for (const finding of findings) {
    const actionText = finding.actions === undefined ? '' : `, actions=${finding.actions}`;
    console.log(`[${finding.level}] ${finding.kind} ${finding.name}: lines=${finding.lines}${actionText}; ${finding.reasons.join(', ')}`);
    if (finding.files.length > 1) console.log(`  files: ${finding.files.join(', ')}`);
  }
  console.log(`Summary: ${findings.length} finding(s), ${findings.filter((item) => item.level === 'PLAN_REQUIRED').length} require a split plan.`);
};

const main = () => {
  let options;
  let baseline;
  try {
    options = parseArgs(process.argv.slice(2));
    baseline = loadBaselineFile(options.baseline);
  }
  catch (error) {
    console.error(`BASELINE_INVALID ${error.message}`);
    process.exitCode = 1;
    return;
  }

  const findings = scanFindings(options.root);
  printFindings(findings);
  const issues = compareCurrentToBaseline(findings, baseline);
  if (options.baseRef) {
    try {
      const base = loadBaselineFromRef(options.root, options.baseRef, options.baseline);
      if (base.bootstrap) console.log(`Baseline bootstrap: ${options.baseRef} has no ${relative(options.root, options.baseline)}.`);
      else issues.push(...compareBaselineToBase(baseline, base.baseline));
    }
    catch (error) {
      issues.push(`BASE_REF_INVALID ${error.message}`);
    }
  }

  for (const issue of issues) console.error(issue);
  if (options.strict && issues.length > 0) {
    console.error(`Strict architecture growth gate failed with ${issues.length} issue(s).`);
    process.exitCode = 1;
    return;
  }
  if (issues.length === 0) console.log('Strict architecture growth gate passed; production debt is exact and test debt is zero.');
};

main();
