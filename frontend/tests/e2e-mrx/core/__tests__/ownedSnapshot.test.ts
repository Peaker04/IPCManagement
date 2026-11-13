import { expect, it } from 'vitest';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { readOwnedSnapshot } from '../ownedSnapshot';

it('reads the snapshot from the start of the open descriptor after streamed writes', () => {
  const directory = fs.mkdtempSync(path.join(os.tmpdir(), 'ipc-owned-snapshot-'));
  const file = path.join(directory, 'snapshot.json');
  const descriptor = fs.openSync(file, 'wx+');
  try {
    const chunks = ['{"name":', '"Đối soát"}'];
    for (const chunk of chunks) fs.writeSync(descriptor, chunk);
    const content = chunks.join('');
    const result = readOwnedSnapshot(descriptor);
    expect(result.content).toBe(content);
    expect(result.bytes).toBe(Buffer.byteLength(content));
  } finally {
    fs.closeSync(descriptor);
    fs.rmSync(directory, { recursive: true, force: true });
  }
});
