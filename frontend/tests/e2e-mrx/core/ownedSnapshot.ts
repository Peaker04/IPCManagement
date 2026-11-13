import fs from 'node:fs';

export function readOwnedSnapshot(descriptor: number): { content: string; bytes: number } {
  const bytes = fs.fstatSync(descriptor).size;
  const buffer = Buffer.alloc(bytes);
  let offset = 0;
  while (offset < bytes) {
    const read = fs.readSync(descriptor, buffer, offset, bytes - offset, offset);
    if (read === 0) throw new Error('Owned snapshot was truncated while being read');
    offset += read;
  }
  return { content: buffer.toString('utf8'), bytes };
}
