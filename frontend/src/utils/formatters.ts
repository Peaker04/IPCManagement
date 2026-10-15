export function formatNumber(
  value: number | string | null | undefined,
  format: 'currency' | 'quantity' | 'percent' | 'plain' = 'plain',
  decimals?: number
): string {
  if (value === null || value === undefined || value === '') return '—';
  const num = typeof value === 'string' ? parseFloat(value.replace(/,/g, '')) : value;
  if (isNaN(num)) return '—';

  switch (format) {
    case 'currency': {
      const rounded = Math.round(num);
      const formatted = new Intl.NumberFormat('vi-VN', {
        maximumFractionDigits: decimals ?? 0,
        minimumFractionDigits: decimals ?? 0,
      }).format(rounded);
      return `${formatted} ₫`;
    }
    case 'quantity': {
      const maxDec = decimals ?? (num % 1 === 0 ? 0 : 2);
      const minDec = decimals !== undefined ? decimals : 0;
      return new Intl.NumberFormat('vi-VN', {
        maximumFractionDigits: maxDec,
        minimumFractionDigits: minDec,
      }).format(num);
    }
    case 'percent': {
      const dec = decimals ?? 1;
      return `${new Intl.NumberFormat('vi-VN', {
        maximumFractionDigits: dec,
        minimumFractionDigits: dec,
      }).format(num)}%`;
    }
    case 'plain':
    default: {
      return new Intl.NumberFormat('vi-VN', {
        maximumFractionDigits: decimals ?? 2,
      }).format(num);
    }
  }
}
