import { Button as ButtonPrimitive } from '@base-ui/react/button'
import { cva, type VariantProps } from 'class-variance-authority'

import { cn } from '@/lib/utils'

const buttonVariants = cva(
  "group/button inline-flex max-w-full shrink-0 items-center justify-center rounded-sm border border-transparent bg-clip-padding text-center text-button [overflow-wrap:normal] transition-colors outline-none select-none focus-visible:border-ring focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background active:not-aria-[haspopup]:translate-y-px disabled:pointer-events-none disabled:opacity-50 aria-invalid:border-destructive aria-invalid:ring-2 aria-invalid:ring-destructive/20 dark:aria-invalid:border-destructive/50 dark:aria-invalid:ring-destructive/40 [&_svg]:pointer-events-none [&_svg]:shrink-0 [&_svg:not([class*='size-'])]:size-4",
  {
    variants: {
      variant: {
        default: 'bg-primary text-primary-foreground hover:bg-primary/90',
        outline:
          'border-border bg-surface hover:bg-muted hover:text-foreground aria-expanded:bg-muted aria-expanded:text-foreground dark:border-input dark:bg-input/30 dark:hover:bg-input/50',
        secondary:
          'bg-secondary text-secondary-foreground hover:bg-secondary/80 aria-expanded:bg-secondary aria-expanded:text-secondary-foreground',
        success:
          'border-status-success-border bg-status-success-soft text-status-success hover:bg-status-success-hover focus-visible:ring-status-success/25',
        warning:
          'border-status-warning-border bg-status-warning text-status-warning-foreground hover:bg-status-warning-hover focus-visible:ring-status-warning/25',
        warningSoft:
          'border-status-warning-border bg-status-warning-soft text-status-warning hover:bg-status-warning-hover focus-visible:ring-status-warning/25',
        info:
          'border-primary bg-primary text-primary-foreground hover:bg-primary/90 focus-visible:ring-primary/25',
        ghost:
          'hover:bg-muted hover:text-foreground aria-expanded:bg-muted aria-expanded:text-foreground dark:hover:bg-muted/50',
        destructive:
          'bg-destructive/10 text-destructive hover:bg-destructive/20 focus-visible:border-destructive/40 focus-visible:ring-destructive/20 dark:bg-destructive/20 dark:hover:bg-destructive/30 dark:focus-visible:ring-destructive/40',
        link: 'text-primary underline-offset-4 hover:underline',
      },
      size: {
        default:
          'h-10 gap-2 px-4 has-data-[icon=inline-end]:pr-3 has-data-[icon=inline-start]:pl-3',
        xs: "h-8 gap-1 rounded-sm px-2 text-button-compact in-data-[slot=button-group]:rounded-sm has-data-[icon=inline-end]:pr-1.5 has-data-[icon=inline-start]:pl-1.5 [&_svg:not([class*='size-'])]:size-3.5",
        sm: "h-9 gap-1.5 rounded-sm px-3 text-button in-data-[slot=button-group]:rounded-sm has-data-[icon=inline-end]:pr-2.5 has-data-[icon=inline-start]:pl-2.5 [&_svg:not([class*='size-'])]:size-4",
        lg: 'h-11 gap-2 px-5 has-data-[icon=inline-end]:pr-4 has-data-[icon=inline-start]:pl-4',
        icon: 'size-9',
        'icon-xs':
          "size-8 rounded-sm in-data-[slot=button-group]:rounded-sm [&_svg:not([class*='size-'])]:size-3.5",
        'icon-sm':
          'size-9 rounded-sm in-data-[slot=button-group]:rounded-sm',
        'icon-lg': 'size-11',
      },
      textWrap: {
        nowrap: 'whitespace-nowrap break-keep',
        wrap: 'h-auto min-h-10 whitespace-normal break-normal py-2 leading-snug',
      },
    },
    defaultVariants: {
      variant: 'default',
      size: 'default',
      textWrap: 'nowrap',
    },
  },
)

function Button({
  className,
  variant = 'default',
  size = 'default',
  textWrap = 'nowrap',
  ...props
}: ButtonPrimitive.Props & VariantProps<typeof buttonVariants>) {
  return (
    <ButtonPrimitive
      data-slot="button"
      data-text-wrap={textWrap}
      className={cn(buttonVariants({ variant, size, textWrap, className }))}
      {...props}
    />
  )
}

// eslint-disable-next-line react-refresh/only-export-components
export { Button, buttonVariants }
