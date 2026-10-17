import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { validateConformanceContracts } from './check-conformance-contracts.mjs';

function repository() {
  const root = mkdtempSync(join(tmpdir(), 'ipc-conformance-'));
  for (const path of ['docs/source.md', 'backend/controller.cs', 'backend/request.cs', 'backend/response.cs', 'backend/policy.cs', 'backend/concurrency.cs', 'backend/persistence.cs', 'frontend/page.tsx']) {
    const absolute = join(root, path);
    mkdirSync(join(absolute, '..'), { recursive: true });
    writeFileSync(absolute, 'owner');
  }
  return root;
}

function validContract() {
  return {
    version: 1,
    requirements: [{ id: 'FR-TEST', kind: 'FR', source: 'docs/source.md', statement: 'Test capability', assessment: 'PASS', capabilityIds: ['CAP-READ'], evidenceRequired: ['contract'] }],
    capabilities: [{
      id: 'CAP-READ', frCode: 'FR-TEST', name: 'Read records', operation: 'read', mode: 'DEFAULT', actors: ['Admin'], permissionTokens: [], grain: 'one row', prerequisites: [], sourceLineage: ['DEFAULT record'],
      backend: { controller: 'backend/controller.cs', responseDto: 'backend/response.cs' }, deliveryClass: 'READY', requirementIds: ['FR-TEST'], surfaceIds: ['SURFACE-TEST'], gaps: [],
    }],
    surfaces: [{
      id: 'SURFACE-TEST', route: '/test', workObject: 'OperationalFrame', capabilityIds: ['CAP-READ'], actions: [],
      states: ['loading', 'empty', 'error', 'permission-denied', 'partial', 'write-reconciliation'],
      skeleton: { kind: 'table', owner: 'frontend/page.tsx', geometryContract: 'Matches the resolved table columns and compact rows.' },
      owner: 'frontend/page.tsx', evidenceRequired: ['contract', 'browser'],
    }],
    conflicts: [],
  };
}

function errorsFor(contract, options = {}) {
  return validateConformanceContracts(contract, { repoRoot: repository(), canonicalRoutes: ['/test'], ...options });
}

test('rejects duplicate requirement, capability, surface, and conflict IDs', () => {
  const contract = validContract();
  contract.requirements.push({ ...contract.requirements[0] });
  contract.capabilities.push({ ...contract.capabilities[0] });
  contract.surfaces.push({ ...contract.surfaces[0] });
  contract.conflicts.push({ id: 'CONFLICT-1', requirementIds: ['FR-TEST'], description: 'A', evidence: ['docs/source.md'], decision: 'OWNER_DECISION_REQUIRED' });
  contract.conflicts.push({ ...contract.conflicts[0] });

  const errors = errorsFor(contract).join('\n');
  assert.match(errors, /duplicate requirement id FR-TEST/i);
  assert.match(errors, /duplicate capability id CAP-READ/i);
  assert.match(errors, /duplicate surface id SURFACE-TEST/i);
  assert.match(errors, /duplicate conflict id CONFLICT-1/i);
});

test('rejects dangling requirement, capability, and surface references', () => {
  const contract = validContract();
  contract.requirements[0].capabilityIds = ['CAP-MISSING'];
  contract.capabilities[0].requirementIds = ['FR-MISSING'];
  contract.capabilities[0].surfaceIds = ['SURFACE-MISSING'];
  contract.surfaces[0].capabilityIds = ['CAP-MISSING'];

  const errors = errorsFor(contract).join('\n');
  assert.match(errors, /unknown capability CAP-MISSING/i);
  assert.match(errors, /unknown requirement FR-MISSING/i);
  assert.match(errors, /unknown surface SURFACE-MISSING/i);
});

test('rejects missing source and owner paths', () => {
  const contract = validContract();
  contract.requirements[0].source = 'docs/missing.md';
  contract.capabilities[0].backend.controller = 'backend/missing.cs';
  contract.surfaces[0].owner = 'frontend/missing.tsx';

  const errors = errorsFor(contract).join('\n');
  assert.match(errors, /missing source path docs\/missing\.md/i);
  assert.match(errors, /missing owner path backend\/missing\.cs/i);
  assert.match(errors, /missing owner path frontend\/missing\.tsx/i);
});

test('requires every canonical route except login and forbidden to have a surface', () => {
  const errors = errorsFor(validContract(), { canonicalRoutes: ['/test', '/missing', '/login', '/forbidden'] }).join('\n');
  assert.match(errors, /canonical route \/missing has no surface/i);
  assert.doesNotMatch(errors, /canonical route \/login/i);
  assert.doesNotMatch(errors, /canonical route \/forbidden/i);
});

test('rejects READY write capability without actor, mode, DTO, policy, persistence, concurrency, and full six-state surface', () => {
  const contract = validContract();
  contract.capabilities[0] = {
    ...contract.capabilities[0], operation: 'create', actors: [], mode: '',
    backend: { controller: 'backend/controller.cs', responseDto: 'backend/response.cs' }, sourceLineage: [],
  };
  contract.surfaces[0].states = ['loading', 'error'];

  const errors = errorsFor(contract).join('\n');
  assert.match(errors, /READY writable capability CAP-READ requires actors/i);
  assert.match(errors, /requires a valid mode/i);
  assert.match(errors, /requires requestDto/i);
  assert.match(errors, /requires policy/i);
  assert.match(errors, /requires persistence/i);
  assert.match(errors, /requires concurrency/i);
  assert.match(errors, /requires source lineage/i);
  assert.match(errors, /surface SURFACE-TEST is missing state empty/i);
});

test('rejects a capability that mixes DEFAULT and MATERIAL_RECONCILIATION lineage', () => {
  const contract = validContract();
  contract.capabilities[0].sourceLineage = ['DEFAULT inventory issue', 'MRX reconciliation batch'];
  const errors = errorsFor(contract).join('\n');
  assert.match(errors, /CAP-READ mixes DEFAULT and MATERIAL_RECONCILIATION lineage/i);
});

test('retains browser and persistence evidence obligations when only unit evidence exists', () => {
  const contract = validContract();
  contract.surfaces[0].evidenceRequired = ['unit'];
  const errors = errorsFor(contract).join('\n');
  assert.match(errors, /SURFACE-TEST must retain browser evidence/i);
  assert.match(errors, /SURFACE-TEST must retain persistence evidence/i);
});

test('rejects a stale canonical requirement statement digest', () => {
  const root = repository();
  writeFileSync(join(root, 'docs/source.md'), '| `FR-TEST` | Test capability | Full canonical requirement. |');
  const contract = validContract();
  contract.requirements[0] = { ...contract.requirements[0], title: 'Test capability', sourceAnchor: 'FR-TEST', statementDigest: 'stale-digest' };
  const errors = validateConformanceContracts(contract, { repoRoot: root, canonicalRoutes: ['/test'] }).join('\n');
  assert.match(errors, /FR-TEST canonical statement changed/i);
});

test('canonical docs bind loading geometry write readiness and evidence hierarchy', () => {
  const repoRoot = join(import.meta.dirname, '..');
  const design = readFileSync(join(repoRoot, 'docs/DESIGN.md'), 'utf8');
  const engineering = readFileSync(join(repoRoot, 'docs/ENGINEERING.md'), 'utf8');
  const uiKit = readFileSync(join(repoRoot, 'docs/UI-KIT.md'), 'utf8');
  assert.match(design, /skeleton.*giữ nguyên.*ngữ cảnh route.*hình học.*work object/i);
  assert.match(design, /loading.*kết thúc.*empty.*error.*permission-denied.*partial.*write-reconciliation/is);
  assert.match(engineering, /READY`? write capability.*actor.*permission.*mode.*source lineage.*concurrency/is);
  assert.match(engineering, /unit evidence.*không.*thay thế.*browser.*persistence/i);
  assert.match(uiKit, /skeleton.*geometryContract.*không.*bản ghi giả/i);
});

test('keeps the runtime workbench surface registry in parity with conformance geometry', async () => {
  const repoRoot = join(import.meta.dirname, '..');
  const contract = JSON.parse(readFileSync(join(repoRoot, 'docs/conformance-contracts.json'), 'utf8'));
  const { WORKBENCH_SURFACES, resolveWorkbenchSurface } = await import('../frontend/src/routes/workbenchSurfaceRegistry.ts');
  const keys = new Set();
  for (const surface of WORKBENCH_SURFACES) {
    const key = `${surface.route}?${surface.view || ''}`;
    assert.ok(!keys.has(key), `duplicate runtime surface ${key}`);
    keys.add(key);
    const canonical = contract.surfaces.find((item) => item.id === surface.id);
    assert.ok(canonical, `${surface.id} must exist in conformance contracts`);
    assert.equal(surface.route, canonical.route);
    assert.equal(surface.view, canonical.view);
    assert.equal(surface.geometry.kind, canonical.skeleton.kind);
    assert.deepEqual(surface.geometry, canonical.skeleton.geometry);
    for (const forbidden of ['values', 'counts', 'status', 'date', 'identifier', 'rowData']) assert.ok(!(forbidden in surface.geometry), `${surface.id} geometry cannot contain ${forbidden}`);
    assert.equal(resolveWorkbenchSurface(surface.route, surface.view ? `?view=${surface.view}` : '').id, surface.id);
  }
  assert.equal(WORKBENCH_SURFACES.length, contract.surfaces.length);
});

test('maps every N6 navigation destination to a complete surface contract', () => {
  const repoRoot = join(import.meta.dirname, '..');
  const contract = JSON.parse(readFileSync(join(repoRoot, 'docs/conformance-contracts.json'), 'utf8'));
  const navigation = readFileSync(join(repoRoot, 'frontend/src/components/workbench/AppShell.tsx'), 'utf8');
  const destinations = new Set([...navigation.matchAll(/\bto:\s*'([^']+)'/g)].map((match) => match[1]));
  const capabilities = new Map(contract.capabilities.map((capability) => [capability.id, capability]));
  const tableContracts = new Set(JSON.parse(readFileSync(join(repoRoot, 'docs/table-contracts.json'), 'utf8')).contracts.map((item) => item.id));
  for (const destination of destinations) {
    const [route, query = ''] = destination.split('?');
    const view = new URLSearchParams(query).get('view') || undefined;
    const surface = contract.surfaces.find((item) => item.route === route && item.view === view);
    assert.ok(surface, `${destination} must have a surface contract`);
  }
  for (const surface of contract.surfaces) {
    for (const state of ['loading', 'empty', 'error', 'permission-denied', 'partial', 'write-reconciliation']) assert.ok(surface.states.includes(state), `${surface.id} must declare ${state}`);
    assert.ok(surface.skeleton.owner && surface.skeleton.geometryContract, `${surface.id} must declare skeleton ownership and geometry`);
    assert.ok(surface.evidenceRequired.includes('browser') && surface.evidenceRequired.includes('persistence'), `${surface.id} must retain browser and persistence evidence`);
    for (const action of surface.actions) {
      const capability = capabilities.get(action.capabilityId);
      assert.ok(capability, `${surface.id} action ${action.id} references an unknown capability`);
      assert.notEqual(capability.operation, 'read', `${surface.id} action ${action.id} must map to a writable capability`);
    }
    assert.ok(!surface.tableContractId || tableContracts.has(surface.tableContractId), `${surface.id} references unknown table contract ${surface.tableContractId}`);
    if (!surface.tableContractId) assert.ok(surface.gaps.some((gap) => gap.startsWith('TABLE_CONTRACT_GAP')), `${surface.id} without a table contract must record TABLE_CONTRACT_GAP`);
  }
});

test('splits Auth and System writes at their actual operation grain', () => {
  const repoRoot = join(import.meta.dirname, '..');
  const contract = JSON.parse(readFileSync(join(repoRoot, 'docs/conformance-contracts.json'), 'utf8'));
  const expectedOwners = new Map([
    ['Auth.Login', 'AUTH.LOGIN'],
    ['Auth.Refresh', 'AUTH.REFRESH'],
    ['Auth.Logout', 'AUTH.LOGOUT'],
    ['Auth.Revoke', 'AUTH.REVOKE'],
    ['SystemOperationMode.Initialize', 'SYS.MODE.INITIALIZE'],
    ['SystemOperationMode.Change', 'SYS.MODE.CHANGE'],
  ]);
  for (const [actionId, capabilityId] of expectedOwners) {
    const owners = contract.capabilities.filter((capability) => capability.actionIds.includes(actionId));
    assert.deepEqual(owners.map((owner) => owner.id), [capabilityId], `${actionId} must be owned by ${capabilityId}`);
  }
  const change = contract.capabilities.find((capability) => capability.id === 'SYS.MODE.CHANGE');
  const concurrencyOwner = readFileSync(join(repoRoot, change.backend.concurrency), 'utf8');
  assert.match(concurrencyOwner, /ExpectedVersion[\s\S]*OriginalValue[\s\S]*DbUpdateConcurrencyException[\s\S]*verifySucceeded/i);
});

test('splits Catalog and Admin capabilities at their actual operation grain', () => {
  const repoRoot = join(import.meta.dirname, '..');
  const contract = JSON.parse(readFileSync(join(repoRoot, 'docs/conformance-contracts.json'), 'utf8'));
  const expectedOwners = new Map([
    ['Ingredients.Create', 'CAT.INGREDIENT.CREATE'],
    ['Ingredients.Update', 'CAT.INGREDIENT.UPDATE'],
    ['Ingredients.Delete', 'CAT.INGREDIENT.CLOSE'],
    ['Dishes.Create', 'CAT.DISH.CREATE'],
    ['Dishes.Update', 'CAT.DISH.UPDATE'],
    ['Dishes.Delete', 'CAT.DISH.CLOSE'],
    ['DishBom.AddBomLine', 'CAT.BOM.LINE.ADD'],
    ['DishBom.UpdateBomLine', 'CAT.BOM.LINE.UPDATE'],
    ['DishBom.CloseBomLine', 'CAT.BOM.LINE.CLOSE'],
    ['AdminEmployees.Create', 'ADMIN.EMPLOYEE.CREATE'],
    ['AdminEmployees.Update', 'ADMIN.EMPLOYEE.UPDATE'],
    ['AdminEmployees.UpdateStatus', 'ADMIN.EMPLOYEE.STATUS'],
    ['LifecycleOutbox.Get', 'ADMIN.OUTBOX.READ'],
    ['LifecycleOutbox.Replay', 'ADMIN.OUTBOX.REPLAY'],
    ['ApprovalRules.GetRules', 'APPR.RULES.READ'],
    ['ApprovalRules.GetRuleById', 'APPR.RULES.READ'],
    ['ApprovalRules.CreateRule', 'APPR.RULES.CREATE'],
    ['ApprovalRules.UpdateRule', 'APPR.RULES.UPDATE'],
    ['ApprovalRules.DeleteRule', 'APPR.RULES.DELETE'],
  ]);

  for (const [actionId, capabilityId] of expectedOwners) {
    const owners = contract.capabilities.filter((capability) => capability.actionIds && capability.actionIds.includes(actionId));
    assert.deepEqual(owners.map((owner) => owner.id), [capabilityId], `${actionId} must be owned by ${capabilityId}`);
  }

  const ingredientCreate = contract.capabilities.find((c) => c.id === 'CAT.INGREDIENT.CREATE');
  assert.ok(ingredientCreate, 'CAT.INGREDIENT.CREATE must exist');
  assert.equal(ingredientCreate.deliveryClass, 'BLOCKED');
  assert.ok(
    ingredientCreate.gaps.some((g) => g.includes('UnitsController') || g.includes('UnitId')),
    'CAT.INGREDIENT.CREATE must explicitly document missing UnitsController lookup authority'
  );
});

test('maps every rendered Backend mutation to one guarded writable surface action', () => {
  const repoRoot = join(import.meta.dirname, '..');
  const contract = JSON.parse(readFileSync(join(repoRoot, 'docs/conformance-contracts.json'), 'utf8'));
  const owners = [
    'frontend/src/features/approvals/ApprovalPage.tsx',
    'frontend/src/features/reconciliation/ReconciliationPage.tsx',
    'frontend/src/features/admin/AdvancedSettingsPage.tsx',
  ];
  for (const owner of owners) {
    const source = readFileSync(join(repoRoot, owner), 'utf8');
    for (const match of source.matchAll(/<ActionGuard\b[^>]*capabilityId="([^"]+)"/g)) {
      const capability = contract.capabilities.find((item) => item.id === match[1]);
      assert.ok(capability, `${owner} references unknown capability ${match[1]}`);
      assert.notEqual(capability.operation, 'read', `${match[1]} must be writable`);
      const actions = contract.surfaces.flatMap((surface) => surface.actions).filter((action) => action.capabilityId === match[1]);
      assert.equal(actions.length, 1, `${match[1]} must own exactly one rendered surface action`);
      assert.doesNotMatch(capability.gaps.join('\n'), /frontend.*(?:surface|recovery).*not mapped|ui recovery unresolved/i, `${match[1]} retains a stale frontend mapping gap`);
    }
  }
});

test('maps every Backend action to exactly one capability', () => {
  const repoRoot = join(import.meta.dirname, '..');
  const contract = JSON.parse(readFileSync(join(repoRoot, 'docs/conformance-contracts.json'), 'utf8'));
  const index = JSON.parse(readFileSync(join(repoRoot, 'docs/backend-action-index.json'), 'utf8'));
  const owners = new Map();
  for (const capability of contract.capabilities) {
    for (const actionId of capability.actionIds || []) owners.set(actionId, [...(owners.get(actionId) || []), capability.id]);
  }
  for (const action of index.actions) assert.equal(owners.get(action.actionId)?.length, 1, `${action.actionId} must map to exactly one capability`);
});

test('maps every FR requirement to a source-backed capability or explicit gap', () => {
  const repoRoot = join(import.meta.dirname, '..');
  const contract = JSON.parse(readFileSync(join(repoRoot, 'docs/conformance-contracts.json'), 'utf8'));
  for (const capability of contract.capabilities) {
    assert.ok(capability.requirementIds.length > 0, `${capability.id} must reference a requirement`);
    if (capability.deliveryClass === 'READY') {
      assert.ok(capability.backend.controller, `${capability.id} must name its controller`);
      assert.ok(capability.backend.responseDto, `${capability.id} must name its response DTO`);
      if (capability.operation !== 'read') {
        assert.ok(capability.backend.requestDto, `${capability.id} must name its request DTO`);
        assert.ok(capability.backend.policy, `${capability.id} must name its policy`);
        assert.ok(capability.backend.persistence, `${capability.id} must name its persistence owner`);
      }
    }
  }
  for (const requirement of contract.requirements.filter((item) => item.kind === 'FR')) {
    assert.ok(requirement.capabilityIds.length > 0 || ['GAP', 'CONFLICT'].includes(requirement.assessment), `${requirement.id} must map to a capability or explicit gap`);
  }
});

test('covers every canonical requirement ID exactly once or records a conflict', () => {
  const repoRoot = join(import.meta.dirname, '..');
  const sources = ['docs/DOMAIN.md', 'docs/FLOWS.md', 'docs/DESIGN.md', 'docs/ENGINEERING.md', 'docs/UI-KIT.md', 'docs/table-contracts.json'];
  const canonicalIds = new Set();
  for (const source of sources) {
    const text = readFileSync(join(repoRoot, source), 'utf8');
    for (const match of text.matchAll(/\|\s*`((?:BR|FR|NFR|UXR)-[A-Z0-9.-]+|[DTMN][0-9]+(?:\.[0-9]+)?)`\s*\|/g)) canonicalIds.add(match[1]);
  }
  const contract = JSON.parse(readFileSync(join(repoRoot, 'docs/conformance-contracts.json'), 'utf8'));
  const counts = new Map();
  for (const requirement of contract.requirements) counts.set(requirement.id, (counts.get(requirement.id) || 0) + 1);
  for (const id of canonicalIds) assert.equal(counts.get(id), 1, `${id} must have exactly one requirement contract`);
});
