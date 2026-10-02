import React, { useState, useEffect } from 'react';
import { supabase } from '@core/services/supabaseClient';
import { useProject } from '@core/contexts/ProjectContext';
import './ImportExportUserCourseMappings.css';

const ImportExportUserCourseMappings = () => {
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
          const [headerRow, ...dataRows] = text.split('\n');
          const headers = headerRow.split(',').map(h => h.trim());

          console.log('CSV headers:', headers);

          // Verify required columns for Long Format
          const requiredColumns = ['UserID', 'Name', 'Email', 'Role', 'Location', 'CourseID'];
          const missingColumns = requiredColumns.filter(col => !headers.includes(col));
          if (missingColumns.length > 0) {
            throw new Error(`Missing required columns: ${missingColumns.join(', ')}`);
          }

          // Step 1: Parse all rows and validate structure
          setProgress({ current: 0, total: dataRows.length, phase: 'Parsing CSV data...' });
          const parsedRows = [];
          const parseErrors = [];

          for (let i = 0; i < dataRows.length; i++) {
            setProgress({
              current: i + 1,
              total: dataRows.length,
              phase: `Parsing row ${i + 1} of ${dataRows.length}...`
            });

            const row = dataRows[i];
            if (!row.trim()) continue;

            try {
              // Handle quoted values and proper CSV parsing
              const values = row.split(/,(?=(?:(?:[^"]*"){2})*[^"]*$)/)
                .map(v => v.trim().replace(/^"(.*)"$/, '$1'));

              // Create row data object
              const rowData = { rowNumber: i + 2 }; // +2 for header and 0-indexing
              headers.forEach((header, idx) => {
                rowData[header] = values[idx];
              });

              // Validate required fields
              if (!rowData.UserID || !rowData.Name || !rowData.Email || !rowData.CourseID) {
                throw new Error('UserID, Name, Email, and CourseID are required');
              }

              parsedRows.push(rowData);
            } catch (error) {
              parseErrors.push(`Row ${i + 2}: ${error.message}`);
            }
          }

          if (parseErrors.length > 0) {
            setMessage(
              `❌ Import validation failed:\n\n${parseErrors.join('\n')}\n\n` +
              `Please fix these issues and try again.`
            );
            setLoading(false);
            return;
          }

          // Step 2: Pre-validate courses exist
          const uniqueCourseIds = [...new Set(parsedRows.map(row => row.CourseID))];
          setProgress({ current: 0, total: 0, phase: 'Validating courses...' });

          const { data: existingCourses, error: coursesError } = await supabase
            .from('courses')
            .select('course_id')
            .in('course_id', uniqueCourseIds);

          if (coursesError) throw coursesError;

          const validCourseIds = existingCourses.map(c => c.course_id);
          const missingCourses = uniqueCourseIds.filter(id => !validCourseIds.includes(id));

          if (missingCourses.length > 0) {
            setMessage(
              `❌ Import validation failed:\n\n` +
              `The following courses do not exist in the database:\n${missingCourses.join(', ')}\n\n` +
              `Please import courses first using the Import/Export Courses tool.`
            );
            setLoading(false);
            return;
          }

          // Step 3: Group rows by user to create/update users
          setProgress({ current: 0, total: 0, phase: 'Processing users...' });

          const usersMap = new Map();
          parsedRows.forEach(row => {
            if (!usersMap.has(row.UserID)) {
              usersMap.set(row.UserID, {
                id: parseInt(row.UserID),
                name: row.Name,
                email: row.Email,
                project_role: row.Role || null,
                training_location: row.Location || null,
                job_title: row.JobTitle || null,
                country: row.Country || null,
                division: row.Division || null,
                sub_division: row.SubDivision || null,
                location_name: row.LocationName || null,
                project_id: currentProject.id,
                courses: []
              });
            }
            usersMap.get(row.UserID).courses.push(row.CourseID);
          });

          const users = Array.from(usersMap.values());
          console.log(`Processing ${users.length} unique users with ${parsedRows.length} course mappings`);

          // Step 4: Upsert users
          let usersProcessed = 0;
          let mappingsCreated = 0;
          const errors = [];

          for (const userData of users) {
            setProgress({
              current: usersProcessed + 1,
              total: users.length,
              phase: `Processing user ${usersProcessed + 1} of ${users.length}: ${userData.name}`
            });

            try {
              // Prepare user data (exclude courses array)
              const { courses, ...userRecord } = userData;

              // Upsert user (insert or update if exists)
              const { data: upsertedUser, error: userError } = await supabase
                .from('end_users')
                .upsert([userRecord], {
                  onConflict: 'id',
                  ignoreDuplicates: false
                })
                .select();

              if (userError) throw userError;

              usersProcessed++;

              // Step 5: Create course mappings for this user
              // First, delete existing mappings for this user to ensure clean state
              const { error: deleteError } = await supabase
                .from('user_course_mappings')
                .delete()
                .eq('end_user_id', userData.id)
                .eq('project_id', currentProject.id);

              if (deleteError) throw deleteError;

              // Insert new course mappings
              const mappings = courses.map(courseId => ({
                project_id: currentProject.id,
                end_user_id: userData.id,
                course_id: courseId,
                assigned_by: 'bulk',
                assigned_date: new Date().toISOString()
              }));

              const { data: insertedMappings, error: mappingsError } = await supabase
                .from('user_course_mappings')
                .insert(mappings);

              if (mappingsError) throw mappingsError;

              mappingsCreated += courses.length;

            } catch (error) {
              errors.push(`User ${userData.id} (${userData.name}): ${error.message}`);
            }
          }

          setProgress({
            current: users.length,
            total: users.length,
            phase: 'Import completed!'
          });

          const successMessage =
            `✅ Import completed successfully!\n\n` +
            `Users processed: ${usersProcessed} of ${users.length}\n` +
            `Course mappings created: ${mappingsCreated}\n` +
            `Total CSV rows: ${parsedRows.length}`;

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

  const handleExportTemplate = async () => {
    setLoading(true);
    setMessage('');

    try {
      // Verify authentication
      const { data: { user }, error: authError } = await supabase.auth.getUser();
      if (authError || !user) {
        throw new Error('Authentication required');
      }

      // Create template with example data
      const headers = ['UserID', 'Name', 'Email', 'Role', 'Location', 'CourseID'];
      const exampleRows = [
        ['1', 'John Doe', 'john@example.com', 'Manager', 'London', 'COURSE_A'],
        ['1', 'John Doe', 'john@example.com', 'Manager', 'London', 'COURSE_B'],
        ['2', 'Mary Smith', 'mary@example.com', 'Staff', 'Cairo', 'COURSE_A'],
        ['2', 'Mary Smith', 'mary@example.com', 'Staff', 'Cairo', 'COURSE_C']
      ];

      const csvContent = [
        headers.join(','),
        ...exampleRows.map(row => row.join(','))
      ].join('\n');

      const blob = new Blob([csvContent], { type: 'text/csv' });
      const url = URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      link.download = 'user_course_mappings_template.csv';
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      URL.revokeObjectURL(url);

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

      // Fetch users with their course mappings
      const { data: mappings, error: fetchError } = await supabase
        .from('user_course_mappings')
        .select(`
          end_user_id,
          course_id,
          end_users!inner (
            id,
            name,
            email,
            project_role,
            training_location
          )
        `)
        .eq('project_id', currentProject.id)
        .order('end_user_id', { ascending: true });

      if (fetchError) throw fetchError;

      // Transform to Long Format
      const headers = ['UserID', 'Name', 'Email', 'Role', 'Location', 'CourseID'];
      const csvContent = [
        headers.join(','),
        ...mappings.map(mapping => [
          mapping.end_users.id,
          `"${mapping.end_users.name}"`,
          mapping.end_users.email,
          `"${mapping.end_users.project_role || ''}"`,
          `"${mapping.end_users.training_location || ''}"`,
          mapping.course_id
        ].join(','))
      ].join('\n');

      // Create download link
      const blob = new Blob([csvContent], { type: 'text/csv' });
      const url = URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      link.download = 'user_course_mappings_export.csv';
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      URL.revokeObjectURL(url);

      setMessage(`Export completed successfully: ${mappings.length} course mappings exported`);
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
          <p>Please select a project from the Projects page to import/export user course mappings.</p>
          <p>Each project has its own isolated set of users and course assignments.</p>
        </div>
      </div>
    );
  }

  return (
    <div className="import-export-container">
      <h3>Import/Export User-Course Mappings</h3>
      <div className="project-indicator">
        <strong>Project:</strong> {currentProject.title}
      </div>

      <div className="info-section">
        <h4>📋 About This Tool</h4>
        <p>
          This tool imports user-course assignments in <strong>Long Format</strong> where each row represents
          one user-course assignment. Users with multiple courses will have multiple rows.
        </p>
        <p>
          <strong>Format:</strong> UserID, Name, Email, Role, Location, CourseID
        </p>
        <p className="info-note">
          <strong>Note:</strong> Courses must be imported first using the Import/Export Courses tool.
        </p>
      </div>

      <h4>Import User-Course Mappings</h4>

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
        <h4>Export User-Course Mappings</h4>
        <div className="button-group">
          <button
            onClick={handleExport}
            disabled={loading}
          >
            {loading ? 'Exporting...' : 'Export All Mappings'}
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

export default ImportExportUserCourseMappings;
