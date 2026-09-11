import { useId, type ComponentProps } from 'react';
import { Search } from 'lucide-react';
import { Input } from '@/components/ui/input';
import { cn } from '@/lib/utils';

interface SearchFieldProps extends Omit<ComponentProps<typeof Input>, 'type' | 'size'> {
  label: string;
  description?: string;
  width?: 'compact' | 'standard' | 'wide' | 'full';
  hideLabel?: boolean;
  inputClassName?: string;
}

const widthClasses = {
  compact: 'w-56 max-w-full',
  standard: 'w-72 max-w-full',
  wide: 'w-[28rem] max-w-full',
  full: 'w-full',
};

/** Shared search anatomy. Width remains contextual; control density and semantics do not. */
export function SearchField({ label, description, width = 'standard', hideLabel = false, className, inputClassName, id, ...props }: SearchFieldProps) {
  const generatedId = useId();
  const inputId = id ?? `search-${generatedId}`;
  const descriptionId = description ? `${inputId}-description` : undefined;
  return (
    <label htmlFor={inputId} className={cn('ipc-search-field', widthClasses[width], className)}>
      <span className={hideLabel ? 'sr-only' : 'ipc-search-field__label'}>{label}</span>
      {description ? <span id={descriptionId} className="ipc-search-field__description">{description}</span> : null}
      <span className="ipc-search-field__control">
        <Search aria-hidden="true" className="ipc-search-field__icon" />
        <Input {...props} id={inputId} type="search" aria-label={props['aria-label'] ?? label} aria-describedby={props['aria-describedby'] ?? descriptionId} className={cn('ipc-search-field__input', inputClassName)} />
      </span>
    </label>
  );
}
