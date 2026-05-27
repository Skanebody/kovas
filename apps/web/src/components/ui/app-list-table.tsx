import { cn } from '@/lib/utils'
import type { ReactNode } from 'react'

type AppListTableProps = {
  children: ReactNode
  className?: string
}

/** Tableau liste métier — shell glass-opaque v3. */
export function AppListTable({ children, className }: AppListTableProps) {
  return (
    <div className={cn('glass-opaque rounded-lg overflow-hidden', className)}>
      <div className="overflow-x-auto">
        <table className="w-full text-[13px] text-ink-soft min-w-[560px]">{children}</table>
      </div>
    </div>
  )
}

export function AppListTableHead({ children }: { children: ReactNode }) {
  return (
    <thead className="bg-cream-deep/80 text-ink-mute text-[11px] uppercase tracking-wide">
      {children}
    </thead>
  )
}

export function AppListTableRow({
  children,
  className,
}: { children: ReactNode; className?: string }) {
  return (
    <tr
      className={cn(
        'border-t border-rule/80 hover:bg-ink/5 transition-colors duration-fast',
        className,
      )}
    >
      {children}
    </tr>
  )
}

export function AppListTableCell({
  children,
  className,
}: {
  children: ReactNode
  className?: string
}) {
  return <td className={cn('px-4 py-3 align-middle', className)}>{children}</td>
}
