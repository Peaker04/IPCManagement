import React from 'react';
import { clsx } from 'clsx';
import { twMerge } from 'tailwind-merge';

export interface TabItem {
  id: string;
  label: string;
  count?: number;
  disabled?: boolean;
}

export interface TabsProps {
  items: TabItem[];
  activeId: string;
  onChange: (id: string) => void;
  className?: string;
  size?: 'sm' | 'default';
}

export function Tabs({
  items,
  activeId,
  onChange,
  className,
  size = 'default',
}: TabsProps) {
  const handleKeyDown = (e: React.KeyboardEvent, index: number) => {
    let nextIndex = index;
    if (e.key === 'ArrowRight') {
      nextIndex = (index + 1) % items.length;
    } else if (e.key === 'ArrowLeft') {
      nextIndex = (index - 1 + items.length) % items.length;
    }

    if (nextIndex !== index && !items[nextIndex].disabled) {
      e.preventDefault();
      onChange(items[nextIndex].id);
    }
  };

  return (
    <div
      role="tablist"
      aria-orientation="horizontal"
      className={twMerge(
        clsx(
          'inline-flex items-center rounded-md border border-slate-200 bg-slate-100/80 p-0.5 gap-0.5 select-none',
          size === 'sm' ? 'h-7' : 'h-8',
          className
        )
      )}
    >
      {items.map((tab, idx) => {
        const isActive = tab.id === activeId;
        return (
          <button
            key={tab.id}
            role="tab"
            type="button"
            aria-selected={isActive}
            tabIndex={isActive ? 0 : -1}
            disabled={tab.disabled}
            onClick={() => onChange(tab.id)}
            onKeyDown={(e) => handleKeyDown(e, idx)}
            className={clsx(
              'inline-flex items-center justify-center gap-1.5 rounded px-2.5 font-medium text-xs transition-all cursor-pointer',
              size === 'sm' ? 'h-6 text-xs' : 'h-7 text-xs',
              isActive
                ? 'bg-white text-slate-900 shadow-2xs font-semibold'
                : 'text-slate-600 hover:text-slate-900 hover:bg-slate-200/50',
              tab.disabled && 'pointer-events-none opacity-40'
            )}
          >
            <span>{tab.label}</span>
            {tab.count !== undefined && (
              <span
                className={clsx(
                  'rounded-full px-1.5 py-0.25 text-xs tabular-nums',
                  isActive
                    ? 'bg-slate-100 text-slate-800 font-semibold'
                    : 'bg-slate-200/80 text-slate-600'
                )}
              >
                {tab.count}
              </span>
            )}
          </button>
        );
      })}
    </div>
  );
}
