import { createHash } from 'node:crypto';
import { existsSync, readFileSync } from 'node:fs';
import { dirname, isAbsolute, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const ASSESSMENTS = new Set(['PASS', 'FAIL', 'PARTIAL', 'GAP', 'CONFLICT']);
const DELIVERY_CLASSES = new Set(['READY', 'PARTIAL', 'BLOCKED', 'INVALID', 'READ_ONLY_BY_CONTRACT']);
const EVIDENCE_KINDS = new Set(['static', 'unit', 'contract', 'backend-test', 'openapi', 'browser', 'persistence', 'actor-mode']);
const MODES = new Set(['DEFAULT', 'MATERIAL_RECONCILIATION', 'SHARED_MASTER_DATA']);
const OPERATIONS = new Set(['read', 'create', 'update', 'terminal']);
const REQUIREMENT_KINDS = new Set(['BR', 'FR', 'NFR', 'UXR', 'D', 'T', 'M', 'N', 'AC']);
const REQUIRED_STATES = ['loading', 'empty', 'error', 'permission-denied', 'partial', 'write-reconciliation'];

function normalizeRequirementRow(row) {
  return row.trim().replace(/\s+/g, ' ');
}

export function requirementStatementDigest(row) {
  return createHash('sha256').update(normalizeRequirementRow(row), 'utf8').digest('hex');
}

function findRequirementRow(repoRoot, source, anchor) {
  if (!source || !anchor) return null;
  const absolute = isAbsolute(source) ? source : join(repoRoot, source);
  if (!existsSync(absolute)) return null;
  return readFileSync(absolute, 'utf8').split(/\r?\n/).find((row) => row.includes(`\`${anchor}\``)) || null;
}

function addDuplicates(errors, records, label) {
  const seen = new Set();
  for (const record of records) {
    if (!record?.id) continue;
    if (seen.has(record.id)) errors.push(`Duplicate ${label} id ${record.id}`);
    seen.add(record.id);
  }
}

function checkPath(errors, repoRoot, path, label) {
  if (typeof path !== 'string' || !path.trim()) return;
  const absolute = isAbsolute(path) ? path : join(repoRoot, path);
  if (!existsSync(absolute)) errors.push(`Missing ${label} path ${path}`);
}

function parseCanonicalRoutes(repoRoot) {
  const registry = join(repoRoot, 'frontend/src/routes/routeRegistry.ts');
  if (!existsSync(registry)) return [];
  const source = readFileSync(registry, 'utf8');
  return [...source.matchAll(/\bpath:\s*['"]([^'"]+)['"]/g)].map((match) => match[1]);
}

export function validateConformanceContracts(contract, { repoRoot, canonicalRoutes } = {}) {
  const errors = [];
  const root = resolve(repoRoot || dirname(dirname(fileURLToPath(import.meta.url))));

  if (!contract || typeof contract !== 'object') return ['Contract must be an object'];
  if (contract.version !== 1) errors.push('Contract version must be 1');
  for (const key of ['requirements', 'capabilities', 'surfaces', 'conflicts']) {
    if (!Array.isArray(contract[key])) errors.push(`${key} must be an array`);
  }
  if (errors.some((error) => /must be an array/.test(error))) return errors;

  const requirements = contract.requirements;
  const capabilities = contract.capabilities;
  const surfaces = contract.surfaces;
  const conflicts = contract.conflicts;
  addDuplicates(errors, requirements, 'requirement');
  addDuplicates(errors, capabilities, 'capability');
  addDuplicates(errors, surfaces, 'surface');
  addDuplicates(errors, conflicts, 'conflict');

  const requirementIds = new Set(requirements.map((item) => item.id));
  const capabilityIds = new Set(capabilities.map((item) => item.id));
  const surfaceIds = new Set(surfaces.map((item) => item.id));
  const actionIndexPath = join(root, 'docs/backend-action-index.json');
  const backendActionIds = existsSync(actionIndexPath)
    ? new Set(JSON.parse(readFileSync(actionIndexPath, 'utf8')).actions.map((action) => action.actionId))
    : new Set();

  for (const requirement of requirements) {
    if (!REQUIREMENT_KINDS.has(requirement.kind)) errors.push(`Requirement ${requirement.id} has invalid kind ${requirement.kind}`);
    if (!ASSESSMENTS.has(requirement.assessment)) errors.push(`Requirement ${requirement.id} has invalid assessment ${requirement.assessment}`);
    if (!requirement.title?.trim()) errors.push(`Requirement ${requirement.id} requires a title`);
    if (requirement.sourceAnchor !== requirement.id) errors.push(`Requirement ${requirement.id} sourceAnchor must equal its id`);
    if (!/^[a-f0-9]{64}$/.test(requirement.statementDigest || '')) errors.push(`Requirement ${requirement.id} requires a SHA-256 statementDigest`);
    checkPath(errors, root, requirement.source, 'source');
    const row = findRequirementRow(root, requirement.source, requirement.sourceAnchor);
    if (!row || requirement.statementDigest !== requirementStatementDigest(row)) {
      errors.push(`${requirement.id} canonical statement changed; reconcile assessment and evidence`);
    }
    for (const capabilityId of requirement.capabilityIds || []) {
      if (!capabilityIds.has(capabilityId)) errors.push(`Requirement ${requirement.id} references unknown capability ${capabilityId}`);
    }
    for (const evidence of requirement.evidenceRequired || []) {
      if (!EVIDENCE_KINDS.has(evidence)) errors.push(`Requirement ${requirement.id} has invalid evidence ${evidence}`);
    }
  }

  for (const capability of capabilities) {
    if (!OPERATIONS.has(capability.operation)) errors.push(`Capability ${capability.id} has invalid operation ${capability.operation}`);
    if (!capability.actionIds?.length) errors.push(`Capability ${capability.id} requires at least one Backend action ID`);
    for (const actionId of capability.actionIds || []) {
      if (!backendActionIds.has(actionId)) errors.push(`Capability ${capability.id} references unknown Backend action ${actionId}`);
    }
    if (!MODES.has(capability.mode)) errors.push(`Capability ${capability.id} requires a valid mode`);
    if (!DELIVERY_CLASSES.has(capability.deliveryClass)) errors.push(`Capability ${capability.id} has invalid deliveryClass ${capability.deliveryClass}`);
    for (const requirementId of capability.requirementIds || []) {
      if (!requirementIds.has(requirementId)) errors.push(`Capability ${capability.id} references unknown requirement ${requirementId}`);
    }
    for (const surfaceId of capability.surfaceIds || []) {
      if (!surfaceIds.has(surfaceId)) errors.push(`Capability ${capability.id} references unknown surface ${surfaceId}`);
    }
    for (const [owner, path] of Object.entries(capability.backend || {})) checkPath(errors, root, path, 'owner');

    const lineage = (capability.sourceLineage || []).join(' ');
    if (/\bDEFAULT\b/i.test(lineage) && /\b(?:MRX|MATERIAL_RECONCILIATION)\b/i.test(lineage)) {
      errors.push(`${capability.id} mixes DEFAULT and MATERIAL_RECONCILIATION lineage`);
    }

    if (capability.deliveryClass === 'READY' && capability.operation !== 'read') {
      if (!capability.actors?.length) errors.push(`READY writable capability ${capability.id} requires actors`);
      if (!MODES.has(capability.mode)) errors.push(`READY writable capability ${capability.id} requires a valid mode`);
      for (const owner of ['requestDto', 'policy', 'persistence', 'concurrency']) {
        if (!capability.backend?.[owner]) errors.push(`READY writable capability ${capability.id} requires ${owner}`);
      }
      if (!capability.sourceLineage?.length) errors.push(`READY writable capability ${capability.id} requires source lineage`);
      for (const surfaceId of capability.surfaceIds || []) {
        const surface = surfaces.find((candidate) => candidate.id === surfaceId);
        if (!surface) continue;
        for (const state of REQUIRED_STATES) {
          if (!surface.states?.includes(state)) errors.push(`Surface ${surface.id} is missing state ${state}`);
        }
      }
    }
  }

  for (const surface of surfaces) {
    checkPath(errors, root, surface.owner, 'owner');
    checkPath(errors, root, surface.skeleton?.owner, 'owner');
    for (const capabilityId of surface.capabilityIds || []) {
      if (!capabilityIds.has(capabilityId)) errors.push(`Surface ${surface.id} references unknown capability ${capabilityId}`);
    }
    if (!surface.evidenceRequired?.includes('browser')) errors.push(`${surface.id} must retain browser evidence`);
    if (!surface.evidenceRequired?.includes('persistence')) errors.push(`${surface.id} must retain persistence evidence`);
  }

  for (const conflict of conflicts) {
    for (const requirementId of conflict.requirementIds || []) {
      if (!requirementIds.has(requirementId)) errors.push(`Conflict ${conflict.id} references unknown requirement ${requirementId}`);
    }
    for (const evidencePath of conflict.evidence || []) checkPath(errors, root, evidencePath, 'source');
  }

  const routes = canonicalRoutes || parseCanonicalRoutes(root);
  const surfaceRoutes = new Set(surfaces.map((surface) => surface.route));
  for (const route of routes) {
    if (route === '/login' || route === '/forbidden') continue;
    if (!surfaceRoutes.has(route)) errors.push(`Canonical route ${route} has no surface`);
  }

  return errors;
}

function runCli() {
  const contractPath = process.argv[2];
  if (!contractPath) {
    console.error('Usage: node scripts/check-conformance-contracts.mjs <contract.json>');
    process.exitCode = 1;
    return;
  }
  let contract;
  try {
    contract = JSON.parse(readFileSync(resolve(contractPath), 'utf8'));
  } catch (error) {
    console.error(`Cannot read conformance contract: ${error.message}`);
    process.exitCode = 1;
    return;
  }
  const errors = validateConformanceContracts(contract, { repoRoot: process.cwd() });
  if (errors.length) {
    for (const error of errors) console.error(error);
    process.exitCode = 1;
    return;
  }
  console.log('Conformance contracts: PASS');
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) runCli();
