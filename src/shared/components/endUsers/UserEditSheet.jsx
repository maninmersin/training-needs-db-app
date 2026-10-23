import React, { useEffect, useState } from 'react';
import { Loader2 } from 'lucide-react';
import {
  Button, FormField, Input, Select, SelectContent, SelectItem, SelectTrigger, SelectValue, Sheet, SheetBody, SheetContent,
  SheetDescription, SheetFooter, SheetHeader, SheetTitle
} from '@/components/ui';
import { blankDraft, changedFields, columnLabel, draftToRow, groupColumns, isIntegerColumn, isRoleColumn, validateDraft } from './endUsersLogic';

const NONE = '__none__'; // Radix Select cannot hold an empty value, so "nothing chosen" travels as this

function ChoiceField({ label, value, options, placeholder, error, onChange, disabled }) {
  const choices = value && !options.includes(value) ? [value, ...options] : options; // keep a saved value that is no longer in the list
  return (
    <FormField label={label} error={error}>
      {(fieldProps) => (
        <Select value={value || NONE} onValueChange={(next) => onChange(next === NONE ? '' : next)} disabled={disabled}>
          <SelectTrigger {...fieldProps}>
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value={NONE}>{placeholder}</SelectItem>
            {choices.map((choice) => (
              <SelectItem key={choice} value={choice}>{choice}</SelectItem>
            ))}
          </SelectContent>
        </Select>
      )}
    </FormField>
  );
}

/**
 * Side panel for adding or editing one person. `onSubmit(values)` gets the whole new row when adding,
 * or only the changed fields when editing, and may reject with an Error to be shown in the panel.
 */
export default function UserEditSheet({ mode, user, columns, roles, locations, onSubmit, onClose }) {
  const isNew = mode === 'create';
  const [draft, setDraft] = useState({});
  const [errors, setErrors] = useState({});
  const [saving, setSaving] = useState(false);
  const open = Boolean(mode);

  useEffect(() => {
    if (!mode) return;
    setErrors({});
    setSaving(false);
    setDraft(isNew ? blankDraft(columns, locations) : { ...user });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [mode, user]);

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
    if (!isNew && Object.keys(values).length === 0) {
      onClose();
      return;
    }
    setSaving(true);
    try {
      await onSubmit(values);
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
            {errors.submit && <div role="alert" className="rounded-md bg-destructive-soft px-3 py-2 text-sm text-destructive">{errors.submit}</div>}
          </SheetBody>

          <SheetFooter>
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
