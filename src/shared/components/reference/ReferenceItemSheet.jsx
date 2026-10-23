import React, { useEffect, useState } from 'react';
import { Loader2, Trash2 } from 'lucide-react';
import {
  Button, FormField, Input, Sheet, SheetBody, SheetContent, SheetDescription, SheetFooter, SheetHeader, SheetTitle, Switch
} from '@/components/ui';
import { blankDraft, changedValues, draftToValues, editableColumns, itemToDraft, validateDraft } from './referenceLogic';

/**
 * Side panel for adding or editing one item of a reference list (`tab` comes from referenceConfig).
 * `onSubmit(values)` gets the whole new item when adding, or only the changed fields when editing, and may
 * reject with an Error to be shown in the panel. When editing, `onDelete(item)` adds a Delete button.
 */
export default function ReferenceItemSheet({ tab, mode, item, onSubmit, onDelete, onClose }) {
  const isNew = mode === 'create';
  const [draft, setDraft] = useState({});
  const [errors, setErrors] = useState({});
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (!mode || !tab) return;
    setErrors({});
    setSaving(false);
    setDraft(isNew ? blankDraft(tab) : itemToDraft(tab, item));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [mode, tab, item]);

  const set = (key, value) => {
    setDraft((previous) => ({ ...previous, [key]: value }));
    if (errors[key]) setErrors((previous) => ({ ...previous, [key]: null }));
  };

  const submit = async (event) => {
    event.preventDefault();
    const found = validateDraft(tab, draft);
    setErrors(found);
    if (Object.keys(found).length > 0) return;

    const values = isNew ? draftToValues(tab, draft) : changedValues(tab, item, draft);
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

  const open = Boolean(mode && tab);
  const flags = tab ? editableColumns(tab).filter((column) => column.type === 'boolean') : [];

  return (
    <Sheet open={open} onOpenChange={(next) => !next && !saving && onClose()}>
      <SheetContent>
        {open && (
          <form onSubmit={submit} className="flex min-h-0 flex-1 flex-col" noValidate>
            <SheetHeader>
              <SheetTitle>{isNew ? `Add New ${tab.singular}` : `Edit ${tab.singular}`}</SheetTitle>
              <SheetDescription>
                {isNew ? 'The new item is added to this project only.' : `ID ${item?.id} - changes apply to this project only`}
              </SheetDescription>
            </SheetHeader>

            <SheetBody>
              {editableColumns(tab)
                .filter((column) => column.type !== 'boolean')
                .map((column) => (
                  <FormField key={column.key} label={column.key === tab.displayField ? `${column.label} *` : column.label} error={errors[column.key]}>
                    <Input
                      type={column.type === 'number' ? 'number' : 'text'}
                      min={column.type === 'number' ? 0 : undefined}
                      value={draft[column.key] ?? ''}
                      onChange={(event) => set(column.key, event.target.value)}
                      disabled={saving}
                      autoFocus={isNew && column.key === tab.displayField}
                    />
                  </FormField>
                ))}
              {flags.map((column) => (
                <div key={column.key} className="flex items-center gap-3">
                  <Switch id={`ref-${column.key}`} checked={Boolean(draft[column.key])} onCheckedChange={(value) => set(column.key, value)} disabled={saving} />
                  <label htmlFor={`ref-${column.key}`} className="text-sm font-medium">{column.label}</label>
                </div>
              ))}
              {errors.submit && <div role="alert" className="rounded-md bg-destructive-soft px-3 py-2 text-sm text-destructive">{errors.submit}</div>}
            </SheetBody>

            <SheetFooter>
              {!isNew && onDelete && (
                <Button variant="destructive" className="mr-auto" onClick={() => onDelete(item)} disabled={saving}>
                  <Trash2 /> Delete
                </Button>
              )}
              <Button onClick={onClose} disabled={saving}>Cancel</Button>
              <Button type="submit" variant="default" disabled={saving}>
                {saving && <Loader2 className="animate-spin" aria-hidden="true" />}
                {isNew ? `Add ${tab.singular}` : 'Save changes'}
              </Button>
            </SheetFooter>
          </form>
        )}
      </SheetContent>
    </Sheet>
  );
}
