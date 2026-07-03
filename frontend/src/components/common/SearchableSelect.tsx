import { useEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { Search } from 'lucide-react';
import { normalizeVietnamese } from '@/lib/utils';

export interface SearchableSelectOption {
  value: string;
  label: string;
  hint?: string;
  keywords?: string;
}

interface SearchableSelectProps {
  value: string;
  onChange: (value: string) => void;
  options: SearchableSelectOption[];
  /** Label to show for the current value when the dropdown is closed. Falls back to
   *  `options.find(o => o.value === value)?.label` — pass this explicitly when `options`
   *  only ever holds the current server search results (may not include the selected item). */
  selectedLabel?: string;
  placeholder?: string;
  onCreateNew?: (query: string) => void;
  createNewLabel?: string;
  disabled?: boolean;
  className?: string;
  id?: string;
  /** When provided, SearchableSelect stops filtering `options` itself and instead calls this
   *  (debounced) with the raw query text — the caller is expected to fetch matching options
   *  (e.g. from the backend) and pass the results back in via `options`. */
  onQueryChange?: (query: string) => void;
  isLoading?: boolean;
}

export function SearchableSelect({
  value,
  onChange,
  options,
  selectedLabel,
  placeholder = '-- Chọn --',
  onCreateNew,
  createNewLabel = '+ Thêm mới...',
  disabled,
  className,
  id,
  onQueryChange,
  isLoading,
}: SearchableSelectProps) {
  const [query, setQuery] = useState('');
  const [isOpen, setIsOpen] = useState(false);
  const [highlightedIndex, setHighlightedIndex] = useState(0);
  const [dropdownRect, setDropdownRect] = useState<{ top: number; left: number; width: number } | null>(null);
  const wrapperRef = useRef<HTMLDivElement>(null);
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    return () => {
      if (debounceRef.current) clearTimeout(debounceRef.current);
    };
  }, []);

  const selected = options.find((option) => option.value === value);
  const displayLabel = selectedLabel ?? selected?.label ?? '';
  const normalizedQuery = normalizeVietnamese(query);
  const filtered = onQueryChange
    ? options
    : normalizedQuery
      ? options.filter((option) =>
          normalizeVietnamese(`${option.label} ${option.keywords ?? ''}`).includes(normalizedQuery)
        )
      : options;

  const rowCount = filtered.length + (onCreateNew ? 1 : 0);
  const isCreateRowHighlighted = onCreateNew && highlightedIndex === filtered.length;

  const notifyQueryChange = (nextQuery: string, immediate = false) => {
    if (!onQueryChange) return;
    if (debounceRef.current) clearTimeout(debounceRef.current);
    if (immediate) {
      onQueryChange(nextQuery);
      return;
    }
    debounceRef.current = setTimeout(() => onQueryChange(nextQuery), 300);
  };

  const updateDropdownRect = () => {
    const rect = wrapperRef.current?.getBoundingClientRect();
    if (rect) {
      setDropdownRect({ top: rect.bottom + 4, left: rect.left, width: rect.width });
    }
  };

  const openDropdown = () => {
    updateDropdownRect();
    setQuery('');
    setIsOpen(true);
    setHighlightedIndex(0);
    notifyQueryChange('', true);
  };

  const selectOption = (option: SearchableSelectOption) => {
    onChange(option.value);
    setIsOpen(false);
    setQuery('');
  };

  const triggerCreateNew = () => {
    const currentQuery = query;
    setIsOpen(false);
    setQuery('');
    onCreateNew?.(currentQuery);
  };

  const handleKeyDown = (event: React.KeyboardEvent<HTMLInputElement>) => {
    if (!isOpen) {
      if (event.key === 'ArrowDown' || event.key === 'Enter') {
        event.preventDefault();
        openDropdown();
      }
      return;
    }
    if (event.key === 'ArrowDown') {
      event.preventDefault();
      setHighlightedIndex((prev) => Math.min(prev + 1, rowCount - 1));
    } else if (event.key === 'ArrowUp') {
      event.preventDefault();
      setHighlightedIndex((prev) => Math.max(prev - 1, 0));
    } else if (event.key === 'Enter') {
      event.preventDefault();
      if (isCreateRowHighlighted) {
        triggerCreateNew();
      } else if (filtered[highlightedIndex]) {
        selectOption(filtered[highlightedIndex]);
      }
    } else if (event.key === 'Escape') {
      event.preventDefault();
      setIsOpen(false);
    }
  };

  return (
    <div className="relative" ref={wrapperRef}>
      <Search className="pointer-events-none absolute left-2.5 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
      <input
        id={id}
        type="text"
        className={`ipc-input w-full ${className ?? ''}`}
        style={{ paddingLeft: '2rem' }}
        placeholder={placeholder}
        disabled={disabled}
        value={isOpen ? query : displayLabel}
        onFocus={openDropdown}
        onChange={(event) => {
          const nextValue = event.target.value;
          setQuery(nextValue);
          setIsOpen(true);
          setHighlightedIndex(0);
          if (!dropdownRect) {
            updateDropdownRect();
          }
          notifyQueryChange(nextValue);
        }}
        onKeyDown={handleKeyDown}
        onBlur={() => setIsOpen(false)}
      />
      {isOpen && dropdownRect &&
        createPortal(
          <div
            className="fixed z-50 max-h-60 overflow-auto rounded-md border border-slate-200 bg-white shadow-lg"
            style={{ top: dropdownRect.top, left: dropdownRect.left, width: dropdownRect.width }}
            onMouseDown={(event) => event.preventDefault()}
          >
            {isLoading && (
              <div className="px-3 py-2 text-sm text-slate-400">Đang tìm...</div>
            )}
            {!isLoading && filtered.length === 0 && !onCreateNew && (
              <div className="px-3 py-2 text-sm text-slate-400">Không tìm thấy kết quả</div>
            )}
            {!isLoading && filtered.map((option, index) => (
              <button
                type="button"
                key={option.value}
                className={`flex w-full items-center justify-between px-3 py-2 text-left text-sm hover:bg-slate-50 ${
                  option.value === value ? 'bg-slate-100 font-medium' : ''
                } ${highlightedIndex === index ? 'bg-slate-100' : ''}`}
                onMouseEnter={() => setHighlightedIndex(index)}
                onClick={() => selectOption(option)}
              >
                <span>{option.label}</span>
                {option.hint && <span className="text-xs text-emerald-600">{option.hint}</span>}
              </button>
            ))}
            {onCreateNew && (
              <button
                type="button"
                className={`flex w-full items-center gap-1 border-t border-slate-100 px-3 py-2 text-left text-sm font-medium text-blue-600 hover:bg-blue-50 ${
                  isCreateRowHighlighted ? 'bg-blue-50' : ''
                }`}
                onMouseEnter={() => setHighlightedIndex(filtered.length)}
                onClick={triggerCreateNew}
              >
                {createNewLabel}
              </button>
            )}
          </div>,
          document.body
        )}
    </div>
  );
}
