import React, { useEffect, useState } from 'react';
import { Loader2, Search } from 'lucide-react';
import {
  Button, Dialog, DialogBody, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, FormField, Input,
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue
} from '@/components/ui';
import { searchUserDirectory } from '../../services/userDirectoryService';
import { addableWalkIns, defaultWalkInStatus } from './trackerLogic';

/**
 * Record someone who turned up but was not assigned to the session. Search the project's people, pick one,
 * choose a status and add an optional note. `onAdd({ person, status, notes })` does the saving and may reject
 * with an Error, which is shown in the dialog.
 */
export default function WalkInDialog({ open, projectId, statuses, rows, onAdd, onClose }) {
  const [term, setTerm] = useState('');
  const [results, setResults] = useState([]);
  const [searching, setSearching] = useState(false);
  const [person, setPerson] = useState(null);
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

  const choices = addableWalkIns(results, rows);
  const alreadyListed = results.length - choices.length;
  const status = statuses.find((candidate) => String(candidate.id) === statusId);

  const submit = async (event) => {
    event.preventDefault();
    if (!person || !status) return;
    setSaving(true);
    setError(null);
    try {
      await onAdd({ person, status, notes: notes.trim() });
    } catch (addError) {
      setError(addError.message || 'Could not add the person');
      setSaving(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={(next) => !next && !saving && onClose()}>
      <DialogContent>
        <form onSubmit={submit} className="flex min-h-0 flex-1 flex-col" noValidate>
          <DialogHeader>
            <DialogTitle>Add walk-in</DialogTitle>
            <DialogDescription>Record someone who attended but was not assigned to this session. They are not added to the session's assignments.</DialogDescription>
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
            <Button type="submit" variant="default" disabled={!person || !status || saving}>
              {saving && <Loader2 className="animate-spin" aria-hidden="true" />}
              Add walk-in
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
