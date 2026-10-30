import React from 'react';
import { cva, type VariantProps } from 'class-variance-authority';
import { clsx } from 'clsx';
import { twMerge } from 'tailwind-merge';
import { Loader2 } from 'lucide-react';

export type ComponentInteractionState =
  | 'disabled'
  | 'loading'
  | 'readonly'
  | 'error'
  | 'warning'
  | 'active'
  | 'idle';

/**
 * Strict Finite State Machine (FSM) resolver for Component Interaction States (Rule L2-UI-01 & S-UI-01)
 * Enforces single unambiguous state based on strict precedence:
 * 'disabled' > 'loading' > 'readonly' > 'error' > 'warning' > 'active' > 'idle'
 */
export function resolveInteractionState(params: {
  disabled?: boolean;
  loading?: boolean;
  readOnly?: boolean;
  error?: boolean;
  warning?: boolean;
  active?: boolean;
}): ComponentInteractionState {
  if (params.disabled) return 'disabled';
  if (params.loading) return 'loading';
  if (params.readOnly) return 'readonly';
  if (params.error) return 'error';
  if (params.warning) return 'warning';
  if (params.active) return 'active';
  return 'idle';
}

const buttonVariants = cva(
  'inline-flex items-center justify-center gap-1.5 whitespace-nowrap rounded font-medium text-sm transition-all duration-150 active:scale-[0.98] ease-out focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-slate-400 select-none cursor-pointer',
  {
    variants: {
      variant: {
        default: 'bg-slate-900 text-white hover:bg-slate-800 active:bg-slate-950 border border-transparent shadow-2xs',
        outline: 'border border-slate-300 bg-white text-slate-700 hover:bg-slate-50 hover:text-slate-900 active:bg-slate-100',
        ghost: 'text-slate-700 hover:bg-slate-100 hover:text-slate-900 active:bg-slate-200',
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
  loading?: boolean;
  loadingText?: string;
  active?: boolean;
}

export const Button = React.forwardRef<HTMLButtonElement, ButtonProps>(
  ({ className, variant, size, disabled, loading, loadingText, active, children, onClick, ...props }, ref) => {
    const interactionState = resolveInteractionState({
      disabled,
      loading,
      active,
    });

    const isNonInteractive = interactionState === 'disabled' || interactionState === 'loading';
    const spinnerSize = size === 'xs' || size === 'sm' ? 12 : 14;

    return (
      <button
        ref={ref}
        data-interaction-state={interactionState}
        disabled={isNonInteractive}
        aria-busy={interactionState === 'loading' ? true : undefined}
        aria-disabled={interactionState === 'disabled' ? true : undefined}
        tabIndex={isNonInteractive ? -1 : props.tabIndex}
        onClick={isNonInteractive ? undefined : onClick}
        className={twMerge(
          clsx(
            buttonVariants({ variant, size }),
            // When loading or disabled, kill all hover/active pointer interactions
            isNonInteractive && 'pointer-events-none cursor-not-allowed active:scale-100',
            interactionState === 'disabled' && 'opacity-50 shadow-none',
            interactionState === 'loading' && 'opacity-85 shadow-none',
            interactionState === 'active' && 'ring-2 ring-slate-400 ring-offset-1',
            className
          )
        )}
        {...props}
      >
        {interactionState === 'loading' && (
          <Loader2 size={spinnerSize} className="animate-spin shrink-0" aria-hidden="true" />
        )}
        {interactionState === 'loading' && loadingText ? loadingText : children}
      </button>
    );
  }
);
Button.displayName = 'Button';
