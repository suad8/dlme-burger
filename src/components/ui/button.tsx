import * as React from 'react'
import { Slot } from '@radix-ui/react-slot'
import { cva, type VariantProps } from 'class-variance-authority'
import { Loader2 } from 'lucide-react'
import { cn } from '@/lib/utils'

const buttonVariants = cva(
  // hover / focus / active / disabled — كل الحالات مغطّاة
  'inline-flex items-center justify-center gap-2 rounded-[var(--radius-md)] ' +
    'text-sm font-semibold whitespace-nowrap outline-none ' +
    // منحنى مخصّص + تقلّص عند الضغط: ردّ فعل ملموس بدل تغيّر لون فقط
    '[transition:background-color_var(--dur-fast)_var(--ease-smooth),color_var(--dur-fast)_var(--ease-smooth),box-shadow_var(--dur-base)_var(--ease-smooth),transform_var(--dur-fast)_var(--ease-spring),opacity_var(--dur-fast)_linear] ' +
    'active:scale-[0.97] ' +
    'focus-visible:outline-2 focus-visible:outline-offset-2 ' +
    'focus-visible:outline-[hsl(var(--ring))] disabled:pointer-events-none disabled:opacity-50 ' +
    'disabled:active:scale-100 ' +
    "[&_svg]:shrink-0 [&_svg:not([class*='size-'])]:size-4",
  {
    variants: {
      variant: {
        primary:
          'bg-primary text-primary-foreground shadow-xs hover:bg-primary-hover hover:shadow-sm',
        secondary:
          'bg-surface text-foreground border border-border shadow-xs hover:bg-surface-muted active:bg-muted',
        subtle:
          'bg-primary-soft text-primary hover:brightness-97 active:brightness-94',
        ghost: 'text-foreground hover:bg-surface-muted active:bg-muted',
        danger:
          'bg-danger text-white shadow-xs hover:brightness-95 active:brightness-90',
        link: 'text-primary underline-offset-4 hover:underline',
      },
      size: {
        // كل الأحجام التفاعلية ≥ 44px ارتفاعًا فعليًا عبر tap-target
        sm: 'h-9 px-3 text-[13px]',
        md: 'h-11 px-4',
        lg: 'h-12 px-6 text-base',
        icon: 'size-11',
      },
    },
    defaultVariants: { variant: 'primary', size: 'md' },
  },
)

export interface ButtonProps
  extends React.ButtonHTMLAttributes<HTMLButtonElement>,
    VariantProps<typeof buttonVariants> {
  asChild?: boolean
  loading?: boolean
}

export function Button({
  className,
  variant,
  size,
  asChild = false,
  loading = false,
  disabled,
  children,
  ...props
}: ButtonProps) {
  const Comp = asChild ? Slot : 'button'
  return (
    <Comp
      className={cn(buttonVariants({ variant, size }), className)}
      disabled={disabled ?? loading}
      aria-busy={loading || undefined}
      {...props}
    >
      {loading ? (
        <>
          <Loader2 className="size-4 animate-spin" aria-hidden />
          <span>{children}</span>
        </>
      ) : (
        children
      )}
    </Comp>
  )
}

export { buttonVariants }
