import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { BarChart3, ClipboardList, Loader2 } from 'lucide-react';
import { useProject } from '@core/contexts/ProjectContext';
import { Button, EmptyState, Input, PageHeader, StatCard } from '@/components/ui';
import { cn } from '@/lib/utils';
import {
  getAssignmentVsAttendanceStats,
  getDrillDownStats,
  getAttendanceGaps
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

      {attendanceGaps && (
        <AttendanceIssuesPanel gaps={attendanceGaps} onIssueClick={(sessionId) => navigate(`/attendance-tracker?session=${encodeURIComponent(sessionId)}`)} />
      )}
    </div>
  );
};

export default AttendanceComplianceDashboard;
