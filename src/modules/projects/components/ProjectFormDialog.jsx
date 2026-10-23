import React, { useEffect, useState } from 'react';
import { Loader2 } from 'lucide-react';
import {
  Button, Dialog, DialogBody, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle,
  FormField, Input, Select, SelectContent, SelectItem, SelectTrigger, SelectValue, Textarea
} from '@/components/ui';
import { EMPTY_PROJECT_FORM, validateProject } from './projectValidation';

/**
 * One form for creating and editing a project. `initialValues` seeds the form each time it opens;
 * `showDataSource` adds the Training Data Source choice (edit only, as before).
 */
export default function ProjectFormDialog({ isOpen, onClose, onSubmit, title, submitLabel, submittingLabel, initialValues = EMPTY_PROJECT_FORM, showDataSource = false }) {
  const [form, setForm] = useState(initialValues);
  const [errors, setErrors] = useState({});
  const [isSubmitting, setIsSubmitting] = useState(false);

  useEffect(() => {
    if (isOpen) {
      setForm(initialValues);
      setErrors({});
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isOpen]);

  const set = (name, value) => {
    setForm((previous) => ({ ...previous, [name]: value }));
    if (errors[name]) setErrors((previous) => ({ ...previous, [name]: null }));
  };
  const onChange = (event) => set(event.target.name, event.target.value);

  const close = () => {
    if (isSubmitting) return;
    setErrors({});
    onClose();
  };

  const handleSubmit = async (event) => {
    event.preventDefault();
    const found = validateProject(form);
    setErrors(found);
    if (Object.keys(found).length > 0) return;

    setIsSubmitting(true);
    try {
      await onSubmit(form);
      onClose();
    } catch (error) {
      console.error('Error saving project:', error);
      setErrors({ submit: error.message || 'Failed to save project' });
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <Dialog open={isOpen} onOpenChange={(open) => !open && close()}>
      <DialogContent className="max-w-xl">
        <form onSubmit={handleSubmit} className="flex min-h-0 flex-1 flex-col" noValidate>
          <DialogHeader>
            <DialogTitle>{title}</DialogTitle>
            <DialogDescription>Fields marked * are required.</DialogDescription>
          </DialogHeader>

          <DialogBody className="flex flex-col gap-4">
            <FormField label="Project Name *" hint="A unique identifier for this project (used in URLs and references)" error={errors.name}>
              <Input name="name" value={form.name} onChange={onChange} placeholder="e.g., acme-corp-training" disabled={isSubmitting} autoFocus />
            </FormField>

            <FormField label="Project Title *" hint="A descriptive title for display purposes" error={errors.title}>
              <Input name="title" value={form.title} onChange={onChange} placeholder="e.g., ACME Corp Training Initiative" disabled={isSubmitting} />
            </FormField>

            <FormField label="Description" hint="Optional description of the project's goals and scope">
              <Textarea name="description" value={form.description} onChange={onChange} rows={3} placeholder="Describe the purpose and scope of this project..." disabled={isSubmitting} />
            </FormField>

            <FormField label="Project Code" hint="Optional code for tracking and reporting" error={errors.project_code} className="max-w-xs">
              <Input name="project_code" value={form.project_code} onChange={onChange} placeholder="e.g., ACT-2025" disabled={isSubmitting} />
            </FormField>

            <div className="grid grid-cols-2 gap-4">
              <FormField label="Start Date" hint="When does this project begin?">
                <Input type="date" name="start_date" value={form.start_date} onChange={onChange} disabled={isSubmitting} />
              </FormField>
              <FormField label="Target End Date" hint="When do you plan to complete this project?" error={errors.target_end_date}>
                <Input type="date" name="target_end_date" value={form.target_end_date} onChange={onChange} disabled={isSubmitting} />
              </FormField>
            </div>

            {showDataSource && (
              <FormField
                label="Training Data Source"
                hint="Where the Schedule Creator, Session Calculator and User Assignments get their people and courses. Switching doesn't delete either set of data."
              >
                {(fieldProps) => (
                  <Select value={form.training_data_source} onValueChange={(value) => set('training_data_source', value)} disabled={isSubmitting}>
                    <SelectTrigger {...fieldProps}>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="access">MS Access import</SelectItem>
                      <SelectItem value="app">Managed in app (people, roles, courses, mappings)</SelectItem>
                    </SelectContent>
                  </Select>
                )}
              </FormField>
            )}

            {errors.submit && (
              <div role="alert" className="rounded-md bg-destructive-soft px-3 py-2 text-sm text-destructive">{errors.submit}</div>
            )}
          </DialogBody>

          <DialogFooter>
            <Button onClick={close} disabled={isSubmitting}>Cancel</Button>
            <Button type="submit" variant="default" disabled={isSubmitting}>
              {isSubmitting && <Loader2 className="animate-spin" aria-hidden="true" />}
              {isSubmitting ? submittingLabel : submitLabel}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
