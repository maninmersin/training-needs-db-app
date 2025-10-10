import React, { useState } from 'react';
import './ImpactRatingGuide.css';

const ImpactRatingGuide = ({ isOpen, onToggle }) => {
  const ratingGuide = {
    process: {
      title: 'PROCESS',
      description: 'How much the process itself changes',
      ratings: {
        0: 'The process is unchanged',
        1: 'Some steps in the process have changed',
        2: 'Most or all steps in the process are changed',
        3: 'A completely new process'
      }
    },
    role: {
      title: 'ROLE',
      description: 'How role ownership and responsibilities change',
      ratings: {
        0: 'Process remains with the existing owners',
        1: 'Process steps remain with existing owners, but responsibilities/tasks have changed. Unlikely to result in a job specification amendment',
        2: 'Process steps belong to new owners or new steps assigned. Likely to result in a job specification amendment',
        3: 'Process moves to a completely new role in the organisation. A new job specification is required'
      }
    },
    effort: {
      title: 'EFFORT (Workload)',
      description: 'How the effort and resource requirements change',
      ratings: {
        0: 'No fluctuation in effort spent',
        1: 'Fluctuation in effort, but no impact on resourcing',
        2: 'Fluctuation will require new owners or more/less resource',
        3: 'Fluctuation impacts resourcing, requiring a new role or adjustment'
      }
    }
  };

  const getRatingColor = (rating) => {
    const colors = {
      0: '#10b981', // Green
      1: '#f59e0b', // Yellow
      2: '#f97316', // Orange
      3: '#dc2626'  // Red
    };
    return colors[rating] || '#6b7280';
  };

  return (
    <div className="impact-rating-guide">
      <div className="guide-header">
        <button 
          className="guide-toggle-btn"
          onClick={onToggle}
          aria-expanded={isOpen}
        >
          <span className="guide-icon">📊</span>
          <span className="guide-title">Process Impact Analysis – Change Rating Guide</span>
          <span className={`guide-arrow ${isOpen ? 'expanded' : ''}`}>▼</span>
        </button>
      </div>
      
      {isOpen && (
        <div className="guide-content">
          <div className="guide-intro">
            <p>Use this guide to ensure consistent rating across all impact dimensions. Each dimension uses a 0-3 scale.</p>
          </div>
          
          <div className="rating-dimensions">
            {Object.entries(ratingGuide).map(([key, dimension]) => (
              <div key={key} className="dimension-section">
                <div className="dimension-header">
                  <h4 className="dimension-title">{dimension.title}</h4>
                  <p className="dimension-description">{dimension.description}</p>
                </div>
                
                <div className="rating-scale">
                  {Object.entries(dimension.ratings).map(([rating, description]) => (
                    <div key={rating} className="rating-item">
                      <div 
                        className="rating-badge"
                        style={{ backgroundColor: getRatingColor(parseInt(rating)) }}
                      >
                        {rating}
                      </div>
                      <div className="rating-description">
                        <strong className="rating-level">
                          {rating === '0' ? 'ZERO' : 
                           rating === '1' ? 'LOW' : 
                           rating === '2' ? 'MEDIUM' : 'HIGH'}
                        </strong>
                        <span className="rating-text">{description}</span>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            ))}
          </div>
          
          <div className="guide-footer">
            <div className="rating-summary">
              <h5>Quick Reference:</h5>
              <div className="summary-badges">
                <span className="summary-badge" style={{ backgroundColor: '#10b981' }}>0 - No Change</span>
                <span className="summary-badge" style={{ backgroundColor: '#f59e0b' }}>1 - Minor Change</span>
                <span className="summary-badge" style={{ backgroundColor: '#f97316' }}>2 - Major Change</span>
                <span className="summary-badge" style={{ backgroundColor: '#dc2626' }}>3 - Complete Change</span>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default ImpactRatingGuide;