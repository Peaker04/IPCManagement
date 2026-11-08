export function normalizeSearchText(value?: string | null): string {
  return (value ?? '').normalize('NFD').replace(/\p{M}/gu, '').toLocaleLowerCase('vi-VN').replace(/đ/g, 'd').replace(/\s+/g, ' ').trim();
}
