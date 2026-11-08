// Match BE quantity rounding without losing decimal half-micros to binary floating point.
export function normalizeQuantity(value: number, multiplier = 1): number {
  if (!Number.isFinite(value) || value <= 0 || !Number.isSafeInteger(multiplier) || multiplier <= 0) return 0;
  const [coefficient, exponent = '0'] = String(value).toLowerCase().split('e');
  const [whole, fraction = ''] = coefficient.split('.');
  const scale = fraction.length - Number(exponent) - 6;
  const product = BigInt(whole + fraction) * BigInt(multiplier);
  const divisor = 10n ** BigInt(Math.max(0, scale));
  const micros = scale > 0 ? (product + divisor / 2n) / divisor : product * 10n ** BigInt(-scale);
  return Number(micros) / 1_000_000;
}
