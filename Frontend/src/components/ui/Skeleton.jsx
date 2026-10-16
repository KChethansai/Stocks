import { cn } from '@/lib/utils'

/* Skeleton blocks matching the layout they stand in for. No spinner-only
 * screens: every loading state mirrors its final layout. */
export function Skeleton({ className, ...props }) {
  return (
    <div
      aria-hidden="true"
      className={cn('animate-pulse rounded-md bg-white/[0.06]', className)}
      {...props}
    />
  )
}

export function SkeletonText({ lines = 3, className }) {
  return (
    <div className={cn('flex flex-col gap-2', className)} aria-hidden="true">
      {Array.from({ length: lines }, (_, i) => (
        <Skeleton key={i} className="h-3" style={{ width: `${100 - i * 12}%` }} />
      ))}
    </div>
  )
}

/* Shell skeleton for route transitions (sidebar + topbar frames). */
export function ShellSkeleton() {
  return (
    <div className="flex h-screen w-screen overflow-hidden bg-[var(--ink-950)]" aria-label="Loading">
      <div className="hidden w-60 shrink-0 flex-col gap-2 border-r border-[var(--hairline)] p-4 md:flex">
        <Skeleton className="h-8 w-32" />
        <Skeleton className="mt-4 h-9 w-full" />
        <Skeleton className="h-9 w-full" />
        <Skeleton className="h-9 w-full" />
        <Skeleton className="h-9 w-full" />
      </div>
      <div className="flex min-w-0 flex-1 flex-col">
        <div className="flex h-14 items-center justify-between border-b border-[var(--hairline)] px-4">
          <Skeleton className="h-8 w-56" />
          <Skeleton className="h-8 w-24" />
        </div>
        <div className="flex flex-col gap-4 p-6">
          <Skeleton className="h-7 w-64" />
          <Skeleton className="h-40 w-full" />
          <Skeleton className="h-24 w-full" />
        </div>
      </div>
    </div>
  )
}
