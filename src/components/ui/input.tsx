import * as React from 'react'
import { cn } from '@/lib/utils'

export type InputProps = React.InputHTMLAttributes<HTMLInputElement>

export function Input({ className, type = 'text', ...props }: InputProps) {
  return (
    <input
      type={type}
      className={cn(
        'flex h-11 w-full rounded-[var(--radius-md)] border border-input bg-surface',
        'px-3 py-2 text-sm text-foreground shadow-xs transition-colors duration-150',
        'placeholder:text-muted-foreground',
        'focus-visible:outline-2 focus-visible:outline-offset-1 focus-visible:outline-[hsl(var(--ring))]',
        'disabled:cursor-not-allowed disabled:opacity-50 disabled:bg-surface-muted',
        'aria-[invalid=true]:border-danger aria-[invalid=true]:outline-danger',
        className,
      )}
      {...props}
    />
  )
}

export function Textarea({
  className,
  ...props
}: React.TextareaHTMLAttributes<HTMLTextAreaElement>) {
  return (
    <textarea
      className={cn(
        'flex min-h-24 w-full rounded-[var(--radius-md)] border border-input bg-surface',
        'px-3 py-2 text-sm text-foreground shadow-xs transition-colors duration-150',
        'placeholder:text-muted-foreground resize-y',
        'focus-visible:outline-2 focus-visible:outline-offset-1 focus-visible:outline-[hsl(var(--ring))]',
        'disabled:cursor-not-allowed disabled:opacity-50 disabled:bg-surface-muted',
        'aria-[invalid=true]:border-danger',
        className,
      )}
      {...props}
    />
  )
}

export function Label({
  className,
  required,
  ...props
}: React.LabelHTMLAttributes<HTMLLabelElement> & { required?: boolean }) {
  return (
    <label
      className={cn(
        'text-sm font-medium text-foreground leading-none',
        className,
      )}
      {...props}
    >
      {props.children}
      {required ? (
        <span className="text-danger ms-1" aria-hidden>
          *
        </span>
      ) : null}
    </label>
  )
}

export function FieldError({ children }: { children?: React.ReactNode }) {
  if (!children) return null
  return (
    <p role="alert" className="text-xs text-danger mt-1.5">
      {children}
    </p>
  )
}

export function FieldHint({ children }: { children?: React.ReactNode }) {
  if (!children) return null
  return <p className="text-xs text-muted-foreground mt-1.5">{children}</p>
}
