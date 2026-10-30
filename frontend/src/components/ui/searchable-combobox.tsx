import { useState, useRef, useEffect, useMemo, useId } from 'react';
import { ChevronDown, Check, X } from 'lucide-react';
import { clsx } from 'clsx';
import { twMerge } from 'tailwind-merge';

export interface ComboboxOption {
  value: string;
  label: string;
  sublabel?: string;
  badge?: string;
}

export interface SearchableComboboxProps {
  id?: string;
  'aria-label': string;
  options: ComboboxOption[];
  value: string;
  onChange: (value: string) => void;
  placeholder?: string;
  disabled?: boolean;
  className?: string;
  maxVisibleOptions?: number;
}

function removeDiacritics(str: string): string {
  return str.normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase();
}

export function SearchableCombobox({
  id: explicitId,
  'aria-label': ariaLabel,
  options = [],
  value,
  onChange,
  placeholder = 'Tìm kiếm hoặc chọn...',
  disabled = false,
  className,
  maxVisibleOptions = 15,
}: SearchableComboboxProps) {
  const generatedId = useId();
  const id = explicitId || generatedId;

  const [isOpen, setIsOpen] = useState(false);
  const [searchTerm, setSearchTerm] = useState('');
  const containerRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  // Close on outside click
  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (containerRef.current && !containerRef.current.contains(event.target as Node)) {
        setIsOpen(false);
      }
    }
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const selectedOption = useMemo(
    () => options.find((opt) => opt.value === value),
    [options, value]
  );

  // Efficient filtered options limited to maxVisibleOptions (performance NFR)
  const filteredOptions = useMemo(() => {
    const rawQuery = searchTerm.trim();
    if (!rawQuery) {
      return options.slice(0, maxVisibleOptions);
    }
    const cleanQuery = removeDiacritics(rawQuery);
    const matches: ComboboxOption[] = [];
    for (const opt of options) {
      const matchLabel = removeDiacritics(opt.label).includes(cleanQuery);
      const matchSub = opt.sublabel && removeDiacritics(opt.sublabel).includes(cleanQuery);
      const matchBadge = opt.badge && removeDiacritics(opt.badge).includes(cleanQuery);
      if (matchLabel || matchSub || matchBadge) {
        matches.push(opt);
        if (matches.length >= maxVisibleOptions) break;
      }
    }
    return matches;
  }, [options, searchTerm, maxVisibleOptions]);

  const handleSelect = (val: string) => {
    onChange(val);
    setIsOpen(false);
    setSearchTerm('');
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Escape') {
      setIsOpen(false);
      inputRef.current?.blur();
    } else if (e.key === 'ArrowDown' && !isOpen) {
      setIsOpen(true);
    }
  };

  return (
    <div
      ref={containerRef}
      className={twMerge(clsx('relative inline-flex items-center w-full', className))}
    >
      <div className="relative w-full flex items-center">
        <input
          ref={inputRef}
          id={id}
          type="text"
          role="combobox"
          aria-expanded={isOpen}
          aria-label={ariaLabel}
          aria-controls={`${id}-listbox`}
          disabled={disabled}
          placeholder={selectedOption ? selectedOption.label : placeholder}
          value={isOpen ? searchTerm : selectedOption ? selectedOption.label : ''}
          onChange={(e) => {
            setSearchTerm(e.target.value);
            if (!isOpen) setIsOpen(true);
          }}
          onFocus={() => {
            setIsOpen(true);
          }}
          onKeyDown={handleKeyDown}
          className={clsx(
            'w-full h-8 px-2.5 pr-8 rounded border text-xs font-medium bg-white text-slate-900 transition-colors',
            'focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-slate-400 focus-visible:border-slate-400',
            disabled ? 'bg-slate-50 text-slate-400 cursor-not-allowed border-slate-200' : 'border-slate-300 hover:border-slate-400 cursor-text'
          )}
        />

        <div className="absolute right-2 flex items-center gap-1 pointer-events-none text-slate-400">
          {isOpen && searchTerm ? (
            <button
              type="button"
              aria-label="Xóa từ khóa"
              className="pointer-events-auto hover:text-slate-600"
              onClick={(e) => {
                e.stopPropagation();
                setSearchTerm('');
                inputRef.current?.focus();
              }}
            >
              <X size={13} aria-hidden="true" />
            </button>
          ) : (
            <ChevronDown size={14} aria-hidden="true" className={clsx('transition-transform', isOpen && 'rotate-180')} />
          )}
        </div>
      </div>

      {isOpen && (
        <div
          id={`${id}-listbox`}
          role="listbox"
          className="absolute left-0 top-full mt-1 w-full min-w-[240px] max-h-60 overflow-y-auto rounded-md border border-slate-200 bg-white shadow-lg z-50 py-1 text-xs"
        >
          {filteredOptions.length === 0 ? (
            <div className="p-3 text-center text-slate-500 italic">
              Không tìm thấy kết quả phù hợp.
            </div>
          ) : (
            filteredOptions.map((opt) => {
              const isSelected = opt.value === value;
              return (
                <div
                  key={opt.value}
                  role="option"
                  aria-selected={isSelected}
                  onClick={() => handleSelect(opt.value)}
                  className={clsx(
                    'px-3 py-1.5 flex items-center justify-between cursor-pointer transition-colors',
                    isSelected ? 'bg-blue-50 text-blue-900 font-semibold' : 'hover:bg-slate-50 text-slate-800'
                  )}
                >
                  <div className="flex flex-col min-w-0 pr-2">
                    <span className="truncate">{opt.label}</span>
                    {opt.sublabel && (
                      <span className="text-[11px] text-slate-500 font-mono truncate">{opt.sublabel}</span>
                    )}
                  </div>
                  <div className="flex items-center gap-1.5 shrink-0">
                    {opt.badge && (
                      <span className="text-[10px] font-mono px-1.5 py-0.2 rounded bg-slate-100 text-slate-600 border border-slate-200">
                        {opt.badge}
                      </span>
                    )}
                    {isSelected && <Check size={14} className="text-blue-600 shrink-0" aria-hidden="true" />}
                  </div>
                </div>
              );
            })
          )}
        </div>
      )}
    </div>
  );
}
