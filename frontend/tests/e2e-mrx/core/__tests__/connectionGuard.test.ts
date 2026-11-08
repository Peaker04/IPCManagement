import { expect, it } from 'vitest';
import { assertTargetConnectionDatabase } from '../dbGuardrail';

const target = 'ipc_mrx_evidence_20261101t120000z_a1b2c3';

it.each([
  'Database=ipcmanagement;Password="fixture;only"',
  `Database=${target};Initial Catalog=ipcmanagement`,
  'Server=localhost;Password="Database=ipc_mrx_evidence_20261101t120000z_a1b2c3"',
])('rejects an API connection whose actual database differs or is ambiguous', (connection) => {
  expect(() => assertTargetConnectionDatabase(connection, target))
    .toThrow(/connection.*database.*match/i);
});

it.each(['Database', 'Initial Catalog'])('accepts a quoted-password connection with exact target via %s', (key) => {
  expect(() => assertTargetConnectionDatabase(`${key}=${target};Password="fixture;Database=not-a-target"`, target))
    .not.toThrow();
});
