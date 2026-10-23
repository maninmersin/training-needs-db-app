import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { BarChart3, CalendarDays, Download, Loader2, Search, UserRound } from 'lucide-react';
import { useProject } from '@core/contexts/ProjectContext';
import {
  Badge, Button, DataTable, Dialog, DialogBody, DialogContent, DialogDescription, DialogHeader, DialogTitle, DropdownMenu,
  DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger, EmptyState, FormField, Input, PageHeader, Select, SelectContent,
  SelectItem, SelectTrigger, SelectValue, StatCard, Tabs, TabsContent, TabsList, TabsTrigger, toast
} from '@/components/ui';
import { cn } from '@/lib/utils';
import { downloadTable } from '@shared/import/exportFiles';
import {
  getAttendanceStatistics,
  exportAttendanceData,
  getSessionsForAttendance,
  getSessionAttendanceRecords,
  getAttendeeHistory
} from '../../services/attendanceService';
import { searchUserDirectory } from '../../services/userDirectoryService';
import { complianceLevel, formatPercentage } from './complianceLogic';
import { EMPTY_FILTERS, filterReportSessions, summariseHistory, uniqueOptions } from './reportsLogic';

const ALL = '__all__'; // Radix Select cannot hold an empty value

const BAR = { excellent: 'bg-success', good: 'bg-primary', warning: 'bg-warning', critical: 'bg-destructive' };
const TEXT = { excellent: 'text-success', good: 'text-primary', warning: 'text-warning', critical: 'text-destructive' };
const TONE = { excellent: 'success', good: 'default', warning: 'warning', critical: 'danger' };

function StatusBadge({ status }) {
  if (!status) return <Badge>Unknown</Badge>;
  return (
    <span className="inline-flex items-center gap-1.5 text-sm font-medium">
      <span className="size-2 rounded-full" style={{ backgroundColor: status.color_code }} aria-hidden="true" />
      {status.status_name}
    </span>
  );
}

function FilterSelect({ label, value, onChange, allLabel, options }) {
  return (
    <FormField label={label}>
      {(fieldProps) => (
        <Select value={value || ALL} onValueChange={(next) => onChange(next === ALL ? '' : next)}>
          <SelectTrigger {...fieldProps}><SelectValue /></SelectTrigger>
          <SelectContent>
            <SelectItem value={ALL}>{allLabel}</SelectItem>
            {options.map((option) => (<SelectItem key={option} value={option}>{option}</SelectItem>))}
          </SelectContent>
        </Select>
      )}
    </FormField>
  );
}

const AttendanceReports = () => {
  const { currentProject } = useProject();

  const [statistics, setStatistics] = useState(null);
  const [sessions, setSessions] = useState([]);
  const [filters, setFilters] = useState(EMPTY_FILTERS);
  const [loading, setLoading] = useState(true);
  const [exporting, setExporting] = useState(false);
  const [error, setError] = useState(null);
  const [activeView, setActiveView] = useState('overview'); // overview, sessions, individual

  const [selectedSession, setSelectedSession] = useState(null);
  const [sessionRecords, setSessionRecords] = useState(null); // null while loading

  const [personTerm, setPersonTerm] = useState('');
  const [people, setPeople] = useState([]);
  const [searching, setSearching] = useState(false);
  const [person, setPerson] = useState(null);
  const [history, setHistory] = useState(null); // null while loading

  const loadReportsData = useCallback(async () => {
    try {
      setLoading(true);
      setError(null);
      const [statsData, sessionsData] = await Promise.all([getAttendanceStatistics(currentProject.id, filters), getSessionsForAttendance(currentProject.id)]);
      setStatistics(statsData);
      setSessions(sessionsData);
    } catch (loadError) {
      console.error('Error loading reports data:', loadError);
      setError('Failed to load attendance reports');
    } finally {
      setLoading(false);
    }
  }, [currentProject, filters]);

  useEffect(() => {
    if (currentProject) loadReportsData();
  }, [currentProject, loadReportsData]);

  const setFilter = (field, value) => setFilters((previous) => ({ ...previous, [field]: value }));

  const handleExportData = async (format) => {
    try {
      setExporting(true);
      const exportData = await exportAttendanceData(currentProject.id, filters);
      if (exportData.length === 0) {
        toast.info('No attendance data found for the selected filters.');
        return;
      }
      downloadTable(`attendance-report-${new Date().toISOString().split('T')[0]}`, Object.keys(exportData[0]), exportData.map((row) => Object.values(row)), format);
    } catch (exportError) {
      console.error('Error exporting data:', exportError);
      setError('Failed to export attendance data');
    } finally {
      setExporting(false);
    }
  };

  const openSession = async (session) => {
    setSelectedSession(session);
    setSessionRecords(null);
    try {
      setSessionRecords(await getSessionAttendanceRecords(session.id, currentProject.id));
    } catch (loadError) {
      console.error('Error loading session attendees:', loadError);
      setError('Failed to load session attendees');
      setSelectedSession(null);
    }
  };

  // Individual tab: search as the person types, after a short pause
  useEffect(() => {
    if (activeView !== 'individual' || person || !currentProject) return undefined;
    let active = true;
    const timer = setTimeout(async () => {
      setSearching(true);
      try {
        const found = await searchUserDirectory(currentProject.id, personTerm);
        if (active) setPeople(found);
      } catch (searchError) {
        if (active) setError(`Could not search: ${searchError.message}`);
      } finally {
        if (active) setSearching(false);
      }
    }, 250);
    return () => {
      active = false;
      clearTimeout(timer);
    };
  }, [personTerm, activeView, person, currentProject]);

  const choosePerson = async (chosen) => {
    setPerson(chosen);
    setHistory(null);
    try {
      setHistory(await getAttendeeHistory(chosen.id, currentProject.id, { startDate: filters.startDate, endDate: filters.endDate }));
    } catch (loadError) {
      console.error('Error loading attendee history:', loadError);
      setError('Failed to load attendance history');
      setPerson(null);
    }
  };

  const areaOptions = useMemo(() => uniqueOptions(sessions, 'functional_area'), [sessions]);
  const locationOptions = useMemo(() => uniqueOptions(sessions, 'training_location'), [sessions]);
  const shownSessions = useMemo(() => filterReportSessions(sessions, filters), [sessions, filters]);
  const personSummary = useMemo(() => summariseHistory(history || []), [history]);

  const sessionColumns = useMemo(
    () => [
      { accessorKey: 'course_name', header: 'Course', meta: { className: 'font-medium' } },
      { id: 'when', header: 'Date & Time', accessorFn: (session) => session.start_datetime, cell: ({ row }) => new Date(row.original.start_datetime).toLocaleString('en-GB') },
      { id: 'where', header: 'Location', accessorFn: (session) => `${session.training_location} - Room ${session.classroom_number}` },
      { accessorKey: 'functional_area', header: 'Functional Area' },
      {
        id: 'attendance',
        header: 'Attendance',
        enableSorting: false,
        cell: ({ row }) => <Button size="sm" aria-label={`View details - ${row.original.course_name}`} onClick={() => openSession(row.original)}>View Details</Button>
      }
    ],
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [currentProject]
  );

  const historyColumns = useMemo(
    () => [
      { id: 'course', header: 'Course', accessorFn: (record) => record.session?.course_name || record.session?.session_title || '', meta: { className: 'font-medium' } },
      { id: 'when', header: 'Date & Time', accessorFn: (record) => record.session?.start_datetime || '', cell: ({ row }) => (row.original.session?.start_datetime ? new Date(row.original.session.start_datetime).toLocaleString('en-GB') : '') },
      { id: 'where', header: 'Location', accessorFn: (record) => record.session?.training_location || '' },
      { id: 'status', header: 'Status', accessorFn: (record) => record.status?.status_name || '', cell: ({ row }) => <StatusBadge status={row.original.status} /> },
      { id: 'notes', header: 'Notes', enableSorting: false, accessorFn: (record) => record.notes || '-', meta: { className: 'text-muted-foreground' } }
    ],
    []
  );

  const recordColumns = useMemo(
    () => [
      { id: 'name', header: 'Name', accessorFn: (record) => record.user?.name || 'Unknown User', meta: { className: 'font-medium' } },
      { id: 'status', header: 'Status', accessorFn: (record) => record.status?.status_name || '', cell: ({ row }) => <StatusBadge status={row.original.status} /> },
      { id: 'notes', header: 'Notes', accessorFn: (record) => record.notes || '-', meta: { className: 'text-muted-foreground' } }
    ],
    []
  );

  if (!currentProject) {
    return (
      <div className="mx-auto max-w-6xl rounded-lg border border-border bg-card">
        <EmptyState icon={BarChart3} title="No Project Selected" description="Please select a project to view attendance reports." />
      </div>
    );
  }

  if (loading && !statistics && !error) {
    return (
      <div role="status" className="flex items-center justify-center gap-2 py-16 text-sm text-muted-foreground">
        <Loader2 className="size-4 animate-spin" aria-hidden="true" />
        Loading attendance reports...
      </div>
    );
  }

  const overall = statistics?.overall;
  const areas = statistics?.by_functional_area ? Object.entries(statistics.by_functional_area) : [];
  const overallLevel = complianceLevel(overall?.attendance_rate || 0).level;

  return (
    <div className="mx-auto flex max-w-6xl flex-col gap-4">
      <PageHeader
        title="Attendance Reports & Analytics"
        description={`Analyze attendance patterns, generate reports, and track training effectiveness. Project: ${currentProject.title}.`}
        actions={
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button disabled={exporting}>{exporting ? <Loader2 className="animate-spin" aria-hidden="true" /> : <Download />} Export</Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end">
              <DropdownMenuItem onSelect={() => handleExportData('xlsx')}>Excel (.xlsx)</DropdownMenuItem>
              <DropdownMenuItem onSelect={() => handleExportData('csv')}>CSV</DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        }
      />

      {error && (
        <div role="alert" className="flex items-center gap-3 rounded-md bg-destructive-soft px-3 py-2 text-sm text-destructive">
          <span className="flex-1">{error}</span>
          <Button variant="ghost" size="sm" onClick={() => setError(null)}>Dismiss</Button>
        </div>
      )}

      <section aria-label="Filters" className="grid gap-3 rounded-lg border border-border bg-card p-4 sm:grid-cols-2 lg:grid-cols-[repeat(4,1fr)_auto]">
        <FormField label="Start Date"><Input type="date" value={filters.startDate} onChange={(event) => setFilter('startDate', event.target.value)} /></FormField>
        <FormField label="End Date"><Input type="date" value={filters.endDate} onChange={(event) => setFilter('endDate', event.target.value)} /></FormField>
        <FilterSelect label="Functional Area" value={filters.functionalArea} onChange={(value) => setFilter('functionalArea', value)} allLabel="All Areas" options={areaOptions} />
        <FilterSelect label="Training Location" value={filters.trainingLocation} onChange={(value) => setFilter('trainingLocation', value)} allLabel="All Locations" options={locationOptions} />
        <div className="flex items-end"><Button variant="ghost" onClick={() => setFilters(EMPTY_FILTERS)}>Reset Filters</Button></div>
      </section>

      <Tabs value={activeView} onValueChange={setActiveView}>
        <TabsList>
          <TabsTrigger value="overview">Overview</TabsTrigger>
          <TabsTrigger value="sessions">By Session</TabsTrigger>
          <TabsTrigger value="individual">Individual</TabsTrigger>
        </TabsList>

        <TabsContent value="overview" className="flex flex-col gap-4">
          {statistics ? (
            <>
              <div className={cn('flex flex-wrap gap-3', loading && 'opacity-60')}>
                <StatCard value={overall?.total_records || 0} label="Total Records" />
                <StatCard value={overall?.total_present || 0} label="Present" tone="success" />
                <StatCard value={overall?.total_absent || 0} label="Absent" tone={(overall?.total_absent || 0) > 0 ? 'danger' : 'default'} />
                <StatCard value={formatPercentage(overall?.attendance_rate || 0)} label="Attendance Rate" tone={TONE[overallLevel]} />
              </div>

              <h3 className="text-base font-semibold">Attendance by Functional Area</h3>
              {areas.length > 0 ? (
                <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
                  {areas.map(([area, stats]) => {
                    const { level } = complianceLevel(stats.attendance_rate);
                    return (
                      <div key={area} className="flex flex-col gap-3 rounded-lg border border-border bg-card p-4">
                        <div className="flex items-baseline justify-between gap-2">
                          <h4 className="text-sm font-semibold">{area}</h4>
                          <span className={cn('text-lg font-semibold tabular-nums', TEXT[level])}>{formatPercentage(stats.attendance_rate)}</span>
                        </div>
                        <div className="flex gap-5 text-xs text-muted-foreground">
                          <span className="flex flex-col"><b className="text-sm tabular-nums text-foreground">{stats.present}</b>Present</span>
                          <span className="flex flex-col"><b className="text-sm tabular-nums text-foreground">{stats.total - stats.present}</b>Absent</span>
                          <span className="flex flex-col"><b className="text-sm tabular-nums text-foreground">{stats.total}</b>Total</span>
                        </div>
                        <div role="progressbar" aria-label={`${area} attendance`} aria-valuemin={0} aria-valuemax={100} aria-valuenow={Math.round(stats.attendance_rate)} className="h-1.5 overflow-hidden rounded-full bg-secondary">
                          <div className={cn('h-full rounded-full', BAR[level])} style={{ width: `${Math.min(stats.attendance_rate, 100)}%` }} />
                        </div>
                      </div>
                    );
                  })}
                </div>
              ) : (
                <div className="rounded-lg border border-border bg-card">
                  <EmptyState icon={BarChart3} title="No Attendance Data Available" description="No attendance records found for the current filters. Try adjusting your date range or clearing filters." />
                </div>
              )}
            </>
          ) : (
            <div className="rounded-lg border border-border bg-card">
              <EmptyState icon={BarChart3} title="No Attendance Data Available" description="No attendance records found for the current filters. Try adjusting your date range or clearing filters." />
            </div>
          )}
        </TabsContent>

        <TabsContent value="sessions" className="flex flex-col gap-3">
          <h3 className="text-base font-semibold">Session-wise Attendance</h3>
          {loading ? (
            <div role="status" className="flex items-center justify-center gap-2 rounded-lg border border-border bg-card py-12 text-sm text-muted-foreground">
              <Loader2 className="size-4 animate-spin" aria-hidden="true" /> Loading session data...
            </div>
          ) : (
            <DataTable
              caption="Sessions"
              columns={sessionColumns}
              data={shownSessions}
              getRowId={(session) => session.id}
              pageSize={25}
              emptyState={<EmptyState icon={CalendarDays} title="No sessions match" description="Try different filters." />}
            />
          )}
        </TabsContent>

        <TabsContent value="individual" className="flex flex-col gap-3">
          <h3 className="text-base font-semibold">Individual Attendance History</h3>
          {!person ? (
            <div className="flex max-w-xl flex-col gap-2">
              <div className="relative">
                <Search className="pointer-events-none absolute left-2.5 top-1/2 size-4 -translate-y-1/2 text-subtle-foreground" aria-hidden="true" />
                <Input aria-label="Search for an attendee" placeholder="Search for an attendee by name, email or ID..." value={personTerm} onChange={(event) => setPersonTerm(event.target.value)} className="pl-8" />
              </div>
              <ul aria-label="People found" className="max-h-64 overflow-y-auto rounded-md border border-border bg-card">
                {people.map((candidate) => (
                  <li key={candidate.id} className="border-b border-border last:border-b-0">
                    <button type="button" onClick={() => choosePerson(candidate)} className="flex w-full flex-col px-3 py-2 text-left text-sm hover:bg-accent focus-visible:outline-2 focus-visible:outline-ring">
                      <span className="font-medium">{candidate.name}</span>
                      <span className="text-xs text-muted-foreground">{[candidate.email, candidate.project_role, candidate.training_location].filter(Boolean).join(' - ')}</span>
                    </button>
                  </li>
                ))}
                {searching && <li className="flex items-center gap-2 px-3 py-2 text-sm text-muted-foreground"><Loader2 className="size-4 animate-spin" aria-hidden="true" /> Searching...</li>}
                {!searching && people.length === 0 && (
                  <li className="px-3 py-2 text-sm italic text-muted-foreground">{personTerm.trim().length < 2 ? 'Type at least two letters to search' : 'No one found'}</li>
                )}
              </ul>
            </div>
          ) : (
            <>
              <div className="flex items-center gap-3 rounded-lg border border-border bg-card px-4 py-3">
                <UserRound className="size-5 text-muted-foreground" aria-hidden="true" />
                <div className="min-w-0 flex-1">
                  <h4 className="font-semibold">{person.name}</h4>
                  <p className="truncate text-xs text-muted-foreground">{[person.email, person.project_role, person.training_location].filter(Boolean).join(' - ')}</p>
                </div>
                <Button onClick={() => { setPerson(null); setHistory(null); }}>Change person</Button>
              </div>
              {history === null ? (
                <div role="status" className="flex items-center justify-center gap-2 rounded-lg border border-border bg-card py-12 text-sm text-muted-foreground">
                  <Loader2 className="size-4 animate-spin" aria-hidden="true" /> Loading attendance history...
                </div>
              ) : (
                <>
                  <div className="flex flex-wrap gap-3">
                    <StatCard value={formatPercentage(personSummary.rate)} label="Attendance Rate" tone={TONE[complianceLevel(personSummary.rate).level]} />
                    <StatCard value={personSummary.attended} label="Sessions Attended" tone="success" />
                    <StatCard value={personSummary.missed} label="Sessions Missed" tone={personSummary.missed > 0 ? 'danger' : 'default'} />
                  </div>
                  <DataTable
                    caption="Attendance history"
                    columns={historyColumns}
                    data={history}
                    getRowId={(record) => record.id}
                    pageSize={25}
                    emptyState={<EmptyState icon={CalendarDays} title="No attendance recorded" description="This person has no attendance records for the dates chosen." />}
                  />
                </>
              )}
            </>
          )}
        </TabsContent>
      </Tabs>

      <Dialog open={Boolean(selectedSession)} onOpenChange={(open) => !open && setSelectedSession(null)}>
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle>Session Attendees</DialogTitle>
            {selectedSession && (
              <DialogDescription>
                {selectedSession.course_name} - {new Date(selectedSession.start_datetime).toLocaleDateString('en-GB')}{' '}
                {new Date(selectedSession.start_datetime).toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit' })} - {selectedSession.training_location} - {selectedSession.functional_area}
              </DialogDescription>
            )}
          </DialogHeader>
          <DialogBody>
            {sessionRecords === null ? (
              <div role="status" className="flex items-center justify-center gap-2 py-8 text-sm text-muted-foreground">
                <Loader2 className="size-4 animate-spin" aria-hidden="true" /> Loading attendees...
              </div>
            ) : (
              <DataTable
                caption="Session attendees"
                columns={recordColumns}
                data={sessionRecords}
                getRowId={(record) => record.id}
                pageSize={25}
                emptyState={<EmptyState icon={CalendarDays} title="No attendance recorded for this session" />}
              />
            )}
          </DialogBody>
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default AttendanceReports;
