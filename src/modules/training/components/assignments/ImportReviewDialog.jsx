import React, { useEffect, useMemo, useState } from 'react';
import { saveAs } from 'file-saver';
import { parseReviewRows, outcomesToCsv } from './reviewSheet';
import { readReviewWorkbook, checkReviewInfo } from './reviewWorkbook';
import { previewReviewImport, applyReviewImport } from '../../services/assignmentReviewService';
import './ImportReviewDialog.css';

const STATUS_LABEL = {
  ok: 'Will move',
  warning: 'Will move (over capacity)',
  blocked: 'Held back: group is full',
  error: 'Cannot apply',
  skipped: 'No change'
};

const plural = (n, one, many) => `${n} ${n === 1 ? one : many}`;

/**
 * Import a stakeholder review sheet. Three steps: choose the file, check what it would do (nothing is
 * changed yet), then apply. Rows that can't be applied are explained and skipped; the rest are applied,
 * each one all-or-nothing.
 */
const ImportReviewDialog = ({ isOpen, onClose, schedule, projectId, filters, onApplied }) => {
  const [fileName, setFileName] = useState('');
  const [items, setItems] = useState(null);       // rows read from the file
  const [preview, setPreview] = useState(null);   // { results, summary }
  const [allowFull, setAllowFull] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState(null);
  const [outcome, setOutcome] = useState(null);   // { outcomes, summary } after applying

  const reset = () => {
    setFileName(''); setItems(null); setPreview(null); setAllowFull(false);
    setBusy(false); setError(null); setOutcome(null);
  };

  // Start clean every time the dialog is opened
  useEffect(() => { if (isOpen) reset(); }, [isOpen]);

  // Plan (without changing anything) whenever the file or the "allow full" choice changes
  useEffect(() => {
    if (!items) return undefined;
    let cancelled = false;
    setBusy(true);
    setError(null);
    previewReviewImport({ items, schedule, projectId, allowFull, filters })
      .then((planned) => { if (!cancelled) setPreview(planned); })
      .catch((err) => { if (!cancelled) setError(`Could not check the file against the schedule: ${err.message}`); })
      .finally(() => { if (!cancelled) setBusy(false); });
    return () => { cancelled = true; };
  }, [items, allowFull, schedule?.id, projectId]);

  const handleFile = async (event) => {
    const file = event.target.files && event.target.files[0];
    if (!file) return;
    reset();
    setFileName(file.name);
    try {
      const { rows, info } = readReviewWorkbook(await file.arrayBuffer());
      const infoProblem = checkReviewInfo(info, schedule);
      if (infoProblem) throw new Error(infoProblem);

      const parsed = parseReviewRows(rows);
      if (parsed.missingColumns.length > 0) {
        throw new Error(`The file is missing these columns: ${parsed.missingColumns.join(', ')}. Use a file exported from this screen.`);
      }
      if (parsed.items.length === 0) throw new Error('The file has no rows.');
      setItems(parsed.items);
    } catch (err) {
      setError(err.message || 'Could not read that file.');
      setFileName('');
    }
  };

  const movable = useMemo(
    () => (preview ? preview.results.filter((r) => r.plan).length : 0),
    [preview]
  );

  const handleApply = async () => {
    setBusy(true);
    setError(null);
    try {
      const applied = await applyReviewImport({ items, schedule, projectId, allowFull, filters });
      setOutcome(applied);
      if (onApplied) await onApplied(applied);
    } catch (err) {
      setError(`The import could not be completed: ${err.message}`);
    } finally {
      setBusy(false);
    }
  };

  const downloadReport = () => {
    const blob = new Blob([outcomesToCsv(outcome.outcomes)], { type: 'text/csv;charset=utf-8;' });
    saveAs(blob, `import_report_${new Date().toISOString().slice(0, 10)}.csv`);
  };

  if (!isOpen) return null;

  const summary = preview?.summary;

  return (
    <div className="import-review-overlay" onClick={busy ? undefined : onClose}>
      <div className="import-review-dialog" onClick={(e) => e.stopPropagation()} role="dialog" aria-label="Import review sheet">
        <div className="import-review-header">
          <h3>Import review sheet</h3>
          <button className="import-review-close" onClick={onClose} disabled={busy} aria-label="Close">×</button>
        </div>

        {!outcome && (
          <>
            <p className="import-review-help">
              Choose the Excel file that came back from the reviewer (or a CSV saved from it). Nothing is changed
              until you press Apply, and you will see exactly what would happen first.
            </p>

            <div className="import-review-file">
              <input type="file" accept=".xlsx,.xls,.csv" onChange={handleFile} disabled={busy} aria-label="Review file" />
              {fileName && <span className="import-review-filename">{fileName}</span>}
            </div>
          </>
        )}

        {error && <div className="import-review-error">{error}</div>}
        {busy && !outcome && <p className="import-review-note">Checking...</p>}

        {preview && !outcome && (
          <>
            <div className="import-review-summary">
              <span className="chip ok">{plural(summary.ok + summary.warning, 'move ready', 'moves ready')}</span>
              {summary.warning > 0 && <span className="chip warning">{plural(summary.warning, 'over capacity', 'over capacity')}</span>}
              {summary.blocked > 0 && <span className="chip blocked">{plural(summary.blocked, 'held back (full)', 'held back (full)')}</span>}
              {summary.error > 0 && <span className="chip error">{plural(summary.error, 'cannot be applied', 'cannot be applied')}</span>}
              {summary.skipped > 0 && <span className="chip neutral">{plural(summary.skipped, 'no change', 'no change')}</span>}
              <span className="chip neutral">{plural(summary.unchanged, 'row left blank', 'rows left blank')}</span>
            </div>

            {(summary.blocked > 0 || allowFull) && (
              <label className="import-review-allow">
                <input type="checkbox" checked={allowFull} onChange={(e) => setAllowFull(e.target.checked)} disabled={busy} />
                Allow moves into full sessions
              </label>
            )}

            {preview.results.length === 0 ? (
              <p className="import-review-note">No rows have a group filled in under "Move To Group", so there is nothing to apply.</p>
            ) : (
              <div className="import-review-table-wrap">
                <table className="import-review-table">
                  <thead>
                    <tr><th>Row</th><th>Person</th><th>Course</th><th>Move</th><th>Result</th></tr>
                  </thead>
                  <tbody>
                    {preview.results.map((r) => (
                      <tr key={r.rowNumber} className={`status-${r.status}`}>
                        <td>{r.rowNumber}</td>
                        <td>{r.person}</td>
                        <td>{r.course}</td>
                        <td>Group {r.fromGroup} → {r.toGroup === null ? '?' : `Group ${r.toGroup}`}</td>
                        <td>
                          <span className={`badge ${r.status}`}>{STATUS_LABEL[r.status]}</span>
                          <div className="message">{r.message}</div>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </>
        )}

        {outcome && (
          <>
            <div className="import-review-summary">
              <span className="chip ok">{plural(outcome.summary.applied, 'move applied', 'moves applied')}</span>
              {outcome.summary.failed > 0 && <span className="chip error">{plural(outcome.summary.failed, 'failed', 'failed')}</span>}
              {outcome.summary.notApplied > 0 && <span className="chip neutral">{plural(outcome.summary.notApplied, 'not applied', 'not applied')}</span>}
            </div>
            {outcome.outcomes.some((o) => !o.applied) ? (
              <div className="import-review-table-wrap">
                <table className="import-review-table">
                  <thead><tr><th>Row</th><th>Person</th><th>Course</th><th>Why it was not applied</th></tr></thead>
                  <tbody>
                    {outcome.outcomes.filter((o) => !o.applied).map((o) => (
                      <tr key={o.rowNumber} className="status-error">
                        <td>{o.rowNumber}</td><td>{o.person}</td><td>{o.course}</td><td>{o.message}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            ) : (
              <p className="import-review-note">Every move was applied.</p>
            )}
          </>
        )}

        <div className="import-review-actions">
          {outcome ? (
            <>
              <button onClick={downloadReport}>Download report (CSV)</button>
              <button className="primary" onClick={onClose}>Close</button>
            </>
          ) : (
            <>
              <button onClick={onClose} disabled={busy}>Cancel</button>
              <button className="primary" onClick={handleApply} disabled={busy || !preview || movable === 0}>
                {busy && preview ? 'Applying...' : `Apply ${plural(movable, 'move', 'moves')}`}
              </button>
            </>
          )}
        </div>
      </div>
    </div>
  );
};

export default ImportReviewDialog;
