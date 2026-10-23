import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { Eye, EyeOff, Loader2, Pencil, Plus, Search, Trash2, UserCog } from 'lucide-react';
import { supabase } from '@core/services/supabaseClient';
import * as adminUsers from '@core/services/adminUsersApi';
import { useCurrentUser } from '@core/components/shell/useCurrentUser';
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader,
  AlertDialogTitle, Badge, Button, Checkbox, DataTable, Dialog, DialogBody, DialogContent, DialogDescription, DialogFooter, DialogHeader,
  DialogTitle, EmptyState, FormField, Input, PageHeader, Select, SelectContent, SelectItem, SelectTrigger, SelectValue, Toolbar, Tooltip,
  TooltipContent, TooltipTrigger, toast
} from '@/components/ui';
import { createUserAccount, deleteUserAccount, loadRoles, loadUsers, updateUserAccount } from './userAdminService';
import { deleteBlockedReason, filterUsers, roleChangeBlockedReason, roleIdsOf, roleNamesOf, toggleId, validateUserForm } from './usersLogic';

const ALL = '__all__'; // Radix Select cannot hold an empty value
const EMPTY_FORM = { email: '', password: '', roles: [] };

function RoleChoices({ roles, selected, onChange, disabled, error }) {
  return (
    <fieldset className="flex flex-col gap-1.5" aria-describedby={error ? 'roles-error' : undefined}>
      <legend className="mb-1 text-xs font-medium text-muted-foreground">Roles</legend>
      <div className="flex max-h-48 flex-col gap-1 overflow-y-auto rounded-md border border-border p-2">
        {roles.length === 0 && <p className="text-sm italic text-muted-foreground">No roles exist yet. Create them in Roles & Permissions.</p>}
        {roles.map((role) => (
          <label key={role.id} className="flex cursor-pointer items-start gap-2 rounded px-1 py-1 text-sm hover:bg-accent">
            <Checkbox aria-label={role.name} checked={selected.includes(role.id)} onCheckedChange={() => onChange(toggleId(selected, role.id))} disabled={disabled} className="mt-0.5" />
            <span className="flex flex-col leading-tight">
              <span className="font-medium">{role.name}</span>
              {role.description && <span className="text-xs text-muted-foreground">{role.description}</span>}
            </span>
          </label>
        ))}
      </div>
      {error && <p id="roles-error" className="text-xs text-destructive">{error}</p>}
    </fieldset>
  );
}

const UserManagementDashboard = () => {
  const { user: currentUser } = useCurrentUser();
  const [users, setUsers] = useState([]);
  const [roles, setRoles] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [searchTerm, setSearchTerm] = useState('');
  const [filterRole, setFilterRole] = useState('');

  const [dialog, setDialog] = useState(null); // { mode: 'create' } | { mode: 'edit', user }
  const [form, setForm] = useState(EMPTY_FORM);
  const [formErrors, setFormErrors] = useState({});
  const [showPassword, setShowPassword] = useState(false);
  const [saving, setSaving] = useState(false);
  const [userToDelete, setUserToDelete] = useState(null);

  const refresh = useCallback(async () => {
    const [usersData, rolesData] = await Promise.all([loadUsers(supabase), loadRoles(supabase)]);
    setUsers(usersData);
    setRoles(rolesData);
  }, []);

  useEffect(() => {
    const load = async () => {
      try {
        setLoading(true);
        await refresh();
      } catch (loadError) {
        setError('Failed to load data');
        console.error('Error loading users:', loadError);
      } finally {
        setLoading(false);
      }
    };
    load();
  }, [refresh]);

  const openCreate = () => {
    setForm(EMPTY_FORM);
    setFormErrors({});
    setShowPassword(false);
    setDialog({ mode: 'create' });
  };

  const openEdit = (user) => {
    setForm({ email: user.email, password: '', roles: roleIdsOf(user) });
    setFormErrors({});
    setShowPassword(false);
    setDialog({ mode: 'edit', user });
  };

  const closeDialog = () => {
    if (!saving) setDialog(null);
  };

  const submit = async (event) => {
    event.preventDefault();
    const isNew = dialog.mode === 'create';
    const found = validateUserForm(form, { isNew });
    if (!isNew) {
      const blocked = roleChangeBlockedReason(dialog.user, users, form.roles, roles);
      if (blocked && !found.roles) found.roles = blocked;
    }
    setFormErrors(found);
    if (Object.keys(found).length > 0) return;

    setSaving(true);
    try {
      const values = { email: form.email.trim(), password: form.password, roleIds: form.roles };
      if (isNew) {
        await createUserAccount(supabase, adminUsers, values);
        toast.success('User created', { description: values.email });
      } else {
        await updateUserAccount(supabase, adminUsers, dialog.user, values);
        toast.success('User updated successfully', { description: values.email });
      }
      setDialog(null);
      await refresh();
    } catch (saveError) {
      setFormErrors({ submit: `Failed to ${isNew ? 'create' : 'update'} user: ${saveError.message}` });
    } finally {
      setSaving(false);
    }
  };

  const confirmDelete = async () => {
    const user = userToDelete;
    try {
      setSaving(true);
      const result = await deleteUserAccount(supabase, adminUsers, user.id);
      setUserToDelete(null);
      await refresh();
      if (result.loginDeleted) toast.success('User deleted', { description: user.email });
      else toast.warning('User deleted, but their login account was not removed', { description: result.loginError });
    } catch (deleteError) {
      setUserToDelete(null);
      setError(`Failed to delete user: ${deleteError.message}`);
    } finally {
      setSaving(false);
    }
  };

  const shown = useMemo(() => filterUsers(users, searchTerm, filterRole), [users, searchTerm, filterRole]);
  const blockedDelete = userToDelete ? deleteBlockedReason(userToDelete, users, currentUser?.id) : null;

  const columns = useMemo(
    () => [
      { accessorKey: 'email', header: 'Email', meta: { className: 'font-medium' } },
      {
        id: 'status',
        header: 'Status',
        accessorFn: (user) => (user.is_active === false ? 'Inactive' : 'Active'),
        cell: ({ getValue }) => <Badge variant={getValue() === 'Active' ? 'success' : 'warning'}>{getValue()}</Badge>
      },
      {
        id: 'roles',
        header: 'Roles',
        accessorFn: (user) => roleNamesOf(user).join(', '),
        meta: { className: 'whitespace-normal py-1' },
        cell: ({ row }) => (
          <div className="flex flex-wrap gap-1">
            {roleNamesOf(row.original).map((name) => (<Badge key={name} variant="primary">{name}</Badge>))}
          </div>
        )
      },
      { id: 'created', header: 'Created', accessorFn: (user) => user.created_at || '', cell: ({ row }) => (row.original.created_at ? new Date(row.original.created_at).toLocaleDateString('en-GB') : '') },
      {
        id: 'actions',
        header: 'Actions',
        enableSorting: false,
        meta: { align: 'right' },
        cell: ({ row }) => (
          <div className="flex items-center justify-end gap-1" onClick={(event) => event.stopPropagation()}>
            <Tooltip>
              <TooltipTrigger asChild><Button variant="ghost" size="icon-sm" aria-label={`Edit ${row.original.email}`} onClick={() => openEdit(row.original)}><Pencil /></Button></TooltipTrigger>
              <TooltipContent>Edit user</TooltipContent>
            </Tooltip>
            <Tooltip>
              <TooltipTrigger asChild><Button variant="destructive" size="icon-sm" aria-label={`Delete ${row.original.email}`} onClick={() => setUserToDelete(row.original)}><Trash2 /></Button></TooltipTrigger>
              <TooltipContent>Delete user</TooltipContent>
            </Tooltip>
          </div>
        )
      }
    ],
    // eslint-disable-next-line react-hooks/exhaustive-deps
    []
  );

  if (loading) {
    return (
      <div role="status" className="flex items-center justify-center gap-2 py-16 text-sm text-muted-foreground">
        <Loader2 className="size-4 animate-spin" aria-hidden="true" /> Loading user management dashboard...
      </div>
    );
  }

  const isNew = dialog?.mode === 'create';

  return (
    <div className="mx-auto flex max-w-6xl flex-col gap-4">
      <PageHeader
        title="User Management"
        count={users.length}
        description="User accounts, their roles and their access. A role decides what a user can do (see Roles & Permissions)."
        actions={<Button variant="default" onClick={openCreate}><Plus /> Create New User</Button>}
      />

      {error && (
        <div role="alert" className="flex items-center gap-3 rounded-md bg-destructive-soft px-3 py-2 text-sm text-destructive">
          <span className="flex-1">{error}</span>
          <Button variant="ghost" size="sm" onClick={() => setError(null)}>Dismiss</Button>
        </div>
      )}

      {users.length === 0 && roles.length === 0 && !error ? (
        <div className="rounded-lg border border-border bg-card">
          <EmptyState
            icon={UserCog}
            title="Setup Required"
            description="No users or roles were found, so the user tables may not be set up. If this is a new database, run npm run db:migrate and refresh this page."
          />
        </div>
      ) : (
        <>
          <Toolbar>
            <div className="relative w-72 max-w-full">
              <Search className="pointer-events-none absolute left-2.5 top-1/2 size-4 -translate-y-1/2 text-subtle-foreground" aria-hidden="true" />
              <Input type="search" aria-label="Search by email" placeholder="Search by email..." value={searchTerm} onChange={(event) => setSearchTerm(event.target.value)} className="pl-8" />
            </div>
            <div className="w-48">
              <Select value={filterRole || ALL} onValueChange={(value) => setFilterRole(value === ALL ? '' : value)}>
                <SelectTrigger aria-label="Filter by role"><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value={ALL}>All Roles</SelectItem>
                  {roles.map((role) => (<SelectItem key={role.id} value={String(role.id)}>{role.name}</SelectItem>))}
                </SelectContent>
              </Select>
            </div>
          </Toolbar>

          <DataTable
            caption="Users"
            columns={columns}
            data={shown}
            getRowId={(user) => String(user.id)}
            pageSize={25}
            onRowClick={openEdit}
            emptyState={<EmptyState icon={UserCog} title={users.length === 0 ? 'No users yet' : 'No users match'} description={users.length === 0 ? 'Create the first user with the button above.' : 'Try a different search or role.'} />}
          />
        </>
      )}

      <Dialog open={Boolean(dialog)} onOpenChange={(open) => !open && closeDialog()}>
        <DialogContent>
          {dialog && (
            <form onSubmit={submit} className="flex min-h-0 flex-1 flex-col" noValidate>
              <DialogHeader>
                <DialogTitle>{isNew ? 'Create New User' : `Edit User: ${dialog.user.email}`}</DialogTitle>
                <DialogDescription>{isNew ? 'Create a login and choose the roles the user has.' : 'Change the email, set a new password, or change the roles.'}</DialogDescription>
              </DialogHeader>
              <DialogBody className="flex flex-col gap-4">
                <FormField label="Email" error={formErrors.email}>
                  <Input type="email" value={form.email} onChange={(event) => setForm({ ...form, email: event.target.value })} disabled={saving} autoFocus autoComplete="off" />
                </FormField>
                <FormField label={isNew ? 'Password' : 'New Password'} error={formErrors.password} hint={isNew ? 'At least 6 characters' : 'Leave blank to keep the current password'}>
                  {(fieldProps) => (
                    <div className="flex gap-2">
                      <Input {...fieldProps} type={showPassword ? 'text' : 'password'} value={form.password} onChange={(event) => setForm({ ...form, password: event.target.value })} disabled={saving} autoComplete="new-password" />
                      <Button size="icon" aria-label={showPassword ? 'Hide password' : 'Show password'} onClick={() => setShowPassword((value) => !value)}>
                        {showPassword ? <EyeOff /> : <Eye />}
                      </Button>
                    </div>
                  )}
                </FormField>
                <RoleChoices roles={roles} selected={form.roles} onChange={(next) => setForm({ ...form, roles: next })} disabled={saving} error={formErrors.roles} />
                {formErrors.submit && <div role="alert" className="rounded-md bg-destructive-soft px-3 py-2 text-sm text-destructive">{formErrors.submit}</div>}
              </DialogBody>
              <DialogFooter>
                <Button onClick={closeDialog} disabled={saving}>Cancel</Button>
                <Button type="submit" variant="default" disabled={saving}>
                  {saving && <Loader2 className="animate-spin" aria-hidden="true" />}
                  {isNew ? (saving ? 'Creating...' : 'Create User') : saving ? 'Updating...' : 'Update User'}
                </Button>
              </DialogFooter>
            </form>
          )}
        </DialogContent>
      </Dialog>

      <AlertDialog open={Boolean(userToDelete)} onOpenChange={(open) => !open && !saving && setUserToDelete(null)}>
        <AlertDialogContent>
          <AlertDialogHeader><AlertDialogTitle>Confirm Delete User</AlertDialogTitle></AlertDialogHeader>
          <AlertDialogDescription asChild>
            <div className="flex flex-col gap-2">
              <p>Are you sure you want to delete the user <strong className="text-foreground">{userToDelete?.email}</strong>?</p>
              <p className="text-destructive">This action cannot be undone and will remove all associated data.</p>
              {blockedDelete && <p role="alert" className="rounded-md bg-warning-soft px-3 py-2 text-warning">{blockedDelete}</p>}
            </div>
          </AlertDialogDescription>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={saving}>Cancel</AlertDialogCancel>
            <AlertDialogAction destructive disabled={saving || Boolean(blockedDelete)} onClick={confirmDelete}>{saving ? 'Deleting...' : 'Delete User'}</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
};

export default UserManagementDashboard;
