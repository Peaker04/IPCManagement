import { afterEach, expect, it, vi } from 'vitest';
import { downloadAuthenticatedFile } from '../utils/fileDownload';

afterEach(() => { vi.restoreAllMocks(); vi.unstubAllGlobals(); localStorage.clear(); });

it.each([false, true])('downloads actual bytes with authentication, refresh=%s, and cleans its object URL', async refresh => {
  localStorage.setItem('ipc_v3_token', 'download-old');
  const user = JSON.parse(localStorage.getItem('ipc_v3_user')!);
  const fetch = vi.spyOn(globalThis, 'fetch').mockImplementation(async (input, init) => {
    const path = new URL(String(input)).pathname;
    if (path === '/api/auth/refresh') return new Response(JSON.stringify({ success: true, data: {
      accessToken: 'download-new', tokenType: 'Bearer', expiresIn: 1800, user,
    } }), { status: 200, headers: { 'Content-Type': 'application/json' } });
    if (path !== '/api/report/xlsx') throw new Error(`Unexpected download request ${path}`);
    if (refresh && new Headers(init?.headers).get('Authorization') === 'Bearer download-old') return new Response('', { status: 401 });
    return new Response('workbook-bytes');
  });
  const create = vi.fn((bytes: Blob) => { expect(bytes.size).toBe(14); return 'blob:unit-test'; });
  const revoke = vi.fn();
  const NativeURL = URL;
  vi.stubGlobal('URL', class extends NativeURL { static createObjectURL = create; static revokeObjectURL = revoke; });
  const click = vi.spyOn(HTMLAnchorElement.prototype, 'click').mockImplementation(function (this: HTMLAnchorElement) {
    expect(this.download).toBe('bao-cao.xlsx');
    expect(this.href).toBe('blob:unit-test');
  });
  await downloadAuthenticatedFile('/api/report/xlsx', 'bao-cao.xlsx');
  expect(fetch).toHaveBeenLastCalledWith(`${window.location.origin}/api/report/xlsx`, {
    headers: { Authorization: `Bearer ${refresh ? 'download-new' : 'download-old'}`, 'X-Operational-Mode': 'DEFAULT' },
  });
  expect(fetch.mock.calls.filter(([url]) => String(url).endsWith('/auth/refresh'))).toHaveLength(refresh ? 1 : 0);
  expect(await create.mock.calls[0][0].text()).toBe('workbook-bytes');
  expect(create).toHaveBeenCalledOnce();
  expect(click).toHaveBeenCalledOnce();
  expect(revoke).toHaveBeenCalledWith('blob:unit-test');
  expect(document.querySelector('a[download]')).toBeNull();
});

it('reports HTTP failure instead of opening an unauthenticated fallback or pretending success', async () => {
  vi.spyOn(globalThis, 'fetch').mockResolvedValue(new Response('', { status: 403 }));
  const open = vi.spyOn(window, 'open').mockImplementation(() => null);
  await expect(downloadAuthenticatedFile('/api/report/xlsx', 'bao-cao.xlsx')).rejects.toThrow(/403/);
  expect(open).not.toHaveBeenCalled();
});
