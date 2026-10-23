import { useEffect, useMemo, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import { BookOpen, Download, Loader2, Pencil, Plus, Search, Trash2, Upload } from 'lucide-react';
import { supabase } from '@core/services/supabaseClient';
import { useProject } from '@core/contexts/ProjectContext';
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter,
  AlertDialogHeader, AlertDialogTitle, Button, DataTable, DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger,
  EmptyState, Input, PageHeader, Toolbar, Tooltip, TooltipContent, TooltipTrigger, toast
} from '@/components/ui';
import ImportWizard from '../import/ImportWizard';
import { coursesAdapter } from '../import/adapters';
import { COURSE_EXPORT_HEADERS, coursesToRows, downloadTable } from '../import/exportFiles';
import ColumnFilter from './ColumnFilter';
import CourseEditSheet from './courses/CourseEditSheet';
import { activeFilterCount, filterCourses, uniqueColumnValues } from './courses/coursesLogic';

// Columns that get a filter button (course ID and name are covered by the search box)
const FILTERS = [
  { field: 'functional_area', label: 'Functional Area' },
  { field: 'duration_hrs', label: 'Duration (hrs)' },
  { field: 'priority', label: 'Priority' },
  { field: 'application', label: 'Application' }
];

const CoursesForm = () => {
  const { currentProject } = useProject();
  const [courses, setCourses] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [searchTerm, setSearchTerm] = useState('');
  const [functionalAreas, setFunctionalAreas] = useState([]);
  const [columnFilters, setColumnFilters] = useState({});
  const [sheet, setSheet] = useState(null); // { mode: 'create' | 'edit', course? }
  const [courseToDelete, setCourseToDelete] = useState(null);
  const [importing, setImporting] = useState(false);
  const [reloadKey, setReloadKey] = useState(0);
  const [searchParams, setSearchParams] = useSearchParams();

  // Load this project's courses and the functional areas to choose from
  useEffect(() => {
    const fetchData = async () => {
      try {
        if (!currentProject) {
          setCourses([]);
          setFunctionalAreas([]);
          return;
        }
        setLoading(true);
        setError(null);
        setColumnFilters({});

        const { data: coursesData, error: coursesError } = await supabase
          .from('courses')
          .select('*')
          .eq('project_id', currentProject.id)
          .order('course_id', { ascending: true });
        if (coursesError) throw coursesError;
        setCourses(coursesData);

        const { data: areasData, error: areasError } = await supabase
          .from('functional_areas')
          .select('name')
          .eq('project_id', currentProject.id)
          .eq('active', true)
          .order('display_order');
        if (areasError) {
          console.warn('Reference table not available, using fallback');
          // Fallback: take the areas the courses already use
          const uniqueAreas = [...new Set(coursesData?.map((c) => c.functional_area).filter(Boolean))];
          setFunctionalAreas(uniqueAreas.map((area) => ({ name: area })));
        } else {
          setFunctionalAreas(areasData || []);
        }
      } catch (loadError) {
        setError(loadError.message);
      } finally {
        setLoading(false);
      }
    };

    fetchData();
  }, [currentProject, reloadKey]);

  // The old /import-export-courses link arrives as ?import=courses
  useEffect(() => {
    if (searchParams.get('import') === 'courses') {
      setImporting(true);
      setSearchParams({}, { replace: true });
    }
  }, [searchParams, setSearchParams]);

  const handleUpdate = async (courseId, changes) => {
    const { error: updateError } = await supabase.from('courses').update(changes).eq('course_id', courseId);
    if (updateError) throw updateError;
    setCourses((previous) => previous.map((course) => (course.course_id === courseId ? { ...course, ...changes } : course)));
  };

  const handleCreate = async (newCourse) => {
    if (!currentProject) throw new Error('Please select a project first');
    const { data, error: insertError } = await supabase.from('courses').insert([{ ...newCourse, project_id: currentProject.id }]).select();
    if (insertError) throw insertError;
    setCourses((previous) => [...previous, data[0]]);
  };

  const handleDelete = async (course) => {
    try {
      const { error: deleteError } = await supabase.from('courses').delete().eq('course_id', course.course_id);
      if (deleteError) throw deleteError;
      setCourses((previous) => previous.filter((item) => item.course_id !== course.course_id));
      setSheet((current) => (current?.course?.course_id === course.course_id ? null : current)); // close the panel if it was open on this course
      toast.success('Course deleted', { description: course.course_id });
    } catch (deleteError) {
      setError(deleteError.message);
    }
  };

  const exportCourses = (format) => {
    downloadTable('courses_export', COURSE_EXPORT_HEADERS, coursesToRows(filteredCourses), format);
    toast.success(`${filteredCourses.length} ${filteredCourses.length === 1 ? 'course' : 'courses'} exported`);
  };

  const saveSheet = async (values) => {
    if (sheet.mode === 'create') {
      await handleCreate(values);
      toast.success('Course added', { description: values.course_id });
    } else {
      await handleUpdate(sheet.course.course_id, values);
      toast.success('Course saved', { description: sheet.course.course_id });
    }
    setError(null);
    setSheet(null);
  };

  const filteredCourses = useMemo(() => filterCourses(courses, searchTerm, columnFilters), [courses, searchTerm, columnFilters]);
  const filterOptions = useMemo(
    () => FILTERS.map((filter) => ({ ...filter, values: uniqueColumnValues(courses, filter.field) })).filter((filter) => filter.values.length > 0),
    [courses]
  );
  const filtersActive = activeFilterCount(columnFilters);

  const tableColumns = useMemo(
    () => [
      { accessorKey: 'course_id', header: 'Course ID', meta: { className: 'font-medium' } },
      { id: 'course_name', header: 'Course Name', accessorFn: (course) => course.course_name ?? '' },
      { accessorKey: 'functional_area', header: 'Functional Area' },
      { accessorKey: 'duration_hrs', header: 'Duration (hrs)', meta: { align: 'right', className: 'tabular-nums' } },
      { id: 'priority', header: 'Priority', accessorFn: (course) => course.priority ?? 1, meta: { align: 'right', className: 'tabular-nums' } },
      { id: 'application', header: 'Application', accessorFn: (course) => course.application ?? '' },
      {
        id: 'actions',
        header: 'Actions',
        enableSorting: false,
        meta: { align: 'right' },
        cell: ({ row }) => (
          <div className="flex items-center justify-end gap-1" onClick={(event) => event.stopPropagation()}>
            <Tooltip>
              <TooltipTrigger asChild>
                <Button variant="ghost" size="icon-sm" aria-label="Edit course" onClick={() => setSheet({ mode: 'edit', course: row.original })}>
                  <Pencil />
                </Button>
              </TooltipTrigger>
              <TooltipContent>Edit course</TooltipContent>
            </Tooltip>
            <Tooltip>
              <TooltipTrigger asChild>
                <Button variant="destructive" size="icon-sm" aria-label="Delete course" onClick={() => setCourseToDelete(row.original)}>
                  <Trash2 />
                </Button>
              </TooltipTrigger>
              <TooltipContent>Delete course</TooltipContent>
            </Tooltip>
          </div>
        )
      }
    ],
    []
  );

  if (!loading && !currentProject) {
    return (
      <div className="mx-auto max-w-6xl rounded-lg border border-border bg-card">
        <EmptyState
          icon={BookOpen}
          title="No Project Selected"
          description="Please select a project from the Projects page to manage courses. Each project has its own isolated set of courses and data."
        />
      </div>
    );
  }

  return (
    <div className="mx-auto flex max-w-[1400px] flex-col gap-4">
      <PageHeader
        title="Courses Management"
        count={loading ? undefined : filteredCourses.length === courses.length ? courses.length : `${filteredCourses.length} of ${courses.length}`}
        description={`Manage your training courses${currentProject ? ` for ${currentProject.title}` : ''}, including course details, duration, and functional areas. Use the Priority field to sequence the courses, the lower the number the higher the priority.`}
        actions={
          <>
            <Button onClick={() => setImporting(true)} disabled={loading}><Upload /> Import</Button>
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button disabled={loading}><Download /> Export</Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end">
                <DropdownMenuItem onSelect={() => exportCourses('xlsx')}>Excel (.xlsx)</DropdownMenuItem>
                <DropdownMenuItem onSelect={() => exportCourses('csv')}>CSV</DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
            <Button variant="default" onClick={() => setSheet({ mode: 'create' })} disabled={loading}>
              <Plus /> Add New Course
            </Button>
          </>
        }
      />

      {error && (
        <div role="alert" className="flex items-center gap-3 rounded-md bg-destructive-soft px-3 py-2 text-sm text-destructive">
          <span className="flex-1">{error}</span>
          <Button variant="ghost" size="sm" onClick={() => setError(null)}>Dismiss</Button>
        </div>
      )}

      <Toolbar>
        <div className="relative w-80 max-w-full">
          <Search className="pointer-events-none absolute left-2.5 top-1/2 size-4 -translate-y-1/2 text-subtle-foreground" aria-hidden="true" />
          <Input
            type="search"
            aria-label="Search courses"
            placeholder="Search by ID, name, functional area, or priority..."
            value={searchTerm}
            onChange={(event) => setSearchTerm(event.target.value)}
            className="pl-8"
          />
        </div>
        {filterOptions.map((filter) => (
          <ColumnFilter
            key={filter.field}
            label={filter.label}
            values={filter.values}
            selected={columnFilters[filter.field] || []}
            onChange={(selected) => setColumnFilters((previous) => ({ ...previous, [filter.field]: selected }))}
          />
        ))}
        {filtersActive > 0 && (
          <>
            <span className="text-xs font-medium text-success">{filtersActive} filter(s) active</span>
            <Button variant="ghost" onClick={() => setColumnFilters({})}>Clear filters</Button>
          </>
        )}
      </Toolbar>

      {loading ? (
        <div role="status" className="flex items-center justify-center gap-2 rounded-lg border border-border bg-card py-16 text-sm text-muted-foreground">
          <Loader2 className="size-4 animate-spin" aria-hidden="true" />
          Loading courses...
        </div>
      ) : (
        <DataTable
          caption="Courses"
          columns={tableColumns}
          data={filteredCourses}
          getRowId={(course) => course.course_id}
          pageSize={50}
          pageSizes={[25, 50, 100, 200]}
          onRowClick={(course) => setSheet({ mode: 'edit', course })}
          emptyState={
            <EmptyState
              icon={BookOpen}
              title={courses.length === 0 ? 'No courses yet' : 'No courses match'}
              description={courses.length === 0 ? 'Add courses one at a time here, or use Import.' : 'Try a different search or clear the filters.'}
            />
          }
        />
      )}

      <CourseEditSheet
        mode={sheet?.mode}
        course={sheet?.course}
        functionalAreas={functionalAreas}
        onSubmit={saveSheet}
        onDelete={setCourseToDelete}
        onClose={() => setSheet(null)}
      />

      <ImportWizard
        open={importing}
        adapter={coursesAdapter}
        db={supabase}
        projectId={currentProject?.id}
        onClose={() => setImporting(false)}
        onApplied={() => setReloadKey((key) => key + 1)}
      />

      <AlertDialog open={Boolean(courseToDelete)} onOpenChange={(open) => !open && setCourseToDelete(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete course</AlertDialogTitle>
          </AlertDialogHeader>
          <AlertDialogDescription>
            Are you sure you want to delete course {courseToDelete?.course_id}? Any individual course assignments for it are removed too.
          </AlertDialogDescription>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction destructive onClick={() => handleDelete(courseToDelete)}>Delete</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
};

export default CoursesForm;
