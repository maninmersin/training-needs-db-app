import { useEffect, useMemo, useState } from 'react';
import { Loader2, Pencil, Plus, Search, Trash2, Users } from 'lucide-react';
import { supabase } from '@core/services/supabaseClient';
import { useProject } from '@core/contexts/ProjectContext';
import { fetchAllRows } from '@core/utils/fetchAllRows';
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter,
  AlertDialogHeader, AlertDialogTitle, Button, DataTable, EmptyState, Input, PageHeader, Toolbar, Tooltip, TooltipContent,
  TooltipTrigger, toast
} from '@/components/ui';
import ColumnFilter from './endUsers/ColumnFilter';
import UserEditSheet from './endUsers/UserEditSheet';
import { activeFilterCount, columnLabel, filterUsers, orderColumns, uniqueColumnValues } from './endUsers/endUsersLogic';

// Searchable by the box above the table, so no filter button for these
const NO_FILTER_BUTTON = ['id', 'name', 'email'];

const DynamicUserForm = () => {
  const { currentProject } = useProject();
  const [users, setUsers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [searchTerm, setSearchTerm] = useState('');
  const [columns, setColumns] = useState([]);
  const [roles, setRoles] = useState([]);
  const [trainingLocations, setTrainingLocations] = useState([]);
  const [columnFilters, setColumnFilters] = useState({});
  const [sheet, setSheet] = useState(null); // { mode: 'create' | 'edit', user? }
  const [userToDelete, setUserToDelete] = useState(null);

  // Load the reference lists, the table's columns and this project's people
  useEffect(() => {
    const fetchData = async () => {
      try {
        if (!currentProject) {
          setUsers([]);
          return;
        }
        setLoading(true);
        setError(null);
        setColumnFilters({});

        const { data: rolesData, error: rolesError } = await supabase.from('project_roles').select('project_role_name');
        if (rolesError) throw rolesError;
        setRoles([...new Set(rolesData.map((role) => role.project_role_name))].map((name, index) => ({ id: index + 1, name })));

        const { data: locationsData, error: locationsError } = await supabase
          .from('training_locations')
          .select('id, name')
          .eq('active', true)
          .order('display_order');
        if (locationsError) {
          console.warn('Reference table not available, using fallback');
          // Fallback: take the locations people already have
          const { data: userData } = await supabase.from('end_users').select('training_location');
          const uniqueLocations = [...new Set(userData?.map((u) => u.training_location).filter(Boolean))];
          setTrainingLocations(uniqueLocations.map((name, index) => ({ id: index + 1, name })));
        } else {
          setTrainingLocations(locationsData || []);
        }

        const { data: schemaData, error: schemaError } = await supabase.rpc('get_table_columns', { table_name: 'end_users' });
        if (schemaError) throw schemaError;
        setColumns(orderColumns(schemaData));

        const usersData = await fetchAllRows(() => supabase.from('end_users').select('*').eq('project_id', currentProject.id));
        setUsers(usersData.sort((a, b) => String(a.name || '').localeCompare(String(b.name || ''))));
      } catch (loadError) {
        setError(loadError.message);
      } finally {
        setLoading(false);
      }
    };

    fetchData();
  }, [currentProject]);

  const handleUpdate = async (userId, changes) => {
    const { data, error: updateError } = await supabase.from('end_users').update(changes).eq('id', userId).select();
    if (updateError) throw updateError;
    setUsers((previous) => previous.map((user) => (user.id === userId ? { ...user, ...data[0] } : user)));
  };

  const handleCreate = async (newUser) => {
    if (!currentProject) throw new Error('Please select a project first');

    const { data: existingUser } = await supabase.from('end_users').select('id').eq('id', newUser.id).single();
    if (existingUser) throw new Error(`Employee ID ${newUser.id} already exists. Please use a different ID.`);

    const { data, error: insertError } = await supabase.from('end_users').insert([{ ...newUser, project_id: currentProject.id }]).select();
    if (insertError) throw insertError;
    setUsers((previous) => [...previous, data[0]]);
  };

  const handleDelete = async (user) => {
    try {
      const { error: deleteError } = await supabase.from('end_users').delete().eq('id', user.id);
      if (deleteError) throw deleteError;
      setUsers((previous) => previous.filter((item) => item.id !== user.id));
      toast.success('User deleted', { description: user.name || String(user.id) });
    } catch (deleteError) {
      setError(deleteError.message);
    }
  };

  const saveSheet = async (values) => {
    if (sheet.mode === 'create') {
      await handleCreate(values);
      toast.success('User added', { description: values.name || String(values.id) });
    } else {
      await handleUpdate(sheet.user.id, values);
      toast.success('User saved', { description: sheet.user.name || String(sheet.user.id) });
    }
    setError(null);
    setSheet(null);
  };

  const filteredUsers = useMemo(() => filterUsers(users, columns, searchTerm, columnFilters), [users, columns, searchTerm, columnFilters]);
  const filterColumns = useMemo(
    () =>
      columns
        .map((column) => ({ name: column.column_name, values: uniqueColumnValues(users, column.column_name) }))
        .filter((column) => !NO_FILTER_BUTTON.includes(column.name) && column.values.length > 0),
    [columns, users]
  );
  const filtersActive = activeFilterCount(columnFilters);

  const tableColumns = useMemo(
    () => [
      ...columns.map((column) => ({
        id: column.column_name,
        header: columnLabel(column.column_name),
        accessorFn: (user) => user[column.column_name] ?? '',
        meta: { className: column.column_name === 'name' ? 'font-medium' : column.column_name === 'id' ? 'tabular-nums text-subtle-foreground' : undefined }
      })),
      {
        id: 'actions',
        header: 'Actions',
        enableSorting: false,
        meta: { align: 'right' },
        cell: ({ row }) => (
          <div className="flex items-center justify-end gap-1" onClick={(event) => event.stopPropagation()}>
            <Tooltip>
              <TooltipTrigger asChild>
                <Button variant="ghost" size="icon-sm" aria-label="Edit user" onClick={() => setSheet({ mode: 'edit', user: row.original })}>
                  <Pencil />
                </Button>
              </TooltipTrigger>
              <TooltipContent>Edit user</TooltipContent>
            </Tooltip>
            <Tooltip>
              <TooltipTrigger asChild>
                <Button variant="destructive" size="icon-sm" aria-label="Delete user" onClick={() => setUserToDelete(row.original)}>
                  <Trash2 />
                </Button>
              </TooltipTrigger>
              <TooltipContent>Delete user</TooltipContent>
            </Tooltip>
          </div>
        )
      }
    ],
    [columns]
  );

  if (!loading && !currentProject) {
    return (
      <div className="mx-auto max-w-6xl rounded-lg border border-border bg-card">
        <EmptyState
          icon={Users}
          title="No Project Selected"
          description="Please select a project from the Projects page to manage users. Each project has its own isolated set of users and data."
        />
      </div>
    );
  }

  return (
    <div className="mx-auto flex max-w-[1400px] flex-col gap-4">
      <PageHeader
        title="End Users Management"
        count={loading ? undefined : filteredUsers.length === users.length ? users.length : `${filteredUsers.length} of ${users.length}`}
        description={`Manage end users, their roles, and personal information${currentProject ? ` for ${currentProject.title}` : ''}. Use the search box or filters to find specific users.`}
        actions={
          <Button variant="default" onClick={() => setSheet({ mode: 'create' })} disabled={loading}>
            <Plus /> Add New User
          </Button>
        }
      />

      {error && (
        <div role="alert" className="flex items-center gap-3 rounded-md bg-destructive-soft px-3 py-2 text-sm text-destructive">
          <span className="flex-1">{error}</span>
          <Button variant="ghost" size="sm" onClick={() => setError(null)}>Dismiss</Button>
        </div>
      )}

      <Toolbar>
        <div className="relative w-72 max-w-full">
          <Search className="pointer-events-none absolute left-2.5 top-1/2 size-4 -translate-y-1/2 text-subtle-foreground" aria-hidden="true" />
          <Input
            type="search"
            aria-label="Search users"
            placeholder="Search users by any field..."
            value={searchTerm}
            onChange={(event) => setSearchTerm(event.target.value)}
            className="pl-8"
          />
        </div>
        {filterColumns.map((column) => (
          <ColumnFilter
            key={column.name}
            label={columnLabel(column.name)}
            values={column.values}
            selected={columnFilters[column.name] || []}
            onChange={(selected) => setColumnFilters((previous) => ({ ...previous, [column.name]: selected }))}
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
          {currentProject ? `Loading users for project: ${currentProject.name}` : 'Preparing user data...'}
        </div>
      ) : (
        <DataTable
          caption="End users"
          columns={tableColumns}
          data={filteredUsers}
          getRowId={(user) => String(user.id)}
          pageSize={50}
          pageSizes={[25, 50, 100, 200]}
          onRowClick={(user) => setSheet({ mode: 'edit', user })}
          emptyState={
            <EmptyState
              icon={Users}
              title={users.length === 0 ? 'No users yet' : 'No users match'}
              description={users.length === 0 ? 'Add people one at a time here, or use Import/Export End Users.' : 'Try a different search or clear the filters.'}
            />
          }
        />
      )}

      <UserEditSheet
        mode={sheet?.mode}
        user={sheet?.user}
        columns={columns}
        roles={roles}
        locations={trainingLocations}
        onSubmit={saveSheet}
        onClose={() => setSheet(null)}
      />

      <AlertDialog open={Boolean(userToDelete)} onOpenChange={(open) => !open && setUserToDelete(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete user</AlertDialogTitle>
          </AlertDialogHeader>
          <AlertDialogDescription>
            Are you sure you want to delete user {userToDelete?.name || userToDelete?.id}?
          </AlertDialogDescription>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction destructive onClick={() => handleDelete(userToDelete)}>Delete</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
};

export default DynamicUserForm;
