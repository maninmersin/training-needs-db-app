import React, { useState, useEffect } from 'react';
import { useProject } from '@core/contexts/ProjectContext';
import { supabase } from '@core/services/supabaseClient';
import * as XLSX from 'xlsx';
import { 
  getStakeholders, 
  searchStakeholders, 
  getStakeholderStats,
  deleteStakeholder,
  createStakeholder 
} from '../services/stakeholderService';
import StakeholderForm from './StakeholderForm';
import StakeholderCard from './StakeholderCard';
import './StakeholderDirectory.css';

const StakeholderDirectory = () => {
  const { currentProject } = useProject();
  const [stakeholders, setStakeholders] = useState([]);
  const [filteredStakeholders, setFilteredStakeholders] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [stats, setStats] = useState({});
  const [users, setUsers] = useState([]);
  
  // UI State
  const [showForm, setShowForm] = useState(false);
  const [editingStakeholder, setEditingStakeholder] = useState(null);
  const [viewMode, setViewMode] = useState('table'); // 'cards' or 'table'
  const [searchTerm, setSearchTerm] = useState('');
  const [filters, setFilters] = useState({
    stakeholder_type: '',
    power_level: '',
    interest_level: '',
    position_on_change: '',
    engagement_status: '',
    current_engagement_level: '',
    relationship_owner: ''
  });

  // Load stakeholders on mount and project change
  useEffect(() => {
    if (currentProject?.id) {
      loadStakeholders();
      loadStats();
      loadUsers();
    }
  }, [currentProject?.id]);

  // Apply search and filters when data or filters change
  useEffect(() => {
    applyFilters();
  }, [stakeholders, searchTerm, filters]);

  const loadStakeholders = async () => {
    try {
      setLoading(true);
      const data = await getStakeholders(currentProject.id);
      setStakeholders(data);
      setError(null);
    } catch (err) {
      console.error('Error loading stakeholders:', err);
      setError('Failed to load stakeholders');
    } finally {
      setLoading(false);
    }
  };

  const loadStats = async () => {
    try {
      const data = await getStakeholderStats(currentProject.id);
      setStats(data);
    } catch (err) {
      console.error('Error loading stats:', err);
    }
  };

  const loadUsers = async () => {
    try {
      const { data, error } = await supabase
        .from('project_users')
        .select(`
          user_id,
          auth_users!inner(
            id,
            email
          )
        `)
        .eq('project_id', currentProject.id);

      if (error) throw error;
      
      const usersList = data?.map(pu => ({
        id: pu.auth_users.id,
        name: pu.auth_users.email.split('@')[0],
        email: pu.auth_users.email
      })) || [];
      
      setUsers(usersList);
    } catch (err) {
      console.error('Error loading users:', err);
    }
  };

  const applyFilters = async () => {
    try {
      // If no search term and no filters, use all stakeholders
      if (!searchTerm && Object.values(filters).every(f => !f)) {
        setFilteredStakeholders(stakeholders);
        return;
      }

      // Apply search and filters
      const filtered = await searchStakeholders(currentProject.id, searchTerm, filters);
      setFilteredStakeholders(filtered);
    } catch (err) {
      console.error('Error applying filters:', err);
      setFilteredStakeholders(stakeholders);
    }
  };

  const handleCreateStakeholder = () => {
    setEditingStakeholder(null);
    setShowForm(true);
  };

  const handleEditStakeholder = (stakeholder) => {
    setEditingStakeholder(stakeholder);
    setShowForm(true);
  };

  const handleDeleteStakeholder = async (stakeholder) => {
    if (!window.confirm(`Are you sure you want to delete ${stakeholder.name}?`)) {
      return;
    }

    try {
      await deleteStakeholder(stakeholder.id, currentProject.id);
      await loadStakeholders();
      await loadStats();
    } catch (err) {
      console.error('Error deleting stakeholder:', err);
      alert('Failed to delete stakeholder');
    }
  };

  const handleFormSubmit = async () => {
    setShowForm(false);
    setEditingStakeholder(null);
    await loadStakeholders();
    await loadStats();
  };

  const handleFormCancel = () => {
    setShowForm(false);
    setEditingStakeholder(null);
  };

  const handleExportExcel = () => {
    try {
      // Prepare data for export
      const exportData = stakeholders.map(stakeholder => ({
        'Name': stakeholder.name || '',
        'Title': stakeholder.title || '',
        'Email': stakeholder.email || '',
        'Phone': stakeholder.phone || '',
        'Department': stakeholder.department || '',
        'Organization': stakeholder.organization || '',
        'Type': stakeholder.stakeholder_type || '',
        'Category': stakeholder.stakeholder_category || '',
        'Priority': stakeholder.stakeholder_priority || '',
        'Power Level': stakeholder.power_level || '',
        'Interest Level': stakeholder.interest_level || '',
        'Current Engagement': stakeholder.current_engagement_level || '',
        'Target Engagement': stakeholder.target_engagement_level || '',
        'Position on Change': stakeholder.position_on_change || '',
        'Engagement Status': stakeholder.engagement_status || '',
        'Relationship Owner': stakeholder.relationship_owner_profile?.email || '',
        'Last Contact Date': stakeholder.last_contact_date || '',
        'Engagement Purpose': stakeholder.engagement_purpose || '',
        'Actions Required': stakeholder.actions_required || '',
        'Comments': stakeholder.comments || ''
      }));

      // Create workbook and worksheet
      const wb = XLSX.utils.book_new();
      const ws = XLSX.utils.json_to_sheet(exportData);
      
      // Auto-size columns
      const colWidths = [];
      Object.keys(exportData[0] || {}).forEach(key => {
        const maxLength = Math.max(
          key.length,
          ...exportData.map(row => String(row[key]).length)
        );
        colWidths.push({ wch: Math.min(maxLength + 2, 50) });
      });
      ws['!cols'] = colWidths;

      // Add worksheet to workbook
      XLSX.utils.book_append_sheet(wb, ws, 'Stakeholders');

      // Generate filename with project name and date
      const fileName = `${currentProject.title}_Stakeholders_${new Date().toISOString().split('T')[0]}.xlsx`;
      
      // Save file
      XLSX.writeFile(wb, fileName);
      
      setError(null);
    } catch (err) {
      console.error('Export error:', err);
      setError('Failed to export stakeholders to Excel');
    }
  };

  const handleImportExcel = async (event) => {
    const file = event.target.files[0];
    if (!file) return;

    try {
      setLoading(true);
      setError(null);

      // Read the file
      const data = await file.arrayBuffer();
      const workbook = XLSX.read(data);
      const sheetName = workbook.SheetNames[0];
      const worksheet = workbook.Sheets[sheetName];
      
      // Convert to JSON
      const jsonData = XLSX.utils.sheet_to_json(worksheet);
      
      if (jsonData.length === 0) {
        setError('No data found in Excel file');
        return;
      }

      // Process and import stakeholders
      let importedCount = 0;
      let errorCount = 0;
      
      for (const row of jsonData) {
        try {
          const stakeholderData = {
            name: row['Name'] || '',
            title: row['Title'] || '',
            email: row['Email'] || '',
            phone: row['Phone'] || '',
            department: row['Department'] || '',
            organization: row['Organization'] || '',
            stakeholder_type: row['Type'] || 'General',
            stakeholder_category: row['Category'] || 'Internal',
            stakeholder_priority: row['Priority'] || 'Primary',
            power_level: parseInt(row['Power Level']) || 3,
            interest_level: parseInt(row['Interest Level']) || 3,
            current_engagement_level: parseInt(row['Current Engagement']) || 0,
            target_engagement_level: parseInt(row['Target Engagement']) || 3,
            position_on_change: row['Position on Change'] || 'Neutral',
            engagement_status: row['Engagement Status'] || 'A',
            last_contact_date: row['Last Contact Date'] || null,
            engagement_purpose: row['Engagement Purpose'] || '',
            actions_required: row['Actions Required'] || '',
            comments: row['Comments'] || ''
          };

          // Skip rows without name
          if (!stakeholderData.name?.trim()) {
            continue;
          }

          await createStakeholder(stakeholderData, currentProject.id);
          importedCount++;
        } catch (err) {
          console.error('Error importing row:', err);
          errorCount++;
        }
      }

      // Refresh the stakeholder list
      await loadStakeholders();
      await loadStats();
      
      // Show success message
      if (importedCount > 0) {
        setError(`Successfully imported ${importedCount} stakeholders${errorCount > 0 ? `. ${errorCount} rows failed to import.` : '.'}`);
      } else {
        setError('No valid stakeholder data found to import');
      }

    } catch (err) {
      console.error('Import error:', err);
      setError('Failed to import Excel file. Please check the format and try again.');
    } finally {
      setLoading(false);
      // Clear the file input
      event.target.value = '';
    }
  };

  const clearFilters = () => {
    setSearchTerm('');
    setFilters({
      stakeholder_type: '',
      power_level: '',
      interest_level: '',
      position_on_change: '',
      engagement_status: '',
      current_engagement_level: '',
      relationship_owner: ''
    });
  };

  // Helper functions for displaying level descriptions
  const getPowerLevelText = (level) => {
    const powerLevels = {
      1: '1 - Very Low',
      2: '2 - Low', 
      3: '3 - Medium',
      4: '4 - High',
      5: '5 - Very High'
    };
    return powerLevels[level] || '3 - Medium';
  };

  const getInterestLevelText = (level) => {
    const interestLevels = {
      1: '1 - Very Low',
      2: '2 - Low',
      3: '3 - Medium', 
      4: '4 - High',
      5: '5 - Very High'
    };
    return interestLevels[level] || '3 - Medium';
  };

  const getEngagementLevelText = (level) => {
    const engagementLevels = {
      0: '0 - Not Aware',
      1: '1 - Aware',
      2: '2 - Understanding',
      3: '3 - Ready to Collaborate',
      4: '4 - Committed',
      5: '5 - Champion'
    };
    return engagementLevels[level] || '0 - Not Aware';
  };

  const getRAGStatusText = (status) => {
    const ragStatus = {
      'R': 'Red',
      'A': 'Amber', 
      'G': 'Green'
    };
    return ragStatus[status] || 'Amber';
  };

  const getEngagementGapIndicator = (current, target) => {
    const gap = target - current;
    if (gap === 0) return null;
    
    return (
      <span className={`gap-indicator ${gap > 0 ? 'gap-behind' : 'gap-ahead'}`}>
        {gap > 0 ? `+${gap}` : gap}
      </span>
    );
  };

  const getContactIndicator = (lastContactDate) => {
    if (!lastContactDate) {
      return (
        <div className="contact-status never-contacted">
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <circle cx="12" cy="12" r="10"/>
            <path d="M15 9l-6 6m0-6l6 6"/>
          </svg>
          <span>Never contacted</span>
        </div>
      );
    }

    const daysSince = Math.floor((new Date() - new Date(lastContactDate)) / (1000 * 60 * 60 * 24));
    
    if (daysSince <= 7) {
      return (
        <div className="contact-status recent">
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <path d="M22 16.92v3a2 2 0 0 1-2.18 2 19.79 19.79 0 0 1-8.63-3.07 19.5 19.5 0 0 1-6-6 19.79 19.79 0 0 1-3.07-8.67A2 2 0 0 1 4.11 2h3a2 2 0 0 1 2 1.72 12.84 12.84 0 0 0 .7 2.81 2 2 0 0 1-.45 2.11L8.09 9.91a16 16 0 0 0 6 6l1.27-1.27a2 2 0 0 1 2.11-.45 12.84 12.84 0 0 0 2.81.7A2 2 0 0 1 22 16.92z"/>
          </svg>
          <span>{daysSince === 0 ? 'Today' : `${daysSince} days ago`}</span>
        </div>
      );
    } else if (daysSince <= 30) {
      return (
        <div className="contact-status moderate">
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <circle cx="12" cy="12" r="10"/>
            <path d="M12 6v6l4 2"/>
          </svg>
          <span>{daysSince} days ago</span>
        </div>
      );
    } else {
      return (
        <div className="contact-status overdue">
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <circle cx="12" cy="12" r="10"/>
            <path d="M12 8v4M12 16h.01"/>
          </svg>
          <span>{daysSince} days ago</span>
        </div>
      );
    }
  };

  if (!currentProject) {
    return (
      <div className="stakeholder-directory">
        <div className="no-project">
          <h3>No Project Selected</h3>
          <p>Please select a project to view stakeholders.</p>
        </div>
      </div>
    );
  }

  if (loading) {
    return (
      <div className="stakeholder-directory">
        <div className="loading">
          <div className="loading-spinner"></div>
          <p>Loading stakeholders...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="stakeholder-directory">
      {/* Header */}
      <div className="directory-header">
        <div className="header-content">
          <div className="title-section">
            <h1>Stakeholder Directory</h1>
            <p>Manage and track stakeholders for {currentProject.title}</p>
          </div>
          
          <div className="header-actions">
            <button 
              className="btn btn-secondary"
              onClick={handleExportExcel}
              title="Export to Excel"
            >
              <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/>
                <polyline points="7,10 12,15 17,10"/>
                <line x1="12" y1="15" x2="12" y2="3"/>
              </svg>
              Export Excel
            </button>
            
            <label className="btn btn-secondary">
              <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/>
                <polyline points="17,8 12,3 7,8"/>
                <line x1="12" y1="3" x2="12" y2="15"/>
              </svg>
              Import Excel
              <input
                type="file"
                accept=".xlsx,.xls"
                onChange={handleImportExcel}
                style={{ display: 'none' }}
              />
            </label>
            
            <button 
              className="btn btn-primary"
              onClick={handleCreateStakeholder}
            >
              <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <path d="M12 5v14M5 12h14"/>
              </svg>
              Add Stakeholder
            </button>
          </div>
        </div>

        {/* Stats Bar */}
        <div className="stats-bar">
          <div className="stat-item">
            <span className="stat-number">{stats.total || 0}</span>
            <span className="stat-label">Total Stakeholders</span>
          </div>
          <div className="stat-item">
            <span className="stat-number">{(stats.byPowerLevel?.[4] || 0) + (stats.byPowerLevel?.[5] || 0)}</span>
            <span className="stat-label">High Power</span>
          </div>
          <div className="stat-item">
            <span className="stat-number">{(stats.byPosition?.Champion || 0) + (stats.byPosition?.Supporter || 0)}</span>
            <span className="stat-label">Supporters</span>
          </div>
          <div className="stat-item">
            <span className="stat-number">{(stats.byPosition?.Skeptic || 0) + (stats.byPosition?.Resistor || 0)}</span>
            <span className="stat-label">Resistors</span>
          </div>
        </div>

        {error && (
          <div className="error-banner">
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <circle cx="12" cy="12" r="10"/>
              <line x1="15" y1="9" x2="9" y2="15"/>
              <line x1="9" y1="9" x2="15" y2="15"/>
            </svg>
            <span>{error}</span>
            <button onClick={() => setError(null)} className="btn-link">Dismiss</button>
          </div>
        )}
      </div>

      {/* Filters and Search */}
      <div className="directory-controls">
        <div className="search-section">
          <div className="search-container">
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <circle cx="11" cy="11" r="8"/>
              <path d="m21 21-4.35-4.35"/>
            </svg>
            <input
              type="text"
              placeholder="Search stakeholders..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="search-input"
            />
          </div>
        </div>

        <div className="filter-section">
          <select
            value={filters.stakeholder_type}
            onChange={(e) => setFilters({...filters, stakeholder_type: e.target.value})}
            className="filter-select"
          >
            <option value="">All Types</option>
            <option value="Executive">Executive</option>
            <option value="Senior Manager">Senior Manager</option>
            <option value="Manager">Manager</option>
            <option value="Key User">Key User</option>
            <option value="Subject Matter Expert">Subject Matter Expert</option>
            <option value="General">General</option>
          </select>

          <select
            value={filters.power_level}
            onChange={(e) => setFilters({...filters, power_level: e.target.value})}
            className="filter-select"
          >
            <option value="">All Power Levels</option>
            <option value="5">5 - Very High</option>
            <option value="4">4 - High</option>
            <option value="3">3 - Medium</option>
            <option value="2">2 - Low</option>
            <option value="1">1 - Very Low</option>
          </select>

          <select
            value={filters.interest_level}
            onChange={(e) => setFilters({...filters, interest_level: e.target.value})}
            className="filter-select"
          >
            <option value="">All Interest Levels</option>
            <option value="5">5 - Very High</option>
            <option value="4">4 - High</option>
            <option value="3">3 - Medium</option>
            <option value="2">2 - Low</option>
            <option value="1">1 - Very Low</option>
          </select>

          <select
            value={filters.position_on_change}
            onChange={(e) => setFilters({...filters, position_on_change: e.target.value})}
            className="filter-select"
          >
            <option value="">All Positions</option>
            <option value="Champion">Champion</option>
            <option value="Supporter">Supporter</option>
            <option value="Neutral">Neutral</option>
            <option value="Skeptic">Skeptic</option>
            <option value="Resistor">Resistor</option>
          </select>

          <select
            value={filters.engagement_status}
            onChange={(e) => setFilters({...filters, engagement_status: e.target.value})}
            className="filter-select"
          >
            <option value="">All Status</option>
            <option value="G">🟢 Green</option>
            <option value="A">🟡 Amber</option>
            <option value="R">🔴 Red</option>
          </select>

          <select
            value={filters.current_engagement_level}
            onChange={(e) => setFilters({...filters, current_engagement_level: e.target.value})}
            className="filter-select"
          >
            <option value="">All Engagement Levels</option>
            <option value="5">5 - Champion</option>
            <option value="4">4 - Committed</option>
            <option value="3">3 - Ready to Collaborate</option>
            <option value="2">2 - Understanding</option>
            <option value="1">1 - Aware</option>
            <option value="0">0 - Not Aware</option>
          </select>

          <select
            value={filters.relationship_owner}
            onChange={(e) => setFilters({...filters, relationship_owner: e.target.value})}
            className="filter-select"
          >
            <option value="">All Owners</option>
            <option value="unassigned">Unassigned</option>
            {users.map(user => (
              <option key={user.id} value={user.id}>
                {user.name || user.email.split('@')[0]}
              </option>
            ))}
          </select>

          {(searchTerm || Object.values(filters).some(f => f)) && (
            <button onClick={clearFilters} className="btn btn-secondary">
              Clear Filters
            </button>
          )}
        </div>

        <div className="view-controls">
          <div className="view-toggle">
            <button
              className={`toggle-btn ${viewMode === 'cards' ? 'active' : ''}`}
              onClick={() => setViewMode('cards')}
            >
              <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <rect x="3" y="3" width="7" height="7"/>
                <rect x="14" y="3" width="7" height="7"/>
                <rect x="3" y="14" width="7" height="7"/>
                <rect x="14" y="14" width="7" height="7"/>
              </svg>
            </button>
            <button
              className={`toggle-btn ${viewMode === 'table' ? 'active' : ''}`}
              onClick={() => setViewMode('table')}
            >
              <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <path d="M3 6h18M3 12h18M3 18h18"/>
              </svg>
            </button>
          </div>
        </div>
      </div>

      {/* Content */}
      <div className="directory-content">
        {filteredStakeholders.length === 0 ? (
          <div className="empty-state">
            <div className="empty-icon">
              <svg width="64" height="64" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1">
                <path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"/>
                <circle cx="9" cy="7" r="4"/>
                <path d="M23 21v-2a4 4 0 0 0-3-3.87M16 3.13a4 4 0 0 1 0 7.75"/>
              </svg>
            </div>
            <h3>No Stakeholders Found</h3>
            <p>
              {stakeholders.length === 0 
                ? "Get started by adding your first stakeholder."
                : "No stakeholders match your current filters."
              }
            </p>
            {stakeholders.length === 0 && (
              <button 
                className="btn btn-primary"
                onClick={handleCreateStakeholder}
              >
                Add First Stakeholder
              </button>
            )}
          </div>
        ) : (
          <>
            {viewMode === 'cards' ? (
              <div className="stakeholders-grid">
                {filteredStakeholders.map(stakeholder => (
                  <StakeholderCard
                    key={stakeholder.id}
                    stakeholder={stakeholder}
                    onEdit={handleEditStakeholder}
                    onDelete={handleDeleteStakeholder}
                  />
                ))}
              </div>
            ) : (
              <div className="stakeholders-table">
                <table>
                  <thead>
                    <tr>
                      <th>Name</th>
                      <th>Title</th>
                      <th>Email</th>
                      <th>Type</th>
                      <th>Power</th>
                      <th>Interest</th>
                      <th>Current Engagement</th>
                      <th>Target Engagement</th>
                      <th>Position</th>
                      <th>Status</th>
                      <th>Owner</th>
                      <th>Last Contact</th>
                      <th>Actions</th>
                    </tr>
                  </thead>
                  <tbody>
                    {filteredStakeholders.map(stakeholder => (
                      <tr key={stakeholder.id}>
                        <td>
                          <strong>{stakeholder.name}</strong>
                        </td>
                        <td>{stakeholder.title || '—'}</td>
                        <td>
                          {stakeholder.email ? (
                            <a href={`mailto:${stakeholder.email}`} className="email-link">
                              {stakeholder.email}
                            </a>
                          ) : '—'}
                        </td>
                        <td>
                          <span className="type-badge">{stakeholder.stakeholder_type}</span>
                        </td>
                        <td>
                          <span className={`level-badge power-${stakeholder.power_level || 3}`}>
                            {getPowerLevelText(stakeholder.power_level || 3)}
                          </span>
                        </td>
                        <td>
                          <span className={`level-badge interest-${stakeholder.interest_level || 3}`}>
                            {getInterestLevelText(stakeholder.interest_level || 3)}
                          </span>
                        </td>
                        <td>
                          <span className={`engagement-badge engagement-${stakeholder.current_engagement_level || 0}`}>
                            {getEngagementLevelText(stakeholder.current_engagement_level || 0)}
                          </span>
                        </td>
                        <td>
                          <div className="engagement-target">
                            <span className={`engagement-badge engagement-${stakeholder.target_engagement_level || 3}`}>
                              {getEngagementLevelText(stakeholder.target_engagement_level || 3)}
                            </span>
                            {getEngagementGapIndicator(stakeholder.current_engagement_level || 0, stakeholder.target_engagement_level || 3)}
                          </div>
                        </td>
                        <td>
                          <span className={`position-badge position-${stakeholder.position_on_change?.toLowerCase() || 'neutral'}`}>
                            {stakeholder.position_on_change || 'Neutral'}
                          </span>
                        </td>
                        <td>
                          <span className={`rag-badge rag-${stakeholder.engagement_status?.toLowerCase() || 'a'}`}>
                            {getRAGStatusText(stakeholder.engagement_status || 'A')}
                          </span>
                        </td>
                        <td>
                          <span className="owner-badge">
                            {stakeholder.relationship_owner_profile?.email?.split('@')[0] || 'Unassigned'}
                          </span>
                        </td>
                        <td>
                          <div className="contact-indicator">
                            {getContactIndicator(stakeholder.last_contact_date)}
                          </div>
                        </td>
                        <td>
                          <div className="table-actions">
                            <button
                              onClick={() => handleEditStakeholder(stakeholder)}
                              className="action-btn edit-btn"
                              title="Edit"
                            >
                              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                                <path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"/>
                                <path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"/>
                              </svg>
                            </button>
                            <button
                              onClick={() => handleDeleteStakeholder(stakeholder)}
                              className="action-btn delete-btn"
                              title="Delete"
                            >
                              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                                <polyline points="3,6 5,6 21,6"/>
                                <path d="m19,6v14a2,2 0 0,1 -2,2H7a2,2 0 0,1 -2,-2V6m3,0V4a2,2 0 0,1 2,-2h4a2,2 0 0,1 2,2v2"/>
                              </svg>
                            </button>
                          </div>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </>
        )}
      </div>

      {/* Results Summary */}
      {filteredStakeholders.length > 0 && (
        <div className="results-summary">
          Showing {filteredStakeholders.length} of {stakeholders.length} stakeholders
        </div>
      )}

      {/* Form Modal */}
      {showForm && (
        <StakeholderForm
          stakeholder={editingStakeholder}
          onSubmit={handleFormSubmit}
          onCancel={handleFormCancel}
        />
      )}
    </div>
  );
};

export default StakeholderDirectory;