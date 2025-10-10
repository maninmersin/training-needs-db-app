import React, { useState, useEffect } from 'react';
import { useProject } from '@core/contexts/ProjectContext';
import { supabase } from '@core/services/supabaseClient';
import { 
  getSystemsReferenceData,
  getStakeholderRolesReferenceData,
  getStatusOptionsReferenceData,
  getProcessImpact
} from '../services/impactAssessmentService';
import ProcessImpactModal from './ProcessImpactModal';
import './ProcessImpactTable.css';

const ProcessImpactTable = ({ assessmentId, onProcessesChange }) => {
  const { currentProject } = useProject();
  const [loading, setLoading] = useState(true);
  const [processes, setProcesses] = useState([]);
  const [filteredProcesses, setFilteredProcesses] = useState([]);
  const [referenceData, setReferenceData] = useState({
    stakeholderRoles: [],
    systems: [],
    statusOptions: []
  });
  
  // Filter states
  const [filters, setFilters] = useState({
    stakeholderRole: '',
    level: '',
    status: '',
    showSelected: false,
    showCompleted: false,
    searchText: ''
  });

  // Modal states
  const [selectedProcess, setSelectedProcess] = useState(null);
  const [showImpactModal, setShowImpactModal] = useState(false);
  const [expandedRows, setExpandedRows] = useState(new Set());
  const [existingImpact, setExistingImpact] = useState(null);

  useEffect(() => {
    if (currentProject?.id && assessmentId) {
      loadData();
    }
  }, [currentProject?.id, assessmentId]);

  useEffect(() => {
    applyFilters();
  }, [processes, filters]);

  const loadData = async () => {
    try {
      setLoading(true);
      
      // Load reference data
      const [stakeholderRoles, systems, statusOptions] = await Promise.all([
        getStakeholderRolesReferenceData(currentProject.id),
        getSystemsReferenceData(currentProject.id),
        getStatusOptionsReferenceData(currentProject.id)
      ]);

      setReferenceData({
        stakeholderRoles,
        systems,
        statusOptions
      });

      // Load assessment processes with selection status
      await loadAssessmentProcesses();

    } catch (error) {
      console.error('Error loading data:', error);
    } finally {
      setLoading(false);
    }
  };

  const loadAssessmentProcesses = async () => {
    try {
      // Load assessment-specific processes directly
      const { data: assessmentProcesses, error: processError } = await supabase
        .from('process_hierarchy')
        .select('*')
        .eq('assessment_id', assessmentId)
        .order('process_code');

      if (processError) {
        console.error('Error loading assessment processes:', processError);
        return;
      }

      // Get selection status separately
      const { data: selections, error: selectionError } = await supabase
        .from('assessment_process_selections')
        .select('process_id')
        .eq('assessment_id', assessmentId);

      const selectedProcessIds = new Set((selections || []).map(s => s.process_id));

      // Get existing impact data
      const { data: impacts, error: impactError } = await supabase
        .from('process_impacts')
        .select('process_id, overall_impact_rating, status')
        .eq('assessment_id', assessmentId);

      const impactData = new Map((impacts || []).map(impact => [
        impact.process_id, 
        { 
          overall_impact_rating: impact.overall_impact_rating,
          impact_status: impact.status 
        }
      ]));

      // Combine the data
      const processesWithStatus = (assessmentProcesses || []).map(process => ({
        ...process,
        process_id: process.id,
        is_selected: selectedProcessIds.has(process.id),
        has_impact: impactData.has(process.id),
        overall_impact_rating: impactData.get(process.id)?.overall_impact_rating || null,
        impact_status: impactData.get(process.id)?.impact_status || null,
        selected_at: null,
        selection_reason: null
      }));

      setProcesses(processesWithStatus);
    } catch (error) {
      console.error('Error in loadAssessmentProcesses:', error);
    }
  };

  const applyFilters = () => {
    let filtered = [...processes];

    // Apply filters
    if (filters.stakeholderRole) {
      filtered = filtered.filter(process => 
        process.stakeholder_roles?.includes(filters.stakeholderRole)
      );
    }


    if (filters.level !== '') {
      filtered = filtered.filter(process => 
        process.level_number === parseInt(filters.level)
      );
    }

    if (filters.status) {
      filtered = filtered.filter(process => 
        process.impact_status === filters.status
      );
    }

    if (filters.showSelected) {
      filtered = filtered.filter(process => process.is_selected);
    }

    if (filters.showCompleted) {
      filtered = filtered.filter(process => 
        process.has_impact && process.impact_status === 'completed'
      );
    }

    if (filters.searchText) {
      const searchTerm = filters.searchText.toLowerCase();
      filtered = filtered.filter(process =>
        process.process_name.toLowerCase().includes(searchTerm) ||
        process.process_code.toLowerCase().includes(searchTerm)
      );
    }

    setFilteredProcesses(filtered);
  };

  // Filter processes based on tree expansion state
  const getVisibleProcesses = () => {
    const visible = [];
    const processMap = new Map();
    
    // Create a map for quick lookup
    filteredProcesses.forEach(process => {
      processMap.set(process.process_id, process);
    });

    const isProcessVisible = (process, visited = new Set()) => {
      if (visited.has(process.process_id)) return false;
      visited.add(process.process_id);
      
      if (process.level_number === 0) return true;
      
      const parent = processMap.get(process.parent_id);
      if (!parent) return true;
      
      return expandedRows.has(parent.process_id) && isProcessVisible(parent, visited);
    };

    filteredProcesses.forEach(process => {
      if (isProcessVisible(process)) {
        visible.push(process);
      }
    });

    return visible;
  };

  const handleFilterChange = (key, value) => {
    setFilters(prev => ({
      ...prev,
      [key]: value
    }));
  };

  const toggleRowExpansion = (processId) => {
    const newExpanded = new Set(expandedRows);
    if (newExpanded.has(processId)) {
      newExpanded.delete(processId);
    } else {
      newExpanded.add(processId);
    }
    setExpandedRows(newExpanded);
  };

  const handleSelectProcess = async (process) => {
    try {
      // Get current user
      const { data: { user } } = await supabase.auth.getUser();
      
      if (!user) {
        console.error('User not authenticated');
        return;
      }

      // Add to assessment_process_selections
      const { error } = await supabase
        .from('assessment_process_selections')
        .upsert({
          assessment_id: assessmentId,
          process_id: process.process_id,
          selected_by: user.id,
          selection_reason: 'Selected for impact analysis'
        });

      if (error) {
        console.error('Error selecting process:', error);
        return;
      }

      // Reload data to update selection status
      await loadAssessmentProcesses();
    } catch (error) {
      console.error('Error in handleSelectProcess:', error);
    }
  };

  const handleDeselectProcess = async (process) => {
    try {
      const { error } = await supabase
        .from('assessment_process_selections')
        .delete()
        .eq('assessment_id', assessmentId)
        .eq('process_id', process.process_id);

      if (error) {
        console.error('Error deselecting process:', error);
        return;
      }

      await loadAssessmentProcesses();
    } catch (error) {
      console.error('Error in handleDeselectProcess:', error);
    }
  };

  const handleAddImpact = (process) => {
    setSelectedProcess(process);
    setExistingImpact(null); // Clear any existing impact data
    setShowImpactModal(true);
  };

  const handleEditImpact = async (process) => {
    try {
      setSelectedProcess(process);
      
      // Load existing impact data
      const impactData = await getProcessImpact(assessmentId, process.process_id);
      setExistingImpact(impactData);
      
      setShowImpactModal(true);
    } catch (error) {
      console.error('Error loading existing impact:', error);
      // Still show modal even if loading fails - user can create new impact
      setExistingImpact(null);
      setShowImpactModal(true);
    }
  };

  const handleImpactSaved = async () => {
    setShowImpactModal(false);
    setSelectedProcess(null);
    setExistingImpact(null);
    await loadAssessmentProcesses();
    
    if (onProcessesChange) {
      onProcessesChange();
    }
  };

  const getImpactRatingColor = (rating) => {
    if (rating === null || rating === undefined) return 'rating-none';
    if (rating <= 1) return 'rating-low';
    if (rating <= 2) return 'rating-medium';
    if (rating <= 4) return 'rating-high';
    return 'rating-critical';
  };

  const getStatusColor = (status) => {
    const statusColors = {
      'Completed': 'status-complete',
      'completed': 'status-complete',
      'In Progress': 'status-in-progress',
      'in_progress': 'status-in-progress',
      'Draft': 'status-pending',
      'pending': 'status-pending',
      'Not Started': 'status-none',
      'Mixed': 'status-review',
      'review': 'status-review'
    };
    return statusColors[status] || 'status-none';
  };

  const getLevelIndentation = (level) => {
    return `level-${level}`;
  };

  // Calculate status and impact for parent rows based on children
  const getChildProcesses = (parentId) => {
    return filteredProcesses.filter(p => p.parent_id === parentId);
  };

  const getCalculatedStatus = (process) => {
    if (process.level_number === 2) {
      return process.has_impact ? process.impact_status || 'Draft' : 'Not Started';
    }
    
    const children = getChildProcesses(process.process_id);
    if (children.length === 0) return 'No Children';
    
    const childStatuses = children.map(child => 
      child.level_number === 2 ? getCalculatedStatus(child) : getCalculatedStatus(child)
    );
    
    const completedCount = childStatuses.filter(status => status === 'completed').length;
    const inProgressCount = childStatuses.filter(status => status === 'in_progress' || status === 'Draft').length;
    const notStartedCount = childStatuses.filter(status => status === 'Not Started').length;
    
    if (completedCount === childStatuses.length) return 'Completed';
    if (inProgressCount > 0) return 'In Progress';
    if (notStartedCount === childStatuses.length) return 'Not Started';
    return 'Mixed';
  };

  const getCalculatedImpact = (process) => {
    if (process.level_number === 2) {
      return process.has_impact ? process.overall_impact_rating : null;
    }
    
    const children = getChildProcesses(process.process_id);
    if (children.length === 0) return null;
    
    const childImpacts = children
      .map(child => getCalculatedImpact(child))
      .filter(impact => impact !== null);
    
    if (childImpacts.length === 0) return null;
    return Math.round(childImpacts.reduce((sum, impact) => sum + impact, 0) / childImpacts.length);
  };

  const renderProcessRow = (process) => {
    const isExpanded = expandedRows.has(process.process_id);
    const hasChildren = filteredProcesses.some(p => p.parent_id === process.process_id);
    const calculatedStatus = getCalculatedStatus(process);
    const calculatedImpact = getCalculatedImpact(process);

    // Create indentation based on level
    const getIndentedName = () => {
      const indent = '  '.repeat(process.level_number);
      const connector = process.level_number === 1 ? '├ ' : process.level_number === 2 ? '└ ' : '';
      return indent + connector + process.process_name;
    };

    return (
      <tr key={process.process_id} className={`process-row level-${process.level_number}`}>
        <td>
          <span 
            onClick={hasChildren ? () => toggleRowExpansion(process.process_id) : undefined}
            style={{ 
              cursor: hasChildren ? 'pointer' : 'default',
              display: 'inline-flex',
              alignItems: 'center',
              gap: '4px'
            }}
          >
            {hasChildren ? (isExpanded ? '−' : '+') : ' '}
            L{process.level_number}
          </span>
        </td>
        <td>{process.process_code}</td>
        <td>{getIndentedName()}</td>
        <td>{calculatedStatus}</td>
        <td>{calculatedImpact !== null ? `${calculatedImpact}/5` : '-'}</td>
        <td>
          {process.level_number === 2 && (
            <span 
              onClick={() => handleEditImpact(process)}
              className="edit-link"
            >
              Edit
            </span>
          )}
        </td>
      </tr>
    );
  };

  const getUniqueValues = (field) => {
    const values = new Set();
    processes.forEach(process => {
      if (field === 'stakeholderRoles') {
        process.stakeholder_roles?.forEach(role => values.add(role));
      } else {
        const value = process[field];
        if (value) values.add(value);
      }
    });
    return Array.from(values).sort();
  };

  if (loading) {
    return (
      <div className="process-impact-table loading">
        <div className="loading-spinner"></div>
        <p>Loading process library...</p>
      </div>
    );
  }

  return (
    <div className="process-impact-table">
      {/* Filters Header */}
      <div className="table-filters">
        <div className="filter-row">
          <div className="filter-group">
            <label>Stakeholder Role:</label>
            <select 
              value={filters.stakeholderRole} 
              onChange={(e) => handleFilterChange('stakeholderRole', e.target.value)}
            >
              <option value="">All Roles</option>
              {referenceData.stakeholderRoles.map(role => (
                <option key={role.role_code} value={role.role_code}>
                  {role.role_code} - {role.role_name}
                </option>
              ))}
            </select>
          </div>
          
          
          <div className="filter-group">
            <label>Level:</label>
            <select 
              value={filters.level} 
              onChange={(e) => handleFilterChange('level', e.target.value)}
            >
              <option value="">All Levels</option>
              <option value="0">L0 - Main Areas</option>
              <option value="1">L1 - Sub-processes</option>
              <option value="2">L2 - Detailed Processes</option>
            </select>
          </div>
          
          <div className="filter-group">
            <label>Status:</label>
            <select 
              value={filters.status} 
              onChange={(e) => handleFilterChange('status', e.target.value)}
            >
              <option value="">All Status</option>
              <option value="completed">Completed</option>
              <option value="in_progress">In Progress</option>
              <option value="pending">Pending</option>
            </select>
          </div>
        </div>
        
        <div className="filter-row">
          <div className="filter-group">
            <label>Search:</label>
            <input 
              type="text" 
              placeholder="Search processes..."
              value={filters.searchText}
              onChange={(e) => handleFilterChange('searchText', e.target.value)}
            />
          </div>
          
          <div className="filter-toggles">
            <label className="checkbox-label">
              <input 
                type="checkbox" 
                checked={filters.showSelected}
                onChange={(e) => handleFilterChange('showSelected', e.target.checked)}
              />
              <span>Selected Only</span>
            </label>
            
            <label className="checkbox-label">
              <input 
                type="checkbox" 
                checked={filters.showCompleted}
                onChange={(e) => handleFilterChange('showCompleted', e.target.checked)}
              />
              <span>Completed Only</span>
            </label>
          </div>
          
          <div className="table-stats">
            <span className="stat">
              Total: {filteredProcesses.length}
            </span>
            <span className="stat">
              Selected: {filteredProcesses.filter(p => p.is_selected).length}
            </span>
            <span className="stat">
              Completed: {filteredProcesses.filter(p => p.has_impact && p.impact_status === 'completed').length}
            </span>
          </div>
        </div>
      </div>

      {/* Process Table */}
      <div className="table-container">
        <table className="process-table">
          <thead>
            <tr>
              <th className="level-column">Level</th>
              <th className="code-column">ID</th>
              <th className="name-column">Process Name</th>
              <th className="status-column">Status</th>
              <th className="impact-column">Impact</th>
              <th className="actions-column">Edit</th>
            </tr>
          </thead>
          <tbody>
            {(() => {
              const visibleProcesses = getVisibleProcesses();
              return visibleProcesses.length > 0 ? (
                visibleProcesses.map(process => renderProcessRow(process))
              ) : (
                <tr>
                  <td colSpan="6" className="no-data">
                    {processes.length === 0 
                      ? 'No processes found for this assessment. Please add processes using the Process Hierarchy Manager.'
                      : 'No processes match the current filters.'
                    }
                  </td>
                </tr>
              );
            })()}
          </tbody>
        </table>
      </div>

      {/* Impact Modal */}
      {showImpactModal && selectedProcess && (
        <ProcessImpactModal
          assessmentId={assessmentId}
          processData={selectedProcess}
          existingImpact={existingImpact}
          onSave={handleImpactSaved}
          onCancel={() => {
            setShowImpactModal(false);
            setSelectedProcess(null);
            setExistingImpact(null);
          }}
          projectId={currentProject?.id}
        />
      )}
    </div>
  );
};

export default ProcessImpactTable;