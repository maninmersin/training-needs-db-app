import React, { useCallback, useEffect, useState } from 'react';
import { Loader2, RefreshCw } from 'lucide-react';
import { supabase } from '@core/services/supabaseClient';
import { fetchAllRows } from '@core/utils/fetchAllRows';
import { Badge, Button, Dialog, DialogBody, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, StatCard } from '@/components/ui';
import { computeAssignmentStats, scheduleCourseIdsOf } from './assignmentStatsLogic';

// People and the courses they need come from the combined TNA view (works for MS Access and in-app projects,
// role and individual courses alike); what has been assigned comes from this schedule's assignment rows.
async function loadStats({ schedule, projectId, selectedTrainingLocation }) {
  const needs = await fetchAllRows(() => supabase
    .from('training_data_combined')
    .select('id, user_id, user_name, user_project_role, training_location, course_id')
    .eq('project_id', schedule.project_id || projectId));
  const assignments = await fetchAllRows(() => supabase.from('user_assignments').select('id, end_user_id, course_id').eq('schedule_id', schedule.id));
  return computeAssignmentStats({
    needs,
    assignments,
    scheduleCourseIds: scheduleCourseIdsOf(schedule.sessions),
    location: selectedTrainingLocation
  });
}

function UserGroup({ title, tone, users, limit, describe }) {
  if (users.length === 0) return null;
  const shown = limit ? users.slice(0, limit) : users;
  return (
    <section className="flex flex-col gap-1">
      <h5 className="flex items-center gap-2 text-sm font-semibold"><Badge variant={tone}>{users.length}</Badge> {title}</h5>
      <ul className="rounded-md border border-border text-sm">
        {shown.map((user) => (
          <li key={user.id} className="flex flex-wrap items-center gap-x-4 border-b border-border px-3 py-1.5 last:border-b-0">
            <span className="font-medium">{user.name}</span>
            <span className="text-muted-foreground">{user.role}</span>
            <span className="ml-auto text-xs text-muted-foreground">{describe(user)}</span>
          </li>
        ))}
        {limit && users.length > limit && <li className="px-3 py-1.5 text-xs italic text-muted-foreground">... and {users.length - limit} more</li>}
      </ul>
    </section>
  );
}

const AssignmentStatsModal = ({ isOpen, onClose, schedule, projectId, selectedTrainingLocation }) => {
  const [stats, setStats] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [detailedView, setDetailedView] = useState(false);

  const calculate = useCallback(async () => {
    if (!schedule?.id) {
      setError('No schedule data available');
      return;
    }
    setLoading(true);
    setError(null);
    try {
      setStats(await loadStats({ schedule, projectId, selectedTrainingLocation }));
    } catch (err) {
      console.error('Error calculating assignment stats:', err);
      setError(`Failed to calculate assignment statistics: ${err.message || 'unknown error'}${err.details ? ` (${err.details})` : ''}`);
    } finally {
      setLoading(false);
    }
  }, [schedule, projectId, selectedTrainingLocation]);

  // Calculate when the dialog opens, and again if the schedule or location changes
  useEffect(() => {
    if (isOpen && schedule) calculate();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isOpen, schedule?.id, selectedTrainingLocation]);

  if (!isOpen) return null;

  return (
    <Dialog open onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="max-w-3xl">
        <DialogHeader>
          <DialogTitle>Assignment Statistics</DialogTitle>
          <DialogDescription>Who needs courses from this schedule, and how many are assigned.</DialogDescription>
        </DialogHeader>

        <DialogBody className="flex flex-col gap-5">
          {loading && <p role="status" className="flex items-center gap-2 text-sm text-muted-foreground"><Loader2 className="size-4 animate-spin" /> Calculating assignment statistics...</p>}

          {error && (
            <div role="alert" className="flex items-center gap-3 rounded-md bg-destructive-soft px-3 py-2 text-sm text-destructive">
              <span className="flex-1">Error: {error}</span>
              <Button onClick={calculate}><RefreshCw /> Retry</Button>
            </div>
          )}

          {stats && (
            <>
              <section className="flex flex-col gap-2">
                <h4 className="text-sm font-semibold">Summary for {stats.selectedLocation}</h4>
                <div className="grid gap-2 sm:grid-cols-3">
                  <StatCard value={stats.usersNeedingAssignment} label="Users Requiring Assignment" />
                  <StatCard value={stats.totalAssigned} label="Total Course Assignments Made" />
                  <StatCard value={`${stats.completionRate}%`} label="Completion Rate" tone="success" />
                </div>
              </section>

              <section className="flex flex-col gap-2">
                <h4 className="text-sm font-semibold">Assignment Status</h4>
                <div className="grid gap-2 sm:grid-cols-3">
                  <StatCard value={stats.fullyAssigned} label="Fully Assigned" tone="success" />
                  <StatCard value={stats.partiallyAssigned} label="Partially Assigned" tone="warning" />
                  <StatCard value={stats.unassigned} label="Unassigned" tone="danger" />
                </div>
              </section>

              <section className="flex flex-col gap-1.5">
                <div className="flex items-center justify-between text-sm">
                  <span className="font-semibold">Overall Progress</span>
                  <span className="text-muted-foreground">{stats.fullyAssignedPercent}% Complete</span>
                </div>
                <div className="flex h-2 overflow-hidden rounded-full bg-secondary" role="progressbar" aria-valuenow={stats.fullyAssignedPercent} aria-valuemin={0} aria-valuemax={100}>
                  {/* The widths are the figures themselves */}
                  <div className="h-full bg-success" style={{ width: `${stats.fullyAssignedPercent}%` }} />
                  <div className="h-full bg-warning" style={{ width: `${stats.partiallyAssignedPercent}%` }} />
                </div>
              </section>

              <section className="flex flex-col gap-1 text-sm">
                <h4 className="font-semibold">Schedule Information</h4>
                <p><strong>{stats.scheduleCourseIds.length}</strong> courses in schedule</p>
                <p>Training location: <strong>{stats.selectedLocation}</strong></p>
              </section>

              <div>
                <Button onClick={() => setDetailedView(!detailedView)}>{detailedView ? 'Hide Details' : 'Show Details'}</Button>
              </div>

              {detailedView && (
                <div className="flex flex-col gap-4">
                  <UserGroup title="Unassigned Users" tone="danger" users={stats.detailedUsers.unassigned} describe={(u) => `Needs ${u.requiredCourses} courses`} />
                  <UserGroup title="Partially Assigned Users" tone="warning" users={stats.detailedUsers.partiallyAssigned} describe={(u) => `${u.assignedCourses}/${u.requiredCourses} courses (${u.missingCourses} missing)`} />
                  <UserGroup title="Fully Assigned Users" tone="success" users={stats.detailedUsers.fullyAssigned} limit={10} describe={(u) => `Complete (${u.assignedCourses} courses)`} />
                </div>
              )}
            </>
          )}
        </DialogBody>

        <DialogFooter>
          <Button onClick={calculate} disabled={loading}><RefreshCw /> Refresh Stats</Button>
          <Button variant="default" onClick={onClose}>Close</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};

export default AssignmentStatsModal;
