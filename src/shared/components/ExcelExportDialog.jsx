import React, { useState } from 'react';
import * as XLSX from 'xlsx';
import { saveAs } from 'file-saver';
import { Download } from 'lucide-react';
import { toast } from 'sonner';
import { supabase } from '@core/services/supabaseClient';
import { fetchAllRows } from '@core/utils/fetchAllRows';
import { Button, Card, Checkbox } from '@/components/ui';
import { SHEET_NAMES, metadataRows, rowsFor, sortSessions, toExportSession } from './scheduleExportRows';

const BOM = String.fromCharCode(0xfeff); // lets Excel read accented characters in a CSV

// The schedule rows with all of their sessions (a plain select would stop at 1000 sessions)
async function loadSchedulesWithSessions(selectedSchedules) {
  return Promise.all(
    selectedSchedules.map(async (schedule) => {
      const { data, error } = await supabase.from('training_schedules').select('*').eq('id', schedule.id).single();
      if (error) throw error;
      const rows = await fetchAllRows(() => supabase.from('training_sessions').select('*').eq('schedule_id', schedule.id));
      return { ...data, sessions: sortSessions(rows.map(toExportSession)) };
    })
  );
}

const ExcelExportDialog = ({ selectedSchedules, onBack }) => {
  const [exportFormat, setExportFormat] = useState('detailed'); // 'summary', 'detailed', 'visual', 'calendar'
  const [fileFormat, setFileFormat] = useState('xlsx'); // 'xlsx', 'csv'
  const [includeMetadata, setIncludeMetadata] = useState(true);
  const [exporting, setExporting] = useState(false);

  const exportSchedules = async () => {
    try {
      setExporting(true);
      const schedules = await loadSchedulesWithSessions(selectedSchedules);

      if (exportFormat !== 'summary' && schedules.every((schedule) => schedule.sessions.length === 0)) {
        toast.error('Nothing to export', { description: 'The selected schedules have no sessions.' });
        return;
      }

      const workbook = XLSX.utils.book_new();
      XLSX.utils.book_append_sheet(workbook, XLSX.utils.json_to_sheet(rowsFor(exportFormat, schedules)), SHEET_NAMES[exportFormat]);
      if (includeMetadata) {
        XLSX.utils.book_append_sheet(workbook, XLSX.utils.json_to_sheet(metadataRows(schedules, { exportFormat, fileFormat })), 'Export Metadata');
      }

      const filename = `training_schedules_${exportFormat}_${new Date().toISOString().slice(0, 10)}.${fileFormat}`;
      if (fileFormat === 'xlsx') {
        const buffer = XLSX.write(workbook, { bookType: 'xlsx', type: 'array' });
        saveAs(new Blob([buffer], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' }), filename);
      } else {
        // A CSV holds one sheet: the schedule data
        const csv = XLSX.utils.sheet_to_csv(workbook.Sheets[workbook.SheetNames[0]]);
        saveAs(new Blob([BOM + csv], { type: 'text/csv;charset=utf-8;' }), filename);
      }

      toast.success(`Exported ${selectedSchedules.length} schedule(s)`, { description: filename });
      onBack();
    } catch (error) {
      console.error('Export error:', error);
      toast.error('Failed to export schedules', { description: error.message });
    } finally {
      setExporting(false);
    }
  };

  return (
    <Card className="mx-auto max-w-2xl">
      <div className="border-b border-border px-4 py-3">
        <h2 className="text-base font-semibold">Export Schedules to Excel</h2>
        <p className="text-sm text-muted-foreground">Export {selectedSchedules.length} selected schedule(s)</p>
      </div>

      <div className="flex flex-col gap-5 p-4">
        <fieldset className="flex flex-col gap-2">
          <legend className="mb-1 text-sm font-medium">Export Format</legend>
          <RadioOption name="exportFormat" value="summary" current={exportFormat} onChange={setExportFormat}>Summary (Overview of schedules)</RadioOption>
          <RadioOption name="exportFormat" value="detailed" current={exportFormat} onChange={setExportFormat}>Detailed (All session data)</RadioOption>
          <RadioOption name="exportFormat" value="visual" current={exportFormat} onChange={setExportFormat}>Visual (Easy-to-read list)</RadioOption>
          <RadioOption name="exportFormat" value="calendar" current={exportFormat} onChange={setExportFormat}>Calendar (For calendar import)</RadioOption>
        </fieldset>

        <fieldset className="flex flex-col gap-2">
          <legend className="mb-1 text-sm font-medium">File Format</legend>
          <RadioOption name="fileFormat" value="xlsx" current={fileFormat} onChange={setFileFormat}>Excel (.xlsx)</RadioOption>
          <RadioOption name="fileFormat" value="csv" current={fileFormat} onChange={setFileFormat}>CSV (.csv)</RadioOption>
        </fieldset>

        <label className="flex cursor-pointer items-center gap-2 text-sm">
          <Checkbox aria-label="Include metadata sheet" checked={includeMetadata} onCheckedChange={(checked) => setIncludeMetadata(checked === true)} />
          Include metadata sheet
          {fileFormat === 'csv' && <span className="text-xs text-muted-foreground">(Excel only)</span>}
        </label>
      </div>

      <div className="flex justify-end gap-2 border-t border-border px-4 py-3">
        <Button onClick={onBack} disabled={exporting}>Cancel</Button>
        <Button variant="default" onClick={exportSchedules} disabled={exporting}><Download /> {exporting ? 'Exporting...' : 'Export'}</Button>
      </div>
    </Card>
  );
};

function RadioOption({ name, value, current, onChange, children }) {
  return (
    <label className="flex cursor-pointer items-center gap-2 text-sm">
      <input type="radio" name={name} value={value} checked={current === value} onChange={(event) => onChange(event.target.value)} className="size-4 accent-primary" />
      {children}
    </label>
  );
}

export default ExcelExportDialog;
