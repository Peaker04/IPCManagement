import { afterEach, expect, it } from 'vitest';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { readQualificationCredentials } from '../authHelpers';

const directories: string[] = [];
afterEach(() => {
  for (const directory of directories.splice(0)) fs.rmSync(directory, { recursive: true, force: true });
});
function credentialFile(value: unknown): string {
  const directory = fs.mkdtempSync(path.join(os.tmpdir(), 'ipc-credential-contract-'));
  directories.push(directory);
  const file = path.join(directory, 'roles.json');
  fs.writeFileSync(file, JSON.stringify(value));
  return file;
}
const records = Object.fromEntries(['admin', 'dieuphoi', 'thukho', 'beptruong', 'manager']
  .map((role) => [role, { username: `fixture-${role}`, password: 'fixture-only-not-a-real-account' }]));

it('requires an explicit private credential file instead of falling back to legacy accounts', () => {
  expect(() => readQualificationCredentials({})).toThrow(/credential file.*required/i);
});

it('loads five declared identities without changing their passwords', () => {
  expect(readQualificationCredentials({ MRX_E2E_CREDENTIALS_FILE: credentialFile(records) })).toEqual(records);
});

it.each([
  { ...records, manager: undefined },
  { ...records, manager: records.admin },
  { ...records, manager: { username: 'fixture-manager', password: '' } },
])('rejects missing, duplicate or unusable Manager identity without Admin substitution', (value) => {
  expect(() => readQualificationCredentials({ MRX_E2E_CREDENTIALS_FILE: credentialFile(value) }))
    .toThrow(/five distinct.*credentials/i);
});
