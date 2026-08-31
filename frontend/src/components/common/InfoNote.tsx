import { memo, type ReactNode } from 'react';
import { Info, X } from 'lucide-react';
import { Popover } from '@base-ui/react/popover';
import { cn } from '@/lib/utils';

export interface InfoNoteProps {
  /** The guidance/instruction content to display inside the popover */
  content: ReactNode;
  /** Optional popover title (default: "Hướng dẫn") */
  title?: string;
  /** Accessible label for the (i) button (default: "Xem hướng dẫn") */
  ariaLabel?: string;
  /** Icon size in pixels (default: 14) */
  iconSize?: number;
  /** Optional custom trigger className */
  triggerClassName?: string;
  /** Optional custom popup className */
  className?: string;
}

export const InfoNote = memo(function InfoNote({
  content,
  title = 'Hướng dẫn',
  ariaLabel = 'Xem hướng dẫn',
  iconSize = 14,
  triggerClassName,
  className,
}: InfoNoteProps) {
  if (!content) return null;

  return (
    <Popover.Root>
      <Popover.Trigger
        type="button"
        aria-label={ariaLabel}
        className={cn(
          'inline-flex size-5 shrink-0 items-center justify-center rounded-full text-slate-400 hover:bg-blue-50 hover:text-blue-600 transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-500 cursor-pointer',
          triggerClassName
        )}
      >
        <Info size={iconSize} aria-hidden="true" />
      </Popover.Trigger>

      <Popover.Portal>
        <Popover.Positioner side="bottom" align="start" sideOffset={6} className="z-50">
          <Popover.Popup
            aria-label={title}
            className={cn(
              'w-80 max-w-[calc(100vw-2rem)] rounded-lg border border-slate-200 bg-white p-3.5 shadow-lg animate-in fade-in zoom-in-95 duration-150',
              className
            )}
          >
            <div className="flex items-center justify-between gap-2 border-b border-slate-100 pb-2 mb-2">
              <div className="flex items-center gap-1.5 font-semibold text-slate-800 text-xs">
                <Info size={13} className="text-blue-600 shrink-0" aria-hidden="true" />
                <span>{title}</span>
              </div>
              <Popover.Close
                type="button"
                aria-label="Đóng hướng dẫn"
                className="rounded p-0.5 text-slate-400 hover:bg-slate-100 hover:text-slate-700 transition-colors cursor-pointer"
              >
                <X size={13} aria-hidden="true" />
              </Popover.Close>
            </div>

            <div className="text-xs leading-relaxed text-slate-600 font-normal">
              {content}
            </div>
          </Popover.Popup>
        </Popover.Positioner>
      </Popover.Portal>
    </Popover.Root>
  );
});
