import * as React from 'react'
import { cva, type VariantProps } from 'class-variance-authority'
import { cn } from '@/lib/utils'

const badgeVariants = cva(
  'inline-flex items-center gap-1.5 rounded-full px-2.5 py-0.5 text-xs font-medium ' +
    "whitespace-nowrap [&_svg:not([class*='size-'])]:size-3",
  {
    variants: {
      tone: {
        neutral: 'bg-surface-muted text-muted-foreground border border-border',
        primary: 'bg-primary-soft text-primary',
        success: 'bg-success-soft text-success',
        warning: 'bg-warning-soft text-[hsl(38_80%_32%)]',
        danger: 'bg-danger-soft text-danger',
        info: 'bg-info-soft text-info',
        accent: 'bg-accent-soft text-[hsl(35_80%_32%)]',
      },
    },
    defaultVariants: { tone: 'neutral' },
  },
)

export interface BadgeProps
  extends React.HTMLAttributes<HTMLSpanElement>,
    VariantProps<typeof badgeVariants> {}

export function Badge({ className, tone, ...props }: BadgeProps) {
  return <span className={cn(badgeVariants({ tone }), className)} {...props} />
}

export { badgeVariants }
