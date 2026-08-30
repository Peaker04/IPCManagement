"use client"

import * as React from "react"

import { cn } from "@/lib/utils"

interface TableProps extends React.ComponentProps<"table"> {
  bordered?: boolean;
}

function Table({ className, bordered = true, "aria-label": ariaLabel, ...props }: TableProps) {
  return (
    <div
      data-slot="table-container"
      className="relative w-full overflow-x-auto rounded-md border border-slate-200 bg-white shadow-xs"
      tabIndex={ariaLabel ? 0 : undefined}
      aria-label={ariaLabel ? `${ariaLabel} (có thể cuộn ngang)` : undefined}
    >
      <table
        data-slot="table"
        aria-label={ariaLabel}
        className={cn(
          "w-full caption-bottom text-sm border-collapse",
          bordered && "[&_th]:border-r [&_th]:border-slate-200 [&_th:last-child]:border-r-0 [&_td]:border-r [&_td]:border-slate-200 [&_td:last-child]:border-r-0",
          className
        )}
        {...props}
      />
    </div>
  )
}

function TableHeader({ className, ...props }: React.ComponentProps<"thead">) {
  return (
    <thead
      data-slot="table-header"
      className={cn("bg-slate-50/90 border-b border-slate-200 text-slate-700", className)}
      {...props}
    />
  )
}

function TableBody({ className, ...props }: React.ComponentProps<"tbody">) {
  return (
    <tbody
      data-slot="table-body"
      className={cn("divide-y divide-slate-200 bg-white [&_tr:last-child]:border-0", className)}
      {...props}
    />
  )
}

function TableFooter({ className, ...props }: React.ComponentProps<"tfoot">) {
  return (
    <tfoot
      data-slot="table-footer"
      className={cn(
        "border-t border-slate-200 bg-slate-50 font-medium text-slate-800 [&>tr]:last:border-b-0",
        className
      )}
      {...props}
    />
  )
}

function TableRow({ className, ...props }: React.ComponentProps<"tr">) {
  return (
    <tr
      data-slot="table-row"
      className={cn(
        "border-b border-slate-200 transition-colors hover:bg-blue-50/30 has-aria-expanded:bg-blue-50/40 data-[state=selected]:bg-blue-50/50",
        className
      )}
      {...props}
    />
  )
}

function TableHead({ className, scope = "col", ...props }: React.ComponentProps<"th">) {
  return (
    <th
      data-slot="table-head"
      scope={scope}
      className={cn(
        "h-9 px-3 py-2 text-left align-middle font-semibold text-xs text-slate-700 uppercase tracking-wider whitespace-nowrap bg-slate-50/90 select-none [&:has([role=checkbox])]:pr-0",
        className
      )}
      {...props}
    />
  )
}

function TableCell({ className, ...props }: React.ComponentProps<"td">) {
  return (
    <td
      data-slot="table-cell"
      className={cn(
        "p-2.5 px-3 align-middle text-sm text-slate-800 whitespace-nowrap [&:has([role=checkbox])]:pr-0",
        className
      )}
      {...props}
    />
  )
}

function TableCaption({
  className,
  ...props
}: React.ComponentProps<"caption">) {
  return (
    <caption
      data-slot="table-caption"
      className={cn("mt-3 text-xs text-slate-500", className)}
      {...props}
    />
  )
}

export {
  Table,
  TableHeader,
  TableBody,
  TableFooter,
  TableHead,
  TableRow,
  TableCell,
  TableCaption,
}
