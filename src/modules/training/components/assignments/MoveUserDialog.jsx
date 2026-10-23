import React, { useEffect, useMemo, useState } from 'react';
import { fromLocalDateTime } from '@core/utils/dateTimeUtils';
import { loadMoveContext, saveMove } from '../../services/assignmentMoveService';
import { MOVE_SCOPE, findMoveOptions, buildMovePlan, resolveSource } from './moveUserAssignments';
import { cn } from '@/lib/utils';
import { Badge, Button, Dialog, DialogBody, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui';

const formatWhen = (value) => {
  if (!value) return '';
  const date = fromLocalDateTime(String(value));
  return date.toLocaleString('en-GB', { weekday: 'short', day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' });
};

const formatRange = (start, end) => {
  if (!start) return '';
  const first = formatWhen(start);
  const last = end ? formatWhen(end) : '';
  return last && last !== first ? `${first} - ${last}` : first;
};

/**
 * Move a person to another session of a course, or to another group (all their courses).
 * Opened from the person's right-click menu in the assignment screen.
 */
const MoveUserDialog = ({ isOpen, onClose, userInfo, sessionInfo, schedule, projectId, onMoved }) => {
  const source = useMemo(() => resolveSource(sessionInfo), [sessionInfo]);

  const [loading, setLoading] = useState(false);
  const [context, setContext] = useState(null);
  const [scope, setScope] = useState(MOVE_SCOPE.COURSE);
  const [selectedKey, setSelectedKey] = useState(null);
  const [confirmFull, setConfirmFull] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState(null);

  // Load fresh data from the database each time the dialog opens
  useEffect(() => {
    if (!isOpen || !userInfo || !schedule?.id) return undefined;
    let cancelled = false;
    setLoading(true);
    setError(null);
    setContext(null);
    setSelectedKey(null);
    setConfirmFull(false);
    setScope(source.courseId ? MOVE_SCOPE.COURSE : MOVE_SCOPE.GROUP);

    loadMoveContext({
      scheduleId: schedule.id,
      endUserId: userInfo.userId,
      location: source.location,
      functionalArea: source.functionalArea
    })
      .then((data) => { if (!cancelled) setContext(data); })
      .catch((err) => { if (!cancelled) setError(err.message || 'Could not load sessions'); })
      .finally(() => { if (!cancelled) setLoading(false); });

    return () => { cancelled = true; };
  }, [isOpen, userInfo?.userId, schedule?.id, source.location, source.functionalArea, source.courseId]);

  const options = useMemo(() => {
    if (!context) return [];
    return findMoveOptions({ ...context, source, scope });
  }, [context, source, scope]);

  const selected = options.find((o) => (o.key || `group-${o.sessionNumber}`) === selectedKey) || null;
  const selectedIsFull = Boolean(selected?.isFull);
  const canMove = Boolean(selected) && (selected.scope === MOVE_SCOPE.COURSE || selected.canMove) &&
    (!selectedIsFull || confirmFull) && !saving;

  const changeScope = (next) => {
    setScope(next);
    setSelectedKey(null);
    setConfirmFull(false);
    setError(null);
  };

  const handleMove = async () => {
    if (!canMove) return;
    setSaving(true);
    setError(null);
    try {
      const plan = buildMovePlan({
        option: selected,
        sessions: context.sessions,
        userRows: context.userRows,
        user: userInfo,
        schedule: { id: schedule.id, project_id: schedule.project_id || projectId },
        source
      });
      await saveMove(plan);
      if (onMoved) await onMoved(plan);
      onClose();
    } catch (err) {
      // The database undoes the whole move on any error, so the person is still where they were
      setError(`${err.message || 'The move failed'}. Nothing was changed.`);
    } finally {
      setSaving(false);
    }
  };

  if (!isOpen) return null;

  const personName = userInfo?.name || `User ${userInfo?.userId}`;
  const currentLabel = scope === MOVE_SCOPE.COURSE && source.courseName
    ? `${source.courseName}, Group ${source.sessionNumber}`
    : `Group ${source.sessionNumber}`;

  const radio = 'size-4 accent-primary';

  return (
    <Dialog open onOpenChange={(open) => !open && !saving && onClose()}>
      <DialogContent className="max-w-xl" aria-label={`Move ${personName}`}>
        <DialogHeader>
          <DialogTitle>Move {personName}</DialogTitle>
          <DialogDescription>
            Currently in <strong>{currentLabel}</strong> at {source.location}
            {source.functionalArea ? ` (${source.functionalArea})` : ''}
          </DialogDescription>
        </DialogHeader>

        <DialogBody className="flex flex-col gap-4">
          <div className="flex flex-col gap-2" role="radiogroup" aria-label="What to move">
            <label className="flex cursor-pointer items-center gap-2 text-sm">
              <input type="radio" name="move-scope" className={radio} checked={scope === MOVE_SCOPE.COURSE} disabled={!source.courseId} onChange={() => changeScope(MOVE_SCOPE.COURSE)} />
              This course only{source.courseName ? ` (${source.courseName})` : ''}
            </label>
            <label className="flex cursor-pointer items-center gap-2 text-sm">
              <input type="radio" name="move-scope" className={radio} checked={scope === MOVE_SCOPE.GROUP} onChange={() => changeScope(MOVE_SCOPE.GROUP)} />
              Whole group (all their courses in Group {source.sessionNumber})
            </label>
          </div>

          {loading && <p className="text-sm text-muted-foreground" role="status">Loading sessions...</p>}

          {!loading && context && options.length === 0 && (
            <p className="rounded-md bg-muted px-3 py-2 text-sm text-muted-foreground">
              {scope === MOVE_SCOPE.COURSE
                ? 'There is no other session of this course at this location to move to.'
                : 'There is no other group at this location to move to.'}
            </p>
          )}

          {!loading && options.length > 0 && (
            <ul className="flex max-h-72 flex-col gap-1.5 overflow-y-auto">
              {options.map((option) => {
                const key = option.key || `group-${option.sessionNumber}`;
                const disabled = option.scope === MOVE_SCOPE.GROUP && !option.canMove;
                return (
                  <li key={key} className={cn('rounded-md border border-border', selectedKey === key && 'border-primary bg-selected', disabled && 'opacity-60')}>
                    <label className={cn('flex items-start gap-2 px-3 py-2', disabled ? 'cursor-not-allowed' : 'cursor-pointer')}>
                      <input
                        type="radio" name="move-option" className={cn(radio, 'mt-0.5')} checked={selectedKey === key} disabled={disabled}
                        onChange={() => { setSelectedKey(key); setConfirmFull(false); }}
                      />
                      <span className="flex min-w-0 flex-1 flex-col gap-0.5 text-sm">
                        <span className="flex items-center gap-2 font-medium">
                          Group {option.sessionNumber}
                          {option.isFull && <Badge variant="danger">FULL</Badge>}
                        </span>
                        <span className="text-muted-foreground">{formatRange(option.firstStart, option.lastEnd)}</span>

                        {option.scope === MOVE_SCOPE.COURSE && (
                          <span className="text-xs text-muted-foreground">
                            Classroom {option.classroomNumber}
                            {option.trainer ? ` · ${option.trainer}` : ''}
                            {` · ${option.seatsTaken}/${option.maxAttendees} seats taken`}
                          </span>
                        )}

                        {option.scope === MOVE_SCOPE.GROUP && (
                          <>
                            {option.courses.map((c) => (
                              <span key={c.courseId} className="flex items-center gap-1.5 text-xs text-muted-foreground">
                                {c.courseName} · {c.seatsTaken}/{c.maxAttendees} seats taken
                                {c.isFull && <Badge variant="danger">FULL</Badge>}
                              </span>
                            ))}
                            {option.missingCourses.length > 0 && (
                              <span className="text-xs text-warning">
                                Not available: this group has no session for {option.missingCourses.map((c) => c.courseName).join(', ')}
                              </span>
                            )}
                          </>
                        )}
                      </span>
                    </label>
                  </li>
                );
              })}
            </ul>
          )}

          {selectedIsFull && (
            <div className="flex flex-col gap-2 rounded-md bg-warning-soft px-3 py-2 text-sm text-warning">
              <p><strong>This session is already full.</strong> Moving {personName} there goes over the planned number of seats.</p>
              <label className="flex cursor-pointer items-center gap-2">
                <input type="checkbox" className={radio} checked={confirmFull} onChange={(e) => setConfirmFull(e.target.checked)} />
                Move anyway
              </label>
            </div>
          )}

          {error && <div role="alert" className="rounded-md bg-destructive-soft px-3 py-2 text-sm text-destructive">{error}</div>}
        </DialogBody>

        <DialogFooter>
          <Button onClick={onClose} disabled={saving}>Cancel</Button>
          <Button variant="default" onClick={handleMove} disabled={!canMove}>{saving ? 'Moving...' : 'Move'}</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};

export default MoveUserDialog;
