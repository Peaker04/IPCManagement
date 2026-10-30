export function toIsoDate(val: string): string {
  if (!val) return '';
  if (/^\d{4}-\d{2}-\d{2}$/.test(val)) return val;
  const match = val.match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})$/);
  if (match) {
    const [, d, m, y] = match;
    return `${y}-${m.padStart(2, '0')}-${d.padStart(2, '0')}`;
  }
  return val;
}

export function toVietnameseDate(val: string): string {
  if (!val) return '';
  if (/^\d{1,2}\/\d{1,2}\/\d{4}$/.test(val)) return val;
  const match = val.match(/^(\d{4})-(\d{2})-(\d{2})$/);
  if (match) {
    const [, y, m, d] = match;
    return `${d.padStart(2, '0')}/${m.padStart(2, '0')}/${y}`;
  }
  return val;
}

export function todayInBusinessTimezone(now: Date = new Date()): string {
  return new Intl.DateTimeFormat('en-CA', {
    timeZone: 'Asia/Ho_Chi_Minh', year: 'numeric', month: '2-digit', day: '2-digit',
  }).format(now);
}

export function formatVietnameseDateTime(val: string | Date | null | undefined): string {
  if (!val) return '—';
  const date = val instanceof Date ? val : new Date(val);
  if (Number.isNaN(date.getTime())) return '—';
  return new Intl.DateTimeFormat('vi-VN', {
    timeZone: 'Asia/Ho_Chi_Minh', day: '2-digit', month: '2-digit', year: 'numeric',
    hour: '2-digit', minute: '2-digit', hour12: false,
  }).format(date);
}

export function formatVietnameseDate(val: string | Date | null | undefined): string {
  if (!val) return '—';
  if (val instanceof Date) {
    const d = String(val.getDate()).padStart(2, '0');
    const m = String(val.getMonth() + 1).padStart(2, '0');
    const y = val.getFullYear();
    return `${d}/${m}/${y}`;
  }
  return toVietnameseDate(String(val));
}

export function weekStartFor(isoDate: string): string {
  if (!isoDate) return '';
  const match = isoDate.match(/^(\d{4})-(\d{2})-(\d{2})/);
  if (!match) return isoDate;
  const date = new Date(Date.UTC(Number(match[1]), Number(match[2]) - 1, Number(match[3])));
  const day = date.getUTCDay();
  date.setUTCDate(date.getUTCDate() - (day === 0 ? 6 : day - 1));
  return date.toISOString().slice(0, 10);
}

export function currentWeekStart(now: Date = new Date()): string {
  const businessIso = todayInBusinessTimezone(now);
  return weekStartFor(businessIso);
}

