import React, { useState } from 'react';
import { useParams } from 'react-router-dom';
import { useProject } from '@core/contexts/ProjectContext';
import { 
  bulkImportProcessHierarchy,
  exportProcessHierarchyForExcel,
  getImpactAssessments 
} from '../services/impactAssessmentService';
import * as XLSX from 'xlsx';
import './ProcessHierarchyImportExport.css';

/**
 * Process Hierarchy Import/Export Component
 * Handles bulk Excel import/export of process hierarchies
 * Provides data validation and error reporting
 */
const ProcessHierarchyImportExport = () => {
  const { assessmentId: urlAssessmentId } = useParams();
  const { currentProject } = useProject();
  
  const [loading, setLoading] = useState(false);
  const [assessments, setAssessments] = useState([]);
  const [selectedAssessmentId, setSelectedAssessmentId] = useState(urlAssessmentId || '');
  const [importFile, setImportFile] = useState(null);
  const [importResults, setImportResults] = useState(null);
  const [error, setError] = useState(null);
  const [previewData, setPreviewData] = useState([]);
  const [showPreview, setShowPreview] = useState(false);

  // Load assessments on mount
  React.useEffect(() => {
    if (currentProject?.id) {
      loadAssessments();
    }
  }, [currentProject?.id]);

  const loadAssessments = async () => {
    try {
      const assessmentsData = await getImpactAssessments(currentProject.id);
      setAssessments(assessmentsData);
      
      if (!selectedAssessmentId && assessmentsData.length > 0) {
        setSelectedAssessmentId(assessmentsData[0].id);
      }
    } catch (err) {
      console.error('Error loading assessments:', err);
      setError(err.message || 'Failed to load assessments');
    }
  };

  const handleFileSelect = (event) => {
    const file = event.target.files[0];
    if (file) {
      if (!file.name.match(/\.(xlsx|xls|csv)$/)) {
        setError('Please select a valid Excel file (.xlsx, .xls) or CSV file');
        return;
      }
      setImportFile(file);
      setError(null);
      setImportResults(null);
      parseFilePreview(file);
    }
  };

  const parseFilePreview = (file) => {
    const reader = new FileReader();
    reader.onload = (e) => {
      try {
        const workbook = XLSX.read(e.target.result, { type: 'binary' });
        const firstSheet = workbook.Sheets[workbook.SheetNames[0]];
        const jsonData = XLSX.utils.sheet_to_json(firstSheet);
        
        // Map Excel columns to our expected format
        const mappedData = jsonData.slice(0, 10).map((row, index) => ({
          process_code: row['Process Code'] || row['process_code'] || '',
          process_name: row['Process Name'] || row['process_name'] || '',
          level_number: parseInt(row['Level'] || row['level_number'] || 0),
          parent_id: row['Parent ID'] || row['parent_id'] || '',
          sort_order: parseInt(row['Sort Order'] || row['sort_order'] || 0)
        }));

        setPreviewData(mappedData);
        setShowPreview(true);
      } catch (err) {
        console.error('Error parsing file:', err);
        setError('Failed to parse file. Please ensure it\'s a valid Excel/CSV file.');
      }
    };
    reader.readAsBinaryString(file);
  };

  const handleImport = async () => {
    if (!importFile || !selectedAssessmentId) {
      setError('Please select both a file and an assessment');
      return;
    }

    setLoading(true);
    setError(null);

    const reader = new FileReader();
    reader.onload = async (e) => {
      try {
        const workbook = XLSX.read(e.target.result, { type: 'binary' });
        const firstSheet = workbook.Sheets[workbook.SheetNames[0]];
        const jsonData = XLSX.utils.sheet_to_json(firstSheet);
        
        // Map Excel columns to our expected format
        const processData = jsonData.map((row) => ({
          process_code: row['Process Code'] || row['process_code'] || '',
          process_name: row['Process Name'] || row['process_name'] || '',
          level_number: parseInt(row['Level'] || row['level_number'] || 0),
          parent_id: row['Parent ID'] || row['parent_id'] || '',
          sort_order: parseInt(row['Sort Order'] || row['sort_order'] || 0)
        }));

        const results = await bulkImportProcessHierarchy(selectedAssessmentId, processData);
        setImportResults(results);
        
        if (results.errors.length === 0) {
          setImportFile(null);
          setShowPreview(false);
          // Reset file input
          const fileInput = document.getElementById('import-file');
          if (fileInput) fileInput.value = '';
        }
      } catch (err) {
        console.error('Import error:', err);
        setError(err.message || 'Failed to import process hierarchy');
      } finally {
        setLoading(false);
      }
    };
    reader.readAsBinaryString(importFile);
  };

  const handleExport = async () => {
    if (!selectedAssessmentId) {
      setError('Please select an assessment to export');
      return;
    }

    setLoading(true);
    setError(null);

    try {
      const exportData = await exportProcessHierarchyForExcel(selectedAssessmentId);
      
      // Create workbook and worksheet
      const wb = XLSX.utils.book_new();
      const ws = XLSX.utils.json_to_sheet(exportData, {
        header: [
          'id', 
          'process_code', 
          'process_name', 
          'level_number', 
          'level_label',
          'parent_id',
          'sort_order',
          'hierarchy_path',
          'created_at',
          'updated_at'
        ]
      });

      // Set column widths
      ws['!cols'] = [
        { wch: 15 }, // id
        { wch: 15 }, // process_code
        { wch: 30 }, // process_name
        { wch: 10 }, // level_number
        { wch: 10 }, // level_label
        { wch: 15 }, // parent_id
        { wch: 12 }, // sort_order
        { wch: 50 }, // hierarchy_path
        { wch: 20 }, // created_at
        { wch: 20 }  // updated_at
      ];

      XLSX.utils.book_append_sheet(wb, ws, 'Process Hierarchy');

      // Get assessment name for filename
      const assessment = assessments.find(a => a.id === selectedAssessmentId);
      const filename = `process_hierarchy_${assessment?.name || 'export'}_${new Date().toISOString().slice(0, 10)}.xlsx`;
      
      XLSX.writeFile(wb, filename);
    } catch (err) {
      console.error('Export error:', err);
      setError(err.message || 'Failed to export process hierarchy');
    } finally {
      setLoading(false);
    }
  };

  const downloadTemplate = () => {
    const templateData = [
      {
        'Process Code': '1',
        'Process Name': 'PLAN',
        'Level': 0,
        'Parent ID': '',
        'Sort Order': 1
      },
      {
        'Process Code': '1.1',
        'Process Name': 'Strategic Planning',
        'Level': 1,
        'Parent ID': '', // Will be filled with ID of PLAN process
        'Sort Order': 1
      },
      {
        'Process Code': '1.2',
        'Process Name': 'Financial Planning', 
        'Level': 1,
        'Parent ID': '', // Will be filled with ID of PLAN process
        'Sort Order': 2
      },
      {
        'Process Code': '2',
        'Process Name': 'EXECUTE',
        'Level': 0,
        'Parent ID': '',
        'Sort Order': 2
      }
    ];

    const wb = XLSX.utils.book_new();
    const ws = XLSX.utils.json_to_sheet(templateData);
    
    // Set column widths
    ws['!cols'] = [
      { wch: 15 }, // Process Code
      { wch: 30 }, // Process Name
      { wch: 10 }, // Level
      { wch: 15 }, // Parent ID
      { wch: 12 }  // Sort Order
    ];

    XLSX.utils.book_append_sheet(wb, ws, 'Process Hierarchy Template');
    XLSX.writeFile(wb, 'process_hierarchy_template.xlsx');
  };

  return (
    <div className="import-export-manager">
      {/* Header */}
      <div className="manager-header">
        <h1>Process Hierarchy Import/Export</h1>
        <p>Bulk import process hierarchies from Excel or export existing data</p>
      </div>

      {/* Assessment Selection */}
      <div className="assessment-selector">
        <label htmlFor="assessment-select">Select Assessment:</label>
        <select
          id="assessment-select"
          value={selectedAssessmentId}
          onChange={(e) => setSelectedAssessmentId(e.target.value)}
          className="assessment-select"
        >
          <option value="">Choose an assessment...</option>
          {assessments.map(assessment => (
            <option key={assessment.id} value={assessment.id}>
              {assessment.name} ({assessment.status})
            </option>
          ))}
        </select>
      </div>

      {error && (
        <div className="error-message">
          <p>Error: {error}</p>
        </div>
      )}

      <div className="import-export-content">
        {/* Import Section */}
        <div className="import-section">
          <h2>Import Process Hierarchy</h2>
          <p>Upload an Excel file with process hierarchy data</p>
          
          <div className="import-controls">
            <div className="file-input-group">
              <input
                type="file"
                id="import-file"
                accept=".xlsx,.xls,.csv"
                onChange={handleFileSelect}
                className="file-input"
              />
              <label htmlFor="import-file" className="file-input-label">
                {importFile ? importFile.name : 'Choose Excel file...'}
              </label>
            </div>

            <button 
              onClick={downloadTemplate}
              className="btn btn-secondary"
            >
              📥 Download Template
            </button>
          </div>

          {/* File Preview */}
          {showPreview && previewData.length > 0 && (
            <div className="preview-section">
              <h3>Preview (First 10 rows)</h3>
              <div className="preview-table-container">
                <table className="preview-table">
                  <thead>
                    <tr>
                      <th>Process Code</th>
                      <th>Process Name</th>
                      <th>Level</th>
                      <th>Parent ID</th>
                      <th>Sort Order</th>
                    </tr>
                  </thead>
                  <tbody>
                    {previewData.map((row, index) => (
                      <tr key={index}>
                        <td>{row.process_code}</td>
                        <td>{row.process_name}</td>
                        <td>L{row.level_number}</td>
                        <td>{row.parent_id || 'None'}</td>
                        <td>{row.sort_order}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}

          <div className="import-actions">
            <button
              onClick={handleImport}
              disabled={!importFile || !selectedAssessmentId || loading}
              className="btn btn-primary"
            >
              {loading ? 'Importing...' : 'Import Process Hierarchy'}
            </button>
          </div>

          {/* Import Results */}
          {importResults && (
            <div className="import-results">
              <h3>Import Results</h3>
              <div className="results-summary">
                <div className="result-stat">
                  <span className="stat-label">Total Processed:</span>
                  <span className="stat-value">{importResults.total}</span>
                </div>
                <div className="result-stat">
                  <span className="stat-label">Created:</span>
                  <span className="stat-value success">{importResults.created}</span>
                </div>
                <div className="result-stat">
                  <span className="stat-label">Updated:</span>
                  <span className="stat-value info">{importResults.updated}</span>
                </div>
                <div className="result-stat">
                  <span className="stat-label">Errors:</span>
                  <span className="stat-value error">{importResults.errors.length}</span>
                </div>
              </div>

              {importResults.errors.length > 0 && (
                <div className="import-errors">
                  <h4>Import Errors:</h4>
                  <ul>
                    {importResults.errors.map((error, index) => (
                      <li key={index}>
                        Row {error.row}: {Array.isArray(error.errors) ? error.errors.join(', ') : error.error}
                      </li>
                    ))}
                  </ul>
                </div>
              )}
            </div>
          )}
        </div>

        {/* Export Section */}
        <div className="export-section">
          <h2>Export Process Hierarchy</h2>
          <p>Download existing process hierarchy as Excel file</p>
          
          <div className="export-actions">
            <button
              onClick={handleExport}
              disabled={!selectedAssessmentId || loading}
              className="btn btn-primary"
            >
              {loading ? 'Exporting...' : '📤 Export to Excel'}
            </button>
          </div>

          <div className="export-info">
            <h4>Export includes:</h4>
            <ul>
              <li>Process codes and names</li>
              <li>Hierarchy levels and relationships</li>
              <li>Sort order information</li>
              <li>Full hierarchy paths</li>
              <li>Creation and modification timestamps</li>
            </ul>
          </div>
        </div>
      </div>
    </div>
  );
};

export default ProcessHierarchyImportExport;