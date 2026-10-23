import React, { useEffect, useMemo, useState } from 'react';
import { Download, Loader2, Search, UsersRound } from 'lucide-react';
import { supabase } from '@core/services/supabaseClient';
import { useProject } from '@core/contexts/ProjectContext';
import { Badge, Button, DataTable, DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger, EmptyState, Input, PageHeader, Toolbar, toast } from '@/components/ui';
import { filterRows } from './listFilters';
import { downloadTable } from '../import/exportFiles';
import { loadUserCourseEntries } from './userCourses/userCourseService';
import { EXPORT_COLUMNS, SOURCE, toExportRow } from './userCourses/userCourseRows';

const label = (name) => name.replace(/_/g, ' ');

const ExportAllData = () => {
  const { currentProject } = useProject();
  const [rows, setRows] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [search, setSearch] = useState('');

  useEffect(() => {
    const fetchData = async () => {
      if (!currentProject) {
        setRows([]);
        setLoading(false);
        return;
      }
      try {
        setLoading(true);
        setError(null);
        const entries = await loadUserCourseEntries(supabase, currentProject.id);
        setRows(entries.map(toExportRow));
      } catch (loadError) {
        setError(loadError.message);
        console.error('❌ ExportAllData: Error fetching data:', loadError);
      } finally {
        setLoading(false);
      }
    };
    fetchData();
  }, [currentProject]);

  const shown = useMemo(() => filterRows(rows, EXPORT_COLUMNS, search, {}), [rows, search]);

  const columns = useMemo(
    () =>
      EXPORT_COLUMNS.map((name) => ({
        id: name,
        header: label(name),
        accessorFn: (row) => row[name] ?? '',
        meta: { align: name === 'duration_hrs' ? 'right' : undefined, className: name === 'user_name' ? 'font-medium' : name === 'duration_hrs' || name === 'user_id' ? 'tabular-nums' : undefined },
        ...(name === 'course_source' ? { cell: ({ getValue }) => <Badge variant={getValue() === SOURCE.INDIVIDUAL ? 'primary' : 'neutral'}>{getValue()}</Badge> } : {})
      })),
    []
  );

  const exportData = (format) => {
    if (shown.length === 0) {
      toast.info('No data to export');
      return;
    }
    const filename = `${currentProject?.name || 'project'}_user_course_assignments_${new Date().toISOString().split('T')[0]}`;
    downloadTable(filename, EXPORT_COLUMNS, shown.map((row) => EXPORT_COLUMNS.map((name) => row[name])), format);
    toast.success(`${shown.length} ${shown.length === 1 ? 'assignment' : 'assignments'} exported`);
  };

  if (!currentProject) {
    return (
      <div className="mx-auto max-w-6xl rounded-lg border border-border bg-card">
        <EmptyState icon={UsersRound} title="No Project Selected" description="Please select a project from the Projects page to export user course assignments." />
      </div>
    );
  }

  return (
    <div className="mx-auto flex max-w-[1400px] flex-col gap-4">
      <PageHeader
        title="Export User Course Assignments"
        count={loading ? undefined : shown.length === rows.length ? rows.length : `${shown.length} of ${rows.length}`}
        description={`Every person with the courses they need, from their role and from individual assignments. Project: ${currentProject.title}. Exporting saves what is shown below.`}
        actions={
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="default" disabled={loading || shown.length === 0}><Download /> Export ({shown.length} assignments)</Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end">
              <DropdownMenuItem onSelect={() => exportData('xlsx')}>Excel (.xlsx)</DropdownMenuItem>
              <DropdownMenuItem onSelect={() => exportData('csv')}>CSV</DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        }
      />

      {error && <div role="alert" className="rounded-md bg-destructive-soft px-3 py-2 text-sm text-destructive">Error: {error}</div>}

      <Toolbar>
        <div className="relative w-80 max-w-full">
          <Search className="pointer-events-none absolute left-2.5 top-1/2 size-4 -translate-y-1/2 text-subtle-foreground" aria-hidden="true" />
          <Input type="search" aria-label="Search assignments" placeholder="Search by person, course, location..." value={search} onChange={(event) => setSearch(event.target.value)} className="pl-8" />
        </div>
      </Toolbar>

      {loading ? (
        <div role="status" className="flex items-center justify-center gap-2 rounded-lg border border-border bg-card py-16 text-sm text-muted-foreground">
          <Loader2 className="size-4 animate-spin" aria-hidden="true" /> Loading...
        </div>
      ) : (
        <DataTable
          caption="User course assignments"
          columns={columns}
          data={shown}
          getRowId={(row, index) => `${row.user_id}-${row.course_id}-${index}`}
          pageSize={50}
          pageSizes={[25, 50, 100, 200]}
          emptyState={
            <EmptyState
              icon={UsersRound}
              title={rows.length === 0 ? 'No assignments yet' : 'Nothing matches'}
              description={rows.length === 0 ? 'Add people, give their roles courses (Role-Course Mappings), or assign courses to individuals.' : 'Try a different search.'}
            />
          }
        />
      )}
    </div>
  );
};

export default ExportAllData;
