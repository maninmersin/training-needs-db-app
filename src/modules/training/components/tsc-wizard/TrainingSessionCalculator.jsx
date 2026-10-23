import React, { useMemo, useState, useEffect } from 'react';
import { Download, FolderOpen } from 'lucide-react';
import { supabase } from '@core/services/supabaseClient';
import { useProject } from '@core/contexts/ProjectContext';
import { fetchAllRows } from '@core/utils/fetchAllRows';
import { downloadTable } from '@shared/import/exportFiles';
import { Button, Card, DataTable, EmptyState, FormField, PageHeader } from '@/components/ui';
import NumberInput from './NumberInput';
import { DEFAULT_CRITERIA, EXPORT_HEADERS, applyCriteriaChange, calculate, toExportRows } from './calculatorLogic';

const FIELDS = [
  { key: 'max_attendees', label: 'Max Attendees per Session', props: { min: 1 } },
  { key: 'total_weeks', label: 'Total Weeks', props: { min: 1 } },
  { key: 'daily_hours', label: 'Daily Hours', props: { min: 1 } },
  { key: 'days_per_week', label: 'Days per Week', props: { min: 1, max: 7 } },
  { key: 'contingency', label: 'Contingency Factor', props: { min: 1, step: '0.1' } }
];

const COLUMNS = [
  { accessorKey: 'training_location', header: 'Training Location' },
  { accessorKey: 'functional_area', header: 'Functional Area' },
  { accessorKey: 'uniqueUserCount', header: 'Users', meta: { align: 'right' } },
  { accessorKey: 'totalTrainingHours', header: 'Total Training Hours', cell: ({ getValue }) => Number(getValue().toFixed(2)), meta: { align: 'right' } },
  { accessorKey: 'totalClassroomHoursAvailable', header: 'Classroom Hours Available (per classroom)', meta: { align: 'right' } },
  { accessorKey: 'userHoursPerClassroom', header: 'User-Hours Capacity per Classroom', meta: { align: 'right' } },
  { accessorKey: 'numberOfClassrooms', header: 'Classrooms Needed', cell: ({ getValue }) => getValue().toFixed(2), meta: { align: 'right', className: 'font-semibold' } }
];

const TrainingSessionCalculator = () => {
  const { currentProject } = useProject();
  const [criteria, setCriteria] = useState(DEFAULT_CRITERIA);
  const [rows, setRows] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [retryCount, setRetryCount] = useState(0);

  // The people and courses of the project (all of them: a plain select stops at 1000 rows)
  useEffect(() => {
    if (!currentProject) {
      setRows([]);
      setLoading(false);
      return undefined;
    }
    let cancelled = false;
    (async () => {
      try {
        setLoading(true);
        setError(null);
        const data = await fetchAllRows(() => supabase
          .from('training_data_combined')
          .select('id, user_id, user_name, training_location, functional_area, course_id, duration_hrs')
          .eq('project_id', currentProject.id));
        if (!cancelled) {
          setRows(data.map((row) => ({
            end_user_id: row.user_id, training_location: row.training_location, functional_area: row.functional_area,
            course_id: row.course_id, duration_hrs: row.duration_hrs
          })));
        }
      } catch (err) {
        console.error('Error fetching training data:', err);
        if (!cancelled) setError(err.message);
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => { cancelled = true; };
  }, [currentProject, retryCount]);

  const calculations = useMemo(() => calculate(rows, criteria), [rows, criteria]);

  const exportAs = (format) => downloadTable('training_sessions', EXPORT_HEADERS, toExportRows(calculations), format);

  if (!currentProject) {
    return (
      <div className="mx-auto max-w-3xl">
        <Card>
          <EmptyState
            icon={FolderOpen}
            title="No Project Selected"
            description="Please select a project from the Projects page to view classroom calculations. Each project has its own isolated set of users, courses, and training data."
          />
        </Card>
      </div>
    );
  }

  return (
    <div className="mx-auto flex max-w-6xl flex-col gap-4">
      <PageHeader
        title="Training Classroom Calculator"
        description={<span><strong className="font-medium text-foreground">Project:</strong> {currentProject.title}</span>}
        actions={
          <>
            <Button onClick={() => exportAs('csv')} disabled={calculations.length === 0}><Download /> Export to CSV</Button>
            <Button onClick={() => exportAs('xlsx')} disabled={calculations.length === 0}><Download /> Export to Excel</Button>
          </>
        }
      />

      {error && (
        <div role="alert" className="flex items-center gap-3 rounded-md bg-destructive-soft px-3 py-2 text-sm text-destructive">
          <span className="flex-1">Error: {error}</span>
          <Button onClick={() => setRetryCount((count) => count + 1)}>Retry</Button>
        </div>
      )}

      <Card className="p-4">
        <div className="grid grid-cols-2 gap-3 md:grid-cols-3 lg:grid-cols-5">
          {FIELDS.map((field) => (
            <FormField key={field.key} label={field.label}>
              <NumberInput value={criteria[field.key]} onValueChange={(value) => setCriteria((previous) => applyCriteriaChange(previous, field.key, value))} {...field.props} />
            </FormField>
          ))}
        </div>
      </Card>

      <DataTable
        caption="Classrooms needed by location and functional area"
        columns={COLUMNS}
        data={calculations}
        getRowId={(calc) => `${calc.training_location}|${calc.functional_area}`}
        loading={loading}
        pageSize={50}
        emptyState={<EmptyState title="Nothing to calculate" description="This project has no training data yet. Import it, or set up people and courses first." />}
      />

      <Card className="flex flex-col gap-3 p-4 text-sm">
        <h2 className="text-base font-semibold">Calculation details and usage instructions</h2>
        <p className="text-muted-foreground">This form calculates the number of classrooms needed for training sessions based on several criteria.</p>
        <ul className="flex list-disc flex-col gap-1 pl-5">
          <li><strong>Max Attendees per Session:</strong> the maximum number of users that can attend a single training session in a classroom.</li>
          <li><strong>Total Weeks:</strong> the total number of weeks available for training sessions.</li>
          <li><strong>Daily Hours:</strong> the number of hours per day a classroom is available for training.</li>
          <li><strong>Days per Week:</strong> the number of days per week a classroom is available for training.</li>
          <li><strong>Contingency Factor:</strong> a multiplier that adds a buffer for unforeseen circumstances. A value of 1.2 adds a 20% contingency to the Total Training Hours (user-hours) of each functional area, which covers variations in the number of users and longer or additional training.</li>
        </ul>
        <h3 className="font-semibold">Table columns</h3>
        <ul className="flex list-disc flex-col gap-1 pl-5">
          <li><strong>Training Location, Functional Area:</strong> the grouping for the calculation.</li>
          <li><strong>Users:</strong> the number of unique users in the group.</li>
          <li><strong>Total Training Hours:</strong> the training hours of all users in the group, times the Contingency Factor.</li>
          <li><strong>Classroom Hours Available (per classroom):</strong> Total Weeks x Days per Week x Daily Hours.</li>
          <li><strong>User-Hours Capacity per Classroom:</strong> Classroom Hours Available x Max Attendees per Session.</li>
          <li><strong>Classrooms Needed:</strong> Total Training Hours / User-Hours Capacity per Classroom.</li>
        </ul>
      </Card>
    </div>
  );
};

export default TrainingSessionCalculator;
