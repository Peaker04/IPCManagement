import React from 'react';
import { cva, type VariantProps } from 'class-variance-authority';
import { clsx } from 'clsx';
import { twMerge } from 'tailwind-merge';
import { CheckCircle2, Clock, FileEdit, Lock, PlayCircle, XCircle } from 'lucide-react';

const badgeVariants = cva(
  'inline-flex items-center gap-1 rounded px-2 py-0.5 text-xs font-medium transition-colors select-none whitespace-nowrap shrink-0',
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
        sm: 'text-xs px-1.5 py-0.25',
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

export type DomainStatus =
  | 'DRAFT'
  | 'PENDING'
  | 'SUBMITTED'
  | 'IN_PROGRESS'
  | 'EXECUTING'
  | 'COMPLETED'
  | 'CLOSED'
  | 'CANCELLED'
  | 'REJECTED'
  | 'LOCKED';

export interface DomainStatusBadgeProps extends React.HTMLAttributes<HTMLSpanElement> {
  status: DomainStatus | string;
  customLabel?: string;
  size?: 'default' | 'sm';
}

/**
 * Standardized Domain Status Badge for ERP & IPC Workflows (Rule L1-DATA-02 & S-DATA-04)
 * Combines 3 required factors: Fiori pastel token + Lucide icon + Vietnamese semantic text
 */
export function DomainStatusBadge({
  status,
  customLabel,
  size = 'default',
  className,
  ...props
}: DomainStatusBadgeProps) {
  const normalized = (status || '').toUpperCase().trim();
  const iconSize = size === 'sm' ? 10 : 12;

  switch (normalized) {
    case 'DRAFT':
    case 'NHÁP':
    case 'BẢN NHÁP':
      return (
        <Badge variant="neutral" size={size} className={className} {...props}>
          <FileEdit size={iconSize} className="text-slate-500 shrink-0" aria-hidden="true" />
          <span>{customLabel || 'Bản nháp'}</span>
        </Badge>
      );

    case 'PENDING':
    case 'SUBMITTED':
    case 'CHỜ DUYỆT':
    case 'CHỜ PHÊ DUYỆT':
      return (
        <Badge variant="warning" size={size} className={className} {...props}>
          <Clock size={iconSize} className="text-amber-600 shrink-0" aria-hidden="true" />
          <span>{customLabel || 'Chờ phê duyệt'}</span>
        </Badge>
      );

    case 'IN_PROGRESS':
    case 'EXECUTING':
    case 'PROCESSING':
    case 'ĐANG XỬ LÝ':
    case 'ĐANG XUẤT CA':
    case 'TRANSFERRED':
      return (
        <Badge variant="info" size={size} className={className} {...props}>
          <PlayCircle size={iconSize} className="text-blue-600 shrink-0" aria-hidden="true" />
          <span>{customLabel || (normalized === 'TRANSFERRED' ? 'Đã chuyển kho' : 'Đang xử lý')}</span>
        </Badge>
      );

    case 'COMPLETED':
    case 'CLOSED':
    case 'APPROVED':
    case 'HOÀN TẤT':
    case 'ĐÃ DUYỆT':
    case 'ĐÃ CHỐT':
      return (
        <Badge variant="success" size={size} className={className} {...props}>
          <CheckCircle2 size={iconSize} className="text-emerald-600 shrink-0" aria-hidden="true" />
          <span>{customLabel || (normalized === 'APPROVED' ? 'Đã duyệt' : 'Hoàn tất')}</span>
        </Badge>
      );

    case 'CANCELLED':
    case 'REJECTED':
    case 'HỦY':
    case 'TỪ CHỐI':
    case 'ĐÃ HỦY':
      return (
        <Badge variant="danger" size={size} className={className} {...props}>
          <XCircle size={iconSize} className="text-rose-600 shrink-0" aria-hidden="true" />
          <span>{customLabel || (normalized === 'REJECTED' ? 'Đã từ chối' : 'Đã hủy')}</span>
        </Badge>
      );

    case 'LOCKED':
    case 'KHÓA':
    case 'ĐANG KHÓA':
    case 'READY':
      return (
        <Badge variant="neutral" size={size} className={clsx('bg-slate-100 text-slate-700 border-slate-300', className)} {...props}>
          <Lock size={iconSize} className="text-slate-600 shrink-0" aria-hidden="true" />
          <span>{customLabel || (normalized === 'READY' ? 'Đã đóng băng' : 'Đang khóa')}</span>
        </Badge>
      );

    default:
      return (
        <Badge variant="neutral" size={size} className={className} {...props}>
          <span>{customLabel || status}</span>
        </Badge>
      );
  }
}
