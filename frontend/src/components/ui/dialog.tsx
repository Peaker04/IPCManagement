/* eslint-disable react-refresh/only-export-components */
import * as React from "react"
import { createPortal } from "react-dom"

import { Button } from "@/components/ui/button"
import { cn } from "@/lib/utils"

export type DialogSize = "sm" | "md" | "lg" | "full"
export type DialogCloseReason = "escape" | "backdrop" | "close-control"

interface DialogProps {
  open: boolean
  onOpenChange: (open: boolean, reason?: DialogCloseReason) => void
  onCloseRequest?: (reason: DialogCloseReason) => boolean | void
  children: React.ReactNode
}

interface DialogContextValue {
  titleId: string
  requestClose: (reason: DialogCloseReason) => void
}

const DialogContext = React.createContext<DialogContextValue | null>(null)
const inertSiblings = new Map<HTMLElement, { count: number; hadInert: boolean; value: string | null }>()

let activeDialogCount = 0
let originalBodyOverflow: string | null = null
let lockedMainScrollTop = 0
let activeCleanupFn: (() => void) | null = null

export function lockBodyScroll() {
  if (typeof document === "undefined") return
  activeDialogCount += 1
  if (activeDialogCount === 1) {
    originalBodyOverflow = document.body.style.overflow
    document.body.style.overflow = "hidden"
    document.body.classList.add("ipc-modal-open")

    const mainContent = document.getElementById("ipc-main-content")
    let onMainScroll: (() => void) | null = null
    if (mainContent) {
      lockedMainScrollTop = mainContent.scrollTop
      onMainScroll = () => {
        if (mainContent.scrollTop !== lockedMainScrollTop) {
          mainContent.scrollTop = lockedMainScrollTop
        }
      }
      mainContent.addEventListener("scroll", onMainScroll, { passive: false })
    }

    const onWheel = (event: WheelEvent) => {
      const target = event.target as HTMLElement | null
      const insideDialog = target?.closest('[role="dialog"]')
      if (!insideDialog) {
        event.preventDefault()
      }
    }

    const onTouchMove = (event: TouchEvent) => {
      const target = event.target as HTMLElement | null
      const insideDialog = target?.closest('[role="dialog"]')
      if (!insideDialog) {
        event.preventDefault()
      }
    }

    window.addEventListener("wheel", onWheel, { passive: false })
    window.addEventListener("touchmove", onTouchMove, { passive: false })

    activeCleanupFn = () => {
      if (mainContent && onMainScroll) {
        mainContent.removeEventListener("scroll", onMainScroll)
      }
      window.removeEventListener("wheel", onWheel)
      window.removeEventListener("touchmove", onTouchMove)
    }
  }
}

export function unlockBodyScroll() {
  if (typeof document === "undefined") return
  activeDialogCount -= 1
  if (activeDialogCount <= 0) {
    activeDialogCount = 0
    document.body.classList.remove("ipc-modal-open")

    if (activeCleanupFn) {
      activeCleanupFn()
      activeCleanupFn = null
    }

    if (originalBodyOverflow !== null) {
      document.body.style.overflow = originalBodyOverflow
      originalBodyOverflow = null
    } else {
      document.body.style.removeProperty("overflow")
    }
  }
}

function markSiblingsInert(portalRoot: HTMLElement) {
  Array.from(document.body.children).forEach((element) => {
    if (!(element instanceof HTMLElement) || element === portalRoot || element.dataset.ipcDialogPortal === "true") {
      return
    }

    const current = inertSiblings.get(element)
    if (current) {
      current.count += 1
      return
    }

    inertSiblings.set(element, {
      count: 1,
      hadInert: element.hasAttribute("inert"),
      value: element.getAttribute("inert"),
    })
    element.setAttribute("inert", "")
  })
}

function restoreSiblingsInert() {
  inertSiblings.forEach((state, element) => {
    state.count -= 1
    if (state.count > 0) {
      return
    }

    if (state.hadInert) {
      element.setAttribute("inert", state.value ?? "")
    } else {
      element.removeAttribute("inert")
    }
    inertSiblings.delete(element)
  })
}

function getFocusableElements(dialog: HTMLElement) {
  return Array.from(
    dialog.querySelectorAll<HTMLElement>(
      'a[href], button:not([disabled]), input:not([disabled]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])',
    ),
  ).filter((element) => !element.hasAttribute("aria-hidden"))
}

export function Dialog({ open, onOpenChange, onCloseRequest, children }: DialogProps) {
  const titleId = React.useId()
  const portalId = React.useId()
  const openerRef = React.useRef<HTMLElement | null>(null)
  const onOpenChangeRef = React.useRef(onOpenChange)
  const onCloseRequestRef = React.useRef(onCloseRequest)
  React.useEffect(() => {
    onOpenChangeRef.current = onOpenChange
    onCloseRequestRef.current = onCloseRequest
  }, [onCloseRequest, onOpenChange])

  const requestClose = React.useCallback((reason: DialogCloseReason) => {
    if (onCloseRequestRef.current?.(reason) === false) {
      return
    }
    onOpenChangeRef.current(false, reason)
  }, [])

  React.useEffect(() => {
    if (!open) {
      return undefined
    }

    lockBodyScroll()
    return () => {
      unlockBodyScroll()
    }
  }, [open])

  React.useEffect(() => {
    const portalRoot = document.getElementById(portalId)
    if (!open || !portalRoot) {
      return undefined
    }

    openerRef.current = document.activeElement instanceof HTMLElement ? document.activeElement : null
    markSiblingsInert(portalRoot)

    return () => {
      restoreSiblingsInert()
      openerRef.current?.focus()
      openerRef.current = null
    }
  }, [open, portalId])

  React.useEffect(() => {
    const portalRoot = document.getElementById(portalId)
    if (!open || !portalRoot) {
      return undefined
    }

    const dialog = portalRoot.querySelector<HTMLElement>('[role="dialog"]')
    if (!dialog) {
      return undefined
    }

    const focusable = getFocusableElements(dialog)
    ;(focusable[0] ?? dialog).focus()

    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        event.preventDefault()
        requestClose("escape")
      }
    }

    window.addEventListener("keydown", handleKeyDown)
    return () => window.removeEventListener("keydown", handleKeyDown)
  }, [open, portalId, requestClose])

  if (!open || typeof document === "undefined") {
    return null
  }

  return createPortal(
    <div id={portalId} data-ipc-dialog-portal="true">
      <DialogContext.Provider value={{ titleId, requestClose }}>
        <div
          aria-hidden="true"
          className="fixed inset-0 z-[1000] bg-slate-900/45 backdrop-blur-[1px] overscroll-contain"
          style={{ overscrollBehavior: 'contain' }}
          onClick={() => requestClose("backdrop")}
        />
        <div
          className="fixed inset-0 z-[1001] flex items-start justify-center overflow-y-auto p-4 sm:items-center overscroll-contain"
          style={{ overscrollBehavior: 'contain' }}
        >
          {children}
        </div>
      </DialogContext.Provider>
    </div>,
    document.body,
  )
}

const dialogSizeClasses: Record<DialogSize, string> = {
  sm: "max-w-sm",
  md: "max-w-lg",
  lg: "max-w-3xl",
  full: "max-w-[calc(100vw-2rem)]",
}

interface DialogContentProps extends React.HTMLAttributes<HTMLDivElement> {
  size?: DialogSize
}

export function DialogContent({
  className,
  children,
  onClick,
  role = "dialog",
  size = "md",
  ...props
}: DialogContentProps) {
  const context = React.useContext(DialogContext)
  const ariaModal = role === "dialog" && props["aria-modal"] === undefined
    ? true
    : props["aria-modal"]
  const labelledBy = props["aria-labelledby"] ?? context?.titleId

  const handleClick: React.MouseEventHandler<HTMLDivElement> = (event) => {
    event.stopPropagation()
    onClick?.(event)
  }

  const handleKeyDown: React.KeyboardEventHandler<HTMLDivElement> = (event) => {
    if (event.key === "Tab") {
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

    props.onKeyDown?.(event)
  }

  return (
    <div
      {...props}
      role={role}
      tabIndex={props.tabIndex ?? -1}
      aria-modal={ariaModal}
      aria-labelledby={labelledBy}
      data-size={size}
      className={cn(
        "max-h-[85vh] w-full overflow-y-auto gap-4 rounded-md border border-slate-200 bg-white p-4 shadow-xl outline-none sm:p-6",
        dialogSizeClasses[size],
        className,
      )}
      onClick={handleClick}
      onKeyDown={handleKeyDown}
    >
      {children}
    </div>
  )
}

export function DialogHeader({
  className,
  ...props
}: React.HTMLAttributes<HTMLDivElement>) {
  return (
    <div
      className={cn(
        "sticky top-0 z-10 flex flex-col space-y-1.5 bg-inherit text-center sm:text-left",
        className,
      )}
      {...props}
    />
  )
}

export function DialogFooter({
  className,
  ...props
}: React.HTMLAttributes<HTMLDivElement>) {
  return (
    <div
      className={cn(
        "sticky bottom-0 z-10 flex flex-col-reverse bg-inherit sm:flex-row sm:justify-end sm:gap-2",
        className,
      )}
      {...props}
    />
  )
}

export function DialogTitle({ className, id, ...props }: React.HTMLAttributes<HTMLHeadingElement>) {
  const context = React.useContext(DialogContext)

  return (
    <h2
      id={id ?? context?.titleId}
      className={cn(
        "text-lg font-semibold leading-none tracking-tight",
        className,
      )}
      {...props}
    />
  )
}

export function DialogDescription({ className, ...props }: React.HTMLAttributes<HTMLParagraphElement>) {
  return (
    <p className={cn("text-sm text-slate-500", className)} {...props} />
  )
}

export function DialogClose({ onClick, ...props }: React.ComponentProps<typeof Button>) {
  const context = React.useContext(DialogContext)

  return (
    <Button
      type="button"
      variant="outline"
      {...props}
      onClick={(event) => {
        context?.requestClose("close-control")
        onClick?.(event)
      }}
    />
  )
}
