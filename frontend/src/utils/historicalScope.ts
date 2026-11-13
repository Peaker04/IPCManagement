import { isIsoDate, todayInBusinessTimezone } from './dates';

export interface HistoricalSelection {
  period: string;
  year: string;
  from: string;
  to: string;
}

export function historicalRange(selection: HistoricalSelection): { weekFrom?: string; weekTo?: string; error?: string } {
  const today = todayInBusinessTimezone();
  if (selection.period === 'ALL') return {};
  if (selection.period === 'RANGE') {
    if (!isIsoDate(selection.from) || !isIsoDate(selection.to)) return { error: 'Nhập đủ ngày bắt đầu và kết thúc.' };
    if (selection.from > selection.to) return { error: 'Ngày bắt đầu không được sau ngày kết thúc.' };
    return { weekFrom: selection.from, weekTo: selection.to };
  }
  const year = selection.period === 'YEAR' ? selection.year : today.slice(0, 4);
  if (!/^\d{4}$/.test(year) || Number(year) < 1) return { error: 'Năm phải gồm bốn chữ số, từ 0001 đến 9999.' };
  if (selection.period === 'YEAR' || selection.period === 'THIS_YEAR') return { weekFrom: `${year}-01-01`, weekTo: `${year}-12-31` };
  if (selection.period === 'THIS_MONTH') {
    const month = today.slice(0, 7);
    const last = new Date(Number(year), Number(today.slice(5, 7)), 0).getDate();
    return { weekFrom: `${month}-01`, weekTo: `${month}-${last}` };
  }
  return { error: 'Chọn phạm vi thời gian hợp lệ.' };
}
