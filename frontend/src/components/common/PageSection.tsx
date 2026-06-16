import type { ReactNode } from 'react';
import { cn } from '@/lib/utils';

interface PageSectionProps {
  children: ReactNode;
  className?: string;
}

export function PageSection({ children, className }: PageSectionProps) {
  return <div className={cn('ipc-page-stack', className)}>{children}</div>;
}
