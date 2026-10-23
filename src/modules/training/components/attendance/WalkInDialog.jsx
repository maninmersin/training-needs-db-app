import React, { useEffect, useMemo, useState } from 'react';
import { Loader2, Search } from 'lucide-react';
import {
  Button, Dialog, DialogBody, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, FormField, Input,
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue
} from '@/components/ui';
import { searchUserDirectory } from '../../services/userDirectoryService';
import { loadWalkInContext } from '../../services/walkInService';
import { addableWalkIns, defaultWalkInStatus, formatDateTime } from './trackerLogic';
import { CHOICE, availableChoices, buildWalkInPlan, findOtherBookings, targetSeats } from './walkInPlan';

/**
 * Record someone who turned up. Search the project's people and pick one; the dialog then checks their bookings
 * for this course and offers the right choices (assign them, move them from another session, or attendance only).
 * `onAdd({ person, status, notes, choice, plan })` does the saving and may reject with an Error, shown in the dialog.
 */
export default function WalkInDialog({ open, projectId, session, statuses, rows, onAdd, onClose }) {
  const [term, setTerm] = useState('');
  const [results, setResults] = useState([]);
  const [searching, setSearching] = useState(false);
  const [person, setPerson] = useState(null);
  const [bookings, setBookings] = useState({ loading: false, error: null, data: null });
  const [choice, setChoice] = useState(CHOICE.ATTENDANCE_ONLY);
  const [statusId, setStatusId] = useState('');
  const [notes, setNotes] = useState('');
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState(null);

  useEffect(() => {
    if (!open) return;
    setTerm('');
    setResults([]);
    setPerson(null);
    setNotes('');
    setError(null);
    setSaving(false);
    setStatusId(String(defaultWalkInStatus(statuses)?.id ?? ''));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open]);

  // Search as the person types, after a short pause
  useEffect(() => {
    if (!open || person) return undefined;
    let active = true;
    const timer = setTimeout(async () => {
      setSearching(true);
      try {
        const found = await searchUserDirectory(projectId, term);
        if (active) setResults(found);
      } catch (searchError) {
        if (active) setError(`Could not search: ${searchError.message}`);
      } finally {
        if (active) setSearching(false);
      }
    }, 250);
    return () => {
      active = false;
      clearTimeout(timer);
    };
  }, [term, open, person, projectId]);

  // Once someone is picked, look at their bookings on this course
  useEffect(() => {
    if (!person) {
      setBookings({ loading: false, error: null, data: null });
      return undefined;
    }
    let active = true;
    setBookings({ loading: true, error: null, data: null });
    loadWalkInContext({ session, endUserId: person.id })
      .then((data) => {
        if (!active) return;
        const other = findOtherBookings({ existingRows: data.existingRows, existingSessions: data.existingSessions, targetSession: session });
        const choices = availableChoices(other);
        setBookings({ loading: false, error: null, data: { ...data, other, choices, seats: targetSeats(data.targetParts, data.seatRows) } });
        setChoice(choices[0].value);
      })
      .catch((loadError) => {
        if (!active) return;
        setBookings({ loading: false, error: loadError.message, data: null });
        setChoice(CHOICE.ATTENDANCE_ONLY);
      });
    return () => {
      active = false;
    };
  }, [person, session]);

  const choices = useMemo(() => addableWalkIns(results, rows), [results, rows]);
  const alreadyListed = results.length - choices.length;
  const status = statuses.find((candidate) => String(candidate.id) === statusId);
  const data = bookings.data;
  const optionList = data ? data.choices : availableChoices([]).filter((option) => option.value === CHOICE.ATTENDANCE_ONLY);
  const changesBookings = choice !== CHOICE.ATTENDANCE_ONLY;
  const showFullWarning = Boolean(data?.seats?.isFull) && changesBookings;

  const submit = async (event) => {
    event.preventDefault();
    if (!person || !status || bookings.loading) return;
    setSaving(true);
    setError(null);
    try {
      const plan = data
        ? buildWalkInPlan({
            choice,
            session,
            targetParts: data.targetParts,
            person,
            schedule: { id: session.schedule_id, project_id: projectId },
            otherBookings: data.other,
            existingRows: data.existingRows
          })
        : buildWalkInPlan({ choice: CHOICE.ATTENDANCE_ONLY });
      await onAdd({ person, status, notes: notes.trim(), choice, plan });
    } catch (addError) {
      setError(addError.message || 'Could not add the person');
      setSaving(false);
    }
  };

  const bookingText = (booking) =>
    `${booking.courseName}, Group ${booking.sessionNumber} (${formatDateTime(booking.firstStart)}, ${booking.location})`;

  return (
    <Dialog open={open} onOpenChange={(next) => !next && !saving && onClose()}>
      <DialogContent>
        <form onSubmit={submit} className="flex min-h-0 flex-1 flex-col" noValidate>
          <DialogHeader>
            <DialogTitle>Add walk-in</DialogTitle>
            <DialogDescription>Record someone who turned up to this session but was not on its list.</DialogDescription>
          </DialogHeader>

          <DialogBody className="flex flex-col gap-4">
            {!person ? (
              <>
                <div className="relative">
                  <Search className="pointer-events-none absolute left-2.5 top-1/2 size-4 -translate-y-1/2 text-subtle-foreground" aria-hidden="true" />
                  <Input aria-label="Search people" placeholder="Search by name, email or ID..." value={term} onChange={(event) => setTerm(event.target.value)} className="pl-8" autoFocus />
                </div>
                <ul aria-label="People found" className="max-h-64 overflow-y-auto rounded-md border border-border">
                  {choices.map((candidate) => (
                    <li key={candidate.id} className="border-b border-border last:border-b-0">
                      <button type="button" onClick={() => setPerson(candidate)} className="flex w-full flex-col px-3 py-2 text-left text-sm hover:bg-accent focus-visible:outline-2 focus-visible:outline-ring">
                        <span className="font-medium">{candidate.name}</span>
                        <span className="text-xs text-muted-foreground">
                          {[candidate.email, candidate.project_role, candidate.training_location].filter(Boolean).join(' - ')}
                        </span>
                      </button>
                    </li>
                  ))}
                  {searching && <li className="flex items-center gap-2 px-3 py-2 text-sm text-muted-foreground"><Loader2 className="size-4 animate-spin" aria-hidden="true" /> Searching...</li>}
                  {!searching && choices.length === 0 && (
                    <li className="px-3 py-2 text-sm italic text-muted-foreground">
                      {term.trim().length < 2 ? 'Type at least two letters to search' : 'No one found'}
                    </li>
                  )}
                </ul>
                {alreadyListed > 0 && <p className="text-xs text-muted-foreground">{alreadyListed} already on this session's list (not shown)</p>}
              </>
            ) : (
              <>
                <div className="flex items-center gap-3 rounded-md border border-border bg-secondary px-3 py-2">
                  <div className="min-w-0 flex-1">
                    <div className="font-medium">{person.name}</div>
                    <div className="truncate text-xs text-muted-foreground">{[person.email, person.project_role, person.training_location].filter(Boolean).join(' - ')}</div>
                  </div>
                  <Button onClick={() => setPerson(null)} disabled={saving}>Change</Button>
                </div>

                {bookings.loading && (
                  <p role="status" className="flex items-center gap-2 text-sm text-muted-foreground"><Loader2 className="size-4 animate-spin" aria-hidden="true" /> Checking their bookings...</p>
                )}
                {bookings.error && (
                  <div role="alert" className="rounded-md bg-warning-soft px-3 py-2 text-sm text-warning">
                    Could not check their bookings ({bookings.error}). They can still be recorded as attendance only.
                  </div>
                )}
                {data && data.other.length > 0 && (
                  <div className="rounded-md bg-warning-soft px-3 py-2 text-sm text-warning">
                    {person.name} is booked on {data.other.map(bookingText).join(' and ')}.
                  </div>
                )}

                {!bookings.loading && (
                  <fieldset className="flex flex-col gap-2">
                    <legend className="mb-1 text-xs font-medium text-muted-foreground">What should happen to their bookings?</legend>
                    {optionList.map((option) => (
                      <label key={option.value} className="flex cursor-pointer items-start gap-2 rounded-md border border-border px-3 py-2 text-sm has-[:checked]:border-primary has-[:checked]:bg-primary-soft">
                        <input
                          type="radio"
                          name="walk-in-choice"
                          value={option.value}
                          checked={choice === option.value}
                          onChange={() => setChoice(option.value)}
                          disabled={saving}
                          className="mt-0.5 accent-[var(--primary)]"
                        />
                        <span>
                          <span className="font-medium">{option.label}</span>
                          <span className="block text-xs text-muted-foreground">{option.description}</span>
                        </span>
                      </label>
                    ))}
                  </fieldset>
                )}

                {showFullWarning && (
                  <div role="status" className="rounded-md bg-warning-soft px-3 py-2 text-sm text-warning">
                    This session is already full ({data.seats.seatsTaken} of {data.seats.maxAttendees} seats). They will be added anyway.
                  </div>
                )}

                <FormField label="Status">
                  {(fieldProps) => (
                    <Select value={statusId} onValueChange={setStatusId} disabled={saving}>
                      <SelectTrigger {...fieldProps}><SelectValue /></SelectTrigger>
                      <SelectContent>
                        {statuses.map((candidate) => (
                          <SelectItem key={candidate.id} value={String(candidate.id)}>{candidate.status_name}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  )}
                </FormField>
                <FormField label="Comments">
                  <Input value={notes} onChange={(event) => setNotes(event.target.value)} placeholder="Add notes about attendance..." disabled={saving} />
                </FormField>
              </>
            )}
            {error && <div role="alert" className="rounded-md bg-destructive-soft px-3 py-2 text-sm text-destructive">{error}</div>}
          </DialogBody>

          <DialogFooter>
            <Button onClick={onClose} disabled={saving}>Cancel</Button>
            <Button type="submit" variant="default" disabled={!person || !status || saving || bookings.loading}>
              {saving && <Loader2 className="animate-spin" aria-hidden="true" />}
              Add walk-in
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
