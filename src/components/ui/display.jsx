import React from 'react';
import { cva } from 'class-variance-authority';
import { cn } from '@/lib/utils';

const badgeVariants = cva('inline-flex h-5 items-center gap-1 whitespace-nowrap rounded-full px-2 text-xs font-medium', {
  variants: {
    variant: {
      neutral: 'border border-border bg-secondary text-muted-foreground',
      primary: 'bg-primary-soft text-primary-soft-foreground',
      success: 'bg-success-soft text-success',
      warning: 'bg-warning-soft text-warning',
      danger: 'bg-destructive-soft text-destructive'
    }
  },
  defaultVariants: { variant: 'neutral' }
});

export function Badge({ className, variant, ...props }) {
  return <span className={cn(badgeVariants({ variant }), className)} {...props} />;
}

export function Card({ className, ...props }) {
  return <div className={cn('rounded-lg border border-border bg-card text-card-foreground', className)} {...props} />;
}

export function CardHeader({ className, ...props }) {
  return <div className={cn('flex flex-col gap-1 border-b border-border px-4 py-3', className)} {...props} />;
}

export function CardTitle({ className, ...props }) {
  return <h3 className={cn('text-base font-semibold leading-tight', className)} {...props} />;
}

export function CardContent({ className, ...props }) {
  return <div className={cn('px-4 py-3', className)} {...props} />;
}

export function Skeleton({ className, ...props }) {
  return <div className={cn('animate-pulse rounded-md bg-secondary', className)} aria-hidden="true" {...props} />;
}

/** A number with a caption, used in summary rows (import results, schedule totals). */
export function StatCard({ value, label, tone = 'default', className }) {
  const toneClass = { default: 'text-foreground', success: 'text-success', warning: 'text-warning', danger: 'text-destructive' }[tone];
  return (
    <div className={cn('min-w-36 flex-1 rounded-lg border border-border bg-card px-3.5 py-2.5', className)}>
      <div className={cn('text-[22px] font-semibold leading-tight tabular-nums', toneClass)}>{value}</div>
      <div className="text-xs text-muted-foreground">{label}</div>
    </div>
  );
}

export function EmptyState({ icon: Icon, title, description, action, className }) {
  return (
    <div className={cn('flex flex-col items-center gap-2 px-6 py-12 text-center', className)}>
      {Icon && <Icon className="size-8 text-subtle-foreground" aria-hidden="true" />}
      <h3 className="text-base font-semibold">{title}</h3>
      {description && <p className="max-w-md text-sm text-muted-foreground">{description}</p>}
      {action && <div className="mt-2">{action}</div>}
    </div>
  );
}

export function PageHeader({ title, description, count, actions, className }) {
  return (
    <div className={cn('flex flex-wrap items-start justify-between gap-3', className)}>
      <div className="flex min-w-0 flex-col gap-1">
        <div className="flex items-center gap-2.5">
          <h1 className="text-xl font-semibold leading-tight tracking-tight">{title}</h1>
          {count !== undefined && count !== null && <Badge className="tabular-nums">{count}</Badge>}
        </div>
        {description && <p className="max-w-2xl text-sm text-muted-foreground">{description}</p>}
      </div>
      {actions && <div className="flex flex-wrap items-center gap-2">{actions}</div>}
    </div>
  );
}

export function Toolbar({ className, ...props }) {
  return <div role="toolbar" className={cn('flex flex-wrap items-center gap-2', className)} {...props} />;
}
