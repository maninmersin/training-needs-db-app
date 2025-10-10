import React, { useState, useEffect, useMemo } from 'react';
import { supabase } from '@core/services/supabaseClient';
import * as XLSX from 'xlsx';
import { saveAs } from 'file-saver';
import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';
import { debugLog, debugError } from '@core/utils/consoleUtils';
import './AssignmentExportDialog.css';

/**
 * Advanced Export Dialog for Assignment Data
 * 
 * Adapted from StakeholderCalendarExportDialog for use in User Assignment screens.
 * Features:
 * - Filtering by Functional Area, Training Location, Classroom, Courses, Timings, Attendees
 * - Excel export with multiple sheets (Summary, Detailed, Attendees, Statistics)
 * - PDF export with assignment reports and professional formatting
 * - Real-time filter preview
 */
const AssignmentExportDialog = ({
  schedule,
  sessions,
  assignments,
  onClose
}) => {
  // Export configuration
  const [exportFormat, setExportFormat] = useState('excel'); // 'excel' or 'pdf'
  const [exportType, setExportType] = useState('detailed'); // 'summary', 'detailed', 'calendar', 'attendees'
  const [exporting, setExporting] = useState(false);

  // Filter state
  const [filters, setFilters] = useState({
    functionalAreas: [],
    trainingLocations: [],
    classrooms: [],
    courses: [],
    dateRange: { start: '', end: '' },
    attendees: []
  });

  // Available filter options (derived from data)
  const [filterOptions, setFilterOptions] = useState({
    functionalAreas: [],
    trainingLocations: [],
    classrooms: [],
    courses: [],
    attendees: []
  });

  // Preview data
  const [filteredData, setFilteredData] = useState({
    sessions: [],
    assignments: [],
    stats: {}
  });

  debugLog('🎯 AssignmentExportDialog initialized', {
    scheduleId: schedule?.id,
    sessionsCount: sessions?.length,
    assignmentsCount: assignments?.length
  });

  // Helper function to get date range from sessions
  const getDateRange = (sessions) => {
    if (!sessions || sessions.length === 0) return 'No sessions';
    
    const dates = sessions.map(s => new Date(s.start)).sort((a, b) => a - b);
    const startDate = dates[0].toLocaleDateString('en-GB');
    const endDate = dates[dates.length - 1].toLocaleDateString('en-GB');
    
    return startDate === endDate ? startDate : `${startDate} - ${endDate}`;
  };

  // Initialize filter options from available data
  useEffect(() => {
    if (sessions && assignments) {
      const functionalAreas = [...new Set(sessions.map(s => s.functional_area).filter(Boolean))];
      const trainingLocations = [...new Set(sessions.map(s => s.training_location).filter(Boolean))];
      const classrooms = [...new Set(sessions.map(s => s.classroom_name || s._classroom).filter(Boolean))];
      const courses = [...new Set(sessions.map(s => s.course_name || s.title?.split(' - ')[0]).filter(Boolean))];
      const attendees = [...new Set(assignments.map(a => ({
        id: a.end_user_id,
        name: a.end_users?.name || 'Unknown User',
        email: a.end_users?.email || '',
        role: a.end_users?.project_role || '',
        location: a.end_users?.training_location || ''
      })))];

      setFilterOptions({
        functionalAreas: functionalAreas.sort(),
        trainingLocations: trainingLocations.sort(),
        classrooms: classrooms.sort(),
        courses: courses.sort(),
        attendees: attendees.sort((a, b) => a.name.localeCompare(b.name))
      });

      debugLog('📊 Filter options initialized:', {
        functionalAreas: functionalAreas.length,
        trainingLocations: trainingLocations.length,
        classrooms: classrooms.length,
        courses: courses.length,
        attendees: attendees.length
      });
    }
  }, [sessions, assignments]);

  // Update filtered data when filters change
  const updateFilteredData = useMemo(() => {
    if (!sessions || !assignments) return { sessions: [], assignments: [], stats: {} };

    let filteredSessions = sessions;
    let filteredAssignments = assignments;

    // Apply functional area filter
    if (filters.functionalAreas.length > 0) {
      filteredSessions = filteredSessions.filter(s => 
        filters.functionalAreas.includes(s.functional_area)
      );
    }

    // Apply training location filter
    if (filters.trainingLocations.length > 0) {
      filteredSessions = filteredSessions.filter(s => 
        filters.trainingLocations.includes(s.training_location)
      );
    }

    // Apply classroom filter
    if (filters.classrooms.length > 0) {
      filteredSessions = filteredSessions.filter(s => 
        filters.classrooms.includes(s.classroom_name || s._classroom)
      );
    }

    // Apply course filter
    if (filters.courses.length > 0) {
      filteredSessions = filteredSessions.filter(s => {
        const courseName = s.course_name || s.title?.split(' - ')[0];
        return filters.courses.includes(courseName);
      });
    }

    // Apply date range filter
    if (filters.dateRange.start && filters.dateRange.end) {
      const startDate = new Date(filters.dateRange.start);
      const endDate = new Date(filters.dateRange.end);
      filteredSessions = filteredSessions.filter(s => {
        const sessionDate = new Date(s.start);
        return sessionDate >= startDate && sessionDate <= endDate;
      });
    }

    // Filter assignments to match filtered sessions
    const sessionIds = new Set(filteredSessions.map(s => s.id || s.eventId || s.session_identifier));
    filteredAssignments = filteredAssignments.filter(a => {
      // Session level assignments
      if (a.session_id && sessionIds.has(a.session_id)) return true;
      if (a.session_identifier && sessionIds.has(a.session_identifier)) return true;
      
      // Check if assignment matches any filtered session criteria
      return filteredSessions.some(session => {
        // Course level
        if (a.assignment_level === 'course' && a.course_id === session.course_id) return true;
        // Location level
        if (a.assignment_level === 'training_location' && a.training_location === session.training_location) return true;
        // Group level matching
        if (a.assignment_level === 'group' && session.title && a.group_identifier) {
          const groupMatch = session.title.match(/Group (\d+)/);
          if (groupMatch) {
            const sessionGroupName = `Group${groupMatch[1]}`;
            return a.group_identifier.endsWith(sessionGroupName);
          }
        }
        return false;
      });
    });

    // Apply attendee filter
    if (filters.attendees.length > 0) {
      const selectedUserIds = filters.attendees.map(a => a.id);
      filteredAssignments = filteredAssignments.filter(a => 
        selectedUserIds.includes(a.end_user_id)
      );
    }

    // Calculate statistics
    const stats = {
      totalSessions: filteredSessions.length,
      totalAssignments: filteredAssignments.length,
      uniqueAttendees: new Set(filteredAssignments.map(a => a.end_user_id)).size,
      uniqueCourses: new Set(filteredSessions.map(s => s.course_name || s.title?.split(' - ')[0])).size,
      locationBreakdown: {},
      courseBreakdown: {},
      dateRange: getDateRange(filteredSessions)
    };

    // Location breakdown
    filteredSessions.forEach(session => {
      const location = session.training_location || 'Unknown';
      stats.locationBreakdown[location] = (stats.locationBreakdown[location] || 0) + 1;
    });

    // Course breakdown
    filteredSessions.forEach(session => {
      const course = session.course_name || session.title?.split(' - ')[0] || 'Unknown';
      stats.courseBreakdown[course] = (stats.courseBreakdown[course] || 0) + 1;
    });

    return {
      sessions: filteredSessions,
      assignments: filteredAssignments,
      stats
    };
  }, [sessions, assignments, filters]);

  useEffect(() => {
    setFilteredData(updateFilteredData);
  }, [updateFilteredData]);

  // Handle filter changes
  const handleFilterChange = (filterType, value) => {
    setFilters(prev => ({
      ...prev,
      [filterType]: value
    }));
  };

  // Clear all filters
  const clearAllFilters = () => {
    setFilters({
      functionalAreas: [],
      trainingLocations: [],
      classrooms: [],
      courses: [],
      dateRange: { start: '', end: '' },
      attendees: []
    });
  };

  // Multi-select component
  const MultiSelectFilter = ({ label, options, value, onChange, displayKey = null }) => {
    const [isOpen, setIsOpen] = useState(false);

    const handleToggle = (option) => {
      const optionValue = displayKey ? option[displayKey] : option;
      const newValue = value.includes(optionValue)
        ? value.filter(v => v !== optionValue)
        : [...value, optionValue];
      onChange(newValue);
    };

    // Create display text showing selected items
    const getDisplayText = () => {
      if (value.length === 0) {
        return `Select ${label}`;
      }
      
      if (value.length === 1) {
        return value[0];
      }
      
      if (value.length <= 3) {
        return value.join(', ');
      }
      
      return `${value[0]}, ${value[1]} & ${value.length - 2} more`;
    };

    return (
      <div className="multi-select-filter">
        <label>{label}</label>
        <div className="multi-select-dropdown">
          <button
            className="multi-select-button"
            onClick={() => setIsOpen(!isOpen)}
          >
            <span className="button-text">{getDisplayText()}</span>
            <span className={`dropdown-arrow ${isOpen ? 'open' : ''}`}>▼</span>
          </button>
          
          {isOpen && (
            <div className="multi-select-options">
              {options.map((option, index) => {
                const optionValue = displayKey ? option[displayKey] : option;
                const optionLabel = displayKey && option.name ? option.name : option;
                
                return (
                  <label key={index} className="multi-select-option">
                    <input
                      type="checkbox"
                      checked={value.includes(optionValue)}
                      onChange={() => handleToggle(option)}
                    />
                    <span>{optionLabel}</span>
                  </label>
                );
              })}
            </div>
          )}
        </div>
      </div>
    );
  };

  // Export functionality
  const handleExport = async () => {
    try {
      setExporting(true);
      debugLog('🔄 Starting export process', { exportFormat, exportType });

      if (exportFormat === 'excel') {
        await exportToExcel();
      } else {
        await exportToPDF();
      }

      debugLog('✅ Export completed successfully');
    } catch (error) {
      debugError('❌ Export failed:', error);
      alert(`Export failed: ${error.message}`);
    } finally {
      setExporting(false);
    }
  };

  const exportToExcel = async () => {
    debugLog('🔄 Starting Excel export with type:', exportType);
    const workbook = XLSX.utils.book_new();

    // Overview Sheet (for all export types)
    const overviewData = [{
      'Schedule Name': schedule?.name || 'Unknown Schedule',
      'Export Date': new Date().toLocaleDateString('en-GB'),
      'Export Type': exportType,
      'Total Sessions': filteredData.stats.totalSessions,
      'Total Assignments': filteredData.stats.totalAssignments,
      'Unique Attendees': filteredData.stats.uniqueAttendees,
      'Unique Courses': filteredData.stats.uniqueCourses,
      'Date Range': filteredData.stats.dateRange,
      'Filters Applied': getAppliedFiltersText()
    }];

    const overviewSheet = XLSX.utils.json_to_sheet(overviewData);
    XLSX.utils.book_append_sheet(workbook, overviewSheet, 'Overview');

    // Detailed Sessions Sheet - Assignment-focused
    if (exportType === 'detailed') {
      debugLog('📊 Creating detailed Excel data with assignment focus');
      const detailedData = [];
      
      // Create one row per assignment
      filteredData.assignments.forEach(assignment => {
        // Find the session for this assignment
        const session = filteredData.sessions.find(s => {
          // Match by various criteria
          if (assignment.session_id === s.id || 
              assignment.session_identifier === s.session_identifier ||
              assignment.session_identifier === s.eventId) {
            return true;
          }
          
          if (assignment.assignment_level === 'course' && assignment.course_id === s.course_id) {
            return true;
          }
          
          if (assignment.assignment_level === 'training_location' && 
              assignment.training_location === s.training_location) {
            return true;
          }
          
          if (assignment.assignment_level === 'group' && s.title && assignment.group_identifier) {
            const groupMatch = s.title.match(/Group (\d+)/);
            if (groupMatch) {
              const sessionGroupName = `Group${groupMatch[1]}`;
              return assignment.group_identifier.endsWith(sessionGroupName);
            }
          }
          
          return false;
        });

        if (session) {
          const sessionDate = new Date(session.start);
          const startTime = sessionDate.toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit' });
          const endTime = new Date(session.end).toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit' });
          const duration = session.duration || calculateDuration(session.start, session.end);
          const dayOfWeek = sessionDate.toLocaleDateString('en-GB', { weekday: 'long' });

          detailedData.push({
            'Assignment ID': assignment.id,
            'User Name': assignment.end_users?.name || 'Unknown User',
            'User Email': assignment.end_users?.email || 'N/A',
            'User Role': assignment.end_users?.project_role || 'N/A',
            'User Location': assignment.end_users?.training_location || 'N/A',
            'Assignment Level': assignment.assignment_level || 'N/A',
            'Assignment Type': assignment.assignment_type || 'N/A',
            'Functional Area': session.functional_area || 'N/A',
            'Training Location': session.training_location || 'N/A',
            'Classroom': session.classroom_name || session._classroom || 'N/A',
            'Course Name': session.course_name || session.title?.split(' - ')[0] || 'Unknown Course',
            'Course ID': session.course_id || 'N/A',
            'Session Title': session.title || 'Untitled Session',
            'Date': sessionDate.toLocaleDateString('en-GB'),
            'Day of Week': dayOfWeek,
            'Start Time': startTime,
            'End Time': endTime,
            'Duration (Hours)': duration,
            'Group': session.title?.match(/Group (\d+)/)?.[1] || 'N/A',
            'Session ID': assignment.session_id || assignment.session_identifier || 'N/A',
            'Created At': assignment.created_at ? new Date(assignment.created_at).toLocaleDateString('en-GB') : 'N/A',
            'Updated At': assignment.updated_at ? new Date(assignment.updated_at).toLocaleDateString('en-GB') : 'N/A'
          });
        }
      });

      debugLog('📊 Created detailed assignment data rows:', detailedData.length);
      const assignmentSheet = XLSX.utils.json_to_sheet(detailedData);
      XLSX.utils.book_append_sheet(workbook, assignmentSheet, 'Assignment Details');
    }

    // Attendees Sheet
    if (exportType === 'attendees' || exportType === 'detailed') {
      const attendeesData = filteredData.assignments.map(assignment => ({
        'User Name': assignment.end_users?.name || 'Unknown User',
        'User Email': assignment.end_users?.email || 'N/A',
        'Project Role': assignment.end_users?.project_role || 'N/A',
        'User Location': assignment.end_users?.training_location || 'N/A',
        'Assignment Level': assignment.assignment_level || 'N/A',
        'Assignment Type': assignment.assignment_type || 'N/A',
        'Course ID': assignment.course_id || 'N/A',
        'Session ID': assignment.session_id || assignment.session_identifier || 'N/A',
        'Group ID': assignment.group_identifier || 'N/A',
        'Assigned Location': assignment.training_location || 'N/A',
        'Functional Area': assignment.functional_area || 'N/A',
        'Created Date': assignment.created_at ? new Date(assignment.created_at).toLocaleDateString('en-GB') : 'N/A'
      }));

      const attendeesSheet = XLSX.utils.json_to_sheet(attendeesData);
      XLSX.utils.book_append_sheet(workbook, attendeesSheet, 'Attendees');
    }

    // Statistics Sheet
    const statsData = [
      { Metric: 'Total Sessions', Value: filteredData.stats.totalSessions },
      { Metric: 'Total Assignments', Value: filteredData.stats.totalAssignments },
      { Metric: 'Unique Attendees', Value: filteredData.stats.uniqueAttendees },
      { Metric: 'Unique Courses', Value: filteredData.stats.uniqueCourses },
      { Metric: '', Value: '' }, // Spacer
      { Metric: 'Location Breakdown', Value: '' },
      ...Object.entries(filteredData.stats.locationBreakdown).map(([location, count]) => ({
        Metric: `  ${location}`, Value: count
      })),
      { Metric: '', Value: '' }, // Spacer
      { Metric: 'Course Breakdown', Value: '' },
      ...Object.entries(filteredData.stats.courseBreakdown).map(([course, count]) => ({
        Metric: `  ${course}`, Value: count
      }))
    ];

    const statsSheet = XLSX.utils.json_to_sheet(statsData);
    XLSX.utils.book_append_sheet(workbook, statsSheet, 'Statistics');

    // Add filter metadata sheet
    const filterData = [
      { Filter: 'Functional Areas', Values: filters.functionalAreas.join(', ') || 'All' },
      { Filter: 'Training Locations', Values: filters.trainingLocations.join(', ') || 'All' },
      { Filter: 'Classrooms', Values: filters.classrooms.join(', ') || 'All' },
      { Filter: 'Courses', Values: filters.courses.join(', ') || 'All' },
      { Filter: 'Date Range Start', Values: filters.dateRange.start || 'No restriction' },
      { Filter: 'Date Range End', Values: filters.dateRange.end || 'No restriction' },
      { Filter: 'Selected Attendees', Values: filters.attendees.map(a => a.name).join(', ') || 'All' }
    ];

    const filterSheet = XLSX.utils.json_to_sheet(filterData);
    XLSX.utils.book_append_sheet(workbook, filterSheet, 'Applied Filters');

    // Generate filename and save
    const timestamp = new Date().toISOString().slice(0, 10);
    const filename = `assignment_export_${exportType}_${timestamp}.xlsx`;

    const excelBuffer = XLSX.write(workbook, { bookType: 'xlsx', type: 'array' });
    const blob = new Blob([excelBuffer], { 
      type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' 
    });
    saveAs(blob, filename);

    alert(`✅ Excel export completed: ${filename}`);
  };

  const exportToPDF = async () => {
    const pdf = new jsPDF();
    let currentY = 30;
    
    // Title page
    pdf.setFontSize(20);
    pdf.text('Training Assignment Export', 20, currentY);
    currentY += 20;
    
    pdf.setFontSize(12);
    pdf.text(`Schedule: ${schedule?.name || 'Unknown Schedule'}`, 20, currentY);
    currentY += 10;
    pdf.text(`Export Date: ${new Date().toLocaleDateString('en-GB')}`, 20, currentY);
    currentY += 10;
    pdf.text(`Export Type: ${exportType}`, 20, currentY);
    currentY += 10;
    pdf.text(`Filters Applied: ${getAppliedFiltersText()}`, 20, currentY);
    currentY += 20;

    // Statistics summary
    pdf.text('Summary Statistics:', 20, currentY);
    currentY += 10;
    pdf.text(`Total Sessions: ${filteredData.stats.totalSessions}`, 30, currentY);
    currentY += 10;
    pdf.text(`Total Assignments: ${filteredData.stats.totalAssignments}`, 30, currentY);
    currentY += 10;
    pdf.text(`Unique Attendees: ${filteredData.stats.uniqueAttendees}`, 30, currentY);
    currentY += 10;
    pdf.text(`Unique Courses: ${filteredData.stats.uniqueCourses}`, 30, currentY);
    currentY += 10;
    pdf.text(`Date Range: ${filteredData.stats.dateRange}`, 30, currentY);

    if (exportType === 'attendees') {
      // Attendees table
      pdf.addPage();
      pdf.setFontSize(16);
      pdf.text('Assignment Details', 20, 30);

      const attendeeTableData = filteredData.assignments.map(assignment => [
        assignment.end_users?.name || 'Unknown User',
        assignment.end_users?.email || 'N/A',
        assignment.end_users?.project_role || 'N/A',
        assignment.assignment_level || 'N/A',
        assignment.training_location || 'N/A'
      ]);

      autoTable(pdf, {
        head: [['Name', 'Email', 'Role', 'Assignment Level', 'Location']],
        body: attendeeTableData,
        startY: 40,
        styles: { fontSize: 8 },
        headStyles: { fillColor: [66, 96, 146] }
      });
    }

    // Save PDF
    const timestamp = new Date().toISOString().slice(0, 10);
    const filename = `assignment_export_${exportType}_${timestamp}.pdf`;
    pdf.save(filename);

    alert(`✅ PDF export completed: ${filename}`);
  };

  const calculateDuration = (start, end) => {
    const startTime = new Date(start);
    const endTime = new Date(end);
    return Math.round((endTime - startTime) / (1000 * 60 * 60) * 10) / 10; // Hours with 1 decimal
  };

  const getAppliedFiltersText = () => {
    const appliedFilters = [];
    
    if (filters.functionalAreas.length > 0) {
      appliedFilters.push(`Functional Areas: ${filters.functionalAreas.join(', ')}`);
    }
    if (filters.trainingLocations.length > 0) {
      appliedFilters.push(`Locations: ${filters.trainingLocations.join(', ')}`);
    }
    if (filters.classrooms.length > 0) {
      appliedFilters.push(`Classrooms: ${filters.classrooms.join(', ')}`);
    }
    if (filters.courses.length > 0) {
      appliedFilters.push(`Courses: ${filters.courses.join(', ')}`);
    }
    if (filters.dateRange.start || filters.dateRange.end) {
      appliedFilters.push(`Date Range: ${filters.dateRange.start || 'Any'} to ${filters.dateRange.end || 'Any'}`);
    }
    if (filters.attendees.length > 0) {
      appliedFilters.push(`Attendees: ${filters.attendees.length} selected`);
    }

    return appliedFilters.length > 0 ? appliedFilters.join('; ') : 'None';
  };

  return (
    <div className="assignment-export-dialog-overlay">
      <div className="assignment-export-dialog">
        {/* Header */}
        <div className="export-dialog-header">
          <h2>📊 Export Assignment Data</h2>
          <button onClick={onClose} className="close-btn">❌</button>
        </div>

        {/* Content */}
        <div className="export-dialog-content">
          {/* Filters Section */}
          <div className="filters-section">
            <div className="section-header">
              <h3>🔍 Filters</h3>
              <button onClick={clearAllFilters} className="clear-filters-btn">
                Clear All
              </button>
            </div>

            <div className="filters-grid">
              <MultiSelectFilter
                label="Functional Areas"
                options={filterOptions.functionalAreas}
                value={filters.functionalAreas}
                onChange={(value) => handleFilterChange('functionalAreas', value)}
              />

              <MultiSelectFilter
                label="Training Locations"
                options={filterOptions.trainingLocations}
                value={filters.trainingLocations}
                onChange={(value) => handleFilterChange('trainingLocations', value)}
              />

              <MultiSelectFilter
                label="Classrooms"
                options={filterOptions.classrooms}
                value={filters.classrooms}
                onChange={(value) => handleFilterChange('classrooms', value)}
              />

              <MultiSelectFilter
                label="Courses"
                options={filterOptions.courses}
                value={filters.courses}
                onChange={(value) => handleFilterChange('courses', value)}
              />

              <div className="date-range-filter">
                <label>Date Range</label>
                <div className="date-inputs">
                  <input
                    type="date"
                    value={filters.dateRange.start}
                    onChange={(e) => handleFilterChange('dateRange', {
                      ...filters.dateRange,
                      start: e.target.value
                    })}
                  />
                  <span>to</span>
                  <input
                    type="date"
                    value={filters.dateRange.end}
                    onChange={(e) => handleFilterChange('dateRange', {
                      ...filters.dateRange,
                      end: e.target.value
                    })}
                  />
                </div>
              </div>

              <MultiSelectFilter
                label="Attendees"
                options={filterOptions.attendees}
                value={filters.attendees}
                onChange={(value) => handleFilterChange('attendees', value)}
                displayKey="name"
              />
            </div>
          </div>

          {/* Preview Section */}
          <div className="preview-section">
            <h3>📋 Export Preview</h3>
            <div className="preview-stats">
              <div className="stat-item">
                <span className="stat-label">Sessions:</span>
                <span className="stat-value">{filteredData.stats.totalSessions}</span>
              </div>
              <div className="stat-item">
                <span className="stat-label">Assignments:</span>
                <span className="stat-value">{filteredData.stats.totalAssignments}</span>
              </div>
              <div className="stat-item">
                <span className="stat-label">Attendees:</span>
                <span className="stat-value">{filteredData.stats.uniqueAttendees}</span>
              </div>
              <div className="stat-item">
                <span className="stat-label">Courses:</span>
                <span className="stat-value">{filteredData.stats.uniqueCourses}</span>
              </div>
            </div>
          </div>

          {/* Export Options */}
          <div className="export-options-section">
            <h3>⚙️ Export Options</h3>
            
            <div className="export-format-options">
              <label>Export Format:</label>
              <div className="radio-group">
                <label>
                  <input
                    type="radio"
                    value="excel"
                    checked={exportFormat === 'excel'}
                    onChange={(e) => setExportFormat(e.target.value)}
                  />
                  📊 Excel (.xlsx)
                </label>
                <label>
                  <input
                    type="radio"
                    value="pdf"
                    checked={exportFormat === 'pdf'}
                    onChange={(e) => setExportFormat(e.target.value)}
                  />
                  📄 PDF (.pdf)
                </label>
              </div>
            </div>

            <div className="export-type-options">
              <label>Export Type:</label>
              <div className="radio-group">
                <label>
                  <input
                    type="radio"
                    value="detailed"
                    checked={exportType === 'detailed'}
                    onChange={(e) => setExportType(e.target.value)}
                  />
                  📋 Detailed Assignments
                </label>
                <label>
                  <input
                    type="radio"
                    value="attendees"
                    checked={exportType === 'attendees'}
                    onChange={(e) => setExportType(e.target.value)}
                  />
                  👥 Attendee Focus
                </label>
              </div>
            </div>
          </div>
        </div>

        {/* Footer */}
        <div className="export-dialog-footer">
          <button onClick={onClose} className="cancel-btn" disabled={exporting}>
            Cancel
          </button>
          <button
            onClick={handleExport}
            className="export-btn"
            disabled={exporting || filteredData.stats.totalSessions === 0}
          >
            {exporting ? '⏳ Exporting...' : `📊 Export ${exportFormat.toUpperCase()}`}
          </button>
        </div>
      </div>
    </div>
  );
};

export default AssignmentExportDialog;