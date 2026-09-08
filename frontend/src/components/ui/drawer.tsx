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
  const shouldReturnFocusRef = React.useRef(false)
  const onOpenChangeRef = React.useRef(onOpenChange)

  React.useEffect(() => {
    onOpenChangeRef.current = onOpenChange
  }, [onOpenChange])

  const requestClose = React.useCallback((reason: DrawerCloseReason) => {
    shouldReturnFocusRef.current = document.activeElement instanceof HTMLElement
      && Boolean(document.activeElement.closest('[data-ipc-drawer-content]'))
    onOpenChangeRef.current(false, reason)
  }, [])

  React.useEffect(() => {
    const portalRoot = document.getElementById(portalId)
    if (!open || !portalRoot) return undefined

    openerRef.current = document.activeElement instanceof HTMLElement ? document.activeElement : null
    shouldReturnFocusRef.current = false
    const drawer = portalRoot.querySelector<HTMLElement>('[data-ipc-drawer-content]')
    if (!drawer) return undefined

    ;(getFocusableElements(drawer)[0] ?? drawer).focus()
    shouldReturnFocusRef.current = true
    const handleFocusIn = (event: FocusEvent) => {
      shouldReturnFocusRef.current = event.target instanceof Node && drawer.contains(event.target)
    }
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        event.preventDefault()
        requestClose('escape')
      }
    }
    document.addEventListener('focusin', handleFocusIn)
    window.addEventListener('keydown', handleKeyDown)

    return () => {
      document.removeEventListener('focusin', handleFocusIn)
      window.removeEventListener('keydown', handleKeyDown)
      if (shouldReturnFocusRef.current) openerRef.current?.focus()
      openerRef.current = null
      shouldReturnFocusRef.current = false
    }
  }, [open, portalId, requestClose])

  if (!open || typeof document === 'undefined') return null

  return createPortal(
    <div id={portalId} data-ipc-drawer-portal="true" className="fixed inset-0 z-[1000] pointer-events-none">
      <DrawerContext.Provider value={{ titleId, requestClose }}>
        {children}
      </DrawerContext.Provider>
    </div>,
    document.body,
  )
}

export function DrawerContent({ className, children, ...props }: React.HTMLAttributes<HTMLElement>) {
  const context = React.useContext(DrawerContext)

  return <aside
    {...props}
    data-ipc-drawer-content="true"
    data-surface="drawer"
    role="dialog"
    aria-modal="false"
    aria-labelledby={props['aria-label'] ? undefined : props['aria-labelledby'] ?? context?.titleId}
    tabIndex={props.tabIndex ?? -1}
    className={cn('pointer-events-auto absolute inset-y-0 right-0 flex w-full flex-col border-l border-slate-200 bg-white shadow-xl outline-none xl:w-1/2 xl:max-w-2xl', className)}
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
