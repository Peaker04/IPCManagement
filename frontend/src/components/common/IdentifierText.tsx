import type { HTMLAttributes } from 'react'
import { cn } from '@/lib/utils'
import { typography } from '@/lib/typography'

interface IdentifierTextProps extends Omit<HTMLAttributes<HTMLSpanElement>, 'children'> {
  value?: string | null
  fallback?: string
}

export function IdentifierText({ value, fallback = 'Chưa có', className, title, ...props }: IdentifierTextProps) {
  const displayValue = value?.trim() || fallback

  return (
    <span
      {...props}
      title={title ?? displayValue}
      className={cn(
        typography.code,
        'ipc-identifier-text block min-w-0 max-w-full overflow-hidden text-ellipsis whitespace-nowrap',
        className,
      )}
    >
      {displayValue}
    </span>
  )
}
