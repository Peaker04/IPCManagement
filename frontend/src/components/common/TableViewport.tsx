import { useId, useState, type ReactNode } from 'react';
import { cn } from '@/lib/utils';
import { typography } from '@/lib/typography';
import { readTablePreferences, resetTablePreferences, resolveTablePreferenceColumns, writeTablePreferences, type TablePreferenceConfig, type TablePreferenceState } from './tablePreferences';
import { TablePreferencesControl } from './TablePreferencesControl';

interface TableViewportProps {
  children: ReactNode | ((preferences: { columns: ReturnType<typeof resolveTablePreferenceColumns>; density: TableDensity }) => ReactNode);
  ariaLabel: string;
  caption?: string;
  className?: string;
  size?: 'default' | 'weekly';
  density?: TableDensity;
  stickyHeader?: boolean;
  frozenFirstIdentifier?: boolean;
  loading?: boolean;
  skeleton?: ReactNode;
  preferences?: { accountId?: string; config: TablePreferenceConfig };
}

export type { TableDensity } from './tablePreferences';
import type { TableDensity } from './tablePreferences';

const viewportSizeClasses = {
  default: '',
  weekly: 'h-[560px] max-h-[560px]',
};

/**
 * Canonical boundary for operational tables. Data, filters and pagination
 * remain outside this component so the viewport cannot silently change API
 * contracts while route families are being migrated.
 */
export function TableViewport({
  children,
  ariaLabel,
  caption,
  className,
  size = 'default',
  density = 'standard',
  stickyHeader = true,
  frozenFirstIdentifier = true,
  loading = false,
  skeleton,
  preferences,
}: TableViewportProps) {
  const captionId = useId();
  const [preferenceState, setPreferenceState] = useState<TablePreferenceState>(() => preferences ? readTablePreferences(preferences.accountId, preferences.config) : { columnIds: [], hiddenColumnIds: [], density: 'standard' });

  const updatePreferences = (next: TablePreferenceState) => {
    if (!preferences) return;
    setPreferenceState(next);
    writeTablePreferences(preferences.accountId, preferences.config, next);
  };
  const resetPreferences = () => {
    if (!preferences) return;
    resetTablePreferences(preferences.accountId, preferences.config);
    setPreferenceState(readTablePreferences(preferences.accountId, preferences.config));
  };
  const resolvedDensity = preferences ? preferenceState.density : density;
  const renderedChildren = typeof children === 'function'
    ? preferences ? children({ columns: resolveTablePreferenceColumns(preferences.config, preferenceState), density: resolvedDensity }) : null
    : children;

  const content = loading && skeleton ? skeleton : renderedChildren;

  const viewport = (
    <div
      className={cn(typography.body, 'ipc-table-viewport min-w-0 w-full overflow-auto overscroll-x-contain rounded-md border border-slate-200 bg-white shadow-xs', viewportSizeClasses[size], className)}
      data-table-viewport="true"
      data-density={resolvedDensity}
      data-vertical-scroll={size === 'weekly' ? 'bounded' : 'page'}
      data-sticky-header={stickyHeader}
      data-frozen-identifier={frozenFirstIdentifier}
      role="region"
      aria-label={ariaLabel}
      aria-describedby={caption ? captionId : undefined}
      tabIndex={0}
    >
      {caption ? <div id={captionId} className="sr-only">{caption}</div> : null}
      {content}
    </div>
  );

  if (!preferences) return viewport;

  return (
    <div className="min-w-0 w-full">
      <div role="toolbar" aria-label="Tùy chỉnh bảng" className="mb-3 flex min-h-8 justify-end">
        <TablePreferencesControl config={preferences.config} state={preferenceState} onChange={updatePreferences} onReset={resetPreferences} />
      </div>
      {viewport}
    </div>
  );
}
