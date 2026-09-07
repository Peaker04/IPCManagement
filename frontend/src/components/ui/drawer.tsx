import * as React from 'react'
import { createPortal } from 'react-dom'

import { cn } from '@/lib/utils'

export type DrawerCloseReason = 'escape' | 'backdrop' | 'close-control'

interface DrawerProps {
  open: boolean
  onOpenChange: (open: boolean, reason?: DrawerCloseReason) => void
  children: React.ReactNode
}

interface DrawerContextValue {
  titleId: string
  requestClose: (reason: DrawerCloseReason) => void
}

const DrawerContext = React.createContext<DrawerContextValue | null>(null)

const getFocusableElements = (drawer: HTMLElement) => Array.from(
  drawer.querySelectorAll<HTMLElement>(
    'a[href], button:not([disabled]), input:not([disabled]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])',
  ),
).filter((element) => !element.hasAttribute('aria-hidden'))

export function Drawer({ open, onOpenChange, children }: DrawerProps) {
  const titleId = React.useId()
  const portalId = React.useId()
  const openerRef = React.useRef<HTMLElement | null>(null)
  const onOpenChangeRef = React.useRef(onOpenChange)

  React.useEffect(() => {
    onOpenChangeRef.current = onOpenChange
  }, [onOpenChange])

  const requestClose = React.useCallback((reason: DrawerCloseReason) => {
    onOpenChangeRef.current(false, reason)
  }, [])

  React.useEffect(() => {
    const portalRoot = document.getElementById(portalId)
    if (!open || !portalRoot) return undefined

    openerRef.current = document.activeElement instanceof HTMLElement ? document.activeElement : null
    const drawer = portalRoot.querySelector<HTMLElement>('[data-ipc-drawer-content]')
    if (!drawer) return undefined

    ;(getFocusableElements(drawer)[0] ?? drawer).focus()
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        event.preventDefault()
        requestClose('escape')
      }
    }
    window.addEventListener('keydown', handleKeyDown)

    return () => {
      window.removeEventListener('keydown', handleKeyDown)
      openerRef.current?.focus()
      openerRef.current = null
    }
  }, [open, portalId, requestClose])

  if (!open || typeof document === 'undefined') return null

  return createPortal(
    <div id={portalId} data-ipc-drawer-portal="true" className="fixed inset-0 z-[1000] pointer-events-none">
      <DrawerContext.Provider value={{ titleId, requestClose }}>
        <div
          aria-hidden="true"
          className="absolute inset-0 pointer-events-auto bg-slate-900/20"
          onClick={() => requestClose('backdrop')}
        />
        {children}
      </DrawerContext.Provider>
    </div>,
    document.body,
  )
}

export function DrawerContent({ className, children, onKeyDown, ...props }: React.HTMLAttributes<HTMLElement>) {
  const context = React.useContext(DrawerContext)

  const handleKeyDown: React.KeyboardEventHandler<HTMLElement> = (event) => {
    if (event.key === 'Tab') {
      const focusable = getFocusableElements(event.currentTarget)
      const first = focusable[0]
      const last = focusable.at(-1)
      if (!first || !last) {
        event.preventDefault()
        event.currentTarget.focus()
      } else if (event.shiftKey && document.activeElement === first) {
        event.preventDefault()
        last.focus()
      } else if (!event.shiftKey && document.activeElement === last) {
        event.preventDefault()
        first.focus()
      }
    }
    onKeyDown?.(event)
  }

  return <aside
    {...props}
    data-ipc-drawer-content="true"
    data-surface="drawer"
    role="dialog"
    aria-modal="false"
    aria-labelledby={props['aria-label'] ? undefined : props['aria-labelledby'] ?? context?.titleId}
    tabIndex={props.tabIndex ?? -1}
    className={cn('pointer-events-auto absolute inset-y-0 right-0 flex w-full max-w-3xl flex-col border-l border-slate-200 bg-white shadow-xl outline-none', className)}
    onKeyDown={handleKeyDown}
  >{children}</aside>
}

export function DrawerHeader({ className, ...props }: React.HTMLAttributes<HTMLDivElement>) {
  return <div className={cn('shrink-0 border-b border-slate-200 bg-white p-4 sm:p-6', className)} {...props} />
}

export function DrawerBody({ className, ...props }: React.HTMLAttributes<HTMLDivElement>) {
  return <div className={cn('min-h-0 flex-1 overflow-y-auto p-4 sm:p-6', className)} {...props} />
}

export function DrawerFooter({ className, ...props }: React.HTMLAttributes<HTMLDivElement>) {
  return <div className={cn('flex shrink-0 flex-col-reverse gap-2 border-t border-slate-200 bg-white p-4 sm:flex-row sm:justify-end sm:p-6', className)} {...props} />
}

export function DrawerTitle({ className, id, ...props }: React.HTMLAttributes<HTMLHeadingElement>) {
  const context = React.useContext(DrawerContext)
  return <h2 id={id ?? context?.titleId} className={cn('text-lg font-semibold leading-none tracking-tight', className)} {...props} />
}

export function DrawerDescription({ className, ...props }: React.HTMLAttributes<HTMLParagraphElement>) {
  return <p className={cn('mt-1.5 text-sm text-slate-500', className)} {...props} />
}
