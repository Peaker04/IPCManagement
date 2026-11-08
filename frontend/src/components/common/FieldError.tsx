import type { ComponentProps, ReactNode } from 'react';
import { AlertCircle } from 'lucide-react';
import { cn } from '@/lib/utils';

interface FieldErrorProps extends ComponentProps<'p'> {
  children?: ReactNode;
  showIcon?: boolean;
}

export function FieldError({ children, showIcon = true, className, ...props }: FieldErrorProps) {
  if (!children) return null;
  return (
    <p
      role="alert"
      className={cn('ipc-field-error text-xs font-medium text-red-700 mt-0.5', className)}
      {...props}
    >
      {showIcon && <AlertCircle className="size-3.5 shrink-0 text-red-600" aria-hidden="true" />}
      <span>{children}</span>
    </p>
  );
}
