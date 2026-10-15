import React from 'react';
import { cva, type VariantProps } from 'class-variance-authority';
import { clsx } from 'clsx';
import { twMerge } from 'tailwind-merge';

const badgeVariants = cva(
  'inline-flex items-center gap-1 rounded px-2 py-0.5 text-xs font-medium transition-colors select-none',
  {
    variants: {
      variant: {
        default: 'bg-slate-100 text-slate-800 border border-slate-200',
        neutral: 'bg-slate-50 text-slate-600 border border-slate-200',
        success: 'bg-emerald-50 text-emerald-800 border border-emerald-200',
        warning: 'bg-amber-50 text-amber-800 border border-amber-200',
        danger: 'bg-rose-50 text-rose-800 border border-rose-200',
        info: 'bg-blue-50 text-blue-800 border border-blue-200',
        outline: 'border border-slate-300 text-slate-700 bg-white',
      },
      size: {
        default: 'text-xs px-2 py-0.5',
        sm: 'text-[11px] px-1.5 py-0.25',
      },
    },
    defaultVariants: {
      variant: 'default',
      size: 'default',
    },
  }
);

export interface BadgeProps
  extends React.HTMLAttributes<HTMLSpanElement>,
    VariantProps<typeof badgeVariants> {}

export function Badge({ className, variant, size, ...props }: BadgeProps) {
  return (
    <span
      className={twMerge(clsx(badgeVariants({ variant, size, className })))}
      {...props}
    />
  );
}
