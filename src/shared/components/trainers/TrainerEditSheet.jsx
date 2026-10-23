import React, { useEffect, useState } from 'react';
import { Loader2, Trash2 } from 'lucide-react';
import {
  Button, FormField, Input, Sheet, SheetBody, SheetContent, SheetDescription, SheetFooter, SheetHeader, SheetTitle, Switch, Textarea
} from '@/components/ui';
import { BLANK_TRAINER_FORM, formToTrainer, trainerToForm, validateTrainerForm } from './trainersLogic';

/**
 * Side panel for adding or editing one trainer. `onSubmit(trainer)` may reject with an Error, which is shown
 * in the panel. When editing, `onDelete(trainer)` adds a Delete button (the caller asks for confirmation).
 */
export default function TrainerEditSheet({ mode, trainer, onSubmit, onDelete, onClose }) {
  const isNew = mode === 'create';
  const [form, setForm] = useState(BLANK_TRAINER_FORM);
  const [errors, setErrors] = useState({});
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (!mode) return;
    setErrors({});
    setSaving(false);
    setForm(isNew ? BLANK_TRAINER_FORM : trainerToForm(trainer));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [mode, trainer]);

  const set = (name, value) => {
    setForm((previous) => ({ ...previous, [name]: value }));
    if (errors[name]) setErrors((previous) => ({ ...previous, [name]: null }));
  };
  const onChange = (event) => set(event.target.name, event.target.value);

  const submit = async (event) => {
    event.preventDefault();
    const found = validateTrainerForm(form);
    setErrors(found);
    if (Object.keys(found).length > 0) return;

    setSaving(true);
    try {
      await onSubmit(formToTrainer(form));
    } catch (error) {
      setErrors({ submit: error.message || 'Failed to save' });
      setSaving(false);
    }
  };

  return (
    <Sheet open={Boolean(mode)} onOpenChange={(next) => !next && !saving && onClose()}>
      <SheetContent>
        <form onSubmit={submit} className="flex min-h-0 flex-1 flex-col" noValidate>
          <SheetHeader>
            <SheetTitle>{isNew ? 'Add New Trainer' : 'Edit Trainer'}</SheetTitle>
            <SheetDescription>{isNew ? 'The new trainer is added to this project only.' : `${trainer?.name ?? ''} - changes apply to this project only`}</SheetDescription>
          </SheetHeader>

          <SheetBody>
            <FormField label="Name *" error={errors.name}>
              <Input name="name" value={form.name} onChange={onChange} disabled={saving} autoFocus={isNew} />
            </FormField>
            <FormField label="Email" error={errors.email}>
              <Input type="email" name="email" value={form.email} onChange={onChange} disabled={saving} />
            </FormField>
            <FormField label="Phone">
              <Input type="tel" name="phone" value={form.phone} onChange={onChange} disabled={saving} />
            </FormField>
            <FormField label="Specializations (comma-separated)" hint="e.g., Safety Training, IT Training, Leadership">
              <Input name="specializations" value={form.specializations} onChange={onChange} disabled={saving} />
            </FormField>
            <FormField label="Bio">
              <Textarea name="bio" rows={3} value={form.bio} onChange={onChange} disabled={saving} placeholder="Brief description of trainer's background and expertise..." />
            </FormField>
            <div className="flex items-center gap-3">
              <Switch id="trainer-active" checked={form.active} onCheckedChange={(value) => set('active', value)} disabled={saving} />
              <label htmlFor="trainer-active" className="text-sm font-medium">{form.active ? 'Active' : 'Inactive'}</label>
            </div>
            {errors.submit && <div role="alert" className="rounded-md bg-destructive-soft px-3 py-2 text-sm text-destructive">{errors.submit}</div>}
          </SheetBody>

          <SheetFooter>
            {!isNew && onDelete && (
              <Button variant="destructive" className="mr-auto" onClick={() => onDelete(trainer)} disabled={saving}>
                <Trash2 /> Delete trainer
              </Button>
            )}
            <Button onClick={onClose} disabled={saving}>Cancel</Button>
            <Button type="submit" variant="default" disabled={saving}>
              {saving && <Loader2 className="animate-spin" aria-hidden="true" />}
              {isNew ? 'Add Trainer' : 'Update Trainer'}
            </Button>
          </SheetFooter>
        </form>
      </SheetContent>
    </Sheet>
  );
}
