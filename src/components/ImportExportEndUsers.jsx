import React, { useState, useEffect } from 'react';
import { supabase } from '../supabaseClient';
import './ImportExportEndUsers.css';

const ImportExportEndUsers = () => {
  const [file, setFile] = useState(null);
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState('');
  const [authStatus, setAuthStatus] = useState('Checking authentication...');

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
  };

  const handleImport = async () => {
    if (!file) {
      setMessage('Please select a file first');
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

          // Build required columns list from table schema
          const requiredColumns = ['change_type', ...Object.keys(columns[0] || {})]
            .filter(col => !['created_at', 'updated_at'].includes(col));

          const missingColumns = requiredColumns.filter(col => !headers.includes(col));
          if (missingColumns.length > 0) {
            throw new Error(`Missing required columns: ${missingColumns.join(', ')}`);
          }
          console.log('Verified required columns:', requiredColumns);
          
          // Step 1: Parse all rows and validate structure
          const parsedRows = [];
          const parseErrors = [];
          
          for (let i = 0; i < dataRows.length; i++) {
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

          let missingTrainingLocations = [];
          if (trainingLocationsToValidate.length > 0) {
            const { data: validLocations, error: locationsError } = await supabase
              .from('training_locations_tbl')
              .select('name')
              .in('name', trainingLocationsToValidate)
              .eq('active', true);

            if (locationsError) {
              console.warn('Could not validate training locations - reference table may not exist:', locationsError);
            } else {
              const validLocationNames = (validLocations || []).map(loc => loc.name);
              missingTrainingLocations = trainingLocationsToValidate.filter(loc => !validLocationNames.includes(loc));
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

          for (const rowData of parsedRows) {
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
                  result = await supabase
                    .from('end_users')
                    .insert([operationData]);
                  break;
                case 'Update':
                  result = await supabase
                    .from('end_users')
                    .update(operationData)
                    .eq('id', rowData.id);
                  break;
                case 'Delete':
                  result = await supabase
                    .from('end_users')
                    .delete()
                    .eq('id', rowData.id);
                  break;
                default:
                  throw new Error(`Invalid operation: ${rowData.change_type}`);
              }

              if (result.error) throw result.error;
              successCount++;
            } catch (error) {
              errorCount++;
              errors.push(`Row ${rowData.rowNumber}: ${error.message}`);
            }
          }

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

      // Build required columns list from table schema
      const headers = ['change_type', ...Object.keys(columns[0] || {})]
        .filter(col => !['created_at', 'updated_at'].includes(col));

      // Create example data
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
          default:
            return 'example_value';
        }
      });

      const csvContent = [
        headers.join(','),
        exampleRow.join(','),
        'Add,,Jane Doe,jane@example.com',
        'Update,2,Updated Name,updated@example.com',
        'Delete,3,,'
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
    setLoading(true);
    setMessage('');

    try {
      // Verify authentication
      const { data: { user }, error: authError } = await supabase.auth.getUser();
      if (authError || !user) {
        throw new Error('Authentication required');
      }

      // Fetch all users
      const { data: users, error: fetchError } = await supabase
        .from('end_users')
        .select('*')
        .order('id', { ascending: true });

      if (fetchError) throw fetchError;

      // Get headers from first user, excluding system columns
      const headers = Object.keys(users[0] || {})
        .filter(col => !['created_at', 'updated_at'].includes(col));

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

  return (
    <div className="import-export-container">
      <h3>Import/Export Users</h3>
     
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
