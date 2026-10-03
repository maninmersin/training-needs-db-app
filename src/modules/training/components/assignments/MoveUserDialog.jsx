import React, { useEffect, useMemo, useState } from 'react';
import { fromLocalDateTime } from '@core/utils/dateTimeUtils';
import { loadMoveContext, saveMove } from '../../services/assignmentMoveService';
import { MOVE_SCOPE, findMoveOptions, buildMovePlan, resolveSource } from './moveUserAssignments';
import './MoveUserDialog.css';

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

  return (
    <div className="move-user-overlay" onClick={onClose}>
      <div className="move-user-dialog" onClick={(e) => e.stopPropagation()} role="dialog" aria-label={`Move ${personName}`}>
        <div className="move-user-header">
          <h3>Move {personName}</h3>
          <button className="move-user-close" onClick={onClose} aria-label="Close">×</button>
        </div>

        <p className="move-user-current">
          Currently in <strong>{currentLabel}</strong> at {source.location}
          {source.functionalArea ? ` (${source.functionalArea})` : ''}
        </p>

        <div className="move-user-scope" role="radiogroup" aria-label="What to move">
          <label className={scope === MOVE_SCOPE.COURSE ? 'active' : ''}>
            <input
              type="radio" name="move-scope" checked={scope === MOVE_SCOPE.COURSE}
              disabled={!source.courseId} onChange={() => changeScope(MOVE_SCOPE.COURSE)}
            />
            This course only{source.courseName ? ` (${source.courseName})` : ''}
          </label>
          <label className={scope === MOVE_SCOPE.GROUP ? 'active' : ''}>
            <input
              type="radio" name="move-scope" checked={scope === MOVE_SCOPE.GROUP}
              onChange={() => changeScope(MOVE_SCOPE.GROUP)}
            />
            Whole group (all their courses in Group {source.sessionNumber})
          </label>
        </div>

        {loading && <p className="move-user-note">Loading sessions...</p>}

        {!loading && context && options.length === 0 && (
          <p className="move-user-note">
            {scope === MOVE_SCOPE.COURSE
              ? 'There is no other session of this course at this location to move to.'
              : 'There is no other group at this location to move to.'}
          </p>
        )}

        {!loading && options.length > 0 && (
          <ul className="move-user-options">
            {options.map((option) => {
              const key = option.key || `group-${option.sessionNumber}`;
              const disabled = option.scope === MOVE_SCOPE.GROUP && !option.canMove;
              return (
                <li key={key} className={`${selectedKey === key ? 'selected' : ''}${disabled ? ' disabled' : ''}`}>
                  <label>
                    <input
                      type="radio" name="move-option" checked={selectedKey === key} disabled={disabled}
                      onChange={() => { setSelectedKey(key); setConfirmFull(false); }}
                    />
                    <span className="move-user-option-main">
                      <span className="move-user-option-title">
                        Group {option.sessionNumber}
                        {option.isFull && <span className="move-user-badge full">FULL</span>}
                      </span>
                      <span className="move-user-option-when">{formatRange(option.firstStart, option.lastEnd)}</span>

                      {option.scope === MOVE_SCOPE.COURSE && (
                        <span className="move-user-option-meta">
                          Classroom {option.classroomNumber}
                          {option.trainer ? ` · ${option.trainer}` : ''}
                          {` · ${option.seatsTaken}/${option.maxAttendees} seats taken`}
                        </span>
                      )}

                      {option.scope === MOVE_SCOPE.GROUP && (
                        <>
                          {option.courses.map((c) => (
                            <span key={c.courseId} className="move-user-option-meta">
                              {c.courseName} · {c.seatsTaken}/{c.maxAttendees} seats taken
                              {c.isFull && <span className="move-user-badge full">FULL</span>}
                            </span>
                          ))}
                          {option.missingCourses.length > 0 && (
                            <span className="move-user-option-meta unavailable">
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
          <div className="move-user-warning">
            <strong>This session is already full.</strong> Moving {personName} there goes over the planned number of seats.
            <label>
              <input type="checkbox" checked={confirmFull} onChange={(e) => setConfirmFull(e.target.checked)} />
              Move anyway
            </label>
          </div>
        )}

        {error && <div className="move-user-error">{error}</div>}

        <div className="move-user-actions">
          <button className="move-user-cancel" onClick={onClose} disabled={saving}>Cancel</button>
          <button className="move-user-confirm" onClick={handleMove} disabled={!canMove}>
            {saving ? 'Moving...' : 'Move'}
          </button>
        </div>
      </div>
    </div>
  );
};

export default MoveUserDialog;
