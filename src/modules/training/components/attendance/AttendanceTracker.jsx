import React, { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import { ClipboardCheck, Loader2, Search, UserPlus } from 'lucide-react';
import { useProject } from '@core/contexts/ProjectContext';
import { SimpleAuthService } from '@auth/services/simpleAuthService';
import {
  Badge, Button, DataTable, EmptyState, FormField, Input, PageHeader, Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
  StatCard, Toolbar, toast
} from '@/components/ui';
import {
  getSessionsForAttendance,
  getAttendanceStatuses,
  getSessionAttendees,
  getSessionAttendanceRecords,
  markSingleAttendance,
  clearAttendanceRecord,
  getSessionAttendanceSummary
} from '../../services/attendanceService';
import { applyWalkInPlan } from '../../services/walkInService';
import WalkInDialog from './WalkInDialog';
import { CHOICE } from './walkInPlan';
import { FILTER_OPTIONS, filterAttendees, filterSessions, formatDateTime, recordFor, sessionLabel, withWalkIns } from './trackerLogic';

// The comment boxes read their text from here rather than from the column definitions: if the columns
// changed on every keystroke the input would be recreated and lose focus after each letter.
const CommentsContext = createContext({ comments: {}, setComment: () => {} });

function CommentCell({ attendee }) {
  const { comments, setComment } = useContext(CommentsContext);
  return (
    <Input
      aria-label={`Comments for ${attendee.user.name}`}
      placeholder="Add notes about attendance..."
      value={comments[attendee.attendee_id] || ''}
      onChange={(event) => setComment(attendee.attendee_id, event.target.value)}
      className="h-7 min-w-48"
    />
  );
}

const AttendanceTracker = () => {
  const { currentProject } = useProject();
  const [user, setUser] = useState(null);

  const [sessions, setSessions] = useState([]);
  const [selectedSession, setSelectedSession] = useState(null);
  const [attendees, setAttendees] = useState([]);
  const [attendanceRecords, setAttendanceRecords] = useState([]);
  const [attendanceStatuses, setAttendanceStatuses] = useState([]);
  const [attendanceSummary, setAttendanceSummary] = useState(null);

  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState(null);

  const [attendeeSearchTerm, setAttendeeSearchTerm] = useState('');
  const [sessionSearchTerm, setSessionSearchTerm] = useState('');
  const [filterStatus, setFilterStatus] = useState('all');
  const [walkInOpen, setWalkInOpen] = useState(false);
  const [searchParams, setSearchParams] = useSearchParams();
  const [attendeeComments, setAttendeeComments] = useState({});
  const commentsRef = useRef(attendeeComments);
  commentsRef.current = attendeeComments;
  const commentsValue = useMemo(
    () => ({ comments: attendeeComments, setComment: (id, text) => setAttendeeComments((previous) => ({ ...previous, [id]: text })) }),
    [attendeeComments]
  );

  useEffect(() => {
    const loadUser = async () => {
      try {
        setUser(await SimpleAuthService.getCurrentUser());
      } catch (loadError) {
        console.error('Error loading user:', loadError);
      }
    };
    loadUser();
  }, []);

  const loadInitialData = useCallback(async () => {
    try {
      setLoading(true);
      setError(null);
      const [sessionsData, statusesData] = await Promise.all([getSessionsForAttendance(currentProject.id), getAttendanceStatuses()]);
      setSessions(sessionsData);
      setAttendanceStatuses(statusesData);
    } catch (loadError) {
      console.error('Error loading initial data:', loadError);
      setError('Failed to load sessions and attendance data');
    } finally {
      setLoading(false);
    }
  }, [currentProject]);

  useEffect(() => {
    if (currentProject && user) loadInitialData();
  }, [currentProject, user, loadInitialData]);

  // `silent` refreshes after marking someone without blanking the list
  const loadSessionDetails = useCallback(
    async ({ silent = false } = {}) => {
      try {
        if (!silent) setLoading(true);
        const [attendeesData, recordsData, summaryData] = await Promise.all([
          getSessionAttendees(selectedSession.id, currentProject.id),
          getSessionAttendanceRecords(selectedSession.id, currentProject.id),
          getSessionAttendanceSummary(selectedSession.id, currentProject.id)
        ]);
        setAttendees(attendeesData);
        setAttendanceRecords(recordsData);
        setAttendanceSummary(summaryData);
      } catch (loadError) {
        console.error('Error loading session details:', loadError);
        setError('Failed to load session attendance data');
      } finally {
        setLoading(false);
      }
    },
    [selectedSession, currentProject]
  );

  useEffect(() => {
    if (selectedSession && currentProject) loadSessionDetails();
  }, [selectedSession, currentProject, loadSessionDetails]);

  const handleMarkAttendance = useCallback(
    async (attendee, status) => {
      try {
        setSubmitting(true);
        await markSingleAttendance(selectedSession.id, currentProject.id, {
          attendee_id: attendee.attendee_id,
          attendance_status_id: status.id,
          check_in_time: new Date().toISOString(),
          notes: commentsRef.current[attendee.attendee_id] || '',
          marked_by: user.id
        });
        await loadSessionDetails({ silent: true });
        setAttendeeComments((previous) => ({ ...previous, [attendee.attendee_id]: '' }));
        toast.success(`Marked ${attendee.user.name} as ${status.status_name}`);
      } catch (markError) {
        console.error('Error marking attendance:', markError);
        setError('Failed to mark attendance. Please try again.');
      } finally {
        setSubmitting(false);
      }
    },
    [selectedSession, currentProject, user, loadSessionDetails]
  );

  // The compliance dashboard links here with ?session=<id> to open that session
  useEffect(() => {
    const wanted = searchParams.get('session');
    if (!wanted || sessions.length === 0) return;
    const match = sessions.find((session) => session.id === wanted);
    if (match) setSelectedSession(match);
    setSearchParams({}, { replace: true });
  }, [sessions, searchParams, setSearchParams]);

  const handleClear = useCallback(
    async (attendee) => {
      try {
        setSubmitting(true);
        await clearAttendanceRecord(selectedSession.id, currentProject.id, attendee.attendee_id, { removeWalkInAssignment: Boolean(attendee.added_as_walk_in) });
        await loadSessionDetails({ silent: true });
        toast.success(`Cleared the attendance mark for ${attendee.user.name}`);
      } catch (clearError) {
        console.error('Error clearing attendance:', clearError);
        setError('Failed to clear attendance. Please try again.');
      } finally {
        setSubmitting(false);
      }
    },
    [selectedSession, currentProject, loadSessionDetails]
  );

  const handleAddWalkIn = async ({ person, status, notes, choice, plan }) => {
    const changesBookings = plan.newRows.length > 0 || plan.deleteIds.length > 0;
    let result = { assigned: 0, removed: 0, clearedOldMarks: 0 };
    if (changesBookings) {
      result = await applyWalkInPlan({
        plan,
        projectId: currentProject.id,
        endUserId: person.id,
        absentStatusIds: attendanceStatuses.filter((candidate) => !candidate.is_present).map((candidate) => candidate.id)
      });
    }
    try {
      await markSingleAttendance(selectedSession.id, currentProject.id, {
        attendee_id: person.id,
        attendance_status_id: status.id,
        check_in_time: new Date().toISOString(),
        notes,
        marked_by: user.id
      });
    } catch (markError) {
      if (changesBookings) await loadSessionDetails({ silent: true });
      throw new Error(`${person.name}'s booking was updated, but their attendance could not be saved: ${markError.message}. Mark them on the list.`);
    }
    await loadSessionDetails({ silent: true });
    setWalkInOpen(false);
    const outcome = {
      [CHOICE.MOVE]: `Moved ${person.name} to this session and marked them ${status.status_name}`,
      [CHOICE.ASSIGN]: `Added ${person.name} as ${status.status_name} and assigned them to this session`,
      [CHOICE.ALSO]: `Added ${person.name} to this session as well, marked ${status.status_name}`,
      [CHOICE.ATTENDANCE_ONLY]: `Recorded ${person.name} as ${status.status_name} (not assigned to this session)`
    }[choice];
    toast.success(outcome, result.clearedOldMarks > 0 ? { description: 'Their old absence mark was removed.' } : undefined);
  };

  const filteredSessions = useMemo(() => filterSessions(sessions, sessionSearchTerm), [sessions, sessionSearchTerm]);
  const rows = useMemo(() => withWalkIns(attendees, attendanceRecords), [attendees, attendanceRecords]);
  const filteredAttendees = useMemo(
    () => filterAttendees(rows, attendanceRecords, attendanceStatuses, attendeeSearchTerm, filterStatus),
    [rows, attendanceRecords, attendanceStatuses, attendeeSearchTerm, filterStatus]
  );

  const columns = useMemo(
    () => [
      {
        id: 'name',
        header: 'Name',
        accessorFn: (attendee) => attendee.user.name,
        meta: { className: 'font-medium' },
        cell: ({ row }) => (
          <span className="inline-flex items-center gap-2">
            {row.original.user.name}
            {row.original.walkIn && <Badge variant="warning" title="Attended without being assigned to this session">Not assigned</Badge>}
            {row.original.added_as_walk_in && <Badge variant="warning" title="Added to this session as a walk-in">Walk-in</Badge>}
          </span>
        )
      },
      { id: 'email', header: 'Email', accessorFn: (attendee) => attendee.user.email, meta: { className: 'text-muted-foreground' } },
      {
        id: 'status',
        header: 'Status',
        enableSorting: false,
        meta: { className: 'whitespace-normal py-1' },
        cell: ({ row }) => {
          const record = recordFor(attendanceRecords, row.original.attendee_id);
          const status = record && attendanceStatuses.find((candidate) => candidate.id === record.attendance_status_id);
          if (!status) return <Badge>Not Marked</Badge>;
          return (
            <div className="flex flex-col gap-0.5 leading-tight">
              <span className="inline-flex items-center gap-1.5 text-sm font-medium">
                <span className="size-2 rounded-full" style={{ backgroundColor: status.color_code }} aria-hidden="true" />
                {status.status_name}
              </span>
              <span className="text-xs text-subtle-foreground">
                {record.marked_at ? new Date(record.marked_at).toLocaleTimeString('en-GB') : ''}
                {record.notes ? ` - ${record.notes}` : ''}
              </span>
            </div>
          );
        }
      },
      {
        id: 'comment',
        header: 'Comments',
        enableSorting: false,
        cell: ({ row }) => <CommentCell attendee={row.original} />
      },
      {
        id: 'mark',
        header: 'Mark as',
        enableSorting: false,
        cell: ({ row }) => {
          const record = recordFor(attendanceRecords, row.original.attendee_id);
          return (
            <div className="flex gap-1" role="group" aria-label={`Mark attendance for ${row.original.user.name}`}>
              {attendanceStatuses.map((status) => {
                const current = record?.attendance_status_id === status.id;
                return (
                  <Button
                    key={status.id}
                    size="sm"
                    variant={current ? 'default' : 'secondary'}
                    aria-pressed={current}
                    disabled={submitting}
                    title={`Mark as ${status.status_name}`}
                    aria-label={`${status.status_name} - ${row.original.user.name}`}
                    onClick={() => handleMarkAttendance(row.original, status)}
                  >
                    <span className="size-2 rounded-full" style={{ backgroundColor: status.color_code }} aria-hidden="true" />
                    {status.status_name}
                  </Button>
                );
              })}
              {record && (
                <Button
                  size="sm"
                  variant="ghost"
                  disabled={submitting}
                  title={row.original.walkIn ? 'Remove this walk-in' : row.original.added_as_walk_in ? 'Remove this walk-in and the booking made for them' : 'Clear the attendance mark'}
                  aria-label={`Clear - ${row.original.user.name}`}
                  onClick={() => handleClear(row.original)}
                >
                  Clear
                </Button>
              )}
            </div>
          );
        }
      }
    ],
    [attendanceRecords, attendanceStatuses, submitting, handleMarkAttendance, handleClear]
  );

  if (!currentProject) {
    return (
      <div className="mx-auto max-w-6xl rounded-lg border border-border bg-card">
        <EmptyState icon={ClipboardCheck} title="No Project Selected" description="Please select a project to track attendance." />
      </div>
    );
  }

  if (loading && !sessions.length && !error) {
    return (
      <div role="status" className="flex items-center justify-center gap-2 py-16 text-sm text-muted-foreground">
        <Loader2 className="size-4 animate-spin" aria-hidden="true" />
        Loading attendance tracker...
      </div>
    );
  }

  return (
    <div className="mx-auto flex max-w-6xl flex-col gap-4">
      <PageHeader
        title="Attendance Tracker"
        description={`Track attendance for training sessions and manage attendee participation. Project: ${currentProject.title}.`}
      />

      {error && (
        <div role="alert" className="flex items-center gap-3 rounded-md bg-destructive-soft px-3 py-2 text-sm text-destructive">
          <span className="flex-1">{error}</span>
          <Button variant="ghost" size="sm" onClick={() => setError(null)}>Dismiss</Button>
        </div>
      )}

      <section aria-label="Select training session" className="grid gap-3 rounded-lg border border-border bg-card p-4 md:grid-cols-[2fr_1fr]">
        <FormField label="Select Training Session">
          {(fieldProps) => (
            <Select
              value={selectedSession?.id || ''}
              onValueChange={(id) => setSelectedSession(sessions.find((session) => session.id === id) || null)}
            >
              <SelectTrigger {...fieldProps}>
                <SelectValue placeholder="Choose a session..." />
              </SelectTrigger>
              <SelectContent>
                {filteredSessions.map((session) => (
                  <SelectItem key={session.id} value={session.id}>{sessionLabel(session)}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          )}
        </FormField>
        <FormField label="Filter Sessions:">
          <Input placeholder="Search by course, location, or area..." value={sessionSearchTerm} onChange={(event) => setSessionSearchTerm(event.target.value)} />
        </FormField>
      </section>

      {!selectedSession ? (
        <div className="rounded-lg border border-border bg-card">
          <EmptyState
            icon={ClipboardCheck}
            title={sessions.length === 0 ? 'No training sessions yet' : 'Choose a session'}
            description={sessions.length === 0 ? 'Create a schedule first, then come back to record who attended.' : 'Pick a session above to record who attended.'}
          />
        </div>
      ) : (
        <section aria-label={`Attendance for ${selectedSession.course_name}`} className="flex flex-col gap-3">
          <div>
            <h2 className="text-base font-semibold">Attendance for {selectedSession.course_name}</h2>
            <p className="text-sm text-muted-foreground">
              {formatDateTime(selectedSession.start_datetime)} - {selectedSession.training_location} - Room {selectedSession.classroom_number}
            </p>
          </div>

          {attendanceSummary && (
            <div className="flex flex-wrap gap-3">
              <StatCard value={attendanceSummary.total_registered} label="Registered" />
              <StatCard value={attendanceSummary.total_attended} label="Present" tone="success" />
              <StatCard value={attendanceSummary.total_absent} label="Absent" tone={attendanceSummary.total_absent > 0 ? 'danger' : 'default'} />
              {attendanceSummary.total_walk_ins > 0 && <StatCard value={attendanceSummary.total_walk_ins} label="Walk-ins" tone="warning" />}
              <StatCard value={`${Math.round(attendanceSummary.attendance_rate)}%`} label="Rate" />
            </div>
          )}

          <Toolbar>
            <div className="relative w-80 max-w-full">
              <Search className="pointer-events-none absolute left-2.5 top-1/2 size-4 -translate-y-1/2 text-subtle-foreground" aria-hidden="true" />
              <Input
                type="search"
                aria-label="Search attendees"
                placeholder="Search attendees by name or email..."
                value={attendeeSearchTerm}
                onChange={(event) => setAttendeeSearchTerm(event.target.value)}
                className="pl-8"
              />
            </div>
            <div className="w-44">
              <Select value={filterStatus} onValueChange={setFilterStatus}>
                <SelectTrigger aria-label="Filter by attendance status">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {FILTER_OPTIONS.map((option) => (
                    <SelectItem key={option.value} value={option.value}>{option.label}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <Button className="ml-auto" onClick={() => setWalkInOpen(true)} disabled={loading}>
              <UserPlus /> Add walk-in
            </Button>
          </Toolbar>

          {loading ? (
            <div role="status" className="flex items-center justify-center gap-2 rounded-lg border border-border bg-card py-12 text-sm text-muted-foreground">
              <Loader2 className="size-4 animate-spin" aria-hidden="true" />
              Loading attendees...
            </div>
          ) : (
            <CommentsContext.Provider value={commentsValue}>
            <DataTable
              caption="Attendees"
              columns={columns}
              data={filteredAttendees}
              getRowId={(attendee) => String(attendee.id)}
              pageSize={50}
              pageSizes={[25, 50, 100, 200]}
              emptyState={
                <EmptyState
                  icon={ClipboardCheck}
                  title={attendeeSearchTerm || filterStatus !== 'all' ? 'No attendees match your filters' : 'No attendees assigned to this session'}
                />
              }
            />
            </CommentsContext.Provider>
          )}
        </section>
      )}

      <WalkInDialog
        open={walkInOpen}
        projectId={currentProject.id}
        session={selectedSession}
        statuses={attendanceStatuses}
        rows={rows}
        onAdd={handleAddWalkIn}
        onClose={() => setWalkInOpen(false)}
      />
    </div>
  );
};

export default AttendanceTracker;
