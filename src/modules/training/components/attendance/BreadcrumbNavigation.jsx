import React from 'react';
import './BreadcrumbNavigation.css';

const BreadcrumbNavigation = ({ breadcrumb, onBreadcrumbClick }) => {
  return (
    <div className="breadcrumb-navigation">
      <div className="breadcrumb-container">
        {breadcrumb.map((crumb, index) => (
          <React.Fragment key={index}>
            <button
              className={`breadcrumb-item ${index === breadcrumb.length - 1 ? 'active' : ''}`}
              onClick={() => onBreadcrumbClick(crumb.level, crumb.value)}
              disabled={index === breadcrumb.length - 1}
            >
              {crumb.level === 'project' && '🏢'}
              {crumb.level === 'functionalArea' && '📋'}
              {crumb.level === 'trainingLocation' && '📍'}
              {crumb.level === 'session' && '🎯'}
              <span className="breadcrumb-label">{crumb.label}</span>
            </button>
            {index < breadcrumb.length - 1 && (
              <span className="breadcrumb-separator">›</span>
            )}
          </React.Fragment>
        ))}
      </div>
      
      <div className="breadcrumb-info">
        <span className="info-text">
          {breadcrumb.length === 1 && 'Click on an area to drill down'}
          {breadcrumb.length === 2 && 'Click on a location to see individual sessions'}
          {breadcrumb.length === 3 && 'Individual session details'}
        </span>
      </div>
    </div>
  );
};

export default BreadcrumbNavigation;