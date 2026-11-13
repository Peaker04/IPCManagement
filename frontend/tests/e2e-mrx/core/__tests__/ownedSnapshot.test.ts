import { expect, it } from 'vitest';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';

it('reads the exclusively opened snapshot identity even if its pathname is replaced', async () => {
  const owner = await import('../ownedSnapshot').catch(() => null);
  expect(owner, 'Owned snapshot reader is required').not.toBeNull();
  const directory = fs.mkdtempSync(path.join(os.tmpdir(), 'ipc-owned-snapshot-'));
  const file = path.join(directory, 'snapshot.json');
  const descriptor = fs.openSync(file, 'wx+');
  try {
    const content = JSON.stringify({ original: true });
    fs.writeSync(descriptor, content);
    fs.renameSync(file, path.join(directory, 'retained.json'));
    fs.writeFileSync(file, JSON.stringify({ replaced: true }));
    const result = owner!.readOwnedSnapshot(descriptor);
    expect(result.content).toBe(content);
    expect(result.bytes).toBe(Buffer.byteLength(content));
  } finally {
    fs.closeSync(descriptor);
    fs.rmSync(directory, { recursive: true, force: true });
  }
});
