import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { BarChart3, CalendarPlus, ClipboardList, Loader2 } from 'lucide-react';
import { useProject } from '@core/contexts/ProjectContext';
import { Badge, Button, EmptyState, Input, PageHeader, StatCard } from '@/components/ui';
import { cn } from '@/lib/utils';
import {
  getAssignmentVsAttendanceStats,
  getDrillDownStats,
  getAttendanceGaps,
  getUnscheduledAreas
} from '../../services/attendanceService';
import ComplianceMetricCard from './ComplianceMetricCard';
import BreadcrumbNavigation from './BreadcrumbNavigation';
import AttendanceIssuesPanel from './AttendanceIssuesPanel';
import { DATE_PRESETS, LEVEL_TITLES, buildDateFilters, complianceLevel, drillInto, formatPercentage, goToBreadcrumb } from './complianceLogic';

const RATE_TONE = { excellent: 'success', good: 'default', warning: 'warning', critical: 'danger' };

const AttendanceComplianceDashboard = () => {
  const { currentProject } = useProject();
  const navigate = useNavigate();

  const [complianceData, setComplianceData] = useState(null);
  const [drillDownData, setDrillDownData] = useState({});
  const [attendanceGaps, setAttendanceGaps] = useState(null);
  const [unscheduled, setUnscheduled] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  const [currentPath, setCurrentPath] = useState({});
  const [breadcrumb, setBreadcrumb] = useState([]);
  const [viewLevel, setViewLevel] = useState('project'); // project, functionalArea, trainingLocation, session
  const [dateRange, setDateRange] = useState({ startDate: '', endDate: '', preset: 'all' });

  const loadComplianceData = useCallback(async () => {
    try {
      setLoading(true);
      setError(null);
      const dateFilters = buildDateFilters(dateRange);
      const [complianceStats, drillStats, gapsData] = await Promise.all([
        getAssignmentVsAttendanceStats(currentProject.id, { ...dateFilters, ...currentPath }),
        getDrillDownStats(currentProject.id, currentPath, dateFilters),
        getAttendanceGaps(currentProject.id, dateFilters)
      ]);
      setComplianceData(complianceStats);
      setDrillDownData(drillStats.drillDownData || {});
      setBreadcrumb(drillStats.breadcrumb || []);
      setAttendanceGaps(gapsData);

      // Areas with training needs but no sessions. Only when nothing narrows the data (a date range could hide
      // an area's sessions and make it look unscheduled), and only at the top level. A failure here never
      // stops the dashboard.
      const topLevelAllTime = dateRange.preset === 'all' && !currentPath.functionalArea;
      setUnscheduled(topLevelAllTime ? await getUnscheduledAreas(currentProject.id, Object.keys(drillStats.drillDownData || {})).catch(() => []) : []);
    } catch (loadError) {
      console.error('❌ Error loading compliance data:', loadError);
      setError('Failed to load attendance compliance data');
    } finally {
      setLoading(false);
    }
  }, [currentProject, dateRange, currentPath]);

  useEffect(() => {
    if (currentProject) loadComplianceData();
  }, [currentProject, loadComplianceData]);

  const handleBreadcrumbClick = (level, value = null) => {
    const next = goToBreadcrumb(currentPath, level, value);
    setViewLevel(next.viewLevel);
    setCurrentPath(next.path);
  };

  const handleCardClick = (key) => {
    const next = drillInto(currentPath, viewLevel, key);
    setViewLevel(next.viewLevel);
    setCurrentPath(next.path);
  };

  const handleDateRangeChange = (preset, startDate = '', endDate = '') => setDateRange({ preset, startDate, endDate });

  const cards = useMemo(() => Object.entries(drillDownData), [drillDownData]);

  if (!currentProject) {
    return (
      <div className="mx-auto max-w-6xl rounded-lg border border-border bg-card">
        <EmptyState icon={BarChart3} title="No Project Selected" description="Please select a project to view attendance compliance data." />
      </div>
    );
  }

  if (loading && !complianceData && !error) {
    return (
      <div role="status" className="flex items-center justify-center gap-2 py-16 text-sm text-muted-foreground">
        <Loader2 className="size-4 animate-spin" aria-hidden="true" />
        Loading compliance data...
      </div>
    );
  }

  const overall = complianceData?.overall;

  return (
    <div className="mx-auto flex max-w-6xl flex-col gap-4">
      <PageHeader
        title="Attendance Compliance Dashboard"
        description={`Track assignment vs attendance compliance with drill-down analysis. Project: ${currentProject.title}.`}
      />

      {error && (
        <div role="alert" className="flex items-center gap-3 rounded-md bg-destructive-soft px-3 py-2 text-sm text-destructive">
          <span className="flex-1">{error}</span>
          <Button variant="ghost" size="sm" onClick={() => setError(null)}>Dismiss</Button>
        </div>
      )}

      <section aria-label="Date range" className="flex flex-wrap items-center gap-3 rounded-lg border border-border bg-card px-4 py-3">
        <h3 className="text-sm font-semibold">Date Range</h3>
        <div role="group" aria-label="Date range presets" className="flex gap-1">
          {DATE_PRESETS.map((preset) => (
            <Button key={preset.value} size="sm" variant={dateRange.preset === preset.value ? 'default' : 'secondary'} aria-pressed={dateRange.preset === preset.value} onClick={() => handleDateRangeChange(preset.value)}>
              {preset.label}
            </Button>
          ))}
        </div>
        <div className="ml-auto flex items-center gap-2 text-sm text-muted-foreground">
          <Input type="date" aria-label="Start date" value={dateRange.startDate} onChange={(event) => handleDateRangeChange('custom', event.target.value, dateRange.endDate)} className="w-40" />
          <span>to</span>
          <Input type="date" aria-label="End date" value={dateRange.endDate} onChange={(event) => handleDateRangeChange('custom', dateRange.startDate, event.target.value)} className="w-40" />
        </div>
      </section>

      {breadcrumb.length > 0 && <BreadcrumbNavigation breadcrumb={breadcrumb} onBreadcrumbClick={handleBreadcrumbClick} />}

      {overall && (
        <div className={cn('flex flex-wrap gap-3', loading && 'opacity-60')}>
          <StatCard value={overall.total_assigned} label="Total Assigned" />
          <StatCard value={overall.total_attended} label="Actually Attended" tone="success" />
          <StatCard value={formatPercentage(overall.compliance_rate)} label="Compliance Rate" tone={RATE_TONE[complianceLevel(overall.compliance_rate).level]} />
          {overall.missing_attendance_records > 0 && <StatCard value={overall.missing_attendance_records} label="Missing Records" tone="warning" />}
        </div>
      )}

      <section aria-label={LEVEL_TITLES[viewLevel] || 'Sessions'} className="flex flex-col gap-3">
        <h3 className="text-base font-semibold">{LEVEL_TITLES[viewLevel] || 'Session'}</h3>
        {cards.length > 0 ? (
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
            {cards.map(([key, data]) => (
              <ComplianceMetricCard
                key={key}
                title={data.session_name || key}
                assigned={data.assigned}
                attended={data.attended}
                complianceRate={data.compliance_rate}
                missingRecords={data.missing_records || 0}
                onClick={() => handleCardClick(key)}
                isDrillable={viewLevel !== 'session'}
              />
            ))}
          </div>
        ) : (
          <div className="rounded-lg border border-dashed border-border-strong bg-card">
            <EmptyState
              icon={ClipboardList}
              title="No Training Data Found"
              description="To see compliance data: create training sessions using the Schedule Manager, assign users to sessions using User Assignments, then record attendance using the Attendance Tracker."
            />
          </div>
        )}
      </section>

      {unscheduled.length > 0 && (
        <section aria-label="Not scheduled yet" className="flex flex-col gap-3">
          <div>
            <h3 className="text-base font-semibold">Not scheduled yet ({unscheduled.length})</h3>
            <p className="text-sm text-muted-foreground">These functional areas have training needs but no sessions, so there is nothing to attend yet.</p>
          </div>
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
            {unscheduled.map((area) => (
              <div key={area.functional_area} className="flex flex-col gap-3 rounded-lg border border-dashed border-border-strong bg-card p-4">
                <div className="flex items-start justify-between gap-2">
                  <h4 className="text-sm font-semibold leading-snug">{area.functional_area}</h4>
                  <Badge variant="warning">Not scheduled</Badge>
                </div>
                <p className="text-sm text-muted-foreground">
                  <b className="tabular-nums text-foreground">{area.people}</b> {area.people === 1 ? 'person needs' : 'people need'}{' '}
                  <b className="tabular-nums text-foreground">{area.courses}</b> {area.courses === 1 ? 'course' : 'courses'}
                </p>
                <Button size="sm" className="self-start" onClick={() => navigate('/training-scheduler?restart=true')}>
                  <CalendarPlus /> Create a schedule
                </Button>
              </div>
            ))}
          </div>
        </section>
      )}

      {attendanceGaps && (
        <AttendanceIssuesPanel gaps={attendanceGaps} onIssueClick={(sessionId) => navigate(`/attendance-tracker?session=${encodeURIComponent(sessionId)}`)} />
      )}
    </div>
  );
};

export default AttendanceComplianceDashboard;
