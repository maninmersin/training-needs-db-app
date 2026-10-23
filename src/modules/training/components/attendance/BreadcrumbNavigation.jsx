import React from 'react';
import { Building2, ChevronRight, LayoutList, MapPin, Target } from 'lucide-react';
import { cn } from '@/lib/utils';

const ICONS = { project: Building2, functionalArea: LayoutList, trainingLocation: MapPin, session: Target };
const HINTS = ['Click on an area to drill down', 'Click on a location to see individual sessions', 'Individual session details'];

/** The drill-down trail (project > area > location > session). All but the last step can be clicked to go back. */
export default function BreadcrumbNavigation({ breadcrumb, onBreadcrumbClick }) {
  return (
    <div className="flex flex-wrap items-center justify-between gap-2 rounded-lg border border-border bg-card px-3 py-2">
      <nav aria-label="Drill-down">
        <ol className="flex flex-wrap items-center gap-1">
          {breadcrumb.map((crumb, index) => {
            const Icon = ICONS[crumb.level];
            const last = index === breadcrumb.length - 1;
            return (
              <li key={`${crumb.level}-${crumb.value ?? index}`} className="flex items-center gap-1">
                <button
                  type="button"
                  disabled={last}
                  aria-current={last ? 'page' : undefined}
                  onClick={() => onBreadcrumbClick(crumb.level, crumb.value)}
                  className={cn(
                    'inline-flex h-7 items-center gap-1.5 rounded-md px-2 text-sm focus-visible:outline-2 focus-visible:outline-ring',
                    last ? 'bg-primary-soft font-medium text-primary-soft-foreground' : 'text-muted-foreground hover:bg-accent hover:text-foreground'
                  )}
                >
                  {Icon && <Icon className="size-3.5" aria-hidden="true" />}
                  {crumb.label}
                </button>
                {!last && <ChevronRight className="size-3.5 text-subtle-foreground" aria-hidden="true" />}
              </li>
            );
          })}
        </ol>
      </nav>
      <span className="text-xs text-subtle-foreground">{HINTS[breadcrumb.length - 1]}</span>
    </div>
  );
}
