import React, { useEffect, useMemo, useState } from 'react';
import { Download, FileSpreadsheet, Loader2 } from 'lucide-react';
import {
  Badge, Button, Checkbox, DataTable, Dialog, DialogBody, DialogContent, DialogDescription, DialogFooter, DialogHeader,
  DialogTitle, EmptyState, FileDrop, ImportStepper, StatCard, Tabs, TabsList, TabsTrigger
} from '@/components/ui';
import { readTableFile } from './tableFile';
import { STATUS, willApply } from './planning';
import { REPORT_HEADERS, downloadTable, downloadTemplate, reportRows } from './exportFiles';

const STEPS = { upload: 0, check: 1, result: 2 };

const RESULT_BADGE = {
  [STATUS.OK]: { label: 'Ready', variant: 'success' },
  [STATUS.WARNING]: { label: 'Needs a look', variant: 'warning' },
  [STATUS.BLOCKED]: { label: 'Held back', variant: 'warning' },
  [STATUS.ERROR]: { label: 'Cannot import', variant: 'danger' },
  [STATUS.UNCHANGED]: { label: 'No change', variant: 'neutral' }
};

const defaultOptions = (adapter) => Object.fromEntries((adapter?.options || []).map((option) => [option.key, option.default]));
const plural = (count, word) => `${count} ${word}${count === 1 ? '' : 's'}`;

/**
 * Upload > Check > Apply for any importer (see adapters.js). Nothing is saved until Apply; Apply checks the
 * file again against the live data, saves what is ready, and leaves out rows with problems.
 */
export default function ImportWizard({ open, adapter, db, projectId, onClose, onApplied }) {
  const [step, setStep] = useState('upload');
  const [fileName, setFileName] = useState('');
  const [table, setTable] = useState(null);
  const [context, setContext] = useState(null);
  const [options, setOptions] = useState({});
  const [plan, setPlan] = useState(null);
  const [filter, setFilter] = useState('problems');
  const [busy, setBusy] = useState(false);
  const [progress, setProgress] = useState(null);
  const [error, setError] = useState(null);
  const [result, setResult] = useState(null);

  useEffect(() => {
    if (!open || !adapter) return;
    setStep('upload');
    setFileName('');
    setTable(null);
    setContext(null);
    setPlan(null);
    setResult(null);
    setError(null);
    setBusy(false);
    setProgress(null);
    setOptions(defaultOptions(adapter));
  }, [open, adapter]);

  const items = useMemo(() => plan?.items || [], [plan]);
  const counts = useMemo(() => {
    const problems = items.filter((i) => i.status === STATUS.ERROR || i.status === STATUS.BLOCKED || i.status === STATUS.WARNING).length;
    const changes = items.filter(willApply).length;
    return { all: items.length, problems, change: changes, unchanged: items.filter((i) => i.status === STATUS.UNCHANGED).length };
  }, [items]);
  const leftOut = items.filter((i) => i.status === STATUS.ERROR || i.status === STATUS.BLOCKED).length;

  const shown = useMemo(() => {
    if (filter === 'problems') return items.filter((i) => i.status === STATUS.ERROR || i.status === STATUS.BLOCKED || i.status === STATUS.WARNING);
    if (filter === 'change') return items.filter(willApply);
    if (filter === 'unchanged') return items.filter((i) => i.status === STATUS.UNCHANGED);
    return items;
  }, [items, filter]);

  const handleFile = async (file) => {
    setBusy(true);
    setError(null);
    try {
      const read = await readTableFile(file);
      if (read.headers.length === 0) throw new Error('The file is empty - there is no header row');
      const loaded = await adapter.load(db, projectId, read);
      const planned = adapter.plan(read, loaded, options);
      setFileName(file.name);
      setTable(read);
      setContext(loaded);
      setPlan(planned);
      setFilter(planned.items.some((i) => i.status !== STATUS.OK && i.status !== STATUS.UNCHANGED) ? 'problems' : 'change');
      setStep('check');
    } catch (readError) {
      setError(readError.message);
    } finally {
      setBusy(false);
    }
  };

  const changeOption = (key, value) => {
    const next = { ...options, [key]: value };
    setOptions(next);
    if (table && context) setPlan(adapter.plan(table, context, next));
  };

  const apply = async () => {
    setBusy(true);
    setError(null);
    const expected = counts.change;
    try {
      // Re-read the live data so a file checked a while ago can never write on stale information
      const fresh = await adapter.load(db, projectId, table);
      const freshPlan = adapter.plan(table, fresh, options);
      const todo = freshPlan.items.filter(willApply).length;
      setProgress({ done: 0, total: todo });
      const run = await adapter.apply(freshPlan.items, { db, projectId }, (done, total) => setProgress({ done, total }));
      setResult({ ...run, items: freshPlan.items, changedSincePreview: todo !== expected });
      setStep('result');
      if (onApplied) onApplied();
    } catch (applyError) {
      setError(`Could not apply the import: ${applyError.message}`);
    } finally {
      setBusy(false);
      setProgress(null);
    }
  };

  const close = () => {
    if (!busy) onClose();
  };

  const columns = useMemo(
    () => [
      { accessorKey: 'rowNumber', header: 'Row', meta: { className: 'tabular-nums text-subtle-foreground' } },
      { accessorKey: 'label', header: 'Name', meta: { className: 'font-medium' } },
      { accessorKey: 'action', header: 'Action' },
      {
        id: 'status',
        header: 'Result',
        accessorFn: (item) => RESULT_BADGE[item.status].label,
        cell: ({ row }) => <Badge variant={RESULT_BADGE[row.original.status].variant}>{RESULT_BADGE[row.original.status].label}</Badge>
      },
      { accessorKey: 'message', header: 'Detail', meta: { className: 'min-w-72 max-w-xl whitespace-normal py-1 text-muted-foreground' } }
    ],
    []
  );

  const failures = result ? result.outcomes.filter((outcome) => !outcome.ok) : [];
  const failureColumns = useMemo(
    () => [
      { id: 'row', header: 'Row', accessorFn: (outcome) => outcome.item.rowNumber, meta: { className: 'tabular-nums text-subtle-foreground' } },
      { id: 'name', header: 'Name', accessorFn: (outcome) => outcome.item.label, meta: { className: 'font-medium' } },
      { accessorKey: 'message', header: 'What went wrong', meta: { className: 'min-w-72 max-w-xl whitespace-normal py-1' } }
    ],
    []
  );

  if (!adapter) return null;

  const downloadReport = () => {
    const problemItems = result ? result.items : items.filter((i) => i.status !== STATUS.OK && i.status !== STATUS.UNCHANGED);
    downloadTable(`${adapter.key}_import_report`, REPORT_HEADERS, reportRows(problemItems, result?.outcomes), 'csv');
  };

  return (
    <Dialog open={open} onOpenChange={(next) => !next && close()}>
      <DialogContent className="max-w-5xl">
        <DialogHeader>
          <DialogTitle>{adapter.title}</DialogTitle>
          <DialogDescription>Nothing is saved until you press Apply.</DialogDescription>
          <ImportStepper current={STEPS[step]} className="pt-2" />
        </DialogHeader>

        <DialogBody className="flex flex-col gap-4">
          {error && <div role="alert" className="rounded-md bg-destructive-soft px-3 py-2 text-sm text-destructive">{error}</div>}

          {step === 'upload' && (
            <>
              <FileDrop onFile={handleFile} label="Choose a file" hint=".xlsx or .csv" disabled={busy} />
              {busy && (
                <div role="status" className="flex items-center justify-center gap-2 text-sm text-muted-foreground">
                  <Loader2 className="size-4 animate-spin" aria-hidden="true" /> Reading and checking the file...
                </div>
              )}
              <div className="flex flex-col gap-2 rounded-lg border border-border bg-card p-4 text-sm">
                <h3 className="font-semibold">What the file should look like</h3>
                <ul className="list-disc space-y-1 pl-5 text-muted-foreground">
                  {adapter.help.map((line) => (
                    <li key={line}>{line}</li>
                  ))}
                </ul>
                <div className="flex gap-2 pt-1">
                  <Button onClick={() => downloadTemplate(adapter.templateKey, 'xlsx')}><Download /> Download template (Excel)</Button>
                  <Button variant="ghost" onClick={() => downloadTemplate(adapter.templateKey, 'csv')}>CSV</Button>
                </div>
              </div>
            </>
          )}

          {step === 'check' && plan && (
            <>
              <div className="flex items-center gap-3 rounded-lg border border-border bg-card px-3.5 py-2.5">
                <FileSpreadsheet className="size-5 text-success" aria-hidden="true" />
                <div className="min-w-0 flex-1">
                  <div className="truncate font-medium">{fileName}</div>
                  <div className="text-xs text-subtle-foreground">{plural(table.rows.length, 'row')} read</div>
                </div>
                <Button onClick={() => { setStep('upload'); setPlan(null); setError(null); }} disabled={busy}>Choose a different file</Button>
              </div>

              {plan.fileProblems.length > 0 && (
                <div role="alert" className="rounded-md bg-destructive-soft px-3 py-2 text-sm text-destructive">
                  {plan.fileProblems.map((problem) => (<p key={problem}>{problem}</p>))}
                </div>
              )}
              {plan.ignoredColumns.length > 0 && (
                <p className="text-sm text-muted-foreground">These columns are not used and were ignored: {plan.ignoredColumns.join(', ')}.</p>
              )}

              {plan.fileProblems.length === 0 && (
                <>
                  <div className="flex flex-wrap gap-3">
                    {plan.tiles.map((tile) => (<StatCard key={tile.label} value={tile.value} label={tile.label} tone={tile.tone} />))}
                  </div>

                  {adapter.options.length > 0 && (
                    <div className="flex flex-col gap-1.5">
                      {adapter.options.map((option) => (
                        <label key={option.key} className="flex items-start gap-2 text-sm">
                          <Checkbox checked={Boolean(options[option.key])} onCheckedChange={(value) => changeOption(option.key, value === true)} className="mt-0.5" />
                          <span><span className="font-medium">{option.label}</span> <span className="text-muted-foreground">{option.help}</span></span>
                        </label>
                      ))}
                    </div>
                  )}

                  <Tabs value={filter} onValueChange={setFilter}>
                    <TabsList aria-label="Filter rows">
                      <TabsTrigger value="problems">Problems {counts.problems}</TabsTrigger>
                      <TabsTrigger value="change">Will change {counts.change}</TabsTrigger>
                      <TabsTrigger value="unchanged">No change {counts.unchanged}</TabsTrigger>
                      <TabsTrigger value="all">All {counts.all}</TabsTrigger>
                    </TabsList>
                  </Tabs>

                  <DataTable
                    caption="Rows in the file"
                    columns={columns}
                    data={shown}
                    getRowId={(item) => `${item.rowNumber}-${item.label}`}
                    pageSize={25}
                    emptyState={<EmptyState icon={FileSpreadsheet} title="Nothing here" description={filter === 'problems' ? 'No problems found in this file.' : 'No rows in this view.'} />}
                  />
                </>
              )}
            </>
          )}

          {step === 'result' && result && (
            <>
              <div className="flex flex-wrap gap-3">
                <StatCard value={result.applied} label="Applied" tone="success" />
                <StatCard value={result.failed} label="Failed" tone={result.failed > 0 ? 'danger' : 'default'} />
                <StatCard value={result.items.filter((i) => !willApply(i)).length} label="Left out" tone="warning" />
              </div>
              <p className="text-sm">
                {result.failed === 0 ? `Every change was applied (${plural(result.applied, 'change')}).` : `${plural(result.applied, 'change')} applied, ${result.failed} failed.`}
                {result.changedSincePreview && ' The data changed since the preview, so the checks were run again before saving.'}
              </p>
              {failures.length > 0 && (
                <DataTable caption="Failed rows" columns={failureColumns} data={failures} getRowId={(outcome) => `${outcome.item.rowNumber}-${outcome.item.label}`} pageSize={25} />
              )}
            </>
          )}
        </DialogBody>

        <DialogFooter>
          {step === 'check' && plan && plan.fileProblems.length === 0 && (
            <>
              <p className="mr-auto text-sm text-muted-foreground" aria-live="polite">
                <b className="text-foreground">{plural(counts.change, 'change')} will be saved.</b>{' '}
                {leftOut > 0 && `${plural(leftOut, 'row')} left out.`}
              </p>
              {leftOut + counts.problems > 0 && <Button onClick={downloadReport}><Download /> Download problems</Button>}
            </>
          )}
          {step === 'result' && <Button className="mr-auto" onClick={downloadReport}><Download /> Download report (CSV)</Button>}
          {busy && progress && <span className="text-sm text-muted-foreground tabular-nums" role="status">Applying {progress.done} of {progress.total}...</span>}
          {step !== 'result' && <Button onClick={close} disabled={busy}>Cancel</Button>}
          {step === 'check' && plan && plan.fileProblems.length === 0 && (
            <Button variant="default" onClick={apply} disabled={busy || counts.change === 0}>
              {busy && <Loader2 className="animate-spin" aria-hidden="true" />}
              {`Apply ${plural(counts.change, 'change')}`}
            </Button>
          )}
          {step === 'result' && <Button variant="default" onClick={onClose}>Close</Button>}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
