import React, { useState } from 'react';
import { supabase } from '../supabaseClient';
import { toLocalDateTime } from '../utils/dateTimeUtils';
import * as XLSX from 'xlsx';

const ExcelImportWizard = ({ onComplete, onBack }) => {
  const [currentStep, setCurrentStep] = useState(1); // 1: Upload, 2: Validate, 3: Preview, 4: Import
  const [file, setFile] = useState(null);
  const [importData, setImportData] = useState([]);
  const [validationResults, setValidationResults] = useState([]);
  const [importType, setImportType] = useState('update'); // 'update', 'create'
  const [loading, setLoading] = useState(false);

  const handleFileUpload = async (event) => {
    const uploadedFile = event.target.files[0];
    if (!uploadedFile) return;

    setFile(uploadedFile);
    setLoading(true);

    try {
      const data = await readExcelFile(uploadedFile);
      setImportData(data);
      setCurrentStep(2);
    } catch (error) {
      alert(`Error reading file: ${error.message}`);
    } finally {
      setLoading(false);
    }
  };

  const readExcelFile = (file) => {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      
      reader.onload = (e) => {
        try {
          const data = new Uint8Array(e.target.result);
          const workbook = XLSX.read(data, { type: 'array' });
          const sheetName = workbook.SheetNames[0];
          const worksheet = workbook.Sheets[sheetName];
          const jsonData = XLSX.utils.sheet_to_json(worksheet);
          
          resolve(jsonData);
        } catch (error) {
          reject(error);
        }
      };
      
      reader.onerror = () => reject(new Error('Failed to read file'));
      reader.readAsArrayBuffer(file);
    });
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

      alert('✅ Import completed successfully!');
      onComplete();
    } catch (error) {
      alert(`Import failed: ${error.message}`);
    } finally {
      setLoading(false);
    }
  };

  const createNewSchedule = async () => {
    const scheduleName = prompt('Enter a name for the new schedule:');
    if (!scheduleName) throw new Error('Schedule name is required');

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
      name: scheduleName,
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

  return (
    <div className="excel-import-wizard">
      <div className="wizard-header">
        <h2>📥 Import Schedule from Excel</h2>
        <div className="wizard-steps">
          <div className={`step ${currentStep >= 1 ? 'active' : ''}`}>1. Upload</div>
          <div className={`step ${currentStep >= 2 ? 'active' : ''}`}>2. Validate</div>
          <div className={`step ${currentStep >= 3 ? 'active' : ''}`}>3. Preview</div>
          <div className={`step ${currentStep >= 4 ? 'active' : ''}`}>4. Import</div>
        </div>
      </div>

      <div className="wizard-content">
        {currentStep === 1 && (
          <div className="upload-step">
            <h3>Step 1: Upload Excel File</h3>
            <p>Select an Excel file containing schedule data. The file should include columns for:</p>
            <ul>
              <li>Session Title</li>
              <li>Course Name</li>
              <li>Start Date, Start Time</li>
              <li>End Date, End Time</li>
              <li>Duration (hrs)</li>
              <li>Location</li>
              <li>Group Name</li>
              <li>Functional Area</li>
            </ul>

            <div className="import-type-selection">
              <label>Import Type:</label>
              <div className="radio-group">
                <label>
                  <input
                    type="radio"
                    value="create"
                    checked={importType === 'create'}
                    onChange={(e) => setImportType(e.target.value)}
                  />
                  Create new schedule
                </label>
                <label>
                  <input
                    type="radio"
                    value="update"
                    checked={importType === 'update'}
                    onChange={(e) => setImportType(e.target.value)}
                    disabled
                  />
                  Update existing schedule (Coming soon)
                </label>
              </div>
            </div>

            <div className="file-upload">
              <input
                type="file"
                accept=".xlsx,.xls,.csv"
                onChange={handleFileUpload}
                disabled={loading}
              />
              {loading && <div>📄 Reading file...</div>}
            </div>
          </div>
        )}

        {currentStep === 2 && (
          <div className="validate-step">
            <h3>Step 2: Validate Data</h3>
            <p>Found {importData.length} rows in the uploaded file.</p>
            
            <button onClick={validateData} disabled={loading} className="validate-btn">
              {loading ? '⏳ Validating...' : '✅ Validate Data'}
            </button>
          </div>
        )}

        {currentStep === 3 && (
          <div className="preview-step">
            <h3>Step 3: Preview & Review</h3>
            
            <div className="validation-summary">
              <div className="summary-stats">
                <div className="stat valid">✅ Valid: {getValidRowCount()}</div>
                <div className="stat errors">❌ Errors: {getErrorRowCount()}</div>
                <div className="stat total">📊 Total: {validationResults.length}</div>
              </div>
            </div>

            <div className="validation-results">
              {validationResults.slice(0, 10).map(result => (
                <div key={result.rowIndex} className={`result-row ${result.isValid ? 'valid' : 'invalid'}`}>
                  <div className="row-header">
                    Row {result.rowIndex}: {result.data['Session Title'] || 'Unnamed Session'}
                  </div>
                  {result.errors.length > 0 && (
                    <div className="errors">
                      {result.errors.map((error, i) => (
                        <div key={i} className="error">❌ {error}</div>
                      ))}
                    </div>
                  )}
                  {result.warnings.length > 0 && (
                    <div className="warnings">
                      {result.warnings.map((warning, i) => (
                        <div key={i} className="warning">⚠️ {warning}</div>
                      ))}
                    </div>
                  )}
                </div>
              ))}
              
              {validationResults.length > 10 && (
                <div className="more-results">
                  ... and {validationResults.length - 10} more rows
                </div>
              )}
            </div>

            {getValidRowCount() > 0 && (
              <button onClick={() => setCurrentStep(4)} className="proceed-btn">
                Proceed with {getValidRowCount()} valid sessions
              </button>
            )}
          </div>
        )}

        {currentStep === 4 && (
          <div className="import-step">
            <h3>Step 4: Import Data</h3>
            <p>Ready to import {getValidRowCount()} valid sessions.</p>
            
            <button onClick={performImport} disabled={loading} className="import-btn">
              {loading ? '⏳ Importing...' : '📥 Import Sessions'}
            </button>
          </div>
        )}
      </div>

      <div className="wizard-actions">
        <button onClick={onBack} disabled={loading}>
          Cancel
        </button>
        {currentStep > 1 && (
          <button onClick={() => setCurrentStep(currentStep - 1)} disabled={loading}>
            Back
          </button>
        )}
      </div>
    </div>
  );
};

export default ExcelImportWizard;