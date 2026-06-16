import type { ReactNode } from 'react';
import { cn } from '@/lib/utils';

interface FieldRowProps {
  label: ReactNode;
  hint?: ReactNode;
  htmlFor?: string;
  children: ReactNode;
  className?: string;
}

export function FieldRow({ label, hint, htmlFor, children, className }: FieldRowProps) {
  return (
    <div className={cn('ipc-field-row', className)}>
      <label htmlFor={htmlFor} className="ipc-field-label">
        <span>{label}</span>
        {hint && <span className="ipc-field-hint">{hint}</span>}
      </label>
      {children}
    </div>
  );
}
