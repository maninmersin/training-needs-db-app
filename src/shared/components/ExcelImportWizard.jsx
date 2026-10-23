import React, { useState } from 'react';
import { supabase } from '@core/services/supabaseClient';
import { toLocalDateTime } from '@core/utils/dateTimeUtils';
import { ExcelService } from '@core/services/excelService';
import { Check, Upload } from 'lucide-react';
import { toast } from 'sonner';
import { Badge, Button, Card, FileDrop, FormField, ImportStepper, Input } from '@/components/ui';

const ExcelImportWizard = ({ onComplete, onBack }) => {
  const [currentStep, setCurrentStep] = useState(1); // 1: Upload, 2: Validate, 3: Preview, 4: Import
  const [file, setFile] = useState(null);
  const [importData, setImportData] = useState([]);
  const [validationResults, setValidationResults] = useState([]);
  const [importType, setImportType] = useState('update'); // 'update', 'create'
  const [loading, setLoading] = useState(false);
  const [scheduleName, setScheduleName] = useState('');

  const handleFile = async (uploadedFile) => {
    if (!uploadedFile) return;

    setFile(uploadedFile);
    setLoading(true);

    try {
      const data = await readExcelFile(uploadedFile);
      setImportData(data);
      setCurrentStep(2);
    } catch (error) {
      toast.error('Error reading file', { description: error.message });
    } finally {
      setLoading(false);
    }
  };

  const readExcelFile = async (file) => {
    try {
      // Use dynamic Excel service to read the file
      const workbook = await ExcelService.readWorkbook(file);
      const sheetName = ExcelService.getSheetNames(workbook)[0];
      const worksheet = ExcelService.getWorksheet(workbook, sheetName);
      const jsonData = await ExcelService.worksheetToJson(worksheet);
      
      return jsonData;
    } catch (error) {
      throw new Error(`Failed to read Excel file: ${error.message}`);
    }
  };

  const validateData = async () => {
    setLoading(true);
    const results = [];

    for (let i = 0; i < importData.length; i++) {
      const row = importData[i];
      const errors = [];
      const warnings = [];

      // Validate required fields
      if (!row['Session Title']) errors.push('Missing Session Title');
      if (!row['Course Name']) errors.push('Missing Course Name');
      if (!row['Start Date']) errors.push('Missing Start Date');
      if (!row['Start Time']) errors.push('Missing Start Time');
      if (!row['End Date']) errors.push('Missing End Date');
      if (!row['End Time']) errors.push('Missing End Time');

      // Validate date formats
      if (row['Start Date'] && !isValidDate(row['Start Date'])) {
        errors.push('Invalid Start Date format');
      }
      if (row['End Date'] && !isValidDate(row['End Date'])) {
        errors.push('Invalid End Date format');
      }

      // Validate duration
      if (row['Duration (hrs)'] && (isNaN(row['Duration (hrs)']) || row['Duration (hrs)'] <= 0)) {
        errors.push('Invalid duration');
      }

      // Check for scheduling conflicts (warning only)
      if (importType === 'update') {
        // TODO: Add conflict detection logic
      }

      results.push({
        rowIndex: i + 1,
        data: row,
        errors,
        warnings,
        isValid: errors.length === 0
      });
    }

    setValidationResults(results);
    setCurrentStep(3);
    setLoading(false);
  };

  const isValidDate = (dateString) => {
    return !isNaN(Date.parse(dateString));
  };

  const performImport = async () => {
    setLoading(true);

    try {
      if (importType === 'create') {
        await createNewSchedule();
      } else {
        await updateExistingSchedules();
      }

      toast.success('Import completed');
      onComplete();
    } catch (error) {
      toast.error('Import failed', { description: error.message });
    } finally {
      setLoading(false);
    }
  };

  const createNewSchedule = async () => {
    if (!scheduleName.trim()) throw new Error('Schedule name is required');


    const validRows = validationResults.filter(r => r.isValid);
    const sessions = validRows.map(result => {
      const row = result.data;
      return {
        course_id: row['Course ID'] || null,
        course_name: row['Course Name'],
        session_number: parseInt(row['Group Number'] || row['Session Number']) || 1,
        group_type: row['Group Type'] || [],
        group_name: row['Group Name'] || 'Default',
        start: toLocalDateTime(new Date(`${row['Start Date']} ${row['Start Time']}`)),
        end: toLocalDateTime(new Date(`${row['End Date']} ${row['End Time']}`)),
        duration: parseFloat(row['Duration (hrs)']) || 1,
        functional_area: row['Functional Area'] || 'General',
        location: row['Location'] || 'TBD',
        title: row['Session Title']
      };
    });

    const { error } = await supabase.from('training_schedules').insert([{
      name: scheduleName.trim(),
      criteria: {},
      status: 'active',
      functional_areas: [...new Set(sessions.map(s => s.functional_area))],
      training_locations: [...new Set(sessions.map(s => s.location))]
    }]);

    if (error) throw error;
  };

  const updateExistingSchedules = async () => {
    // For updates, we'd need to match sessions by some identifier
    // This is a simplified implementation
    throw new Error('Schedule updates not yet implemented. Please use "Create New Schedule" option.');
  };

  const getValidRowCount = () => {
    return validationResults.filter(r => r.isValid).length;
  };

  const getErrorRowCount = () => {
    return validationResults.filter(r => !r.isValid).length;
  };

  const stepLabels = ['Upload', 'Validate', 'Preview', 'Import'];

  return (
    <Card className="mx-auto max-w-3xl">
      <div className="flex flex-col gap-3 border-b border-border px-4 py-3">
        <h2 className="text-base font-semibold">Import Schedule from Excel</h2>
        <ImportStepper steps={stepLabels} current={currentStep - 1} />
      </div>

      <div className="flex flex-col gap-4 p-4">
        {currentStep === 1 && (
          <>
            <div>
              <h3 className="text-sm font-semibold">Step 1: Upload Excel File</h3>
              <p className="mt-1 text-sm text-muted-foreground">Select an Excel file containing schedule data. The file should include columns for:</p>
              <ul className="mt-1 list-disc pl-5 text-sm text-muted-foreground">
                <li>Session Title</li>
                <li>Course Name</li>
                <li>Start Date, Start Time</li>
                <li>End Date, End Time</li>
                <li>Duration (hrs)</li>
                <li>Location</li>
                <li>Group Name</li>
                <li>Functional Area</li>
              </ul>
            </div>

            <fieldset className="flex flex-col gap-2">
              <legend className="mb-1 text-sm font-medium">Import Type</legend>
              <label className="flex cursor-pointer items-center gap-2 text-sm">
                <input type="radio" value="create" checked={importType === 'create'} onChange={(event) => setImportType(event.target.value)} className="size-4 accent-primary" />
                Create new schedule
              </label>
              <label className="flex items-center gap-2 text-sm text-muted-foreground">
                <input type="radio" value="update" checked={importType === 'update'} onChange={(event) => setImportType(event.target.value)} disabled className="size-4" />
                Update existing schedule (Coming soon)
              </label>
            </fieldset>

            <FileDrop onFile={handleFile} disabled={loading} label="Choose an Excel or CSV file" />
            {loading && <p className="text-sm text-muted-foreground" role="status">Reading file...</p>}
          </>
        )}

        {currentStep === 2 && (
          <>
            <div>
              <h3 className="text-sm font-semibold">Step 2: Validate Data</h3>
              <p className="mt-1 text-sm text-muted-foreground">Found {importData.length} rows in the uploaded file.</p>
            </div>
            <div><Button variant="default" onClick={validateData} disabled={loading}><Check /> {loading ? 'Validating...' : 'Validate Data'}</Button></div>
          </>
        )}

        {currentStep === 3 && (
          <>
            <h3 className="text-sm font-semibold">Step 3: Preview &amp; Review</h3>
            <div className="flex flex-wrap gap-2">
              <Badge variant="success">Valid: {getValidRowCount()}</Badge>
              <Badge variant="danger">Errors: {getErrorRowCount()}</Badge>
              <Badge>Total: {validationResults.length}</Badge>
            </div>

            <ul className="flex flex-col gap-1.5">
              {validationResults.slice(0, 10).map((result) => (
                <li key={result.rowIndex} className={`rounded-md border px-3 py-2 text-sm ${result.isValid ? 'border-border' : 'border-destructive/40 bg-destructive-soft'}`}>
                  <p className="font-medium">Row {result.rowIndex}: {result.data['Session Title'] || 'Unnamed Session'}</p>
                  {result.errors.map((message) => <p key={message} className="text-destructive">{message}</p>)}
                  {result.warnings.map((message) => <p key={message} className="text-warning">{message}</p>)}
                </li>
              ))}
            </ul>
            {validationResults.length > 10 && <p className="text-sm text-muted-foreground">... and {validationResults.length - 10} more rows</p>}

            {getValidRowCount() > 0 && (
              <div><Button variant="default" onClick={() => setCurrentStep(4)}>Proceed with {getValidRowCount()} valid sessions</Button></div>
            )}
          </>
        )}

        {currentStep === 4 && (
          <>
            <div>
              <h3 className="text-sm font-semibold">Step 4: Import Data</h3>
              <p className="mt-1 text-sm text-muted-foreground">Ready to import {getValidRowCount()} valid sessions.</p>
            </div>
            {importType === 'create' && (
              <FormField label="Name for the new schedule *" className="max-w-md">
                <Input value={scheduleName} onChange={(event) => setScheduleName(event.target.value)} placeholder="Enter a name for the new schedule" />
              </FormField>
            )}
            <div><Button variant="default" onClick={performImport} disabled={loading}><Upload /> {loading ? 'Importing...' : 'Import Sessions'}</Button></div>
          </>
        )}
      </div>

      <div className="flex justify-end gap-2 border-t border-border px-4 py-3">
        <Button onClick={onBack} disabled={loading}>Cancel</Button>
        {currentStep > 1 && <Button onClick={() => setCurrentStep(currentStep - 1)} disabled={loading}>Back</Button>}
      </div>
    </Card>
  );
};

export default ExcelImportWizard;
