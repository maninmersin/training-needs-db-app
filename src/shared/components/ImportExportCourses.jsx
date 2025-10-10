import { useState, useEffect } from 'react';
import { supabase } from '@core/services/supabaseClient';
import { useProject } from '@core/contexts/ProjectContext';
import './ImportExportCourses.css';

const ImportExportCourses = ({ onImportComplete }) => {
  const { currentProject } = useProject();
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

    if (!currentProject) {
      setMessage('Please select a project first');
      return;
    }

    setLoading(true);
    setMessage('');

    try {
      const reader = new FileReader();
      reader.onload = async (e) => {
        try {
          const text = e.target.result;
          const [headerRow, ...dataRows] = text.split('\n');
          const headers = headerRow.split(',').map(h => h.trim());
          
          // Verify required columns
          const requiredColumns = ['change_type', 'course_id', 'course_name', 'functional_area', 'duration_hrs', 'priority'];
          const missingColumns = requiredColumns.filter(col => !headers.includes(col));
          if (missingColumns.length > 0) {
            throw new Error(`Missing required columns: ${missingColumns.join(', ')}`);
          }

          // Step 1: Parse all rows and validate structure
          const parsedRows = [];
          const parseErrors = [];
          
          for (let i = 0; i < dataRows.length; i++) {
            const row = dataRows[i];
            if (!row.trim()) continue;
            
            try {
              const values = row.split(/,(?=(?:(?:[^"]*"){2})*[^"]*$)/)
                .map(v => v.trim().replace(/^"(.*)"$/, '$1'));
              
              // Create row data object mapping values to column names
              const rowData = { rowNumber: i + 2 }; // +2 because of header row and 0-indexing
              headers.forEach((header, idx) => {
                rowData[header] = values[idx];
              });

              // Validate required fields based on operation type
              if (!rowData.change_type) {
                throw new Error('Missing change_type');
              }
              if (rowData.change_type !== 'Add' && !rowData.course_id) {
                throw new Error('course_id is required for updates and deletes');
              }
              if (rowData.change_type === 'Add' && (!rowData.course_name || !rowData.functional_area || !rowData.duration_hrs || !rowData.priority)) {
                throw new Error('All fields including priority are required for new courses');
              }

              parsedRows.push(rowData);
            } catch (error) {
              parseErrors.push(`Row ${i + 2}: ${error.message}`);
            }
          }

          // Step 2: Pre-validate functional areas against reference table
          const functionalAreasToValidate = [...new Set(
            parsedRows
              .filter(row => row.functional_area && (row.change_type === 'Add' || row.change_type === 'Update'))
              .map(row => row.functional_area)
          )];

          let missingFunctionalAreas = [];
          if (functionalAreasToValidate.length > 0) {
            const { data: validAreas, error: areasError } = await supabase
              .from('functional_areas')
              .select('name')
              .in('name', functionalAreasToValidate)
              .eq('active', true);

            if (areasError) {
              console.warn('Could not validate functional areas - reference table may not exist:', areasError);
            } else {
              const validAreaNames = (validAreas || []).map(area => area.name);
              missingFunctionalAreas = functionalAreasToValidate.filter(area => !validAreaNames.includes(area));
            }
          }

          // Step 3: Show validation report if there are issues
          const allErrors = [...parseErrors];
          if (missingFunctionalAreas.length > 0) {
            allErrors.push(`Missing functional areas (add these to Reference Data Management first): ${missingFunctionalAreas.join(', ')}`);
          }

          if (allErrors.length > 0) {
            setMessage(
              `❌ Import validation failed:\n\n${allErrors.join('\n')}\n\n` +
              `Please fix these issues and try again. Use Reference Data Management to add missing functional areas.`
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
              const operationData = {
                course_id: rowData.course_id,
                course_name: rowData.course_name,
                functional_area: rowData.functional_area,
                duration_hrs: parseFloat(rowData.duration_hrs),
                application: rowData.application || null,
                priority: parseInt(rowData.priority) || 1,
                project_id: currentProject?.id
              };

              switch (rowData.change_type) {
                case 'Add':
                  result = await supabase
                    .from('courses')
                    .insert([operationData]);
                  break;
                case 'Update':
                  result = await supabase
                    .from('courses')
                    .update(operationData)
                    .eq('course_id', rowData.course_id);
                  break;
                case 'Delete':
                  result = await supabase
                    .from('courses')
                    .delete()
                    .eq('course_id', rowData.course_id);
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
        .from('courses')
        .select('*')
        .eq('project_id', currentProject.id)
        .order('course_id', { ascending: true });

      if (error) throw error;

      // Convert data to CSV
      const headers = ['course_id', 'course_name', 'functional_area', 'duration_hrs', 'application', 'priority'];
      const csvContent = [
        headers.join(','),
        ...data.map(row => 
          headers.map(header => 
            JSON.stringify(row[header])
          ).join(',')
        )
      ].join('\n');

      // Create download link
      const blob = new Blob([csvContent], { type: 'text/csv' });
      const url = URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      link.download = 'courses_export.csv';
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

  const handleDownloadTemplate = () => {
    const templateContent = [
      'change_type,course_id,course_name,functional_area,duration_hrs,application,priority',
      'Add,C001,Introduction to React,Frontend Development,2.5,Web Development,1',
      'Update,C002,Advanced Node.js,Backend Development,3.0,API Development,2',
      'Delete,C003,,,,'
    ].join('\n');

    const blob = new Blob([templateContent], { type: 'text/csv' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = 'courses_template.csv';
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
  };

  if (!currentProject) {
    return (
      <div className="import-export-container">
        <div className="no-project-state">
          <h3>No Project Selected</h3>
          <p>Please select a project from the Projects page to import/export courses.</p>
          <p>Each project has its own isolated set of courses and data.</p>
        </div>
      </div>
    );
  }

  return (
    <div className="import-export-container">
      <h3>Import/Export Courses</h3>
      <div className="project-indicator">
        <strong>Project:</strong> {currentProject.title}
      </div>
      {message && (
        <div className={`message ${message.startsWith('Error') ? 'error' : ''}`}>
          {message}
        </div>
      )}
      
      <div className="import-section">
        <h4>Import Courses</h4>
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
          onClick={handleDownloadTemplate}
          disabled={loading}
        >
          {loading ? 'Preparing...' : 'Download Template'}
        </button>
      </div>

      <div className="export-section">
        <h4>Export Courses</h4>
        <button 
          onClick={handleExport}
          disabled={loading}
        >
          {loading ? 'Exporting...' : 'Export Courses CSV'}
        </button>
      </div>
    </div>
  );
};

export default ImportExportCourses;
