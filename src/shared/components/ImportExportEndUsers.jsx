import React, { useState, useEffect } from 'react';
import { supabase } from '@core/services/supabaseClient';
import { useProject } from '@core/contexts/ProjectContext';
import './ImportExportEndUsers.css';

const ImportExportEndUsers = () => {
  const { currentProject } = useProject();
  const [file, setFile] = useState(null);
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState('');
  const [authStatus, setAuthStatus] = useState('Checking authentication...');
  const [progress, setProgress] = useState({ current: 0, total: 0, phase: '' });

  // Check authentication status on mount
  useEffect(() => {
    const checkAuth = async () => {
      try {
        const { data: { user }, error } = await supabase.auth.getUser();
        if (error) throw error;
        setAuthStatus(user ? `Signed in as ${user.email}` : 'Not signed in');
      } catch (error) {
        setAuthStatus('Error checking authentication');
        console.error('Auth check error:', error);
      }
    };

    checkAuth();
  }, []);

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
      // Verify authentication
      const { data: { user }, error: authError } = await supabase.auth.getUser();
      if (authError || !user) {
        throw new Error('Authentication required');
      }

      const reader = new FileReader();
      reader.onload = async (e) => {
        try {
          const text = e.target.result;
          // Parse header and verify column order
          const [headerRow, ...dataRows] = text.split('\n');
          const headers = headerRow.split(',').map(h => h.trim());
          
          console.log('CSV headers:', headers);
          
          // Verify authentication
          const { data: { user }, error: authError } = await supabase.auth.getUser();
          if (authError || !user) {
            throw new Error('Authentication required');
          }

          // Get table columns to validate against
          const { data: columns, error: columnsError } = await supabase
            .from('end_users')
            .select('*')
            .limit(1);

          if (columnsError) throw columnsError;

          // Use the actual CSV headers for column mapping instead of guessing from database
          const requiredColumns = headers;

          // Validate that essential columns exist
          const essentialColumns = ['change_type', 'name', 'email'];
          const missingEssential = essentialColumns.filter(col => !headers.includes(col));
          if (missingEssential.length > 0) {
            throw new Error(`Missing essential columns: ${missingEssential.join(', ')}`);
          }
          console.log('Verified required columns:', requiredColumns);
          
          // Step 1: Parse all rows and validate structure
          setProgress({ current: 0, total: dataRows.length, phase: 'Parsing CSV data...' });
          const parsedRows = [];
          const parseErrors = [];
          
          for (let i = 0; i < dataRows.length; i++) {
            setProgress({ current: i + 1, total: dataRows.length, phase: `Parsing row ${i + 1} of ${dataRows.length}...` });
            const row = dataRows[i];
            if (!row.trim()) continue;
            
            try {
              // Use headers from CSV file for column mapping
              // Handle quoted values and proper CSV parsing
              const values = row.split(/,(?=(?:(?:[^"]*"){2})*[^"]*$)/)
                .map(v => v.trim().replace(/^"(.*)"$/, '$1'));
              
              console.log('Parsed row values:', values);
              
              // Verify column count matches required columns
              if (values.length < requiredColumns.length) {
                throw new Error(
                  `Expected ${requiredColumns.length} columns but got ${values.length}. ` +
                  `Required columns: ${requiredColumns.join(', ')}`
                );
              }

              // Create row data object mapping values to column names
              const rowData = { rowNumber: i + 2 }; // +2 because of header row and 0-indexing
              requiredColumns.forEach((col, idx) => {
                rowData[col] = values[idx];
              });
              
              console.log('Row data:', rowData);

              // Validate required fields
              if (!rowData.change_type) {
                throw new Error('Missing change_type');
              }
              if (rowData.change_type !== 'Add' && !rowData.id) {
                throw new Error('ID is required for updates and deletes');
              }
              if (rowData.change_type === 'Add' && (!rowData.name || !rowData.email)) {
                throw new Error('Name and email are required for new users');
              }

              parsedRows.push(rowData);
            } catch (error) {
              parseErrors.push(`Row ${i + 2}: ${error.message}`);
            }
          }

          // Step 2: Pre-validate training locations against reference table
          const trainingLocationsToValidate = [...new Set(
            parsedRows
              .filter(row => row.training_location && (row.change_type === 'Add' || row.change_type === 'Update'))
              .map(row => row.training_location)
              .filter(loc => loc && loc.trim() !== '') // Filter out empty/null values
          )];

          console.log('Training locations from CSV to validate:', trainingLocationsToValidate);
          console.log('Required columns order:', requiredColumns);
          console.log('Sample parsed rows:', parsedRows.slice(0, 3).map(row => ({ 
            training_location: row.training_location,
            location_name: row.location_name,
            change_type: row.change_type 
          })));

          let missingTrainingLocations = [];
          if (trainingLocationsToValidate.length > 0) {
            const { data: validLocations, error: locationsError } = await supabase
              .from('training_locations')
              .select('name')
              .in('name', trainingLocationsToValidate)
              .eq('active', true);

            if (locationsError) {
              console.warn('Could not validate training locations - reference table may not exist:', locationsError);
            } else {
              const validLocationNames = (validLocations || []).map(loc => loc.name);
              console.log('Valid training locations from database:', validLocationNames);
              console.log('Checking these CSV values:', trainingLocationsToValidate);
              missingTrainingLocations = trainingLocationsToValidate.filter(loc => !validLocationNames.includes(loc));
              console.log('Missing training locations:', missingTrainingLocations);
            }
          }

          // Step 3: Show validation report if there are issues
          const allErrors = [...parseErrors];
          if (missingTrainingLocations.length > 0) {
            allErrors.push(`Missing training locations (add these to Reference Data Management first): ${missingTrainingLocations.join(', ')}`);
          }

          if (allErrors.length > 0) {
            setMessage(
              `❌ Import validation failed:\n\n${allErrors.join('\n')}\n\n` +
              `Please fix these issues and try again. Use Reference Data Management to add missing training locations.`
            );
            return;
          }

          // Step 4: All validation passed - proceed with import
          let successCount = 0;
          let errorCount = 0;
          const errors = [];

          setProgress({ current: 0, total: parsedRows.length, phase: 'Importing users...' });

          for (let index = 0; index < parsedRows.length; index++) {
            const rowData = parsedRows[index];
            setProgress({ 
              current: index + 1, 
              total: parsedRows.length, 
              phase: `Importing user ${index + 1} of ${parsedRows.length}: ${rowData.name}` 
            });
            try {
              let result;
              // Create operation data with all columns except change_type and rowNumber
              const operationData = Object.keys(rowData).reduce((acc, key) => {
                if (key !== 'change_type' && key !== 'rowNumber') {
                  acc[key] = rowData[key];
                }
                return acc;
              }, {});

              switch (rowData.change_type) {
                case 'Add':
                  // Add project_id for new users
                  operationData.project_id = currentProject.id;
                  
                  // Use upsert to insert or update if exists
                  result = await supabase
                    .from('end_users')
                    .upsert([operationData], {
                      onConflict: 'id',
                      ignoreDuplicates: false
                    });
                  break;
                case 'Update':
                  result = await supabase
                    .from('end_users')
                    .update(operationData)
                    .eq('id', rowData.id)
                    .eq('project_id', currentProject.id);
                  break;
                case 'Delete':
                  result = await supabase
                    .from('end_users')
                    .delete()
                    .eq('id', rowData.id)
                    .eq('project_id', currentProject.id);
                  break;
                default:
                  throw new Error(`Invalid operation: ${rowData.change_type}`);
              }

              if (result.error) {
                // Provide more detailed error messages for common conflicts
                let errorMessage = result.error.message;
                if (result.error.code === '23505') { // Unique constraint violation
                  if (result.error.message.includes('pkey')) {
                    errorMessage = `ID '${rowData.id}' already exists`;
                  } else if (result.error.message.includes('email')) {
                    errorMessage = `Email '${rowData.email}' already exists`;
                  } else {
                    errorMessage = `Duplicate value conflict: ${result.error.message}`;
                  }
                }
                throw new Error(errorMessage);
              }
              successCount++;
            } catch (error) {
              errorCount++;
              errors.push(`Row ${rowData.rowNumber}: ${error.message}`);
            }
          }

          setProgress({ current: parsedRows.length, total: parsedRows.length, phase: 'Import completed!' });
          
          const successMessage = `✅ Import completed successfully: ${successCount} records processed.`;
          const errorMessage = errors.length > 0 ? `\n\n⚠️ Some errors occurred: ${errors.join('; ')}` : '';
          setMessage(successMessage + errorMessage);
        } catch (error) {
          setMessage(`Error processing file: ${error.message}`);
        } finally {
          setLoading(false);
        }
      };

      reader.onerror = () => {
        let errorMessage = 'Error reading file';
        switch (reader.error.code) {
          case reader.error.NOT_FOUND_ERR:
            errorMessage = 'File not found';
            break;
          case reader.error.NOT_READABLE_ERR:
            errorMessage = 'File is not readable';
            break;
          case reader.error.ABORT_ERR:
            errorMessage = 'File reading was aborted';
            break;
          default:
            errorMessage = `File reading error (code ${reader.error.code})`;
        }
        console.error('FileReader error:', reader.error);
        setMessage(errorMessage);
        setLoading(false);
      };

      reader.readAsText(file);
    } catch (error) {
      setMessage(`Error: ${error.message}`);
      setLoading(false);
    }
  };

  const handleExportTemplate = async () => {
    setLoading(true);
    setMessage('');

    try {
      // Verify authentication
      const { data: { user }, error: authError } = await supabase.auth.getUser();
      if (authError || !user) {
        throw new Error('Authentication required');
      }

      // Get table columns to validate against
      const { data: columns, error: columnsError } = await supabase
        .from('end_users')
        .select('*')
        .limit(1);

      if (columnsError) throw columnsError;

      // Build required columns list with proper ordering
      // Define the correct column order for end_users (matching CSV header order)
      const orderedColumns = [
        'change_type',
        'id', 
        'name', 
        'email', 
        'job_title', 
        'country', 
        'division', 
        'sub_division', 
        'location_name', 
        'training_location', 
        'project_role', 
        'project_id'
      ];
      
      // Get actual table columns and filter out system columns
      const tableColumns = Object.keys(columns[0] || {})
        .filter(col => !['created_at', 'updated_at'].includes(col));
      
      // Use ordered columns if they match table structure, otherwise fall back to dynamic
      const headers = orderedColumns.every(col => col === 'change_type' || tableColumns.includes(col)) 
        ? orderedColumns 
        : ['change_type', ...tableColumns];

      // Create example data with proper field examples
      const exampleRow = headers.map(header => {
        switch (header) {
          case 'change_type':
            return 'Add';
          case 'id':
            return '1';
          case 'name':
            return 'John Doe';
          case 'email':
            return 'john@example.com';
          case 'job_title':
            return 'Product Manager';
          case 'country':
            return 'Egypt';
          case 'division':
            return 'Distribution';
          case 'sub_division':
            return 'Logistics';
          case 'location_name':
            return 'Cairo Office';
          case 'training_location':
            return 'YASMINE';
          case 'project_role':
            return 'Logistics Planner';
          case 'project_id':
            return currentProject?.id || 'project-uuid-here';
          default:
            return '';
        }
      });

      const csvContent = [
        headers.join(','),
        exampleRow.join(',')
      ].join('\n');
      const blob = new Blob([csvContent], { type: 'text/csv' });
      const url = URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      link.download = 'end_users_template.csv';
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);

      setMessage('Template downloaded successfully');
    } catch (error) {
      setMessage(`Error: ${error.message}`);
    } finally {
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
      // Verify authentication
      const { data: { user }, error: authError } = await supabase.auth.getUser();
      if (authError || !user) {
        throw new Error('Authentication required');
      }

      // Fetch users for current project only
      const { data: users, error: fetchError } = await supabase
        .from('end_users')
        .select('*')
        .eq('project_id', currentProject.id)
        .order('id', { ascending: true });

      if (fetchError) throw fetchError;

      // Use consistent column ordering for export
      const orderedColumns = [
        'id', 
        'name', 
        'email', 
        'job_title', 
        'country', 
        'division', 
        'sub_division', 
        'location_name', 
        'training_location', 
        'project_role', 
        'project_id'
      ];
      
      // Get actual table columns and filter out system columns
      const tableColumns = Object.keys(users[0] || {})
        .filter(col => !['created_at', 'updated_at'].includes(col));
      
      // Use ordered columns if they match table structure, otherwise fall back to dynamic
      const headers = orderedColumns.every(col => tableColumns.includes(col)) 
        ? orderedColumns 
        : tableColumns;

      // Convert data to CSV
      const csvContent = [
        headers.join(','),
        ...users.map(user => 
          headers.map(header => 
            JSON.stringify(user[header])
          ).join(',')
        )
      ].join('\n');

      // Create download link
      const blob = new Blob([csvContent], { type: 'text/csv' });
      const url = URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      link.download = 'end_users_export.csv';
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      URL.revokeObjectURL(url);

      setMessage('Export completed successfully');
    } catch (error) {
      setMessage(`Export error: ${error.message}`);
    } finally {
      setLoading(false);
    }
  };

  if (!currentProject) {
    return (
      <div className="import-export-container">
        <div className="no-project-state">
          <h3>No Project Selected</h3>
          <p>Please select a project from the Projects page to import/export users.</p>
          <p>Each project has its own isolated set of users and data.</p>
        </div>
      </div>
    );
  }

  return (
    <div className="import-export-container">
      <h3>Import/Export Users</h3>
      <div className="project-indicator">
        <strong>Project:</strong> {currentProject.title}
      </div>
     
        <h4>Import Users</h4>
      
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
            {loading ? 'Importing...' : 'Import CSV'}
          </button>
          <button 
            onClick={handleExportTemplate}
            disabled={loading}
          >
            {loading ? 'Preparing...' : 'Download Template'}
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
        <h4>Export Users</h4>
        <div className="button-group">
          <button 
            onClick={handleExport}
            disabled={loading}
          >
            {loading ? 'Exporting...' : 'Export All Users'}
          </button>
        </div>
      </div>

      {message && (
        <div className={`message ${message.startsWith('Error') ? 'error' : ''}`}>
          {message}
        </div>
      )}
    </div>
  );
};

export default ImportExportEndUsers;
