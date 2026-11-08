import React, { type ReactNode } from 'react';
import { formatCurrency, formatNumber, formatPercent, formatQuantity } from '@/lib/formatters';
import { cn } from '@/lib/utils';

export interface NumProps extends React.HTMLAttributes<HTMLSpanElement> {
  value: number | string | null | undefined;
  type?: 'currency' | 'number' | 'quantity' | 'percent' | 'raw';
  maximumFractionDigits?: number;
  unit?: string;
  prefix?: string;
  suffix?: string;
  fallback?: ReactNode;
}

/**
 * Standardized numerical display component with tabular-nums font features
 * Strictly enforces Rule C4 and Rule T3 to prevent layout shifts when numerical values update.
 */
export const Num: React.FC<NumProps> = ({
  value,
  type = 'number',
  maximumFractionDigits,
  unit,
  prefix = '',
  suffix = '',
  fallback = '—',
  className,
  ...props
}) => {
  if (value === null || value === undefined || (typeof value === 'number' && Number.isNaN(value))) {
    return <span className={cn('num tabular-nums text-slate-400', className)} {...props}>{fallback}</span>;
  }

  const numVal = typeof value === 'number' ? value : Number(value);
  if (Number.isNaN(numVal)) {
    return <span className={cn('num tabular-nums', className)} {...props}>{String(value)}</span>;
  }

  let formatted: string;
  switch (type) {
    case 'currency':
      formatted = formatCurrency(numVal, maximumFractionDigits ?? 0);
      break;
    case 'quantity':
      formatted = formatQuantity(numVal, { maximumFractionDigits });
      break;
    case 'percent':
      formatted = formatPercent(numVal, maximumFractionDigits ?? 1);
      break;
    case 'number':
      formatted = formatNumber(numVal);
      break;
    case 'raw':
    default:
      formatted = String(value);
      break;
  }

  if (unit) {
    formatted = `${formatted} ${unit}`;
  }

  return (
    <span className={cn('num tabular-nums', className)} {...props}>
      {prefix}{formatted}{suffix}
    </span>
  );
};
