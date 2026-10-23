import React, { useEffect, useState } from 'react';
import { Loader2, Trash2 } from 'lucide-react';
import {
  Button, FormField, Input, Sheet, SheetBody, SheetContent, SheetDescription, SheetFooter, SheetHeader, SheetTitle
} from '@/components/ui';
import ChoiceField from '../ChoiceField';
import UserCoursesSection from './UserCoursesSection';
import { diffExtra, hasCourseChanges } from './userCoursesLogic';
import { loadCourseContext } from './userCoursesService';
import { blankDraft, changedFields, columnLabel, draftToRow, groupColumns, isIntegerColumn, isRoleColumn, validateDraft } from './endUsersLogic';

/**
 * Side panel for adding or editing one person. `onSubmit(values)` gets the whole new row when adding,
 * or only the changed fields when editing, and may reject with an Error to be shown in the panel.
 * When editing, `onDelete(user)` adds a Delete button (the caller asks for confirmation).
 * The Courses section needs `db` and `projectId`; when courses were added or removed, `onSubmit` also receives
 * `{ add, remove }` (individual course ids) as its second argument.
 */
export default function UserEditSheet({ mode, user, columns, roles, locations, db, projectId, onSubmit, onDelete, onClose }) {
  const isNew = mode === 'create';
  const [draft, setDraft] = useState({});
  const [errors, setErrors] = useState({});
  const [saving, setSaving] = useState(false);
  const [courseContext, setCourseContext] = useState(null);
  const [coursesLoading, setCoursesLoading] = useState(false);
  const [coursesError, setCoursesError] = useState(null);
  const [extraIds, setExtraIds] = useState([]);
  const open = Boolean(mode);

  useEffect(() => {
    if (!mode) return;
    setErrors({});
    setSaving(false);
    setDraft(isNew ? blankDraft(columns, locations) : { ...user });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [mode, user]);

  // Load the project's courses, the role mappings and (when editing) this person's extra courses
  useEffect(() => {
    if (!mode || !db || !projectId) return undefined;
    let active = true;
    setCourseContext(null);
    setCoursesError(null);
    setExtraIds([]);
    setCoursesLoading(true);
    loadCourseContext(db, projectId, isNew ? null : user?.id)
      .then((loaded) => {
        if (!active) return;
        setCourseContext(loaded);
        setExtraIds(loaded.extraIds);
      })
      .catch((error) => active && setCoursesError(error.message))
      .finally(() => active && setCoursesLoading(false));
    return () => {
      active = false;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [mode, user, db, projectId]);

  const set = (name, value) => {
    setDraft((previous) => ({ ...previous, [name]: value }));
    if (errors[name]) setErrors((previous) => ({ ...previous, [name]: null }));
  };

  const submit = async (event) => {
    event.preventDefault();
    const found = validateDraft(draft, columns, { isNew });
    setErrors(found);
    if (Object.keys(found).length > 0) return;

    const values = isNew ? draftToRow(draft, columns) : changedFields(user, draft, columns);
    const courseChanges = !isNew && courseContext && hasCourseChanges(courseContext.extraIds, extraIds) ? diffExtra(courseContext.extraIds, extraIds) : null;
    if (!isNew && Object.keys(values).length === 0 && !courseChanges) {
      onClose();
      return;
    }
    setSaving(true);
    try {
      await onSubmit(values, courseChanges);
    } catch (error) {
      setErrors({ submit: error.message || 'Failed to save' });
      setSaving(false);
    }
  };

  const roleNames = roles.map((role) => role.name);
  const locationNames = locations.map((location) => location.name);

  const renderField = (column) => {
    const name = column.column_name;
    const label = columnLabel(name);
    const value = draft[name] ?? '';
    if (isRoleColumn(name)) {
      return <ChoiceField key={name} label={label} value={value} options={roleNames} placeholder="Select a role" error={errors[name]} onChange={(next) => set(name, next)} disabled={saving} />;
    }
    if (name === 'training_location') {
      return <ChoiceField key={name} label={label} value={value} options={locationNames} placeholder="Select a location" error={errors[name]} onChange={(next) => set(name, next)} disabled={saving} />;
    }
    return (
      <FormField key={name} label={label} error={errors[name]}>
        <Input
          type={isIntegerColumn(column) && name !== 'id' ? 'number' : 'text'}
          value={value}
          onChange={(event) => set(name, event.target.value)}
          disabled={saving || (name === 'id' && !isNew)}
          autoFocus={isNew && name === 'id'}
        />
      </FormField>
    );
  };

  return (
    <Sheet open={open} onOpenChange={(next) => !next && !saving && onClose()}>
      <SheetContent>
        <form onSubmit={submit} className="flex min-h-0 flex-1 flex-col" noValidate>
          <SheetHeader>
            <SheetTitle>{isNew ? 'Add user' : 'Edit user'}</SheetTitle>
            <SheetDescription>
              {isNew ? 'The new person is added to this project only.' : `ID ${user?.id ?? ''} - changes apply to this project only`}
            </SheetDescription>
          </SheetHeader>

          <SheetBody>
            {groupColumns(columns).map((group) => (
              <section key={group.title} aria-label={group.title} className="flex flex-col gap-3">
                <h3 className="text-[11px] font-semibold uppercase tracking-wider text-subtle-foreground">{group.title}</h3>
                {group.columns.map(renderField)}
              </section>
            ))}
            {db && projectId && (
              <section aria-label="Courses" className="flex flex-col gap-3">
                <h3 className="text-[11px] font-semibold uppercase tracking-wider text-subtle-foreground">Courses</h3>
                <UserCoursesSection
                  context={courseContext}
                  loading={coursesLoading}
                  error={coursesError}
                  role={draft.project_role || draft.role || ''}
                  extraIds={extraIds}
                  onChange={setExtraIds}
                  canEdit={!isNew}
                  disabled={saving}
                />
              </section>
            )}
            {errors.submit && <div role="alert" className="rounded-md bg-destructive-soft px-3 py-2 text-sm text-destructive">{errors.submit}</div>}
          </SheetBody>

          <SheetFooter>
            {!isNew && onDelete && (
              <Button variant="destructive" className="mr-auto" onClick={() => onDelete(user)} disabled={saving}>
                <Trash2 /> Delete user
              </Button>
            )}
            <Button onClick={onClose} disabled={saving}>Cancel</Button>
            <Button type="submit" variant="default" disabled={saving}>
              {saving && <Loader2 className="animate-spin" aria-hidden="true" />}
              {isNew ? 'Add user' : 'Save changes'}
            </Button>
          </SheetFooter>
        </form>
      </SheetContent>
    </Sheet>
  );
}
