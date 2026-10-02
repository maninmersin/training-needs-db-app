import React, { useState, useEffect } from 'react';
import { supabase } from '@core/services/supabaseClient';
import { useProject } from '@core/contexts/ProjectContext';
import './ImportExportUserCourseMappings.css'; // Reuse existing styles

const ImportExportTrainingData = () => {
  const { currentProject } = useProject();
  const [file, setFile] = useState(null);
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState('');
  const [stats, setStats] = useState(null);
  const [progress, setProgress] = useState({ current: 0, total: 0, phase: '' });

  // Load statistics on mount
  useEffect(() => {
    if (currentProject) {
      loadStats();
    }
  }, [currentProject]);

  const loadStats = async () => {
    try {
      const { data, error } = await supabase
        .rpc('get_training_data_stats', { p_project_id: currentProject.id });

      if (error) {
        console.warn('Stats function not available:', error);
        // Fallback: manual count
        const { count } = await supabase
          .from('training_data')
          .select('*', { count: 'exact', head: true })
          .eq('project_id', currentProject.id);
        setStats({ total_assignments: count });
      } else {
        setStats(data[0]);
      }
    } catch (error) {
      console.error('Error loading stats:', error);
    }
  };

  const handleFileChange = (e) => {
    setFile(e.target.files[0]);
    setMessage('');
    setProgress({ current: 0, total: 0, phase: '' });
  };

  const handleImport = async () => {
    if (!file) {
      setMessage('Please select a file first');
      return;
    }

    if (!currentProject) {
      setMessage('Please select a project first');
      return;
    }

    setLoading(true);
    setMessage('');
    setProgress({ current: 0, total: 0, phase: 'Reading file...' });

    try {
      const reader = new FileReader();
      reader.onload = async (e) => {
        try {
          const text = e.target.result;
          // Normalize line endings to \n (handle Windows \r\n and Mac \r)
          const normalizedText = text.replace(/\r\n/g, '\n').replace(/\r/g, '\n');
          const [headerRow, ...dataRows] = normalizedText.split('\n');
          // Remove quotes and trim whitespace from headers
          const headers = headerRow.split(',').map(h => h.trim().replace(/^"|"$/g, ''));

          console.log('CSV headers:', headers);

          // Required columns from Access export (with actual Access field names)
          const requiredColumns = [
            'ID', 'functional_area', 'sub_functional_area', 'est_duration_hrs',
            'emp_id', 'name'
          ];

          const missingColumns = requiredColumns.filter(col => !headers.includes(col));
          if (missingColumns.length > 0) {
            throw new Error(`Missing required columns: ${missingColumns.join(', ')}\n\nExpected Access export columns: ID, functional_area, sub_functional_area, est_duration_hrs, emp_id, name, etc.`);
          }

          // Check for at least one location column (training_location OR location)
          if (!headers.includes('training_location') && !headers.includes('location')) {
            throw new Error('CSV must include either "training_location" or "location" column');
          }

          // Step 1: Parse all rows
          setProgress({ current: 0, total: dataRows.length, phase: 'Parsing CSV data...' });
          const parsedRows = [];
          const parseErrors = [];

          for (let i = 0; i < dataRows.length; i++) {
            const row = dataRows[i];
            if (!row.trim()) continue;

            try {
              // Handle quoted values and proper CSV parsing
              const values = row.split(/,(?=(?:(?:[^"]*"){2})*[^"]*$)/)
                .map(v => v.trim().replace(/^"(.*)"$/, '$1'));

              const rowData = { rowNumber: i + 2 };
              headers.forEach((header, idx) => {
                rowData[header] = values[idx];
              });

              // Validate required fields (using Access column names)
              // Note: training_location can be empty if location field has a value (fallback)
              if (!rowData.emp_id || !rowData.name) {
                throw new Error('emp_id and name are required');
              }
              if (!rowData.training_location && !rowData.location) {
                throw new Error('Either training_location or location must be provided');
              }
              if (!rowData.ID || !rowData.sub_functional_area || !rowData.est_duration_hrs) {
                throw new Error('ID, sub_functional_area, and est_duration_hrs are required');
              }
              if (!rowData.functional_area) {
                throw new Error('functional_area is required');
              }

              // Validate duration is numeric
              const duration = parseFloat(rowData.est_duration_hrs);
              if (isNaN(duration) || duration <= 0) {
                throw new Error(`Invalid est_duration_hrs: ${rowData.est_duration_hrs}`);
              }

              parsedRows.push(rowData);
            } catch (error) {
              parseErrors.push(`Row ${i + 2}: ${error.message}`);
            }
          }

          if (parseErrors.length > 0) {
            setMessage(
              `❌ Import validation failed:\n\n${parseErrors.slice(0, 10).join('\n')}` +
              (parseErrors.length > 10 ? `\n\n... and ${parseErrors.length - 10} more errors` : '')
            );
            setLoading(false);
            return;
          }

          // Step 2: Delete existing data for this project (replace mode)
          setProgress({ current: 0, total: 0, phase: 'Clearing existing data...' });

          const { error: deleteError } = await supabase
            .from('training_data')
            .delete()
            .eq('project_id', currentProject.id);

          if (deleteError) throw deleteError;

          // Step 3: Batch insert new data (500 rows at a time for performance)
          const batchSize = 500;
          let successCount = 0;
          const errors = [];

          for (let i = 0; i < parsedRows.length; i += batchSize) {
            const batch = parsedRows.slice(i, i + batchSize);

            setProgress({
              current: i + batch.length,
              total: parsedRows.length,
              phase: `Importing records ${i + 1} to ${i + batch.length} of ${parsedRows.length}...`
            });

            // Prepare batch data - Map Access column names to Supabase column names
            const batchData = batch.map(row => ({
              project_id: currentProject.id,
              // User fields - map from Access export
              user_id: row.emp_id,  // emp_id → user_id
              user_name: row.name,  // name → user_name
              user_email: row.email || null,
              business_unit: row['business-unit'] || null,  // Handle hyphenated field name
              organization: row.org || null,
              user_country: row.country || null,
              user_department: row.department || null,
              user_job_title: row.job_title || null,
              user_location: row.location || null,
              training_location: row.training_location || row.location || 'Unknown Location',
              user_project_role: row.project_role || null,
              // Course fields - map from Access export
              course_id: String(row.ID),  // ID → course_id (convert to string)
              course_name: row.sub_functional_area,  // sub_functional_area → course_name
              duration_hrs: parseFloat(row.est_duration_hrs),  // est_duration_hrs → duration_hrs
              course_topic: null,  // Not in Access export
              course_sub_topic: null,  // Not in Access export
              course_application: null,  // Not in Access export
              course_priority: 1,  // Default priority
              // Functional area fields
              functional_area: row.functional_area,
              sub_functional_area: row.sub_functional_area,
              functional_area_short: null,  // Not in Access export
              // Metadata fields
              assigned_by: row.assigned_by || 'import',
              assigned_date: row.assigned_date || new Date().toISOString(),
              assignment_notes: row.notes || null
            }));

            try {
              const { error: insertError } = await supabase
                .from('training_data')
                .insert(batchData);

              if (insertError) throw insertError;
              successCount += batch.length;
            } catch (error) {
              errors.push(`Batch ${Math.floor(i / batchSize) + 1}: ${error.message}`);
            }
          }

          setProgress({
            current: parsedRows.length,
            total: parsedRows.length,
            phase: 'Import completed!'
          });

          // Reload stats
          await loadStats();

          const successMessage =
            `✅ Import completed successfully!\n\n` +
            `Total records imported: ${successCount} of ${parsedRows.length}\n` +
            `Existing data was replaced for this project.`;

          const errorMessage = errors.length > 0
            ? `\n\n⚠️ Some errors occurred:\n${errors.join('\n')}`
            : '';

          setMessage(successMessage + errorMessage);

        } catch (error) {
          setMessage(`Error processing file: ${error.message}`);
          console.error('Import error:', error);
        } finally {
          setLoading(false);
        }
      };

      reader.onerror = () => {
        setMessage('Error reading file');
        setLoading(false);
      };

      reader.readAsText(file);
    } catch (error) {
      setMessage(`Error: ${error.message}`);
      setLoading(false);
    }
  };

  const handleExport = async () => {
    if (!currentProject) {
      setMessage('Please select a project first');
      return;
    }

    setLoading(true);
    setMessage('');

    try {
      const { data, error } = await supabase
        .from('training_data')
        .select('*')
        .eq('project_id', currentProject.id)
        .order('training_location', { ascending: true })
        .order('user_name', { ascending: true })
        .order('course_id', { ascending: true });

      if (error) throw error;

      if (data.length === 0) {
        setMessage('No training data to export for this project');
        setLoading(false);
        return;
      }

      // CSV headers matching Access export
      const headers = [
        'user_id', 'user_name', 'user_email', 'business_unit', 'organization',
        'user_country', 'user_department', 'user_job_title', 'user_location',
        'training_location', 'user_project_role', 'course_id', 'course_name',
        'duration_hrs', 'course_topic', 'course_sub_topic', 'course_application',
        'course_priority', 'functional_area', 'sub_functional_area',
        'functional_area_short', 'assigned_by', 'assigned_date', 'assignment_notes'
      ];

      const csvContent = [
        headers.join(','),
        ...data.map(row =>
          headers.map(header => {
            const value = row[header];
            // Quote strings that might contain commas
            if (value === null || value === undefined) return '';
            if (typeof value === 'string' && (value.includes(',') || value.includes('"'))) {
              return `"${value.replace(/"/g, '""')}"`;
            }
            return value;
          }).join(',')
        )
      ].join('\n');

      const blob = new Blob([csvContent], { type: 'text/csv' });
      const url = URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      link.download = 'training_data_export.csv';
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      URL.revokeObjectURL(url);

      setMessage(`✅ Export completed: ${data.length} records exported`);
    } catch (error) {
      setMessage(`Export error: ${error.message}`);
      console.error('Export error:', error);
    } finally {
      setLoading(false);
    }
  };

  if (!currentProject) {
    return (
      <div className="import-export-container">
        <div className="no-project-state">
          <h3>No Project Selected</h3>
          <p>Please select a project from the Projects page to import/export training data.</p>
          <p>Each project has its own isolated training data.</p>
        </div>
      </div>
    );
  }

  return (
    <div className="import-export-container">
      <h3>Import/Export Training Data (MS Access)</h3>
      <div className="project-indicator">
        <strong>Project:</strong> {currentProject.title}
      </div>

      {stats && (
        <div className="info-section">
          <h4>📊 Current Data Statistics</h4>
          <p><strong>Total Assignments:</strong> {stats.total_assignments || 0}</p>
          {stats.unique_users && <p><strong>Unique Users:</strong> {stats.unique_users}</p>}
          {stats.unique_courses && <p><strong>Unique Courses:</strong> {stats.unique_courses}</p>}
          {stats.unique_locations && <p><strong>Training Locations:</strong> {stats.unique_locations}</p>}
          {stats.unique_functional_areas && <p><strong>Functional Areas:</strong> {stats.unique_functional_areas}</p>}
        </div>
      )}

      <div className="info-section">
        <h4>📋 About This Tool</h4>
        <p>
          This tool imports the complete training data export from MS Access.
          The CSV should contain all user information and course assignments in one flat table.
        </p>
        <p>
          <strong>Expected CSV Columns:</strong> ID, functional_area, sub_functional_area, est_duration_hrs,
          emp_id, name, business-unit, org, country, department, job_title, email, location,
          training_location, project_role, assigned_by, assigned_date, notes
        </p>
        <p>
          <strong>Import Mode:</strong> REPLACE - All existing training data for this project will be deleted
          and replaced with the new import.
        </p>
        <p className="info-note">
          <strong>⚠️ Warning:</strong> Importing will delete all existing training schedules and calendar events
          for this project. Make sure to export your data first if you need a backup!
        </p>
      </div>

      <h4>Import Training Data from MS Access</h4>

      <div className="import-section">
        <input
          type="file"
          accept=".csv"
          onChange={handleFileChange}
          disabled={loading}
        />
        <button
          onClick={handleImport}
          disabled={loading || !file}
        >
          {loading ? 'Importing...' : 'Import CSV (Replace All)'}
        </button>
      </div>

      {loading && progress.total > 0 && (
        <div className="progress-section">
          <div className="progress-info">
            <div className="progress-text">
              {progress.phase}
            </div>
            <div className="progress-stats">
              {progress.current} of {progress.total} ({Math.round((progress.current / progress.total) * 100)}%)
            </div>
          </div>
          <div className="progress-bar">
            <div
              className="progress-fill"
              style={{ width: `${(progress.current / progress.total) * 100}%` }}
            ></div>
          </div>
        </div>
      )}

      <div className="export-section">
        <h4>Export Training Data to CSV</h4>
        <div className="button-group">
          <button
            onClick={handleExport}
            disabled={loading}
          >
            {loading ? 'Exporting...' : 'Export All Training Data'}
          </button>
        </div>
      </div>

      {message && (
        <div className={`message ${message.startsWith('Error') || message.startsWith('❌') ? 'error' : 'success'}`}>
          <pre style={{ whiteSpace: 'pre-wrap', margin: 0, fontFamily: 'inherit' }}>{message}</pre>
        </div>
      )}
    </div>
  );
};

export default ImportExportTrainingData;
