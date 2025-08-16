import React, { useState } from 'react';
import { supabase } from '../supabaseClient';
import * as XLSX from 'xlsx';
import { saveAs } from 'file-saver';

const ExcelExportDialog = ({ selectedSchedules, onBack }) => {
  const [exportFormat, setExportFormat] = useState('detailed'); // 'summary', 'detailed', 'visual', 'calendar'
  const [fileFormat, setFileFormat] = useState('xlsx'); // 'xlsx', 'csv'
  const [includeMetadata, setIncludeMetadata] = useState(true);
  const [exporting, setExporting] = useState(false);

  const exportSchedules = async () => {
    try {
      setExporting(true);

      // Fetch full schedule data for selected schedules
      const scheduleData = await Promise.all(
        selectedSchedules.map(async (schedule) => {
          const { data, error } = await supabase
            .from('training_schedules')
            .select('*')
            .eq('id', schedule.id)
            .single();

          if (error) throw error;
          return data;
        })
      );

      let workbook;

      if (exportFormat === 'summary') {
        workbook = createSummaryExport(scheduleData);
      } else if (exportFormat === 'detailed') {
        workbook = createDetailedExport(scheduleData);
      } else if (exportFormat === 'visual') {
        workbook = createVisualExport(scheduleData);
      } else if (exportFormat === 'calendar') {
        workbook = createCalendarExport(scheduleData);
      }

      // Add metadata sheet if requested
      if (includeMetadata) {
        addMetadataSheet(workbook, scheduleData);
      }

      // Generate filename
      const timestamp = new Date().toISOString().slice(0, 10);
      const filename = `training_schedules_${exportFormat}_${timestamp}.${fileFormat}`;

      // Export file
      if (fileFormat === 'xlsx') {
        const excelBuffer = XLSX.write(workbook, { bookType: 'xlsx', type: 'array' });
        const blob = new Blob([excelBuffer], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' });
        saveAs(blob, filename);
      } else {
        // For CSV, export the first sheet only
        const csv = XLSX.utils.sheet_to_csv(workbook.Sheets[workbook.SheetNames[0]]);
        const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
        saveAs(blob, filename.replace('.xlsx', '.csv'));
      }

      alert(`✅ Successfully exported ${selectedSchedules.length} schedule(s) to ${filename}`);
      onBack();

    } catch (error) {
      console.error('❌ Export error:', error);
      alert(`Failed to export schedules: ${error.message}`);
    } finally {
      setExporting(false);
    }
  };

  const createSummaryExport = (scheduleData) => {
    const summaryData = scheduleData.map(schedule => ({
      'Schedule Name': schedule.name,
      'Created Date': new Date(schedule.created_at).toLocaleDateString('en-GB'),
      'Version': schedule.version || 'v1.0',
      'Total Sessions': schedule.sessions?.length || 0,
      'Unique Courses': [...new Set(schedule.sessions?.map(s => s.course_name) || [])].length,
      'Date Range': getDateRange(schedule.sessions || []),
      'Locations': [...new Set(schedule.sessions?.map(s => s.location) || [])].join(', ') || 'N/A'
    }));

    const worksheet = XLSX.utils.json_to_sheet(summaryData);
    const workbook = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(workbook, worksheet, 'Schedule Summary');
    return workbook;
  };

  const createDetailedExport = (scheduleData) => {
    const detailedData = [];

    scheduleData.forEach(schedule => {
      if (schedule.sessions && Array.isArray(schedule.sessions)) {
        schedule.sessions.forEach(session => {
          detailedData.push({
            'Schedule Name': schedule.name,
            'Session Title': session.title,
            'Custom Title': session.custom_title || '',
            'Course Name': session.course_name,
            'Start Date': new Date(session.start).toLocaleDateString('en-GB'),
            'Start Time': new Date(session.start).toLocaleTimeString('en-GB'),
            'End Date': new Date(session.end).toLocaleDateString('en-GB'),
            'End Time': new Date(session.end).toLocaleTimeString('en-GB'),
            'Duration (hrs)': session.duration,
            'Location': session.location || 'TBD',
            'Group Name': session.group_name,
            'Functional Area': session.functional_area,
            'Group Number': session.session_number,
            'Course ID': session.course_id,
            'Trainer Name': session.trainer_name || '',
            'Trainer ID': session.trainer_id || '',
            'Max Participants': session.max_participants || '',
            'Current Participants': session.current_participants || 0,
            'Session Color': session.color || '#007bff',
            'Notes': session.notes || ''
          });
        });
      }
    });

    const worksheet = XLSX.utils.json_to_sheet(detailedData);
    const workbook = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(workbook, worksheet, 'Detailed Sessions');
    return workbook;
  };

  const createVisualExport = (scheduleData) => {
    const visualData = [];

    scheduleData.forEach(schedule => {
      if (schedule.sessions && Array.isArray(schedule.sessions)) {
        schedule.sessions.forEach(session => {
          visualData.push({
            'Schedule': schedule.name,
            'Session': session.custom_title || session.title,
            'Course': session.course_name,
            'Date': new Date(session.start).toLocaleDateString('en-GB'),
            'Time': `${new Date(session.start).toLocaleTimeString('en-GB')} - ${new Date(session.end).toLocaleTimeString('en-GB')}`,
            'Duration': `${session.duration}h`,
            'Location': session.location || 'TBD',
            'Trainer': session.trainer_name || 'Not Assigned',
            'Participants': session.max_participants ? `${session.current_participants || 0}/${session.max_participants}` : 'N/A',
            'Group': session.group_name,
            'Area': session.functional_area,
            'Color': session.color || '#007bff',
            'Notes': session.notes || ''
          });
        });
      }
    });

    const worksheet = XLSX.utils.json_to_sheet(visualData);
    
    // Apply formatting
    const range = XLSX.utils.decode_range(worksheet['!ref']);
    
    // Format headers
    for (let col = range.s.c; col <= range.e.c; col++) {
      const headerCell = XLSX.utils.encode_cell({r: 0, c: col});
      if (worksheet[headerCell]) {
        worksheet[headerCell].s = {
          font: { bold: true, color: { rgb: "FFFFFF" } },
          fill: { bgColor: { indexed: 64 }, fgColor: { rgb: "366092" } },
          alignment: { horizontal: "center" }
        };
      }
    }
    
    // Apply color formatting to session rows
    for (let row = 1; row <= range.e.r; row++) {
      const colorCell = XLSX.utils.encode_cell({r: row, c: 11}); // Color column
      const sessionCell = XLSX.utils.encode_cell({r: row, c: 1}); // Session column
      
      if (worksheet[colorCell] && worksheet[colorCell].v) {
        const hexColor = worksheet[colorCell].v.replace('#', '');
        const rgb = hexToRgb(hexColor);
        
        // Apply background color to session name
        if (worksheet[sessionCell]) {
          worksheet[sessionCell].s = {
            fill: { bgColor: { indexed: 64 }, fgColor: { rgb: hexColor } },
            font: { color: { rgb: getContrastColor(hexColor) } }
          };
        }
      }
    }
    
    // Set column widths
    worksheet['!cols'] = [
      { width: 20 }, // Schedule
      { width: 30 }, // Session
      { width: 25 }, // Course
      { width: 12 }, // Date
      { width: 20 }, // Time
      { width: 8 },  // Duration
      { width: 15 }, // Location
      { width: 20 }, // Trainer
      { width: 12 }, // Participants
      { width: 20 }, // Group
      { width: 15 }, // Area
      { width: 10 }, // Color
      { width: 30 }  // Notes
    ];

    const workbook = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(workbook, worksheet, 'Visual Schedule');
    return workbook;
  };

  const hexToRgb = (hex) => {
    const result = /^#?([a-f\d]{2})([a-f\d]{2})([a-f\d]{2})$/i.exec(hex);
    return result ? {
      r: parseInt(result[1], 16),
      g: parseInt(result[2], 16),
      b: parseInt(result[3], 16)
    } : null;
  };

  const getContrastColor = (hexColor) => {
    const rgb = hexToRgb(hexColor);
    if (!rgb) return "000000";
    
    const luminance = (0.299 * rgb.r + 0.587 * rgb.g + 0.114 * rgb.b) / 255;
    return luminance > 0.5 ? "000000" : "FFFFFF";
  };

  const createCalendarExport = (scheduleData) => {
    const calendarData = [];

    scheduleData.forEach(schedule => {
      if (schedule.sessions && Array.isArray(schedule.sessions)) {
        schedule.sessions.forEach(session => {
          const description = [
            `Course: ${session.course_name}`,
            `Group: ${session.group_name}`,
            `Duration: ${session.duration} hours`
          ];
          
          if (session.trainer_name) description.push(`Trainer: ${session.trainer_name}`);
          if (session.max_participants) description.push(`Max Participants: ${session.max_participants}`);
          if (session.notes) description.push(`Notes: ${session.notes}`);
          
          calendarData.push({
            'Subject': session.custom_title || session.title,
            'Start Date': new Date(session.start).toLocaleDateString('en-GB'),
            'Start Time': new Date(session.start).toLocaleTimeString('en-GB'),
            'End Date': new Date(session.end).toLocaleDateString('en-GB'),
            'End Time': new Date(session.end).toLocaleTimeString('en-GB'),
            'Description': description.join('\\n'),
            'Location': session.location || 'TBD',
            'All Day Event': 'False',
            'Categories': session.functional_area || 'Training'
          });
        });
      }
    });

    const worksheet = XLSX.utils.json_to_sheet(calendarData);
    const workbook = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(workbook, worksheet, 'Calendar Import');
    return workbook;
  };

  const addMetadataSheet = (workbook, scheduleData) => {
    const metadata = [
      { Property: 'Export Date', Value: new Date().toISOString() },
      { Property: 'Export Format', Value: exportFormat },
      { Property: 'File Format', Value: fileFormat },
      { Property: 'Schedules Exported', Value: scheduleData.length },
      { Property: 'Total Sessions', Value: scheduleData.reduce((sum, s) => sum + (s.sessions?.length || 0), 0) },
      { Property: 'Application', Value: 'Training Needs Analysis' },
      { Property: 'Version', Value: '1.0' }
    ];

    // Add criteria information if available
    scheduleData.forEach((schedule, index) => {
      if (schedule.criteria) {
        const criteria = schedule.criteria.default || schedule.criteria;
        metadata.push({ Property: '', Value: '' }); // Spacer
        metadata.push({ Property: `Schedule ${index + 1} Criteria`, Value: schedule.name });
        if (criteria.max_attendees) metadata.push({ Property: '  Max Attendees', Value: criteria.max_attendees });
        if (criteria.total_weeks) metadata.push({ Property: '  Total Weeks', Value: criteria.total_weeks });
        if (criteria.daily_hours) metadata.push({ Property: '  Daily Hours', Value: criteria.daily_hours });
        if (criteria.days_per_week) metadata.push({ Property: '  Days Per Week', Value: criteria.days_per_week });
        if (criteria.start_date) metadata.push({ Property: '  Start Date', Value: criteria.start_date });
      }
    });

    const worksheet = XLSX.utils.json_to_sheet(metadata);
    XLSX.utils.book_append_sheet(workbook, worksheet, 'Export Metadata');
  };

  const getDateRange = (sessions) => {
    if (!sessions || sessions.length === 0) return 'N/A';
    
    const dates = sessions.map(s => new Date(s.start)).sort((a, b) => a - b);
    const startDate = dates[0].toLocaleDateString('en-GB');
    const endDate = dates[dates.length - 1].toLocaleDateString('en-GB');
    
    return startDate === endDate ? startDate : `${startDate} - ${endDate}`;
  };

  return (
    <div className="excel-export-dialog">
      <div className="dialog-header">
        <h2>📊 Export Schedules to Excel</h2>
        <p>Export {selectedSchedules.length} selected schedule(s)</p>
      </div>

      <div className="export-options">
        <div className="option-group">
          <label>Export Format:</label>
          <div className="radio-group">
            <label>
              <input
                type="radio"
                value="summary"
                checked={exportFormat === 'summary'}
                onChange={(e) => setExportFormat(e.target.value)}
              />
              Summary (Overview of schedules)
            </label>
            <label>
              <input
                type="radio"
                value="detailed"
                checked={exportFormat === 'detailed'}
                onChange={(e) => setExportFormat(e.target.value)}
              />
              Detailed (All session data)
            </label>
            <label>
              <input
                type="radio"
                value="visual"
                checked={exportFormat === 'visual'}
                onChange={(e) => setExportFormat(e.target.value)}
              />
              Visual (With colors and formatting)
            </label>
            <label>
              <input
                type="radio"
                value="calendar"
                checked={exportFormat === 'calendar'}
                onChange={(e) => setExportFormat(e.target.value)}
              />
              Calendar (For calendar import)
            </label>
          </div>
        </div>

        <div className="option-group">
          <label>File Format:</label>
          <div className="radio-group">
            <label>
              <input
                type="radio"
                value="xlsx"
                checked={fileFormat === 'xlsx'}
                onChange={(e) => setFileFormat(e.target.value)}
              />
              Excel (.xlsx)
            </label>
            <label>
              <input
                type="radio"
                value="csv"
                checked={fileFormat === 'csv'}
                onChange={(e) => setFileFormat(e.target.value)}
              />
              CSV (.csv)
            </label>
          </div>
        </div>

        <div className="option-group">
          <label>
            <input
              type="checkbox"
              checked={includeMetadata}
              onChange={(e) => setIncludeMetadata(e.target.checked)}
            />
            Include metadata sheet
          </label>
        </div>
      </div>

      <div className="dialog-actions">
        <button onClick={onBack} className="cancel-btn" disabled={exporting}>
          Cancel
        </button>
        <button 
          onClick={exportSchedules} 
          className="export-btn" 
          disabled={exporting}
        >
          {exporting ? '⏳ Exporting...' : '📊 Export'}
        </button>
      </div>
    </div>
  );
};

export default ExcelExportDialog;