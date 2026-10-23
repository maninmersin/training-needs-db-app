import React, { useState } from 'react';
import { ChevronDown, ChevronRight, CircleCheck, ClipboardX, TrendingDown, TriangleAlert } from 'lucide-react';
import { Badge, Card, EmptyState, StatCard } from '@/components/ui';

function Section({ id, icon: Icon, title, count, expanded, onToggle, children }) {
  return (
    <div className="border-t border-border first:border-t-0">
      <button
        type="button"
        aria-expanded={expanded}
        aria-controls={`issues-${id}`}
        onClick={onToggle}
        className="flex w-full items-center gap-2 px-4 py-3 text-left text-sm font-medium hover:bg-accent focus-visible:outline-2 focus-visible:outline-ring"
      >
        <Icon className="size-4 text-muted-foreground" aria-hidden="true" />
        <span className="flex-1">{title}</span>
        <span className="text-xs text-muted-foreground">{count}</span>
        {expanded ? <ChevronDown className="size-4" aria-hidden="true" /> : <ChevronRight className="size-4" aria-hidden="true" />}
      </button>
      {expanded && <div id={`issues-${id}`} className="px-4 pb-4">{children}</div>}
    </div>
  );
}

function IssueList({ issues, badge, detail, action, onIssueClick }) {
  return (
    <ul className="flex flex-col gap-2">
      {issues.map((issue) => (
        <li key={issue.session_id}>
          <button
            type="button"
            onClick={() => onIssueClick(issue.session_id)}
            className="flex w-full flex-col gap-1.5 rounded-md border border-border bg-card px-3 py-2 text-left hover:bg-accent focus-visible:outline-2 focus-visible:outline-ring"
          >
            <span className="flex flex-wrap items-center justify-between gap-2">
              <span className="text-sm font-medium">{issue.session_name}</span>
              {badge(issue)}
            </span>
            <span className="text-xs text-muted-foreground">
              Location: {issue.training_location} - Functional Area: {issue.functional_area} - {detail(issue)}
            </span>
            <span className="text-xs text-primary">{action} <span aria-hidden="true">&rarr;</span></span>
          </button>
        </li>
      ))}
    </ul>
  );
}

/** Sessions that need attention: ones with attendance not recorded, and ones with low compliance. */
export default function AttendanceIssuesPanel({ gaps, onIssueClick }) {
  const [expanded, setExpanded] = useState('summary');
  const toggle = (section) => setExpanded((current) => (current === section ? null : section));

  if (!gaps || gaps.summary.total_issues === 0) {
    return (
      <Card>
        <EmptyState icon={CircleCheck} title="No Issues Found" description="All sessions have complete attendance records and good compliance rates!" />
      </Card>
    );
  }

  return (
    <Card className="overflow-hidden">
      <div className="flex items-center justify-between gap-3 border-b border-border px-4 py-3">
        <h3 className="flex items-center gap-2 text-base font-semibold">
          <TriangleAlert className="size-4 text-warning" aria-hidden="true" /> Issues Requiring Attention
        </h3>
        <Badge variant="warning" className="tabular-nums">{gaps.summary.total_issues} Total Issues</Badge>
      </div>

      <Section
        id="summary"
        icon={ClipboardX}
        title="Summary"
        count={`${gaps.summary.missing_records_count + gaps.summary.low_compliance_count} issues`}
        expanded={expanded === 'summary'}
        onToggle={() => toggle('summary')}
      >
        <div className="flex flex-wrap gap-3">
          <StatCard value={gaps.summary.missing_records_count} label="Missing Attendance Records" tone="warning" />
          <StatCard value={gaps.summary.low_compliance_count} label="Low Compliance Sessions (<80%)" tone="danger" />
        </div>
      </Section>

      {gaps.missing_attendance_records.length > 0 && (
        <Section
          id="missing"
          icon={ClipboardX}
          title="Missing Attendance Records"
          count={`${gaps.missing_attendance_records.length} sessions`}
          expanded={expanded === 'missing'}
          onToggle={() => toggle('missing')}
        >
          <IssueList
            issues={gaps.missing_attendance_records}
            badge={() => <Badge variant="warning">Missing Records</Badge>}
            detail={(issue) => `Missing: ${issue.missing_count} of ${issue.assigned_count} records`}
            action="Click to review session"
            onIssueClick={onIssueClick}
          />
        </Section>
      )}

      {gaps.low_compliance_sessions.length > 0 && (
        <Section
          id="compliance"
          icon={TrendingDown}
          title="Low Compliance Sessions"
          count={`${gaps.low_compliance_sessions.length} sessions`}
          expanded={expanded === 'compliance'}
          onToggle={() => toggle('compliance')}
        >
          <IssueList
            issues={gaps.low_compliance_sessions}
            badge={(issue) => <Badge variant={issue.compliance_rate < 60 ? 'danger' : 'warning'}>{issue.compliance_rate}% Compliance</Badge>}
            detail={(issue) => `Attendance: ${issue.attended} of ${issue.assigned} attended`}
            action="Click to investigate"
            onIssueClick={onIssueClick}
          />
        </Section>
      )}
    </Card>
  );
}
