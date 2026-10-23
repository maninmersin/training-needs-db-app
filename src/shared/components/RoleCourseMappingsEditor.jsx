import { useEffect, useMemo, useState } from 'react';
import { Link2, Loader2, Search } from 'lucide-react';
import { supabase } from '@core/services/supabaseClient';
import { useProject } from '@core/contexts/ProjectContext';
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter,
  AlertDialogHeader, AlertDialogTitle, Badge, Button, Checkbox, DataTable, EmptyState, FormField, Input, PageHeader, Select,
  SelectContent, SelectItem, SelectTrigger, SelectValue, Toolbar, toast
} from '@/components/ui';
import { diffSelection, hasChanges, searchCourses, setVisible, sortCourses, toggleCourse } from './mappings/mappingsLogic';

const RoleCourseMappingsEditor = () => {
  const { currentProject } = useProject();
  const [roles, setRoles] = useState([]);
  const [courses, setCourses] = useState([]);
  const [selectedRole, setSelectedRole] = useState(null);
  const [selectedCourses, setSelectedCourses] = useState([]);
  const [existingMappings, setExistingMappings] = useState([]);
  const [searchTerm, setSearchTerm] = useState('');
  const [pendingRole, setPendingRole] = useState(null); // role chosen while there are unsaved changes
  const [error, setError] = useState(null);
  const [isLoading, setIsLoading] = useState({ roles: false, courses: false, mappings: false });

  const setBusy = (key, value) => setIsLoading((previous) => ({ ...previous, [key]: value }));

  useEffect(() => {
    if (!currentProject) return;
    setSelectedRole(null);
    setSelectedCourses([]);
    setExistingMappings([]);
    fetchRoles();
    fetchCourses();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [currentProject]);

  const fetchRoles = async () => {
    setBusy('roles', true);
    try {
      const { data, error: fetchError } = await supabase.from('project_roles').select('*').eq('project_id', currentProject.id);
      if (fetchError) throw fetchError;
      setRoles((data || []).sort((a, b) => a.project_role_name.localeCompare(b.project_role_name)));
    } catch (err) {
      setError(`Failed to load roles: ${err.message}`);
      setRoles([]);
    } finally {
      setBusy('roles', false);
    }
  };

  const fetchCourses = async () => {
    setBusy('courses', true);
    try {
      const { data, error: fetchError } = await supabase.from('courses').select('*').eq('project_id', currentProject.id);
      if (fetchError) throw fetchError;
      setCourses(sortCourses(data || []));
    } catch (err) {
      setError(`Failed to load courses: ${err.message}`);
      setCourses([]);
    } finally {
      setBusy('courses', false);
    }
  };

  const fetchExistingMappings = async (roleName) => {
    setBusy('mappings', true);
    try {
      const { data, error: fetchError } = await supabase
        .from('role_course_mappings')
        .select('course_id')
        .eq('project_role_name', roleName)
        .eq('project_id', currentProject.id);
      if (fetchError) throw fetchError;
      setExistingMappings(data.map((mapping) => mapping.course_id));
      setSelectedCourses(data.map((mapping) => mapping.course_id));
    } catch (err) {
      setError(`Failed to load existing mappings: ${err.message}`);
      setExistingMappings([]);
    } finally {
      setBusy('mappings', false);
    }
  };

  const loadRole = async (roleName) => {
    setError(null);
    setSearchTerm('');
    if (!roleName) {
      setSelectedRole(null);
      setSelectedCourses([]);
      setExistingMappings([]);
      return;
    }
    const role = roles.find((candidate) => candidate.project_role_name === roleName);
    if (!role) {
      setError('Error loading role data: Selected role not found');
      setSelectedRole(null);
      setSelectedCourses([]);
      return;
    }
    setSelectedRole(role);
    await fetchExistingMappings(roleName);
  };

  const unsaved = selectedRole ? hasChanges(existingMappings, selectedCourses) : false;

  const handleRoleChange = (roleName) => {
    if (unsaved) setPendingRole(roleName);
    else loadRole(roleName);
  };

  const saveChanges = async () => {
    if (!selectedRole) return;
    setBusy('mappings', true);
    setError(null);
    try {
      const { added, removed } = diffSelection(existingMappings, selectedCourses);

      if (added.length > 0) {
        const { error: insertError } = await supabase
          .from('role_course_mappings')
          .insert(added.map((courseId) => ({ project_role_name: selectedRole.project_role_name, course_id: courseId, project_id: currentProject.id })));
        if (insertError) throw insertError;
      }

      if (removed.length > 0) {
        const { error: deleteError } = await supabase
          .from('role_course_mappings')
          .delete()
          .eq('project_role_name', selectedRole.project_role_name)
          .eq('project_id', currentProject.id)
          .in('course_id', removed);
        if (deleteError) throw deleteError;
      }

      setExistingMappings(selectedCourses);
      toast.success('Changes saved successfully!', { description: selectedRole.project_role_name });
    } catch (err) {
      setError(`Error saving changes: ${err.message}`);
      toast.error('Could not save changes', { description: err.message });
    } finally {
      setBusy('mappings', false);
    }
  };

  const visibleCourses = useMemo(() => searchCourses(courses, searchTerm), [courses, searchTerm]);
  const busy = isLoading.mappings;

  const columns = useMemo(
    () => [
      {
        id: 'select',
        header: 'Select',
        enableSorting: false,
        cell: ({ row }) => (
          <Checkbox
            aria-label={`Select ${row.original.course_id}`}
            checked={selectedCourses.includes(row.original.course_id)}
            onCheckedChange={() => setSelectedCourses((previous) => toggleCourse(previous, row.original.course_id))}
            disabled={busy}
          />
        )
      },
      { accessorKey: 'functional_area', header: 'Functional Area' },
      { accessorKey: 'course_id', header: 'Course ID', meta: { className: 'font-medium' } },
      { id: 'course_name', header: 'Course Name', accessorFn: (course) => course.course_name ?? '' },
      { accessorKey: 'duration_hrs', header: 'Duration (Hrs)', meta: { align: 'right', className: 'tabular-nums' } },
      { id: 'application', header: 'Application', accessorFn: (course) => course.application ?? '' }
    ],
    [selectedCourses, busy]
  );

  if (!currentProject) {
    return (
      <div className="mx-auto max-w-6xl rounded-lg border border-border bg-card">
        <EmptyState
          icon={Link2}
          title="No Project Selected"
          description="Please select a project from the Projects page to manage role course mappings. Each project has its own isolated set of roles and courses."
        />
      </div>
    );
  }

  return (
    <div className="mx-auto flex max-w-6xl flex-col gap-4">
      <PageHeader
        title="Edit Role Course Mappings"
        description={`Choose a project role, then tick the courses everyone in that role needs. Project: ${currentProject.title}.`}
      />

      {error && (
        <div role="alert" className="flex items-center gap-3 rounded-md bg-destructive-soft px-3 py-2 text-sm text-destructive">
          <span className="flex-1">{error}</span>
          <Button variant="ghost" size="sm" onClick={() => setError(null)}>Dismiss</Button>
        </div>
      )}

      <div className="max-w-sm">
        <FormField label="Select Project Role:">
          {(fieldProps) => (
            <Select value={selectedRole?.project_role_name || ''} onValueChange={handleRoleChange} disabled={isLoading.roles}>
              <SelectTrigger {...fieldProps}>
                <SelectValue placeholder="Select a role" />
              </SelectTrigger>
              <SelectContent>
                {roles.map((role) => (
                  <SelectItem key={role.id ?? role.project_role_name} value={role.project_role_name}>{role.project_role_name}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          )}
        </FormField>
      </div>

      {!selectedRole ? (
        <div className="rounded-lg border border-border bg-card">
          <EmptyState
            icon={Link2}
            title="Select a role to edit its courses"
            description={roles.length === 0 && !isLoading.roles ? 'This project has no roles yet. Add them in Reference Data.' : 'The courses ticked for a role are assigned to everyone in that role.'}
          />
        </div>
      ) : (
        <section aria-label={`Courses for ${selectedRole.project_role_name}`} className="flex flex-col gap-3">
          <h2 className="text-base font-semibold">Edit Courses for {selectedRole.project_role_name}</h2>

          <Toolbar>
            <div className="relative w-72 max-w-full">
              <Search className="pointer-events-none absolute left-2.5 top-1/2 size-4 -translate-y-1/2 text-subtle-foreground" aria-hidden="true" />
              <Input
                type="search"
                aria-label="Search courses"
                placeholder="Search courses..."
                value={searchTerm}
                onChange={(event) => setSearchTerm(event.target.value)}
                className="pl-8"
              />
            </div>
            <Button onClick={() => setSelectedCourses((previous) => setVisible(previous, visibleCourses, true))} disabled={busy || visibleCourses.length === 0}>Select all shown</Button>
            <Button onClick={() => setSelectedCourses((previous) => setVisible(previous, visibleCourses, false))} disabled={busy || visibleCourses.length === 0}>Clear shown</Button>
            <div className="ml-auto flex items-center gap-2 text-sm text-muted-foreground">
              <span className="tabular-nums">{selectedCourses.length} of {courses.length} selected</span>
              {unsaved && <Badge variant="warning">Unsaved changes</Badge>}
            </div>
          </Toolbar>

          {isLoading.courses ? (
            <div role="status" className="flex items-center justify-center gap-2 rounded-lg border border-border bg-card py-16 text-sm text-muted-foreground">
              <Loader2 className="size-4 animate-spin" aria-hidden="true" />
              Loading courses...
            </div>
          ) : (
            <DataTable
              caption="Courses"
              columns={columns}
              data={visibleCourses}
              getRowId={(course) => course.course_id}
              pageSize={50}
              pageSizes={[25, 50, 100, 200]}
              emptyState={
                <EmptyState
                  icon={Link2}
                  title={courses.length === 0 ? 'No courses available for this role' : 'No courses match'}
                  description={courses.length === 0 ? 'Add courses on the Courses screen first.' : 'Try a different search.'}
                />
              }
            />
          )}

          <div className="flex justify-end gap-2">
            <Button onClick={() => setSelectedCourses(existingMappings)} disabled={!unsaved || busy}>Cancel</Button>
            <Button variant="default" onClick={saveChanges} disabled={!unsaved || busy}>
              {busy ? 'Saving...' : 'Save Changes'}
            </Button>
          </div>
        </section>
      )}

      <AlertDialog open={pendingRole !== null} onOpenChange={(open) => !open && setPendingRole(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Discard unsaved changes?</AlertDialogTitle>
          </AlertDialogHeader>
          <AlertDialogDescription>
            You have unsaved course changes for {selectedRole?.project_role_name}. Switching role will discard them.
          </AlertDialogDescription>
          <AlertDialogFooter>
            <AlertDialogCancel>Keep editing</AlertDialogCancel>
            <AlertDialogAction
              onClick={() => {
                const next = pendingRole;
                setPendingRole(null);
                loadRole(next);
              }}
            >
              Discard and switch
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
};

export default RoleCourseMappingsEditor;
