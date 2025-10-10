import React, { useState, useEffect } from 'react';
import { useProject } from '@core/contexts/ProjectContext';
import { getInfluenceInterestMatrix } from '../services/stakeholderService';
import './InfluenceInterestMatrix.css';

const InfluenceInterestMatrix = () => {
  const { currentProject } = useProject();
  const [stakeholders, setStakeholders] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [selectedStakeholder, setSelectedStakeholder] = useState(null);

  useEffect(() => {
    if (currentProject?.id) {
      loadMatrixData();
    }
  }, [currentProject?.id]);

  const loadMatrixData = async () => {
    try {
      setLoading(true);
      const data = await getInfluenceInterestMatrix(currentProject.id);
      console.log('Matrix data loaded:', data);
      data.forEach(stakeholder => {
        const { x, y } = getPositionCoordinates(stakeholder.power_level, stakeholder.interest_level);
        console.log(`Stakeholder ${stakeholder.name}: power=${stakeholder.power_level}, interest=${stakeholder.interest_level}, position=(${x}%, ${y}%)`);
      });
      setStakeholders(data);
      setError(null);
    } catch (err) {
      console.error('Error loading matrix data:', err);
      setError('Failed to load matrix data');
    } finally {
      setLoading(false);
    }
  };

  const getPositionCoordinates = (influence, interest) => {
    // Convert 1-5 scale to position percentages
    // 1 = 10%, 2 = 30%, 3 = 50%, 4 = 70%, 5 = 90%
    const convertToPercentage = (value) => {
      if (value >= 1 && value <= 5) {
        return 10 + (value - 1) * 20; // Maps 1->10%, 2->30%, 3->50%, 4->70%, 5->90%
      }
      return 50; // Default to center if invalid
    };
    
    return {
      x: convertToPercentage(interest),
      y: 100 - convertToPercentage(influence) // Invert Y axis so High is at top
    };
  };

  const getLevelClass = (level, type) => {
    // Convert numeric level (1-5) to CSS class name
    if (level >= 4) return `${type}-high`;
    if (level >= 3) return `${type}-medium`;
    return `${type}-low`;
  };

  const getLevelLabel = (level) => {
    // Convert numeric level (1-5) to display label
    if (level >= 4) return 'High';
    if (level >= 3) return 'Medium';
    return 'Low';
  };

  const getQuadrantInfo = (x, y) => {
    const centerX = 50;
    const centerY = 50;
    
    if (x >= centerX && y <= centerY) {
      return {
        name: 'Manage Closely',
        description: 'High Interest, High Influence',
        color: '#ef4444',
        strategy: 'Keep satisfied and engaged'
      };
    } else if (x < centerX && y <= centerY) {
      return {
        name: 'Keep Satisfied',
        description: 'Low Interest, High Influence',
        color: '#f59e0b',
        strategy: 'Keep satisfied but don\'t overwhelm'
      };
    } else if (x >= centerX && y > centerY) {
      return {
        name: 'Keep Informed',
        description: 'High Interest, Low Influence',
        color: '#10b981',
        strategy: 'Keep informed and engaged'
      };
    } else {
      return {
        name: 'Monitor',
        description: 'Low Interest, Low Influence',
        color: '#6b7280',
        strategy: 'Monitor with minimal effort'
      };
    }
  };

  const getStakeholdersByQuadrant = () => {
    const quadrants = {
      'Manage Closely': [],
      'Keep Satisfied': [],
      'Keep Informed': [],
      'Monitor': []
    };

    stakeholders.forEach(stakeholder => {
      const { x, y } = getPositionCoordinates(stakeholder.power_level, stakeholder.interest_level);
      const quadrant = getQuadrantInfo(x, y);
      quadrants[quadrant.name].push(stakeholder);
    });

    return quadrants;
  };

  if (!currentProject) {
    return (
      <div className="influence-matrix">
        <div className="no-project">
          <h3>No Project Selected</h3>
          <p>Please select a project to view the influence/interest matrix.</p>
        </div>
      </div>
    );
  }

  if (loading) {
    return (
      <div className="influence-matrix">
        <div className="loading">
          <div className="loading-spinner"></div>
          <p>Loading matrix data...</p>
        </div>
      </div>
    );
  }

  const quadrantData = getStakeholdersByQuadrant();

  return (
    <div className="influence-matrix">
      {/* Header */}
      <div className="matrix-header">
        <div className="header-content">
          <h1>Influence/Interest Matrix</h1>
          <p>Visual mapping of stakeholder influence and interest levels for {currentProject.title}</p>
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

      <div className="matrix-content">
        {stakeholders.length === 0 ? (
          <div className="empty-state">
            <div className="empty-icon">
              <svg width="64" height="64" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1">
                <path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"/>
                <circle cx="9" cy="7" r="4"/>
                <path d="M23 21v-2a4 4 0 0 0-3-3.87M16 3.13a4 4 0 0 1 0 7.75"/>
              </svg>
            </div>
            <h3>No Stakeholders Found</h3>
            <p>Add stakeholders to see them positioned on the influence/interest matrix.</p>
          </div>
        ) : (
          <div className="matrix-layout">
            {/* Visual Matrix */}
            <div className="matrix-visualization">
              <div className="matrix-container">
                {/* Axis Labels */}
                <div className="y-axis-label">
                  <span className="axis-title">Influence</span>
                  <div className="axis-labels">
                    <span className="axis-high">High</span>
                    <span className="axis-low">Low</span>
                  </div>
                </div>
                
                <div className="matrix-grid">
                  {/* Grid Background */}
                  <div className="grid-background">
                    {/* Quadrant backgrounds */}
                    <div className="quadrant top-left">
                      <div className="quadrant-label">Keep Satisfied</div>
                    </div>
                    <div className="quadrant top-right">
                      <div className="quadrant-label">Manage Closely</div>
                    </div>
                    <div className="quadrant bottom-left">
                      <div className="quadrant-label">Monitor</div>
                    </div>
                    <div className="quadrant bottom-right">
                      <div className="quadrant-label">Keep Informed</div>
                    </div>
                    
                    {/* Grid lines */}
                    <div className="grid-line vertical"></div>
                    <div className="grid-line horizontal"></div>
                  </div>

                  {/* Stakeholders */}
                  <div className="stakeholder-dots">
                    {stakeholders.map(stakeholder => {
                      const { x, y } = getPositionCoordinates(stakeholder.power_level, stakeholder.interest_level);
                      const isSelected = selectedStakeholder?.id === stakeholder.id;
                      
                      return (
                        <div
                          key={stakeholder.id}
                          className={`stakeholder-dot ${isSelected ? 'selected' : ''}`}
                          style={{
                            left: `${x}%`,
                            top: `${y}%`,
                            backgroundColor: stakeholder.category_color || '#3b82f6'
                          }}
                          onClick={() => setSelectedStakeholder(stakeholder)}
                          title={stakeholder.name}
                        >
                          <span className="dot-label">{stakeholder.name}</span>
                        </div>
                      );
                    })}
                  </div>
                </div>
                
                <div className="x-axis-label">
                  <span className="axis-title">Interest</span>
                  <div className="axis-labels">
                    <span className="axis-low">Low</span>
                    <span className="axis-high">High</span>
                  </div>
                </div>
              </div>
            </div>

            {/* Stakeholder Details Panel */}
            {selectedStakeholder && (
              <div className="stakeholder-details">
                <div className="details-header">
                  <h3>{selectedStakeholder.name}</h3>
                  <button
                    onClick={() => setSelectedStakeholder(null)}
                    className="close-btn"
                  >
                    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                      <line x1="18" y1="6" x2="6" y2="18"/>
                      <line x1="6" y1="6" x2="18" y2="18"/>
                    </svg>
                  </button>
                </div>
                
                <div className="details-content">
                  <div className="detail-item">
                    <label>Type:</label>
                    <span>{selectedStakeholder.stakeholder_type}</span>
                  </div>
                  
                  <div className="detail-item">
                    <label>Power:</label>
                    <span className={`level-badge ${getLevelClass(selectedStakeholder.power_level, 'influence')}`}>
                      {getLevelLabel(selectedStakeholder.power_level)} ({selectedStakeholder.power_level})
                    </span>
                  </div>
                  
                  <div className="detail-item">
                    <label>Interest:</label>
                    <span className={`level-badge ${getLevelClass(selectedStakeholder.interest_level, 'interest')}`}>
                      {getLevelLabel(selectedStakeholder.interest_level)} ({selectedStakeholder.interest_level})
                    </span>
                  </div>
                  
                  <div className="detail-item">
                    <label>Position:</label>
                    <span className={`position-badge position-${selectedStakeholder.position_on_change?.toLowerCase()}`}>
                      {selectedStakeholder.position_on_change}
                    </span>
                  </div>

                  {/* Quadrant Strategy */}
                  <div className="strategy-info">
                    <label>Strategy:</label>
                    <div className="strategy-content">
                      {(() => {
                        const { x, y } = getPositionCoordinates(
                          selectedStakeholder.power_level,
                          selectedStakeholder.interest_level
                        );
                        const quadrant = getQuadrantInfo(x, y);
                        return (
                          <>
                            <span className="quadrant-name" style={{ color: quadrant.color }}>
                              {quadrant.name}
                            </span>
                            <p className="strategy-description">{quadrant.strategy}</p>
                          </>
                        );
                      })()}
                    </div>
                  </div>
                </div>
              </div>
            )}
          </div>
        )}

        {/* Quadrant Summary */}
        {stakeholders.length > 0 && (
          <div className="quadrant-summary">
            <h3>Quadrant Summary</h3>
            <div className="quadrant-cards">
              {Object.entries(quadrantData).map(([quadrantName, quadrantStakeholders]) => {
                const quadrant = getQuadrantInfo(
                  quadrantName === 'Manage Closely' || quadrantName === 'Keep Informed' ? 75 : 25,
                  quadrantName === 'Manage Closely' || quadrantName === 'Keep Satisfied' ? 25 : 75
                );
                
                return (
                  <div key={quadrantName} className="quadrant-card">
                    <div className="card-header">
                      <div className="quadrant-info">
                        <h4 style={{ color: quadrant.color }}>{quadrantName}</h4>
                        <p>{quadrant.description}</p>
                      </div>
                      <div className="quadrant-count">
                        {quadrantStakeholders.length}
                      </div>
                    </div>
                    
                    <div className="stakeholder-list">
                      {quadrantStakeholders.map(stakeholder => (
                        <div
                          key={stakeholder.id}
                          className="stakeholder-item"
                          onClick={() => setSelectedStakeholder(stakeholder)}
                        >
                          <div className="stakeholder-name">{stakeholder.name}</div>
                          <div className="stakeholder-type">{stakeholder.stakeholder_type}</div>
                        </div>
                      ))}
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

export default InfluenceInterestMatrix;