import React, { useEffect, useMemo, useState } from 'react';
import { saveAs } from 'file-saver';
import { parseReviewRows, outcomesToCsv } from './reviewSheet';
import { readReviewWorkbook, checkReviewInfo } from './reviewWorkbook';
import { previewReviewImport, applyReviewImport } from '../../services/assignmentReviewService';
import { Badge, Button, Dialog, DialogBody, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui';

const STATUS_LABEL = {
  ok: 'Will move',
  warning: 'Will move (over capacity)',
  blocked: 'Held back: group is full',
  error: 'Cannot apply',
  skipped: 'No change'
};

const STATUS_VARIANT = { ok: 'success', warning: 'warning', blocked: 'warning', error: 'danger', skipped: 'neutral' };
const TH = 'h-8 px-3 text-left font-semibold';
const TD = 'px-3 py-1.5';

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
    <Dialog open onOpenChange={(open) => !open && !busy && onClose()}>
      <DialogContent className="max-w-4xl" aria-label="Import review sheet">
        <DialogHeader>
          <DialogTitle>Import review sheet</DialogTitle>
          <DialogDescription>
            Choose the Excel file that came back from the reviewer (or a CSV saved from it). Nothing is changed
            until you press Apply, and you will see exactly what would happen first.
          </DialogDescription>
        </DialogHeader>

        <DialogBody className="flex flex-col gap-4">
          {!outcome && (
            <div className="flex flex-wrap items-center gap-3">
              <input
                type="file"
                accept=".xlsx,.xls,.csv"
                onChange={handleFile}
                disabled={busy}
                aria-label="Review file"
                className="text-sm file:mr-3 file:h-8 file:cursor-pointer file:rounded-md file:border file:border-border-strong file:bg-card file:px-3 file:text-sm file:font-medium hover:file:bg-accent"
              />
              {fileName && <span className="text-sm text-muted-foreground">{fileName}</span>}
            </div>
          )}

          {error && <div role="alert" className="rounded-md bg-destructive-soft px-3 py-2 text-sm text-destructive">{error}</div>}
          {busy && !outcome && <p className="text-sm text-muted-foreground" role="status">Checking...</p>}

          {preview && !outcome && (
            <>
              <div className="flex flex-wrap gap-1.5">
                <Badge variant="success">{plural(summary.ok + summary.warning, 'move ready', 'moves ready')}</Badge>
                {summary.warning > 0 && <Badge variant="warning">{plural(summary.warning, 'over capacity', 'over capacity')}</Badge>}
                {summary.blocked > 0 && <Badge variant="warning">{plural(summary.blocked, 'held back (full)', 'held back (full)')}</Badge>}
                {summary.error > 0 && <Badge variant="danger">{plural(summary.error, 'cannot be applied', 'cannot be applied')}</Badge>}
                {summary.skipped > 0 && <Badge>{plural(summary.skipped, 'no change', 'no change')}</Badge>}
                <Badge>{plural(summary.unchanged, 'row left blank', 'rows left blank')}</Badge>
              </div>

              {(summary.blocked > 0 || allowFull) && (
                <label className="flex cursor-pointer items-center gap-2 text-sm">
                  <input type="checkbox" className="size-4 accent-primary" checked={allowFull} onChange={(e) => setAllowFull(e.target.checked)} disabled={busy} />
                  Allow moves into full sessions
                </label>
              )}

              {preview.results.length === 0 ? (
                <p className="rounded-md bg-muted px-3 py-2 text-sm text-muted-foreground">No rows have a group filled in under "Move To Group", so there is nothing to apply.</p>
              ) : (
                <div className="max-h-96 overflow-auto rounded-md border border-border">
                  <table className="w-full border-collapse text-sm">
                    <thead className="sticky top-0 bg-secondary text-xs text-muted-foreground">
                      <tr><th className={TH}>Row</th><th className={TH}>Person</th><th className={TH}>Course</th><th className={TH}>Move</th><th className={TH}>Result</th></tr>
                    </thead>
                    <tbody>
                      {preview.results.map((r) => (
                        <tr key={r.rowNumber} className="border-t border-border align-top">
                          <td className={TD}>{r.rowNumber}</td>
                          <td className={TD}>{r.person}</td>
                          <td className={TD}>{r.course}</td>
                          <td className={TD}>Group {r.fromGroup} → {r.toGroup === null ? '?' : `Group ${r.toGroup}`}</td>
                          <td className={TD}>
                            <Badge variant={STATUS_VARIANT[r.status]}>{STATUS_LABEL[r.status]}</Badge>
                            <div className="mt-1 text-xs text-muted-foreground">{r.message}</div>
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
              <div className="flex flex-wrap gap-1.5">
                <Badge variant="success">{plural(outcome.summary.applied, 'move applied', 'moves applied')}</Badge>
                {outcome.summary.failed > 0 && <Badge variant="danger">{plural(outcome.summary.failed, 'failed', 'failed')}</Badge>}
                {outcome.summary.notApplied > 0 && <Badge>{plural(outcome.summary.notApplied, 'not applied', 'not applied')}</Badge>}
              </div>
              {outcome.outcomes.some((o) => !o.applied) ? (
                <div className="max-h-96 overflow-auto rounded-md border border-border">
                  <table className="w-full border-collapse text-sm">
                    <thead className="sticky top-0 bg-secondary text-xs text-muted-foreground">
                      <tr><th className={TH}>Row</th><th className={TH}>Person</th><th className={TH}>Course</th><th className={TH}>Why it was not applied</th></tr>
                    </thead>
                    <tbody>
                      {outcome.outcomes.filter((o) => !o.applied).map((o) => (
                        <tr key={o.rowNumber} className="border-t border-border align-top">
                          <td className={TD}>{o.rowNumber}</td><td className={TD}>{o.person}</td><td className={TD}>{o.course}</td><td className={TD}>{o.message}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              ) : (
                <p className="rounded-md bg-success-soft px-3 py-2 text-sm text-success">Every move was applied.</p>
              )}
            </>
          )}
        </DialogBody>

        <DialogFooter>
          {outcome ? (
            <>
              <Button onClick={downloadReport}>Download report (CSV)</Button>
              <Button variant="default" onClick={onClose}>Close</Button>
            </>
          ) : (
            <>
              <Button onClick={onClose} disabled={busy}>Cancel</Button>
              <Button variant="default" onClick={handleApply} disabled={busy || !preview || movable === 0}>
                {busy && preview ? 'Applying...' : `Apply ${plural(movable, 'move', 'moves')}`}
              </Button>
            </>
          )}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};

export default ImportReviewDialog;
