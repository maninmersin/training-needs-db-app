import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { CircleCheck, Database, Download, FileSpreadsheet, Loader2 } from 'lucide-react';
import { supabase } from '@core/services/supabaseClient';
import { useProject } from '@core/contexts/ProjectContext';
import {
  Button, Checkbox, DataTable, DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger, EmptyState, FileDrop,
  PageHeader, StatCard, toast
} from '@/components/ui';
import { readTableFile } from '../import/tableFile';
import { TRAINING_DATA_EXPORT_HEADERS, planAccessImport, toTrainingDataRow, trainingDataToRows } from '../import/accessImport';
import { loadAllTrainingData, loadCurrentStats, replaceTrainingData } from '../import/accessImportService';
import { downloadTable } from '../import/exportFiles';

const plural = (count, word, many = `${word}s`) => `${count} ${count === 1 ? word : many}`;

const ImportExportTrainingData = () => {
  const { currentProject } = useProject();
  const [stats, setStats] = useState(null);
  const [fileName, setFileName] = useState('');
  const [plan, setPlan] = useState(null);
  const [skipInvalid, setSkipInvalid] = useState(false);
  const [confirmed, setConfirmed] = useState(false);
  const [busy, setBusy] = useState(false);
  const [progress, setProgress] = useState(null);
  const [result, setResult] = useState(null);
  const [error, setError] = useState(null);

  const refreshStats = useCallback(async () => {
    try {
      setStats(await loadCurrentStats(supabase, currentProject.id));
    } catch (statsError) {
      console.error('Error loading stats:', statsError);
    }
  }, [currentProject]);

  useEffect(() => {
    if (currentProject) refreshStats();
  }, [currentProject, refreshStats]);

  const reset = () => {
    setPlan(null);
    setFileName('');
    setSkipInvalid(false);
    setConfirmed(false);
    setResult(null);
    setError(null);
  };

  const handleFile = async (file) => {
    setBusy(true);
    setError(null);
    setResult(null);
    try {
      const table = await readTableFile(file);
      if (table.headers.length === 0) throw new Error('The file is empty - there is no header row');
      setPlan(planAccessImport(table));
      setFileName(file.name);
      setSkipInvalid(false);
      setConfirmed(false);
    } catch (readError) {
      setError(readError.message);
    } finally {
      setBusy(false);
    }
  };

  const exportCurrent = async (format, name = 'training_data_export') => {
    try {
      setBusy(true);
      const data = await loadAllTrainingData(supabase, currentProject.id);
      if (data.length === 0) {
        toast.info('No training data to export for this project');
        return;
      }
      downloadTable(name, TRAINING_DATA_EXPORT_HEADERS, trainingDataToRows(data), format);
      toast.success(`${plural(data.length, 'record')} exported`);
    } catch (exportError) {
      console.error('Export error:', exportError);
      setError(`Export error: ${exportError.message}`);
    } finally {
      setBusy(false);
    }
  };

  const canApply = Boolean(plan) && plan.fileProblems.length === 0 && plan.rows.length > 0 && (plan.errors.length === 0 || skipInvalid) && confirmed && !busy;

  const apply = async () => {
    setBusy(true);
    setError(null);
    try {
      const now = new Date();
      const rows = plan.rows.map((record) => toTrainingDataRow(record, currentProject.id, now));
      const before = stats?.total_assignments ?? 0;
      const outcome = await replaceTrainingData(supabase, currentProject.id, rows, (done, total, phase) => setProgress({ done, total, phase }));
      setResult({ imported: outcome.inserted, replaced: before, skipped: plan.errors.length });
      setPlan(null);
      await refreshStats();
    } catch (applyError) {
      console.error('Import error:', applyError);
      setError(applyError.message);
      await refreshStats();
    } finally {
      setBusy(false);
      setProgress(null);
    }
  };

  const problemColumns = useMemo(
    () => [
      { accessorKey: 'rowNumber', header: 'Row', meta: { className: 'tabular-nums text-subtle-foreground' } },
      { accessorKey: 'name', header: 'Name', meta: { className: 'font-medium' } },
      { accessorKey: 'message', header: 'Problem', meta: { className: 'min-w-72 whitespace-normal py-1 text-destructive' } }
    ],
    []
  );

  const downloadProblems = () =>
    downloadTable('training_data_import_problems', ['Row', 'Name', 'Problem'], plan.errors.map((e) => [e.rowNumber, e.name, e.message]), 'csv');

  if (!currentProject) {
    return (
      <div className="mx-auto max-w-5xl rounded-lg border border-border bg-card">
        <EmptyState
          icon={Database}
          title="No Project Selected"
          description="Please select a project from the Projects page to import or export training data. Each project has its own isolated training data."
        />
      </div>
    );
  }

  const summary = plan?.summary;
  const previous = stats?.total_assignments ?? 0;

  return (
    <div className="mx-auto flex max-w-5xl flex-col gap-4">
      <PageHeader
        title="Import/Export Training Data (MS Access)"
        description={`Imports the complete training data export from MS Access: one flat table with every person and the courses they need. Project: ${currentProject.title}.`}
        actions={
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button disabled={busy}><Download /> Export All Training Data</Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end">
              <DropdownMenuItem onSelect={() => exportCurrent('xlsx')}>Excel (.xlsx)</DropdownMenuItem>
              <DropdownMenuItem onSelect={() => exportCurrent('csv')}>CSV</DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        }
      />

      {stats && (
        <section aria-label="Current data" className="flex flex-wrap gap-3">
          <StatCard value={stats.total_assignments || 0} label="Total Assignments" />
          {stats.unique_users !== undefined && <StatCard value={stats.unique_users} label="Unique Users" />}
          {stats.unique_courses !== undefined && <StatCard value={stats.unique_courses} label="Unique Courses" />}
          {stats.unique_locations !== undefined && <StatCard value={stats.unique_locations} label="Training Locations" />}
          {stats.unique_functional_areas !== undefined && <StatCard value={stats.unique_functional_areas} label="Functional Areas" />}
        </section>
      )}

      {error && <div role="alert" className="rounded-md bg-destructive-soft px-3 py-2 text-sm text-destructive">{error}</div>}

      {result && (
        <div role="status" className="flex items-start gap-3 rounded-lg border border-border bg-success-soft px-4 py-3 text-sm text-success">
          <CircleCheck className="mt-0.5 size-4 shrink-0" aria-hidden="true" />
          <div className="flex-1">
            <p className="font-medium">Import complete: {plural(result.imported, 'record')} imported.</p>
            <p>The previous {plural(result.replaced, 'record')} for this project {result.replaced === 1 ? 'was' : 'were'} replaced.{result.skipped > 0 && ` ${plural(result.skipped, 'row')} with problems ${result.skipped === 1 ? 'was' : 'were'} left out.`}</p>
          </div>
          <Button onClick={reset}>Done</Button>
        </div>
      )}

      <section aria-label="Import" className="flex flex-col gap-4 rounded-lg border border-border bg-card p-4">
        <div>
          <h2 className="text-base font-semibold">Import Training Data from MS Access</h2>
          <p className="text-sm text-muted-foreground">
            Importing <b className="text-foreground">replaces</b> all of this project's training data with the file. Schedules, sessions and assignments that
            already exist are not deleted, but they refer to people and courses by ID, so check they still match afterwards. Nothing is changed until you press the button below.
          </p>
          <p className="mt-2 text-xs text-subtle-foreground">
            Expected columns: ID, functional_area, sub_functional_area, est_duration_hrs, emp_id, name, business-unit, org, country, department, job_title,
            email, location, training_location, project_role, assigned_by, assigned_date, notes.
          </p>
        </div>

        {!plan && !progress && <FileDrop onFile={handleFile} label="Choose a file" hint=".csv or .xlsx from the MS Access export" disabled={busy} />}

        {busy && !plan && !progress && (
          <div role="status" className="flex items-center justify-center gap-2 text-sm text-muted-foreground">
            <Loader2 className="size-4 animate-spin" aria-hidden="true" /> Reading and checking the file...
          </div>
        )}

        {plan && (
          <>
            <div className="flex items-center gap-3 rounded-lg border border-border px-3.5 py-2.5">
              <FileSpreadsheet className="size-5 text-success" aria-hidden="true" />
              <div className="min-w-0 flex-1">
                <div className="truncate font-medium">{fileName}</div>
                <div className="text-xs text-subtle-foreground">{plural(plan.rows.length + plan.errors.length, 'row')} read</div>
              </div>
              <Button onClick={reset} disabled={busy}>Choose a different file</Button>
            </div>

            {plan.fileProblems.length > 0 && (
              <div role="alert" className="rounded-md bg-destructive-soft px-3 py-2 text-sm text-destructive">
                {plan.fileProblems.map((problem) => (<p key={problem}>{problem}</p>))}
              </div>
            )}
            {plan.ignoredColumns.length > 0 && <p className="text-sm text-muted-foreground">These columns are not used and were ignored: {plan.ignoredColumns.join(', ')}.</p>}

            {plan.fileProblems.length === 0 && (
              <>
                <div className="flex flex-wrap gap-3">
                  <StatCard value={summary.rows} label="Rows to import" />
                  <StatCard value={summary.people} label="People" />
                  <StatCard value={summary.courses} label="Courses" />
                  <StatCard value={summary.locations} label="Training locations" />
                  <StatCard value={summary.areas} label="Functional areas" />
                  {summary.duplicates > 0 && <StatCard value={summary.duplicates} label="Repeated person + course rows" tone="warning" />}
                  {plan.errors.length > 0 && <StatCard value={plan.errors.length} label="Rows with problems" tone="danger" />}
                </div>

                <p className="text-sm" aria-live="polite">
                  This will replace the <b>{plural(previous, 'record')}</b> now in this project with <b>{plural(summary.rows, 'record')}</b> from the file.
                </p>

                {plan.errors.length > 0 && (
                  <div className="flex flex-col gap-2">
                    <div className="flex items-center justify-between gap-3">
                      <h3 className="text-sm font-semibold">Rows with problems</h3>
                      <Button size="sm" onClick={downloadProblems}><Download /> Download problems</Button>
                    </div>
                    <DataTable caption="Rows with problems" columns={problemColumns} data={plan.errors} getRowId={(e) => String(e.rowNumber)} pageSize={10} pageSizes={[10, 25, 50]} />
                    <label className="flex items-start gap-2 text-sm">
                      <Checkbox checked={skipInvalid} onCheckedChange={(value) => setSkipInvalid(value === true)} className="mt-0.5" />
                      <span><span className="font-medium">Leave out the rows with problems</span> <span className="text-muted-foreground">and import the rest. Without this, the import is blocked until the file is fixed, because everything now in the project is being replaced.</span></span>
                    </label>
                  </div>
                )}

                {summary.rows === 0 ? (
                  <p className="text-sm text-destructive">There are no usable rows in this file, so there is nothing to import.</p>
                ) : (
                  <label className="flex items-start gap-2 rounded-md border border-border-strong bg-warning-soft px-3 py-2 text-sm">
                    <Checkbox checked={confirmed} onCheckedChange={(value) => setConfirmed(value === true)} className="mt-0.5" />
                    <span>I understand this replaces all {plural(previous, 'existing record')} for this project.</span>
                  </label>
                )}

                <div className="flex flex-wrap items-center justify-end gap-2">
                  <DropdownMenu>
                    <DropdownMenuTrigger asChild>
                      <Button disabled={busy} className="mr-auto"><Download /> Download a backup of the current data</Button>
                    </DropdownMenuTrigger>
                    <DropdownMenuContent align="start">
                      <DropdownMenuItem onSelect={() => exportCurrent('xlsx', 'training_data_backup_before_import')}>Excel (.xlsx)</DropdownMenuItem>
                      <DropdownMenuItem onSelect={() => exportCurrent('csv', 'training_data_backup_before_import')}>CSV</DropdownMenuItem>
                    </DropdownMenuContent>
                  </DropdownMenu>
                  <Button onClick={reset} disabled={busy}>Cancel</Button>
                  <Button variant="default" onClick={apply} disabled={!canApply}>
                    {busy && <Loader2 className="animate-spin" aria-hidden="true" />}
                    Import CSV (Replace All)
                  </Button>
                </div>
              </>
            )}
          </>
        )}

        {progress && (
          <div role="status" className="flex flex-col gap-2" aria-live="polite">
            <div className="flex items-center justify-between text-sm">
              <span>{progress.phase}</span>
              <span className="tabular-nums text-muted-foreground">{progress.done} of {progress.total}{progress.total > 0 && ` (${Math.round((progress.done / progress.total) * 100)}%)`}</span>
            </div>
            <div className="h-1.5 overflow-hidden rounded-full bg-secondary">
              <div className="h-full rounded-full bg-primary" style={{ width: `${progress.total > 0 ? (progress.done / progress.total) * 100 : 0}%` }} />
            </div>
          </div>
        )}
      </section>
    </div>
  );
};

export default ImportExportTrainingData;
