import type { HTMLAttributes } from 'react'
import { cn } from '@/lib/utils'

interface AvatarProps extends HTMLAttributes<HTMLDivElement> {
  name?: string | null
  size?: 'sm' | 'md' | 'lg'
}

const sizeClasses = {
  sm: 'size-7 text-xs',
  md: 'size-9 text-sm',
  lg: 'size-12 text-base',
}

function getInitials(name?: string | null): string {
  if (!name) return '?'
  const parts = name.trim().split(/\s+/)
  if (parts.length === 1) return parts[0]!.slice(0, 2).toUpperCase()
  return (parts[0]!.charAt(0) + parts[parts.length - 1]!.charAt(0)).toUpperCase()
}

export function Avatar({ name, size = 'md', className, ...props }: AvatarProps) {
  return (
    <div
      aria-label={name ?? 'Avatar'}
      className={cn(
        'inline-flex items-center justify-center rounded-full bg-cream-deep text-ink-mute font-medium select-none',
        sizeClasses[size],
        className,
      )}
      {...props}
    >
      {getInitials(name)}
    </div>
  )
}
