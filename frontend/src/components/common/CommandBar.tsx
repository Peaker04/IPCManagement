import React from 'react';
import type { ReactNode } from 'react';
import { cn } from '@/lib/utils';
import { typography } from '@/lib/typography';

interface CommandBarProps {
  children: ReactNode;
  actions?: ReactNode;
  className?: string;
  leadingClassName?: string;
  actionsClassName?: string;
}

/**
 * CommandBar - Canonical action and status bar (Rule C1, C7, X1)
 * Locks minimum height to prevent wrapping shifts and downstream table pushes.
 */
export function CommandBar({
  children,
  actions,
  className,
  leadingClassName,
  actionsClassName,
}: CommandBarProps) {
  // Extract children of fragment if it's a fragment
  let actionList = React.Children.toArray(actions);
  if (
    actions &&
    typeof actions === 'object' &&
    'type' in actions &&
    (actions as { type?: unknown }).type === React.Fragment
  ) {
    const actObj = actions as { props?: { children?: ReactNode } };
    actionList = React.Children.toArray(actObj.props?.children);
  }

  const primaryActions = actionList.filter((child) => {
    if (React.isValidElement(child)) {
      const props = child.props as { className?: string } | undefined;
      if (props && typeof props.className === 'string') {
        const cls = props.className;
        return (
          cls.includes('ipc-button-primary') ||
          cls.includes('ipc-button-success') ||
          cls.includes('ipc-button-warning')
        );
      }
    }
    return false;
  });

  const secondaryActions = actionList.filter((child) => !primaryActions.includes(child));

  return (
    <div
      className={cn(
        typography.body,
        'ipc-command-bar flex flex-col md:flex-row gap-3 items-stretch md:items-center justify-between',
        className
      )}
    >
      <div className={cn('ipc-command-bar-main flex flex-wrap items-center gap-3', leadingClassName)}>
        {children}
      </div>
      {actions && (
        <div
          className={cn(
            'ipc-command-bar-actions flex shrink-0 flex-wrap items-center justify-end gap-2',
            actionsClassName
          )}
        >
          {actionList.length > 3 ? (
            <>
              <div className="flex flex-wrap items-center justify-end gap-2">
                {secondaryActions}
              </div>
              <div className="flex flex-wrap items-center justify-end gap-2">
                {primaryActions}
              </div>
            </>
          ) : (
            actionList
          )}
        </div>
      )}
    </div>
  );
}
