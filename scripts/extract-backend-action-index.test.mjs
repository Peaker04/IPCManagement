import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, readdirSync, statSync } from 'node:fs';
import { join } from 'node:path';
import { buildBackendActionIndex, extractControllerActions } from './extract-backend-action-index.mjs';

const SOURCE = `
[ApiController]
[Route("api/purchase-orders")]
[Authorize(Policy = "PurchasingRead")]
public sealed class PurchaseOrdersController : ControllerBase
{
    [HttpPost("from-request/{purchaseRequestId:guid}")]
    [Authorize(Policy = "PurchasingWrite")]
    [ProducesResponseType(typeof(IReadOnlyList<PurchaseOrderDto>), StatusCodes.Status201Created)]
    public async Task<ActionResult<IReadOnlyList<PurchaseOrderDto>>> CreateFromRequestAsync(
        [FromRoute] Guid purchaseRequestId,
        [FromBody] CreatePurchaseOrderRequest request,
        CancellationToken cancellationToken)
    {
        return Created();
    }

    [HttpGet]
    public async Task<ActionResult<IReadOnlyList<PurchaseOrderDto>>> GetAllAsync(CancellationToken cancellationToken)
        => Ok();
}`;

test('indexes every Backend HTTP action exactly once', () => {
  const repoRoot = join(import.meta.dirname, '..');
  const root = join(repoRoot, 'backend/src/IPCManagement.Api/Features');
  const files = [];
  const visit = (directory) => {
    for (const entry of readdirSync(directory)) {
      const absolute = join(directory, entry);
      if (statSync(absolute).isDirectory()) visit(absolute);
      else if (/Controller(?:\.[^.]+)?\.cs$/.test(entry)) files.push(absolute);
    }
  };
  visit(root);
  const declaredActions = files.reduce((total, file) => total + (readFileSync(file, 'utf8').match(/\[Http(?:Get|Post|Put|Patch|Delete)\b/g) || []).length, 0);
  const index = buildBackendActionIndex(repoRoot);
  assert.equal(index.actions.length, declaredActions, 'Every HTTP action attribute must produce one index record');
  assert.equal(new Set(index.actions.map((action) => `${action.source}:${action.sourceMethod}:${action.httpMethod}`)).size, declaredActions, 'Action index records must be unique');
});

test('extracts route and policy from combined controller attributes', () => {
  const source = `[ApiController, Route("api/reconciliation/batches"), Authorize]\npublic sealed class ReconciliationBatchesController : ControllerBase { [HttpGet, Authorize(Policy = "ReconciliationReadAccess")] public IActionResult List() => Ok(); }`;
  const [action] = extractControllerActions(source, 'ReconciliationBatchesController.cs');
  assert.equal(action.route, 'api/reconciliation/batches');
  assert.deepEqual(action.policies, ['AUTHENTICATED', 'ReconciliationReadAccess']);
});

test('applies route and authentication metadata from a sibling partial controller file', () => {
  const partial = `public sealed partial class WeeklyMenuImportsController { [HttpGet("weekly-menu")] public IActionResult Get() => Ok(); }`;
  const [action] = extractControllerActions(partial, 'WeeklyMenuImportsController.Queries.cs', { route: 'api/coordination', policies: ['AUTHENTICATED'] });
  assert.equal(action.route, 'api/coordination/weekly-menu');
  assert.deepEqual(action.policies, ['AUTHENTICATED']);
});

test('keeps the checked-in Backend action index byte-stable', () => {
  const repoRoot = join(import.meta.dirname, '..');
  const expected = `${JSON.stringify(buildBackendActionIndex(repoRoot), null, 2)}\n`;
  assert.equal(readFileSync(join(repoRoot, 'docs/backend-action-index.json'), 'utf8'), expected);
});

test('extracts multiline controller actions without inventing business semantics', () => {
  const actions = extractControllerActions(SOURCE, 'backend/src/IPCManagement.Api/Features/Purchasing/Controllers/PurchaseOrdersController.cs');
  assert.deepEqual(actions, [
    {
      actionId: 'PurchaseOrders.CreateFromRequest', controller: 'PurchaseOrdersController', sourceMethod: 'CreateFromRequestAsync',
      source: 'backend/src/IPCManagement.Api/Features/Purchasing/Controllers/PurchaseOrdersController.cs', httpMethod: 'POST',
      route: 'api/purchase-orders/from-request/{purchaseRequestId:guid}', policies: ['PurchasingRead', 'PurchasingWrite'],
      requestTypes: ['CreatePurchaseOrderRequest'], responseTypes: ['PurchaseOrderDto'],
    },
    {
      actionId: 'PurchaseOrders.GetAll', controller: 'PurchaseOrdersController', sourceMethod: 'GetAllAsync',
      source: 'backend/src/IPCManagement.Api/Features/Purchasing/Controllers/PurchaseOrdersController.cs', httpMethod: 'GET',
      route: 'api/purchase-orders', policies: ['PurchasingRead'], requestTypes: [], responseTypes: ['PurchaseOrderDto'],
    },
  ]);
});
