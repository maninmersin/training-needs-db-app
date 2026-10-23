import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { KeyRound, Loader2, Lock, Plus, ShieldPlus, Trash2 } from 'lucide-react';
import { supabase } from '@core/services/supabaseClient';
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader,
  AlertDialogTitle, Badge, Button, Card, Checkbox, Dialog, DialogBody, DialogContent, DialogDescription, DialogFooter, DialogHeader,
  DialogTitle, EmptyState, FormField, Input, PageHeader, Textarea, toast
} from '@/components/ui';
import {
  countPermissions, defaultPermissionRows, groupPermissions, hasPermission, isProtectedRole, normalizePermission, permissionName,
  titleCase, validatePermission, validateRole
} from './rolesLogic';

const RolePermissionsEditor = () => {
  const [roles, setRoles] = useState([]);
  const [permissions, setPermissions] = useState([]);
  const [rolePermissions, setRolePermissions] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  const [selectedRoleId, setSelectedRoleId] = useState(null);
  const [roleToDelete, setRoleToDelete] = useState(null);
  const [roleDialog, setRoleDialog] = useState(false);
  const [permissionDialog, setPermissionDialog] = useState(false);
  const [roleForm, setRoleForm] = useState({ name: '', description: '' });
  const [permissionForm, setPermissionForm] = useState({ resource: '', action: '', description: '' });
  const [formErrors, setFormErrors] = useState({});
  const [saving, setSaving] = useState(false);

  const fetchRoles = useCallback(async () => {
    const { data, error: fetchError } = await supabase.from('auth_roles').select('*').order('name');
    if (fetchError) throw fetchError;
    setRoles(data || []);
  }, []);

  const fetchPermissions = useCallback(async () => {
    const { data, error: fetchError } = await supabase.from('auth_permissions').select('*').order('resource', { ascending: true }).order('action', { ascending: true });
    if (fetchError) {
      if (fetchError.code === '42P01') { // the table does not exist yet
        setPermissions([]);
        return;
      }
      throw fetchError;
    }
    setPermissions(data || []);
  }, []);

  const fetchRolePermissions = useCallback(async () => {
    const { data, error: fetchError } = await supabase.from('auth_role_permissions').select('*, auth_permissions (id, name, description, resource, action)');
    if (fetchError) {
      if (fetchError.code === '42P01') {
        setRolePermissions([]);
        return;
      }
      throw fetchError;
    }
    setRolePermissions(data || []);
  }, []);

  useEffect(() => {
    const load = async () => {
      try {
        setLoading(true);
        await Promise.all([fetchRoles(), fetchPermissions(), fetchRolePermissions()]);
      } catch (loadError) {
        setError('Failed to load data');
        console.error('Error fetching data:', loadError);
      } finally {
        setLoading(false);
      }
    };
    load();
  }, [fetchRoles, fetchPermissions, fetchRolePermissions]);

  // One request: creates the permissions that are missing and leaves existing ones alone
  const initializeDefaultPermissions = async () => {
    try {
      const { error: upsertError } = await supabase.from('auth_permissions').upsert(defaultPermissionRows(), { onConflict: 'name', ignoreDuplicates: true });
      if (upsertError) throw upsertError;
      await fetchPermissions();
      toast.success('Default permissions created');
    } catch (initError) {
      console.error('Error initializing default permissions:', initError);
      setError(`Failed to create the default permissions: ${initError.message}`);
    }
  };

  const openRoleDialog = () => {
    setRoleForm({ name: '', description: '' });
    setFormErrors({});
    setRoleDialog(true);
  };

  const openPermissionDialog = () => {
    setPermissionForm({ resource: '', action: '', description: '' });
    setFormErrors({});
    setPermissionDialog(true);
  };

  const handleCreateRole = async (event) => {
    event.preventDefault();
    const found = validateRole(roleForm, roles);
    setFormErrors(found);
    if (Object.keys(found).length > 0) return;
    setSaving(true);
    try {
      const { error: insertError } = await supabase.from('auth_roles').insert({ name: roleForm.name.trim(), description: roleForm.description.trim() });
      if (insertError) throw insertError;
      setRoleDialog(false);
      await fetchRoles();
      toast.success('Role created', { description: roleForm.name.trim() });
    } catch (createError) {
      setFormErrors({ submit: `Failed to create role: ${createError.message}` });
    } finally {
      setSaving(false);
    }
  };

  const handleCreatePermission = async (event) => {
    event.preventDefault();
    const cleaned = normalizePermission(permissionForm);
    const found = validatePermission(cleaned, permissions);
    setFormErrors(found);
    if (Object.keys(found).length > 0) return;
    setSaving(true);
    try {
      const { error: insertError } = await supabase.from('auth_permissions').insert({
        name: permissionName(cleaned.resource, cleaned.action), description: cleaned.description, resource: cleaned.resource, action: cleaned.action
      });
      if (insertError) throw insertError;
      setPermissionDialog(false);
      await fetchPermissions();
      toast.success('Permission created', { description: permissionName(cleaned.resource, cleaned.action) });
    } catch (createError) {
      setFormErrors({ submit: `Failed to create permission: ${createError.message}` });
    } finally {
      setSaving(false);
    }
  };

  const handleTogglePermission = async (roleId, permissionId, currentlyHas) => {
    try {
      const request = currentlyHas
        ? supabase.from('auth_role_permissions').delete().eq('role_id', roleId).eq('permission_id', permissionId)
        : supabase.from('auth_role_permissions').insert({ role_id: roleId, permission_id: permissionId });
      const { error: toggleError } = await request;
      if (toggleError) throw toggleError;
      await fetchRolePermissions();
    } catch (toggleError) {
      setError(`Failed to update permission: ${toggleError.message}`);
    }
  };

  const handleDeleteRole = async (role) => {
    try {
      const { error: deleteError } = await supabase.from('auth_roles').delete().eq('id', role.id);
      if (deleteError) throw deleteError;
      await Promise.all([fetchRoles(), fetchRolePermissions()]);
      toast.success('Role deleted', { description: role.name });
    } catch (deleteError) {
      setError(`Failed to delete role: ${deleteError.message}`);
    }
  };

  const groups = useMemo(() => groupPermissions(permissions), [permissions]);
  const selectedRole = roles.find((role) => role.id === selectedRoleId) || null;

  if (loading) {
    return (
      <div role="status" className="flex items-center justify-center gap-2 py-16 text-sm text-muted-foreground">
        <Loader2 className="size-4 animate-spin" aria-hidden="true" /> Loading role permissions editor...
      </div>
    );
  }

  return (
    <div className="mx-auto flex max-w-6xl flex-col gap-4">
      <PageHeader
        title="Role & Permissions Management"
        description="Roles decide what each user can do. Create roles, then choose the permissions each one has."
        actions={
          <>
            {permissions.length === 0 && <Button onClick={initializeDefaultPermissions}><ShieldPlus /> Initialize Default Permissions</Button>}
            <Button onClick={openPermissionDialog}><Plus /> Create Permission</Button>
            <Button variant="default" onClick={openRoleDialog}><Plus /> Create Role</Button>
          </>
        }
      />

      {error && (
        <div role="alert" className="flex items-center gap-3 rounded-md bg-destructive-soft px-3 py-2 text-sm text-destructive">
          <span className="flex-1">{error}</span>
          <Button variant="ghost" size="sm" onClick={() => setError(null)}>Dismiss</Button>
        </div>
      )}

      <section aria-label="Roles" className="flex flex-col gap-3">
        <h2 className="text-base font-semibold">Roles</h2>
        {roles.length === 0 ? (
          <Card><EmptyState icon={KeyRound} title="No roles yet" description="Create a role, then choose its permissions." action={<Button variant="default" onClick={openRoleDialog}><Plus /> Create Role</Button>} /></Card>
        ) : (
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
            {roles.map((role) => {
              const protectedRole = isProtectedRole(role.name);
              return (
                <Card key={role.id} className="flex flex-col gap-3 p-4">
                  <div className="flex items-start justify-between gap-2">
                    <h3 className="text-sm font-semibold">{role.name}</h3>
                    {protectedRole ? (
                      <Badge title="The system relies on this role, so it cannot be deleted"><Lock className="size-3" aria-hidden="true" /> Built-in</Badge>
                    ) : (
                      <Button variant="destructive" size="icon-sm" aria-label={`Delete ${role.name}`} onClick={() => setRoleToDelete(role)}><Trash2 /></Button>
                    )}
                  </div>
                  <p className="min-h-5 text-sm text-muted-foreground">{role.description}</p>
                  <div className="mt-auto flex items-center justify-between gap-2">
                    <span className="text-xs text-muted-foreground tabular-nums">{countPermissions(rolePermissions, role.id)} permissions</span>
                    <Button size="sm" aria-label={`Manage permissions for ${role.name}`} onClick={() => setSelectedRoleId(role.id)}>Manage Permissions</Button>
                  </div>
                </Card>
              );
            })}
          </div>
        )}
      </section>

      <Dialog open={roleDialog} onOpenChange={(open) => !open && !saving && setRoleDialog(false)}>
        <DialogContent>
          <form onSubmit={handleCreateRole} className="flex min-h-0 flex-1 flex-col" noValidate>
            <DialogHeader><DialogTitle>Create New Role</DialogTitle><DialogDescription>Give the role a name; you choose its permissions afterwards.</DialogDescription></DialogHeader>
            <DialogBody className="flex flex-col gap-4">
              <FormField label="Role Name" error={formErrors.name}>
                <Input value={roleForm.name} onChange={(event) => setRoleForm({ ...roleForm, name: event.target.value })} disabled={saving} autoFocus />
              </FormField>
              <FormField label="Description">
                <Textarea rows={3} value={roleForm.description} onChange={(event) => setRoleForm({ ...roleForm, description: event.target.value })} disabled={saving} />
              </FormField>
              {formErrors.submit && <div role="alert" className="rounded-md bg-destructive-soft px-3 py-2 text-sm text-destructive">{formErrors.submit}</div>}
            </DialogBody>
            <DialogFooter>
              <Button onClick={() => setRoleDialog(false)} disabled={saving}>Cancel</Button>
              <Button type="submit" variant="default" disabled={saving}>{saving && <Loader2 className="animate-spin" aria-hidden="true" />} Create Role</Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      <Dialog open={permissionDialog} onOpenChange={(open) => !open && !saving && setPermissionDialog(false)}>
        <DialogContent>
          <form onSubmit={handleCreatePermission} className="flex min-h-0 flex-1 flex-col" noValidate>
            <DialogHeader><DialogTitle>Create New Permission</DialogTitle><DialogDescription>A permission is an action on a resource, written resource:action.</DialogDescription></DialogHeader>
            <DialogBody className="flex flex-col gap-4">
              <FormField label="Resource" error={formErrors.resource} hint="e.g., users, schedules, courses">
                <Input value={permissionForm.resource} onChange={(event) => setPermissionForm({ ...permissionForm, resource: event.target.value })} disabled={saving} autoFocus />
              </FormField>
              <FormField label="Action" error={formErrors.action} hint="e.g., create, read, update, delete">
                <Input value={permissionForm.action} onChange={(event) => setPermissionForm({ ...permissionForm, action: event.target.value })} disabled={saving} />
              </FormField>
              <FormField label="Description">
                <Textarea rows={3} value={permissionForm.description} onChange={(event) => setPermissionForm({ ...permissionForm, description: event.target.value })} disabled={saving} />
              </FormField>
              {formErrors.submit && <div role="alert" className="rounded-md bg-destructive-soft px-3 py-2 text-sm text-destructive">{formErrors.submit}</div>}
            </DialogBody>
            <DialogFooter>
              <Button onClick={() => setPermissionDialog(false)} disabled={saving}>Cancel</Button>
              <Button type="submit" variant="default" disabled={saving}>{saving && <Loader2 className="animate-spin" aria-hidden="true" />} Create Permission</Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      <Dialog open={Boolean(selectedRole)} onOpenChange={(open) => !open && setSelectedRoleId(null)}>
        <DialogContent className="max-w-3xl">
          <DialogHeader>
            <DialogTitle>Permissions for {selectedRole?.name}</DialogTitle>
            <DialogDescription>Tick what this role is allowed to do. Changes are saved as you tick.</DialogDescription>
          </DialogHeader>
          <DialogBody>
            {groups.length === 0 ? (
              <EmptyState
                icon={ShieldPlus}
                title="No permissions available"
                description="Initialize the default permissions first."
                action={<Button variant="default" onClick={initializeDefaultPermissions}>Initialize Default Permissions</Button>}
              />
            ) : (
              <div className="grid gap-4 sm:grid-cols-2">
                {groups.map(([resource, resourcePermissions]) => (
                  <fieldset key={resource} className="flex flex-col gap-1.5 rounded-lg border border-border p-3">
                    <legend className="px-1 text-sm font-semibold">{titleCase(resource)}</legend>
                    {resourcePermissions.map((permission) => {
                      const checked = selectedRole ? hasPermission(rolePermissions, selectedRole.id, permission.id) : false;
                      return (
                        <label key={permission.id} className="flex cursor-pointer items-start gap-2 rounded px-1 py-1 text-sm hover:bg-accent">
                          <Checkbox aria-label={`${titleCase(resource)}: ${permission.action}`} checked={checked} onCheckedChange={() => handleTogglePermission(selectedRole.id, permission.id, checked)} className="mt-0.5" />
                          <span className="flex flex-col leading-tight">
                            <span className="font-medium">{permission.action}</span>
                            <span className="text-xs text-muted-foreground">{permission.description}</span>
                          </span>
                        </label>
                      );
                    })}
                  </fieldset>
                ))}
              </div>
            )}
          </DialogBody>
          <DialogFooter><Button onClick={() => setSelectedRoleId(null)}>Close</Button></DialogFooter>
        </DialogContent>
      </Dialog>

      <AlertDialog open={Boolean(roleToDelete)} onOpenChange={(open) => !open && setRoleToDelete(null)}>
        <AlertDialogContent>
          <AlertDialogHeader><AlertDialogTitle>Delete role</AlertDialogTitle></AlertDialogHeader>
          <AlertDialogDescription>
            Are you sure you want to delete the role "{roleToDelete?.name}"? This will remove all its permissions and user assignments.
          </AlertDialogDescription>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction destructive onClick={() => handleDeleteRole(roleToDelete)}>Delete</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
};

export default RolePermissionsEditor;
