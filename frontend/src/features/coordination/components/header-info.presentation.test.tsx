import { describe, expect, it } from 'vitest';
import source from './header-info.tsx?raw';

describe('coordination shift control presentation', () => {
  it('keeps both shift buttons inside one shared 36px segmented-control frame', () => {
    expect(source).toContain('inline-flex h-9 items-center rounded-md border border-slate-300 bg-slate-50 p-0.5');
    expect(source).toContain("variant={active ? 'default' : 'ghost'}");
    expect(source).toContain('className="h-8 min-w-28 rounded-sm border-0 shadow-none"');
    expect(source).not.toContain("variant={active ? 'default' : 'outline'}");
  });
});
