import React, { useContext, useMemo, useRef, useState, useEffect } from 'react';
import { format } from 'date-fns';
import { CalendarDays, RefreshCw, Users } from 'lucide-react';
import { supabase } from '@core/services/supabaseClient';
import { Badge, Button, DataTable, EmptyState, Input, Toolbar } from '@/components/ui';
import { filterSchedules } from './scheduleManagerLogic';
import { progressState, scheduleStatsFrom } from './scheduleSelectorLogic';

const formatDate = (value) => {
  try {
    return format(new Date(value), 'MMM dd, yyyy HH:mm');
  } catch {
    return value;
  }
};

const PROGRESS_VARIANT = { complete: 'success', partial: 'warning', empty: 'neutral' };

const StatsContext = React.createContext({});

// A figure from the schedule's statistics, or '...' while they load
function Figure({ scheduleId, field }) {
  const value = useContext(StatsContext)[scheduleId]?.[field];
  return value ?? '...';
}

function Progress({ scheduleId }) {
  const percentage = useContext(StatsContext)[scheduleId]?.assignmentPercentage;
  return percentage === undefined ? '...' : <Badge variant={PROGRESS_VARIANT[progressState(percentage)]}>{percentage}%</Badge>;
}

const figureColumn = (id, header, field) => ({
  id,
  header,
  enableSorting: false,
  cell: ({ row }) => <Figure scheduleId={row.original.id} field={field} />,
  meta: { align: 'right' }
});

const COLUMNS = (onSelectRef) => [
  { accessorKey: 'name', header: 'Schedule Name', meta: { className: 'min-w-56 font-medium' } },
  { id: 'created', header: 'Created', accessorFn: (schedule) => schedule.created_at, cell: ({ getValue }) => formatDate(getValue()), meta: { className: 'whitespace-nowrap text-muted-foreground' } },
  { id: 'modified', header: 'Modified', accessorFn: (schedule) => schedule.updated_at || schedule.created_at, cell: ({ getValue }) => formatDate(getValue()), meta: { className: 'whitespace-nowrap text-muted-foreground' } },
  figureColumn('courses', 'Courses', 'uniqueCourses'),
  figureColumn('sessions', 'Sessions', 'totalSessions'),
  figureColumn('locations', 'Locations', 'locations'),
  figureColumn('areas', 'Areas', 'functionalAreas'),
  { id: 'progress', header: 'Progress', enableSorting: false, cell: ({ row }) => <Progress scheduleId={row.original.id} /> },
  {
    id: 'actions',
    header: 'Actions',
    enableSorting: false,
    meta: { align: 'right' },
    cell: ({ row }) => (
      <Button size="sm" variant="default" title="Assign Users to Schedule" aria-label={`Assign Users to ${row.original.name}`} onClick={() => onSelectRef.current(row.original)}>
        <Users /> Assign Users
      </Button>
    )
  }
];

const ScheduleSelector = ({ schedules, onScheduleSelect, onRefresh }) => {
  const [searchTerm, setSearchTerm] = useState('');
  const [filterDate, setFilterDate] = useState('');
  const [scheduleStats, setScheduleStats] = useState({});

  // Sessions and assignments of every schedule shown, for the counts and the progress
  useEffect(() => {
    if (schedules.length === 0) return undefined;
    let cancelled = false;

    const loadStats = async () => {
      try {
        const results = await Promise.all(
          schedules.map(async (schedule) => {
            const { data: sessions, error } = await supabase
              .from('training_sessions')
              .select('id, course_id, course_name, training_location, functional_area')
              .eq('schedule_id', schedule.id);
            if (error) {
              console.error('Error fetching sessions for schedule:', schedule.id, error);
              return [schedule.id, scheduleStatsFrom([], [])];
            }

            const { data: assignments, error: assignmentError } = await supabase
              .from('user_assignments')
              .select('session_identifier')
              .eq('schedule_id', schedule.id)
              .eq('assignment_level', 'session')
              .not('session_identifier', 'is', null);
            if (assignmentError) console.error('Error fetching assignments for schedule:', schedule.id, assignmentError);

            return [schedule.id, scheduleStatsFrom(sessions, assignments)];
          })
        );
        if (!cancelled) setScheduleStats(Object.fromEntries(results));
      } catch (error) {
        console.error('Error fetching schedule statistics:', error);
      }
    };

    loadStats();
    return () => { cancelled = true; };
  }, [schedules]);

  const filteredSchedules = useMemo(() => filterSchedules(schedules, searchTerm, filterDate), [schedules, searchTerm, filterDate]);

  // The columns never change (rebuilding them would re-create the cells, even a button being clicked), so the
  // figures and the callback reach the cells through a context and a ref
  const onSelectRef = useRef(onScheduleSelect);
  onSelectRef.current = onScheduleSelect;
  const columns = useMemo(() => COLUMNS(onSelectRef), []);

  return (
    <StatsContext.Provider value={scheduleStats}>
    <div className="flex flex-col gap-3">
      <p className="text-sm text-muted-foreground">Choose an approved schedule to assign users to courses and sessions</p>

      <Toolbar>
        <Input type="search" aria-label="Search schedules" placeholder="Search schedules..." value={searchTerm} onChange={(event) => setSearchTerm(event.target.value)} className="w-64" />
        <Input type="date" aria-label="Created on" value={filterDate} onChange={(event) => setFilterDate(event.target.value)} className="w-40" />
        {(searchTerm || filterDate) && <Button variant="ghost" onClick={() => { setSearchTerm(''); setFilterDate(''); }}>Clear Filters</Button>}
        <Button className="ml-auto" onClick={onRefresh}><RefreshCw /> Refresh</Button>
      </Toolbar>

      <DataTable
        caption="Training schedules"
        columns={columns}
        data={filteredSchedules}
        getRowId={(schedule) => schedule.id}
        emptyState={
          <EmptyState
            icon={CalendarDays}
            title="No Schedules Found"
            description={schedules.length === 0
              ? 'No training schedules available. Create a schedule using the Training Scheduler Wizard first.'
              : 'No schedules match your search criteria. Try adjusting your filters.'}
            action={<Button onClick={onRefresh}>Refresh</Button>}
          />
        }
      />
    </div>
    </StatsContext.Provider>
  );
};

export default ScheduleSelector;
