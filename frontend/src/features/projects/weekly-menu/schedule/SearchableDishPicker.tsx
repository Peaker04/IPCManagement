import { useId, useLayoutEffect, useMemo, useRef, useState } from 'react'
import { Check, Search } from 'lucide-react'
import { cn } from '@/lib/utils'

type DishOption = { id: string; name: string; code?: string; bomReady?: boolean }

const normalize = (value: string) => value
  .normalize('NFD')
  .replace(/[\u0300-\u036f]/g, '')
  .replaceAll('đ', 'd')
  .replaceAll('Đ', 'D')
  .toLocaleLowerCase('vi-VN')
  .replace(/\s+/g, ' ')
  .trim()

const scoreDish = (dish: DishOption, needle: string, selectedId: string) => {
  const name = normalize(dish.name)
  const code = normalize(dish.code ?? '')
  if (dish.id === selectedId) return 10_000
  if (!needle) return dish.bomReady ? 100 : 0
  if (code === needle || name === needle) return 9_000
  if (code.startsWith(needle)) return 8_000
  if (name.startsWith(needle)) return 7_000
  const wordIndex = name.split(' ').findIndex((word) => word.startsWith(needle))
  if (wordIndex >= 0) return 6_000 - wordIndex
  if (code.includes(needle)) return 5_000
  if (name.includes(needle)) return 4_000 - name.indexOf(needle)
  return -1
}

export function SearchableDishPicker({
  value,
  options,
  label,
  disabled,
  onChange,
}: {
  value: string
  options: DishOption[]
  label: string
  disabled?: boolean
  onChange: (dishId: string) => void
}) {
  const listId = useId()
  const inputRef = useRef<HTMLInputElement>(null)
  const selected = options.find((dish) => dish.id === value)
  const [open, setOpen] = useState(false)
  const [popupStyle, setPopupStyle] = useState({ left: 0, top: 0, width: 0 })
  const [query, setQuery] = useState('')
  const [activeIndex, setActiveIndex] = useState(0)
  const filtered = useMemo(() => {
    const needle = normalize(query)
    return options
      .map((dish) => ({ dish, score: scoreDish(dish, needle, value) }))
      .filter(({ score }) => score >= 0)
      .sort((left, right) => right.score - left.score || Number(right.dish.bomReady) - Number(left.dish.bomReady) || left.dish.name.localeCompare(right.dish.name, 'vi'))
      .slice(0, needle ? 8 : 6)
      .map(({ dish }) => dish)
  }, [options, query, value])
  const activeDish = filtered[Math.min(activeIndex, Math.max(filtered.length - 1, 0))]
  const selectDish = (dish: DishOption) => {
    onChange(dish.id)
    setOpen(false)
    setQuery('')
    setActiveIndex(0)
  }

  useLayoutEffect(() => {
    if (!open) return undefined
    const placePopup = () => {
      const rect = inputRef.current?.getBoundingClientRect()
      if (rect) setPopupStyle({ left: rect.left, top: rect.bottom + 4, width: rect.width })
    }
    placePopup()
    window.addEventListener('resize', placePopup)
    window.addEventListener('scroll', placePopup, true)
    return () => {
      window.removeEventListener('resize', placePopup)
      window.removeEventListener('scroll', placePopup, true)
    }
  }, [open])

  return (
    <div className="relative min-w-0">
      <label className="sr-only" htmlFor={`${listId}-search`}>{label}</label>
      <span className="relative block">
        <Search className="pointer-events-none absolute left-2.5 top-1/2 z-10 size-4 -translate-y-1/2 text-slate-500" aria-hidden="true" />
        <input
          ref={inputRef}
          id={`${listId}-search`}
          role="combobox"
          aria-label={label}
          aria-controls={listId}
          aria-expanded={open}
          aria-autocomplete="list"
          aria-activedescendant={open && activeDish ? `${listId}-${activeDish.id}` : undefined}
          disabled={disabled}
          value={open ? query : (selected?.name ?? '')}
          placeholder={disabled ? 'Chưa có món phù hợp' : 'Tìm món ăn'}
          className="h-9 w-full rounded-sm border border-slate-300 bg-white pl-8 pr-2 text-xs text-slate-900 outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-100 disabled:bg-slate-50"
          onFocus={() => { setQuery(''); setActiveIndex(0); setOpen(true) }}
          onChange={(event) => { setQuery(event.target.value); setActiveIndex(0); setOpen(true) }}
          onKeyDown={(event) => {
            if (event.key === 'Escape') { setOpen(false); setQuery(''); event.currentTarget.blur(); return }
            if (event.key === 'ArrowDown') { event.preventDefault(); setActiveIndex((index) => Math.min(index + 1, filtered.length - 1)); return }
            if (event.key === 'ArrowUp') { event.preventDefault(); setActiveIndex((index) => Math.max(index - 1, 0)); return }
            if (event.key === 'Home') { event.preventDefault(); setActiveIndex(0); return }
            if (event.key === 'End') { event.preventDefault(); setActiveIndex(Math.max(filtered.length - 1, 0)); return }
            if (event.key === 'Enter' && activeDish) { event.preventDefault(); selectDish(activeDish) }
          }}
        />
      </span>
      {open && !disabled && (
        <div id={listId} role="listbox" aria-label={`Kết quả ${label}`} style={popupStyle} className="fixed z-[1102] max-h-48 overflow-y-auto rounded-sm border border-slate-200 bg-white p-1 shadow-lg">
          <p className="px-2 py-1 text-[11px] font-medium text-slate-500">Chọn món ăn</p>
          {filtered.length === 0 ? <p className="px-2 py-3 text-center text-xs text-slate-600">Không tìm thấy món phù hợp</p> : filtered.map((dish, index) => (
            <button
              id={`${listId}-${dish.id}`}
              key={dish.id}
              type="button"
              role="option"
              aria-selected={dish.id === value}
              className={cn('flex w-full items-center gap-2 rounded-sm px-2 py-2 text-left text-xs hover:bg-blue-50', index === activeIndex && 'bg-blue-50', dish.id === value && 'font-semibold')}
              onMouseDown={(event) => event.preventDefault()}
              onMouseEnter={() => setActiveIndex(index)}
              onClick={() => selectDish(dish)}
            >
              <Check className={cn('size-3.5 shrink-0', dish.id === value ? 'visible text-blue-700' : 'invisible')} aria-hidden="true" />
              <strong className="min-w-0 flex-1 truncate">{dish.name}</strong>
            </button>
          ))}
        </div>
      )}
    </div>
  )
}
