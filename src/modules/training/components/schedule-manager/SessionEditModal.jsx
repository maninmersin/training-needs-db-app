import React, { useState, useEffect } from 'react';
import { Trash2 } from 'lucide-react';
import { supabase } from '@core/services/supabaseClient';
import { getColorPaletteOptions, getColorByCourseTitle, getContrastTextColor } from '@core/utils/colorUtils';
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle,
  Badge, Button, Dialog, DialogBody, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, FormField, Input, Select,
  SelectContent, SelectItem, SelectTrigger, SelectValue
} from '@/components/ui';
import { durationHours, formatDateTimeLocal, generateTitle, validateTimes } from './sessionEditLogic';

const NO_TRAINER = '__none__'; // Radix Select cannot hold an empty value
const EMPTY_FORM = {
  title: '', custom_title: '', start: '', end: '', trainer_id: '', trainer_name: '', color: '#007bff', location: '', max_participants: '', current_participants: 0
};

const SessionEditModal = ({ session, isOpen, onClose, onSave, onDelete, criteria }) => {
  const [formData, setFormData] = useState(EMPTY_FORM);
  const [trainers, setTrainers] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [confirmDelete, setConfirmDelete] = useState(false);

  const colorPalette = getColorPaletteOptions();

  const fetchTrainers = async () => {
    try {
      const { data, error: fetchError } = await supabase
        .from('trainers')
        .select('id, name, email, specializations, active')
        .eq('active', true)
        .order('name');
      if (fetchError) throw fetchError;
      setTrainers(data || []);
    } catch (err) {
      console.error('Error fetching trainers:', err);
      setError('Failed to load trainers');
    }
  };

  useEffect(() => {
    if (isOpen) fetchTrainers();
  }, [isOpen]);

  // Fill the form from the session each time the dialog opens
  useEffect(() => {
    if (session && isOpen) {
      const courseTitle = session.course?.course_name || session.title;
      const autoColor = session.autoColor || getColorByCourseTitle(courseTitle);
      setError(null);
      setFormData({
        title: session.title || '',
        custom_title: session.custom_title || '',
        start: formatDateTimeLocal(new Date(session.start)),
        end: formatDateTimeLocal(new Date(session.end)),
        trainer_id: session.trainer_id || '',
        trainer_name: session.trainer_name || '',
        color: session.color || autoColor.backgroundColor,
        location: session.location || '',
        max_participants: session.max_participants || criteria?.max_attendees || '',
        current_participants: session.current_participants || 0
      });
    }
  }, [session, isOpen, criteria]);

  const set = (field, value) => setFormData((previous) => ({ ...previous, [field]: value }));

  const handleTrainerChange = (trainerId) => {
    const selectedTrainer = trainers.find((trainer) => trainer.id === trainerId);
    setFormData((previous) => ({ ...previous, trainer_id: trainerId, trainer_name: selectedTrainer ? selectedTrainer.name : '' }));
  };

  const handleSubmit = async (event) => {
    event.preventDefault();
    setLoading(true);
    setError(null);
    try {
      const problem = validateTimes(formData.start, formData.end);
      if (problem) throw new Error(problem);
      if (typeof onSave !== 'function') throw new Error('onSave callback is not a function');

      await onSave({
        ...session,
        title: formData.custom_title || generateTitle(session, formData.trainer_name),
        custom_title: formData.custom_title,
        start: new Date(formData.start),
        end: new Date(formData.end),
        trainer_id: formData.trainer_id || null,
        trainer_name: formData.trainer_name,
        instructor_id: formData.trainer_id || null, // for database compatibility
        instructor_name: formData.trainer_name, // for database compatibility
        color: formData.color,
        text_color: getContrastTextColor(formData.color),
        background_color: formData.color + '20', // add transparency
        location: formData.location,
        max_participants: formData.max_participants ? parseInt(formData.max_participants) : null,
        current_participants: parseInt(formData.current_participants) || 0,
        // Keep the original identifying information so the session can be matched
        originalStart: session.originalStart || session.start,
        originalEnd: session.originalEnd || session.end,
        originalTitle: session.originalTitle || session.title
      });
      onClose();
    } catch (err) {
      console.error('Error in SessionEditModal save:', err);
      setError(err.message || 'An error occurred while saving');
    } finally {
      setLoading(false);
    }
  };

  const handleDelete = async () => {
    setConfirmDelete(false);
    try {
      setLoading(true);
      setError(null);
      await onDelete(session);
      onClose();
    } catch (err) {
      console.error('Error deleting session:', err);
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  if (!isOpen || !session) return null;

  const selectedTrainer = trainers.find((trainer) => trainer.id === formData.trainer_id);
  const maxFromCriteria = criteria?.max_attendees && !session.max_participants;

  return (
    <>
      <Dialog open onOpenChange={(open) => !open && !loading && onClose()}>
        <DialogContent className="max-w-2xl">
          <form onSubmit={handleSubmit} className="flex min-h-0 flex-1 flex-col" noValidate>
            <DialogHeader>
              <DialogTitle>Edit Training Session</DialogTitle>
              <DialogDescription>{session.title}</DialogDescription>
            </DialogHeader>
            <DialogBody className="flex flex-col gap-5">
              {error && <div role="alert" className="rounded-md bg-destructive-soft px-3 py-2 text-sm text-destructive">{error}</div>}

              <fieldset className="flex flex-col gap-3">
                <legend className="mb-1 text-sm font-semibold">Session information</legend>
                <div className="grid gap-3 sm:grid-cols-2">
                  <FormField label="Generated Title"><Input value={generateTitle(session, formData.trainer_name)} disabled readOnly /></FormField>
                  <FormField label="Custom Title (Optional)">
                    <Input value={formData.custom_title} onChange={(event) => set('custom_title', event.target.value)} placeholder="Override the generated title..." />
                  </FormField>
                </div>
              </fieldset>

              <fieldset className="flex flex-col gap-3">
                <legend className="mb-1 text-sm font-semibold">Schedule &amp; details</legend>
                <div className="grid gap-3 sm:grid-cols-2">
                  <FormField label="Start Time"><Input type="datetime-local" required value={formData.start} onChange={(event) => set('start', event.target.value)} /></FormField>
                  <FormField label="End Time"><Input type="datetime-local" required value={formData.end} onChange={(event) => set('end', event.target.value)} /></FormField>
                  <FormField label="Duration"><Input value={`${durationHours(formData.start, formData.end)} hours`} disabled readOnly /></FormField>
                  <FormField label="Location">
                    <Input value={formData.location} onChange={(event) => set('location', event.target.value)} placeholder="Training location..." />
                  </FormField>
                  <FormField label="Trainer">
                    {(props) => (
                      <Select value={formData.trainer_id || NO_TRAINER} onValueChange={(value) => handleTrainerChange(value === NO_TRAINER ? '' : value)}>
                        <SelectTrigger {...props}><SelectValue /></SelectTrigger>
                        <SelectContent>
                          <SelectItem value={NO_TRAINER}>Select a trainer...</SelectItem>
                          {trainers.map((trainer) => (
                            <SelectItem key={trainer.id} value={trainer.id}>{trainer.name} {trainer.email && `(${trainer.email})`}</SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    )}
                  </FormField>
                  <FormField label="Session Color">
                    <input type="color" value={formData.color} onChange={(event) => set('color', event.target.value)} className="h-8 w-16 cursor-pointer rounded-md border border-input bg-background p-0.5" />
                  </FormField>
                </div>
                {selectedTrainer?.specializations?.length > 0 && (
                  <div className="flex flex-wrap items-center gap-1.5 text-sm">
                    <strong>{selectedTrainer.name}:</strong>
                    {selectedTrainer.specializations.map((specialization) => <Badge key={specialization}>{specialization}</Badge>)}
                  </div>
                )}
              </fieldset>

              <fieldset className="flex flex-col gap-2">
                <legend className="mb-1 text-sm font-semibold">Quick color palette</legend>
                <div className="flex flex-wrap gap-1.5">
                  {colorPalette.map((colorOption) => (
                    <button
                      key={colorOption.id}
                      type="button"
                      title={colorOption.name}
                      aria-label={colorOption.name}
                      aria-pressed={formData.color === colorOption.backgroundColor}
                      onClick={() => set('color', colorOption.backgroundColor)}
                      // The swatch colours come from the colour palette data
                      style={{ backgroundColor: colorOption.backgroundColor, borderColor: colorOption.borderColor }}
                      className="size-7 rounded border-2 aria-pressed:ring-2 aria-pressed:ring-ring aria-pressed:ring-offset-1"
                    />
                  ))}
                </div>
              </fieldset>

              <fieldset className="flex flex-col gap-3">
                <legend className="mb-1 text-sm font-semibold">Participants</legend>
                <div className="grid gap-3 sm:grid-cols-2">
                  <FormField label={maxFromCriteria ? `Max Participants (from criteria: ${criteria.max_attendees})` : 'Max Participants'}>
                    <Input type="number" min="1" value={formData.max_participants} onChange={(event) => set('max_participants', event.target.value)} placeholder={criteria?.max_attendees ? `Default: ${criteria.max_attendees}` : 'Max...'} />
                  </FormField>
                  <FormField label="Current Participants">
                    <Input type="number" min="0" value={formData.current_participants} onChange={(event) => set('current_participants', event.target.value)} />
                  </FormField>
                </div>
              </fieldset>
            </DialogBody>
            <DialogFooter className="sm:justify-between">
              <div>
                {onDelete && (
                  <Button type="button" variant="destructive" onClick={() => setConfirmDelete(true)} disabled={loading}><Trash2 /> Delete Session</Button>
                )}
              </div>
              <div className="flex gap-2">
                <Button type="button" onClick={onClose} disabled={loading}>Cancel</Button>
                <Button type="submit" variant="default" disabled={loading}>{loading ? 'Saving...' : 'Save Changes'}</Button>
              </div>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      <AlertDialog open={confirmDelete} onOpenChange={setConfirmDelete}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete this session?</AlertDialogTitle>
            <AlertDialogDescription>Are you sure you want to delete "{session.title}"? This action cannot be undone.</AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction destructive onClick={handleDelete}>Delete Session</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
};

export default SessionEditModal;
