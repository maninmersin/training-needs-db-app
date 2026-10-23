import React from 'react';
import { AlertTriangle, ChevronRight } from 'lucide-react';
import { Badge } from '@/components/ui';
import { cn } from '@/lib/utils';
import { complianceLevel, formatPercentage } from './complianceLogic';

const STYLE = {
  excellent: { text: 'text-success', bar: 'bg-success', badge: 'success' },
  good: { text: 'text-primary', bar: 'bg-primary', badge: 'primary' },
  warning: { text: 'text-warning', bar: 'bg-warning', badge: 'warning' },
  critical: { text: 'text-destructive', bar: 'bg-destructive', badge: 'danger' }
};

/** One group (functional area, location or session) with its attended / assigned numbers and compliance band. */
export default function ComplianceMetricCard({ title, assigned, attended, complianceRate, missingRecords = 0, onClick, isDrillable = true }) {
  const { level, label } = complianceLevel(complianceRate);
  const style = STYLE[level];
  const Wrapper = isDrillable ? 'button' : 'div';

  return (
    <Wrapper
      {...(isDrillable ? { type: 'button', onClick } : {})}
      className={cn(
        'flex flex-col gap-3 rounded-lg border border-border bg-card p-4 text-left',
        isDrillable && 'cursor-pointer transition-colors hover:border-border-strong hover:bg-accent focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring'
      )}
    >
      <div className="flex items-start justify-between gap-2">
        <h4 className="text-sm font-semibold leading-snug">{title}</h4>
        {isDrillable && <ChevronRight className="size-4 shrink-0 text-subtle-foreground" aria-hidden="true" />}
      </div>

      <div className="flex items-end justify-between gap-3">
        <div className="flex flex-col leading-tight">
          <span className={cn('text-2xl font-semibold tabular-nums', style.text)}>{formatPercentage(complianceRate)}</span>
          <span className="text-xs text-muted-foreground">Compliance</span>
        </div>
        <div className="flex items-center gap-2 text-right text-xs text-muted-foreground">
          <span className="flex flex-col leading-tight"><b className="text-sm tabular-nums text-foreground">{attended}</b>Attended</span>
          <span aria-hidden="true">/</span>
          <span className="flex flex-col leading-tight"><b className="text-sm tabular-nums text-foreground">{assigned}</b>Assigned</span>
        </div>
      </div>

      <div
        role="progressbar"
        aria-label={`${title} compliance`}
        aria-valuemin={0}
        aria-valuemax={100}
        aria-valuenow={Math.min(Math.round(complianceRate), 100)}
        className="h-1.5 overflow-hidden rounded-full bg-secondary"
      >
        <div className={cn('h-full rounded-full', style.bar)} style={{ width: `${Math.min(complianceRate, 100)}%` }} />
      </div>

      <div className="flex items-center justify-between gap-2">
        <Badge variant={style.badge}>{label}</Badge>
        {missingRecords > 0 && (
          <span className="inline-flex items-center gap-1 text-xs text-warning">
            <AlertTriangle className="size-3.5" aria-hidden="true" />
            {missingRecords} missing attendance record{missingRecords === 1 ? '' : 's'}
          </span>
        )}
      </div>
    </Wrapper>
  );
}
