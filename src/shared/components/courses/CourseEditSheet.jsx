import React, { useEffect, useState } from 'react';
import { Loader2, Trash2 } from 'lucide-react';
import {
  Button, FormField, Input, Sheet, SheetBody, SheetContent, SheetDescription, SheetFooter, SheetHeader, SheetTitle
} from '@/components/ui';
import ChoiceField from '../ChoiceField';
import { blankCourseDraft, changedCourseFields, courseToDraft, draftToCourse, validateCourseDraft } from './coursesLogic';

/**
 * Side panel for adding or editing one course. `onSubmit(values)` gets the whole new course when adding,
 * or only the changed fields when editing, and may reject with an Error to be shown in the panel.
 * When editing, `onDelete(course)` adds a Delete button (the caller asks for confirmation).
 */
export default function CourseEditSheet({ mode, course, functionalAreas, onSubmit, onDelete, onClose }) {
  const isNew = mode === 'create';
  const [draft, setDraft] = useState(blankCourseDraft(functionalAreas));
  const [errors, setErrors] = useState({});
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (!mode) return;
    setErrors({});
    setSaving(false);
    setDraft(isNew ? blankCourseDraft(functionalAreas) : courseToDraft(course));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [mode, course]);

  const set = (name, value) => {
    setDraft((previous) => ({ ...previous, [name]: value }));
    if (errors[name]) setErrors((previous) => ({ ...previous, [name]: null }));
  };
  const onChange = (event) => set(event.target.name, event.target.value);

  const submit = async (event) => {
    event.preventDefault();
    const found = validateCourseDraft(draft, { isNew });
    setErrors(found);
    if (Object.keys(found).length > 0) return;

    const values = isNew ? draftToCourse(draft) : changedCourseFields(course, draft);
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

  return (
    <Sheet open={Boolean(mode)} onOpenChange={(next) => !next && !saving && onClose()}>
      <SheetContent>
        <form onSubmit={submit} className="flex min-h-0 flex-1 flex-col" noValidate>
          <SheetHeader>
            <SheetTitle>{isNew ? 'Add course' : 'Edit course'}</SheetTitle>
            <SheetDescription>
              {isNew ? 'The new course is added to this project only.' : `${course?.course_id ?? ''} - changes apply to this project only`}
            </SheetDescription>
          </SheetHeader>

          <SheetBody>
            <FormField
              label="Course ID"
              error={errors.course_id}
              hint={isNew ? undefined : "The ID can't be changed because schedules and mappings refer to it. To use a different ID, add a new course."}
            >
              <Input name="course_id" value={draft.course_id} onChange={onChange} disabled={saving || !isNew} autoFocus={isNew} />
            </FormField>
            <FormField label="Course Name">
              <Input name="course_name" value={draft.course_name} onChange={onChange} disabled={saving} />
            </FormField>
            <ChoiceField
              label="Functional Area"
              value={draft.functional_area}
              options={functionalAreas.map((area) => area.name)}
              placeholder="Select functional area"
              onChange={(value) => set('functional_area', value)}
              disabled={saving}
            />
            <div className="grid grid-cols-2 gap-3">
              <FormField label="Duration (hrs)" error={errors.duration_hrs}>
                <Input type="number" step="any" min="0" name="duration_hrs" value={draft.duration_hrs} onChange={onChange} disabled={saving} />
              </FormField>
              <FormField label="Priority" error={errors.priority} hint="1 = highest priority">
                <Input type="number" min="1" name="priority" value={draft.priority} onChange={onChange} disabled={saving} />
              </FormField>
            </div>
            <FormField label="Application">
              <Input name="application" value={draft.application} onChange={onChange} disabled={saving} />
            </FormField>
            {errors.submit && <div role="alert" className="rounded-md bg-destructive-soft px-3 py-2 text-sm text-destructive">{errors.submit}</div>}
          </SheetBody>

          <SheetFooter>
            {!isNew && onDelete && (
              <Button variant="destructive" className="mr-auto" onClick={() => onDelete(course)} disabled={saving}>
                <Trash2 /> Delete course
              </Button>
            )}
            <Button onClick={onClose} disabled={saving}>Cancel</Button>
            <Button type="submit" variant="default" disabled={saving}>
              {saving && <Loader2 className="animate-spin" aria-hidden="true" />}
              {isNew ? 'Add course' : 'Save changes'}
            </Button>
          </SheetFooter>
        </form>
      </SheetContent>
    </Sheet>
  );
}
