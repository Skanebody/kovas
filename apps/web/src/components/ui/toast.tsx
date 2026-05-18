'use client'

import * as ToastPrimitive from '@radix-ui/react-toast'
import { type VariantProps, cva } from 'class-variance-authority'
import { X } from 'lucide-react'
import { forwardRef } from 'react'
import type { ComponentPropsWithoutRef, ElementRef } from 'react'
import { cn } from '@/lib/utils'

export const ToastProvider = ToastPrimitive.Provider

export const ToastViewport = forwardRef<
  ElementRef<typeof ToastPrimitive.Viewport>,
  ComponentPropsWithoutRef<typeof ToastPrimitive.Viewport>
>(({ className, ...props }, ref) => (
  <ToastPrimitive.Viewport
    ref={ref}
    className={cn(
      'fixed bottom-0 right-0 z-[100] flex max-h-screen w-full flex-col-reverse p-4 sm:bottom-4 sm:right-4 sm:max-w-md sm:flex-col gap-2',
      className,
    )}
    {...props}
  />
))
ToastViewport.displayName = ToastPrimitive.Viewport.displayName

const toastVariants = cva(
  cn(
    'group pointer-events-auto relative flex w-full items-center justify-between gap-3',
    'rounded-lg border border-border bg-card p-4 pr-8 shadow-md',
    'data-[state=open]:animate-in data-[state=closed]:animate-out',
    'data-[state=closed]:fade-out-80 data-[state=open]:slide-in-from-bottom-full',
  ),
  {
    variants: {
      variant: {
        default: '',
        success: 'border-accent-green/40',
        error: 'border-accent-red/40',
      },
    },
    defaultVariants: { variant: 'default' },
  },
)

export const Toast = forwardRef<
  ElementRef<typeof ToastPrimitive.Root>,
  ComponentPropsWithoutRef<typeof ToastPrimitive.Root> & VariantProps<typeof toastVariants>
>(({ className, variant, ...props }, ref) => (
  <ToastPrimitive.Root ref={ref} className={cn(toastVariants({ variant }), className)} {...props} />
))
Toast.displayName = ToastPrimitive.Root.displayName

export const ToastTitle = forwardRef<
  ElementRef<typeof ToastPrimitive.Title>,
  ComponentPropsWithoutRef<typeof ToastPrimitive.Title>
>(({ className, ...props }, ref) => (
  <ToastPrimitive.Title
    ref={ref}
    className={cn('text-sm font-semibold leading-none tracking-tight', className)}
    {...props}
  />
))
ToastTitle.displayName = ToastPrimitive.Title.displayName

export const ToastDescription = forwardRef<
  ElementRef<typeof ToastPrimitive.Description>,
  ComponentPropsWithoutRef<typeof ToastPrimitive.Description>
>(({ className, ...props }, ref) => (
  <ToastPrimitive.Description
    ref={ref}
    className={cn('text-sm text-muted-foreground mt-1', className)}
    {...props}
  />
))
ToastDescription.displayName = ToastPrimitive.Description.displayName

export const ToastClose = forwardRef<
  ElementRef<typeof ToastPrimitive.Close>,
  ComponentPropsWithoutRef<typeof ToastPrimitive.Close>
>(({ className, ...props }, ref) => (
  <ToastPrimitive.Close
    ref={ref}
    className={cn(
      'absolute right-2 top-2 rounded-sm p-1 opacity-60 transition-opacity hover:opacity-100',
      'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-foreground/30',
      className,
    )}
    toast-close=""
    {...props}
  >
    <X className="size-4" />
    <span className="sr-only">Fermer</span>
  </ToastPrimitive.Close>
))
ToastClose.displayName = ToastPrimitive.Close.displayName
