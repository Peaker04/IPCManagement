import React from 'react';
import { clsx } from 'clsx';
import { twMerge } from 'tailwind-merge';
import { formatNumber } from '../../utils/formatters';

export interface NumProps extends React.HTMLAttributes<HTMLSpanElement> {
  value: number | string | null | undefined;
  format?: 'currency' | 'quantity' | 'percent' | 'plain';
  decimals?: number;
  prefix?: string;
  suffix?: string;
}

export function Num({
  value,
  format = 'plain',
  decimals,
  prefix = '',
  suffix = '',
  className,
  ...props
}: NumProps) {
  const formattedText = formatNumber(value, format, decimals);
  return (
    <span
      className={twMerge(clsx('tabular-nums font-mono text-right inline-block', className))}
      {...props}
    >
      {prefix}
      {formattedText}
      {suffix}
    </span>
  );
}
