import React from 'react';
import './StakeholderCard.css';

const StakeholderCard = ({ stakeholder, onEdit, onDelete }) => {
  // Helper functions for new numeric levels
  const getPowerLevelColor = (level) => {
    const colors = {
      1: '#dc3545', // Very Low - Red
      2: '#fd7e14', // Low - Orange
      3: '#ffc107', // Medium - Yellow
      4: '#198754', // High - Green
      5: '#0d6efd'  // Very High - Blue
    };
    return colors[level] || colors[3];
  };

  const getInterestLevelColor = (level) => {
    const colors = {
      1: '#6c757d', // Very Low - Gray
      2: '#6f42c1', // Low - Purple
      3: '#0dcaf0', // Medium - Cyan
      4: '#20c997', // High - Teal
      5: '#198754'  // Very High - Green
    };
    return colors[level] || colors[3];
  };

  const getEngagementLevelColor = (level) => {
    const colors = {
      0: '#6c757d', // Not Aware - Gray
      1: '#dc3545', // Aware - Red
      2: '#fd7e14', // Understanding - Orange
      3: '#ffc107', // Ready to Collaborate - Yellow
      4: '#198754', // Committed - Green
      5: '#0d6efd'  // Champion - Blue
    };
    return colors[level] || colors[0];
  };

  // Text helper functions
  const getPowerLevelText = (level) => {
    const texts = {
      1: 'Very Low',
      2: 'Low', 
      3: 'Medium',
      4: 'High',
      5: 'Very High'
    };
    return texts[level] || 'Medium';
  };

  const getInterestLevelText = (level) => {
    const texts = {
      1: 'Very Low',
      2: 'Low',
      3: 'Medium', 
      4: 'High',
      5: 'Very High'
    };
    return texts[level] || 'Medium';
  };

  const getEngagementLevelText = (level) => {
    const texts = {
      0: 'Not Aware',
      1: 'Aware',
      2: 'Understanding',
      3: 'Ready to Collaborate',
      4: 'Committed',
      5: 'Champion'
    };
    return texts[level] || 'Not Aware';
  };

  const getRAGStatusText = (status) => {
    const texts = {
      'R': 'Red',
      'A': 'Amber', 
      'G': 'Green'
    };
    return texts[status] || 'Amber';
  };

  const getEngagementGap = (current, target) => {
    return target - current;
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

  const getPositionColor = (position) => {
    switch (position?.toLowerCase()) {
      case 'champion': return '#10b981';
      case 'supporter': return '#22c55e';
      case 'neutral': return '#6b7280';
      case 'skeptic': return '#f59e0b';
      case 'resistor': return '#ef4444';
      default: return '#6b7280';
    }
  };

  const getPositionIcon = (position) => {
    switch (position?.toLowerCase()) {
      case 'champion':
        return (
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <path d="M12 2l3.09 6.26L22 9.27l-5 4.87 1.18 6.88L12 17.77l-6.18 3.25L7 14.14 2 9.27l6.91-1.01L12 2z"/>
          </svg>
        );
      case 'supporter':
        return (
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <path d="M14 9V5a3 3 0 0 0-3-3l-4 9v11h11.28a2 2 0 0 0 2-1.7l1.38-9a2 2 0 0 0-2-2.3zM7 22H4a2 2 0 0 1-2-2v-7a2 2 0 0 1 2-2h3"/>
          </svg>
        );
      case 'neutral':
        return (
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <circle cx="12" cy="12" r="10"/>
            <line x1="8" y1="12" x2="16" y2="12"/>
          </svg>
        );
      case 'skeptic':
        return (
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <circle cx="12" cy="12" r="10"/>
            <path d="M9.09 9a3 3 0 0 1 5.83 1c0 2-3 3-3 3"/>
            <line x1="12" y1="17" x2="12.01" y2="17"/>
          </svg>
        );
      case 'resistor':
        return (
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <path d="M10 15v4a3 3 0 0 0 3 3l4-9V2H5.72a2 2 0 0 0-2 1.7l-1.38 9a2 2 0 0 0 2 2.3zm7-13h2.67A2.31 2.31 0 0 1 22 4v7a2.31 2.31 0 0 1-2.33 2H17"/>
          </svg>
        );
      default:
        return (
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <circle cx="12" cy="12" r="10"/>
            <line x1="8" y1="12" x2="16" y2="12"/>
          </svg>
        );
    }
  };

  return (
    <div className="stakeholder-card">
      {/* Header */}
      <div className="card-header">
        <div className="stakeholder-info">
          <h3 className="stakeholder-name">{stakeholder.name}</h3>
          {stakeholder.title && (
            <p className="stakeholder-title">{stakeholder.title}</p>
          )}
          {stakeholder.department && (
            <p className="stakeholder-department">{stakeholder.department}</p>
          )}
        </div>
        
        <div className="card-actions">
          <button
            onClick={() => onEdit(stakeholder)}
            className="action-btn edit-btn"
            title="Edit stakeholder"
          >
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"/>
              <path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"/>
            </svg>
          </button>
          <button
            onClick={() => onDelete(stakeholder)}
            className="action-btn delete-btn"
            title="Delete stakeholder"
          >
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <polyline points="3,6 5,6 21,6"/>
              <path d="m19,6v14a2,2 0 0,1 -2,2H7a2,2 0 0,1 -2,-2V6m3,0V4a2,2 0 0,1 2,-2h4a2,2 0 0,1 2,2v2"/>
            </svg>
          </button>
        </div>
      </div>

      {/* Contact Info */}
      {(stakeholder.email || stakeholder.phone) && (
        <div className="contact-info">
          {stakeholder.email && (
            <div className="contact-item">
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <path d="M4 4h16c1.1 0 2 .9 2 2v12c0 1.1-.9 2-2 2H4c-1.1 0-2-.9-2-2V6c0-1.1.9-2 2-2z"/>
                <polyline points="22,6 12,13 2,6"/>
              </svg>
              <a href={`mailto:${stakeholder.email}`} className="contact-link">
                {stakeholder.email}
              </a>
            </div>
          )}
          {stakeholder.phone && (
            <div className="contact-item">
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <path d="M22 16.92v3a2 2 0 0 1-2.18 2 19.79 19.79 0 0 1-8.63-3.07 19.5 19.5 0 0 1-6-6 19.79 19.79 0 0 1-3.07-8.67A2 2 0 0 1 4.11 2h3a2 2 0 0 1 2 1.72 12.84 12.84 0 0 0 .7 2.81 2 2 0 0 1-.45 2.11L8.09 9.91a16 16 0 0 0 6 6l1.27-1.27a2 2 0 0 1 2.11-.45 12.84 12.84 0 0 0 2.81.7A2 2 0 0 1 22 16.92z"/>
              </svg>
              <a href={`tel:${stakeholder.phone}`} className="contact-link">
                {stakeholder.phone}
              </a>
            </div>
          )}
        </div>
      )}

      {/* Type Badge */}
      <div className="stakeholder-type">
        <span className="type-badge">
          {stakeholder.stakeholder_type || 'General'}
        </span>
      </div>

      {/* Enhanced Attributes */}
      <div className="stakeholder-attributes">
        {/* Power Level */}
        <div className="attribute-item">
          <label>Power</label>
          <div className="attribute-value">
            <div 
              className="level-indicator power"
              style={{ backgroundColor: getPowerLevelColor(stakeholder.power_level || 3) }}
            ></div>
            <span>{stakeholder.power_level || 3} - {getPowerLevelText(stakeholder.power_level || 3)}</span>
          </div>
        </div>

        {/* Interest Level */}
        <div className="attribute-item">
          <label>Interest</label>
          <div className="attribute-value">
            <div 
              className="level-indicator interest"
              style={{ backgroundColor: getInterestLevelColor(stakeholder.interest_level || 3) }}
            ></div>
            <span>{stakeholder.interest_level || 3} - {getInterestLevelText(stakeholder.interest_level || 3)}</span>
          </div>
        </div>
      </div>

      {/* Engagement Levels */}
      <div className="engagement-section">
        <div className="engagement-row">
          <div className="engagement-item">
            <label>Current Engagement</label>
            <div className="engagement-value">
              <div 
                className="level-indicator engagement"
                style={{ backgroundColor: getEngagementLevelColor(stakeholder.current_engagement_level || 0) }}
              ></div>
              <span>{getEngagementLevelText(stakeholder.current_engagement_level || 0)}</span>
            </div>
          </div>
          
          <div className="engagement-item">
            <label>Target Engagement</label>
            <div className="engagement-value">
              <div 
                className="level-indicator engagement"
                style={{ backgroundColor: getEngagementLevelColor(stakeholder.target_engagement_level || 3) }}
              ></div>
              <span>{getEngagementLevelText(stakeholder.target_engagement_level || 3)}</span>
            </div>
          </div>
        </div>
        
        {/* Engagement Gap Indicator */}
        {(stakeholder.target_engagement_level || 3) !== (stakeholder.current_engagement_level || 0) && (
          <div className="engagement-gap">
            <span className="gap-label">Gap: </span>
            <span className={`gap-value ${getEngagementGap(stakeholder.current_engagement_level || 0, stakeholder.target_engagement_level || 3) > 0 ? 'gap-behind' : 'gap-ahead'}`}>
              {getEngagementGap(stakeholder.current_engagement_level || 0, stakeholder.target_engagement_level || 3) > 0 
                ? `+${getEngagementGap(stakeholder.current_engagement_level || 0, stakeholder.target_engagement_level || 3)}` 
                : getEngagementGap(stakeholder.current_engagement_level || 0, stakeholder.target_engagement_level || 3)
              }
            </span>
          </div>
        )}
      </div>

      {/* RAG Status and Relationship Owner */}
      <div className="status-section">
        <div className="status-item">
          <label>Status</label>
          <div className={`rag-indicator rag-${(stakeholder.engagement_status || 'A').toLowerCase()}`}>
            {getRAGStatusText(stakeholder.engagement_status || 'A')}
          </div>
        </div>
        
        {stakeholder.relationship_owner_profile?.email && (
          <div className="owner-item">
            <label>Owner</label>
            <div className="owner-value">
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"/>
                <circle cx="12" cy="7" r="4"/>
              </svg>
              <span>{stakeholder.relationship_owner_profile.email.split('@')[0]}</span>
            </div>
          </div>
        )}
      </div>

      {/* Contact Tracking */}
      <div className="contact-section">
        <label>Last Contact</label>
        {getContactIndicator(stakeholder.last_contact_date)}
      </div>

      {/* Position on Change */}
      <div className="position-indicator">
        <div className="position-content">
          <div 
            className="position-icon"
            style={{ color: getPositionColor(stakeholder.position_on_change) }}
          >
            {getPositionIcon(stakeholder.position_on_change)}
          </div>
          <span 
            className="position-text"
            style={{ color: getPositionColor(stakeholder.position_on_change) }}
          >
            {stakeholder.position_on_change || 'Neutral'}
          </span>
        </div>
      </div>

      {/* Notes Preview */}
      {stakeholder.notes && (
        <div className="notes-preview">
          <p>{stakeholder.notes.length > 100 
            ? `${stakeholder.notes.substring(0, 100)}...` 
            : stakeholder.notes
          }</p>
        </div>
      )}

      {/* Organization Info */}
      {stakeholder.organization && (
        <div className="organization-info">
          <small>
            <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <path d="M3 21h18"/>
              <path d="M5 21V7l8-4v18"/>
              <path d="M19 21V11l-6-4"/>
            </svg>
            {stakeholder.organization}
          </small>
        </div>
      )}
    </div>
  );
};

export default StakeholderCard;