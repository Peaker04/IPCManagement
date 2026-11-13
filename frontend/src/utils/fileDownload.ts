import { ApiError, authenticatedFetch } from '../api/client';

/** Download authenticated bytes; callers own visible pending/error feedback. */
export async function downloadAuthenticatedFile(url: string, filename?: string): Promise<void> {
  const response = await authenticatedFetch(url);
  const token = localStorage.getItem('ipc_v3_token');
  if (!response.ok) throw new Error(`Không thể tải tệp (HTTP ${response.status}). Vui lòng thử lại.`);
  const blob = await response.blob();
  if (localStorage.getItem('ipc_v3_token') !== token) throw new ApiError(401, 'Phiên đăng nhập đã thay đổi. Vui lòng tải lại dữ liệu.', undefined, 'SESSION_CHANGED');
  const objectUrl = URL.createObjectURL(blob);
  const anchor = document.createElement('a');
  try {
    anchor.href = objectUrl;
    let serverFilename = '';
    if (!filename) {
      const disposition = response.headers.get('Content-Disposition') ?? '';
      const encoded = /filename\*=UTF-8''([^;]+)/i.exec(disposition)?.[1];
      try {
        const candidate = encoded ? decodeURIComponent(encoded.trim()) : /filename="([^"]+)"/i.exec(disposition)?.[1] ?? '';
        if (/^[\p{L}\p{N}_ .()-]+\.xlsx$/u.test(candidate) && !candidate.includes('..')) serverFilename = candidate;
      } catch { /* Malformed server names use the safe fallback. */ }
    }
    anchor.download = filename || serverFilename || 'tep-tai-ve.xlsx';
    document.body.appendChild(anchor);
    anchor.click();
  } finally {
    anchor.remove();
    URL.revokeObjectURL(objectUrl);
  }
}
