import React from 'react';
import { cva, type VariantProps } from 'class-variance-authority';
import { clsx } from 'clsx';
import { twMerge } from 'tailwind-merge';

const buttonVariants = cva(
  'inline-flex items-center justify-center gap-1.5 whitespace-nowrap rounded font-medium text-sm transition-colors focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-slate-400 disabled:pointer-events-none disabled:opacity-50 select-none cursor-pointer',
  {
    variants: {
      variant: {
        default: 'bg-slate-900 text-white hover:bg-slate-800 active:bg-slate-950 border border-transparent shadow-2xs',
        outline: 'border border-slate-300 bg-white text-slate-700 hover:bg-slate-50 hover:text-slate-900 active:bg-slate-100',
        ghost: 'text-slate-700 hover:bg-slate-100 hover:text-slate-900',
        destructive: 'bg-red-600 text-white hover:bg-red-700 active:bg-red-800 border border-transparent',
        link: 'text-blue-600 underline-offset-4 hover:underline p-0 h-auto font-normal',
        subtle: 'bg-slate-100 text-slate-700 hover:bg-slate-200 active:bg-slate-300',
      },
      size: {
        default: 'h-9 px-3.5 py-1.5 text-sm',
        sm: 'h-8 px-3 py-1 text-xs',
        xs: 'h-7 px-2.5 text-xs',
        icon: 'h-9 w-9 p-0',
      },
    },
    defaultVariants: {
      variant: 'default',
      size: 'default',
    },
  }
);

export interface ButtonProps
  extends React.ButtonHTMLAttributes<HTMLButtonElement>,
    VariantProps<typeof buttonVariants> {
  asChild?: boolean;
}

export const Button = React.forwardRef<HTMLButtonElement, ButtonProps>(
  ({ className, variant, size, ...props }, ref) => {
    return (
      <button
        ref={ref}
        className={twMerge(clsx(buttonVariants({ variant, size, className })))}
        {...props}
      />
    );
  }
);
Button.displayName = 'Button';
