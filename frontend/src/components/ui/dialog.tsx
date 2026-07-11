import * as React from "react"
import { createPortal } from "react-dom"

import { cn } from "@/lib/utils"

interface DialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  children: React.ReactNode
}

export function Dialog({ open, onOpenChange, children }: DialogProps) {
  if (!open || typeof document === "undefined") {
    return null
  }

  return createPortal(
    <>
      <div
        aria-hidden="true"
        className="fixed inset-0 z-[1000] bg-slate-900/45 backdrop-blur-[1px]"
        onClick={() => onOpenChange(false)}
      />
      <div
        className="fixed inset-0 z-[1001] flex items-start justify-center overflow-y-auto p-4 sm:items-center"
        onClick={() => onOpenChange(false)}
      >
        {children}
      </div>
    </>,
    document.body,
  )
}

export function DialogContent({
  className,
  children,
  onClick,
  role = "dialog",
  ...props
}: React.HTMLAttributes<HTMLDivElement>) {
  const ariaModal = role === "dialog" && props["aria-modal"] === undefined
    ? true
    : props["aria-modal"]

  const handleClick: React.MouseEventHandler<HTMLDivElement> = (event) => {
    event.stopPropagation()
    onClick?.(event)
  }

  return (
    <div
      {...props}
      role={role}
      aria-modal={ariaModal}
      className={cn(
        "max-h-[calc(100dvh-2rem)] w-full max-w-lg overflow-y-auto gap-4 rounded-md border border-slate-200 bg-white p-4 shadow-xl outline-none sm:p-6",
        className
      )}
      onClick={handleClick}
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
        "flex flex-col space-y-1.5 text-center sm:text-left",
        className
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
        "flex flex-col-reverse sm:flex-row sm:justify-end sm:gap-2",
        className
      )}
      {...props}
    />
  )
}

export function DialogTitle({ className, ...props }: React.HTMLAttributes<HTMLHeadingElement>) {
  return (
    <h2
      className={cn(
        "text-lg font-semibold leading-none tracking-tight",
        className
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
