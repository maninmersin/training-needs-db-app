import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useProject } from '@core/contexts/ProjectContext';
import { getStakeholderStats } from '../services/stakeholderService';
import './StakeholderDashboard.css';

const StakeholderDashboard = () => {
  const navigate = useNavigate();
  const { currentProject } = useProject();
  const [stats, setStats] = useState({});
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (currentProject?.id) {
      loadStats();
    }
  }, [currentProject?.id]);

  const loadStats = async () => {
    try {
      setLoading(true);
      const data = await getStakeholderStats(currentProject.id);
      setStats(data);
    } catch (err) {
      console.error('Error loading stats:', err);
    } finally {
      setLoading(false);
    }
  };

  const quickActions = [
    {
      title: 'Add New Stakeholder',
      description: 'Register a new stakeholder in the system',
      icon: (
        <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
          <path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2"/>
          <circle cx="9" cy="7" r="4"/>
          <line x1="19" y1="8" x2="19" y2="14"/>
          <line x1="22" y1="11" x2="16" y2="11"/>
        </svg>
      ),
      onClick: () => navigate('/stakeholder-directory')
    },
    {
      title: 'View Matrix',
      description: 'Visualize stakeholder influence and interest',
      icon: (
        <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
          <rect x="3" y="3" width="18" height="18" rx="2"/>
          <path d="M9 3v18"/>
          <path d="M3 9h18"/>
        </svg>
      ),
      onClick: () => navigate('/influence-interest-matrix')
    },
    {
      title: 'Stakeholder Directory',
      description: 'Browse and manage all stakeholders',
      icon: (
        <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
          <path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"/>
          <circle cx="9" cy="7" r="4"/>
          <path d="M23 21v-2a4 4 0 0 0-3-3.87M16 3.13a4 4 0 0 1 0 7.75"/>
        </svg>
      ),
      onClick: () => navigate('/stakeholder-directory')
    }
  ];

  if (!currentProject) {
    return (
      <div className="stakeholder-dashboard">
        <div className="no-project">
          <h3>No Project Selected</h3>
          <p>Please select a project to view stakeholder management features.</p>
        </div>
      </div>
    );
  }

  return (
    <div className="stakeholder-dashboard">
      {/* Header */}
      <div className="dashboard-header">
        <div className="header-content">
          <h1>Stakeholder Engagement</h1>
          <p>Manage stakeholder relationships and track engagement for {currentProject.title}</p>
        </div>
      </div>

      {/* Stats Overview */}
      <div className="stats-overview">
        {loading ? (
          <div className="stats-loading">
            <div className="loading-spinner"></div>
            <p>Loading statistics...</p>
          </div>
        ) : (
          <div className="stats-grid">
            <div className="stat-card">
              <div className="stat-icon">
                <svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                  <path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"/>
                  <circle cx="9" cy="7" r="4"/>
                  <path d="M23 21v-2a4 4 0 0 0-3-3.87M16 3.13a4 4 0 0 1 0 7.75"/>
                </svg>
              </div>
              <div className="stat-content">
                <div className="stat-number">{stats.total || 0}</div>
                <div className="stat-label">Total Stakeholders</div>
              </div>
            </div>

            <div className="stat-card">
              <div className="stat-icon high-influence">
                <svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                  <path d="M12 2l3.09 6.26L22 9.27l-5 4.87 1.18 6.88L12 17.77l-6.18 3.25L7 14.14 2 9.27l6.91-1.01L12 2z"/>
                </svg>
              </div>
              <div className="stat-content">
                <div className="stat-number">{stats.byInfluence?.High || 0}</div>
                <div className="stat-label">High Influence</div>
              </div>
            </div>

            <div className="stat-card">
              <div className="stat-icon supporters">
                <svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                  <path d="M14 9V5a3 3 0 0 0-3-3l-4 9v11h11.28a2 2 0 0 0 2-1.7l1.38-9a2 2 0 0 0-2-2.3zM7 22H4a2 2 0 0 1-2-2v-7a2 2 0 0 1 2-2h3"/>
                </svg>
              </div>
              <div className="stat-content">
                <div className="stat-number">
                  {(stats.byPosition?.Champion || 0) + (stats.byPosition?.Supporter || 0)}
                </div>
                <div className="stat-label">Supporters</div>
              </div>
            </div>

            <div className="stat-card">
              <div className="stat-icon resistors">
                <svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                  <path d="M10 15v4a3 3 0 0 0 3 3l4-9V2H5.72a2 2 0 0 0-2 1.7l-1.38 9a2 2 0 0 0 2 2.3zm7-13h2.67A2.31 2.31 0 0 1 22 4v7a2.31 2.31 0 0 1-2.33 2H17"/>
                </svg>
              </div>
              <div className="stat-content">
                <div className="stat-number">
                  {(stats.byPosition?.Skeptic || 0) + (stats.byPosition?.Resistor || 0)}
                </div>
                <div className="stat-label">Need Attention</div>
              </div>
            </div>
          </div>
        )}
      </div>

      {/* Quick Actions */}
      <div className="quick-actions">
        <h2>Quick Actions</h2>
        <div className="actions-grid">
          {quickActions.map((action, index) => (
            <div key={index} className="action-card" onClick={action.onClick}>
              <div className="action-icon">
                {action.icon}
              </div>
              <div className="action-content">
                <h3>{action.title}</h3>
                <p>{action.description}</p>
              </div>
              <div className="action-arrow">
                <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                  <path d="M5 12h14M12 5l7 7-7 7"/>
                </svg>
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Analytics Dashboard */}
      {!loading && stats.total > 0 && (
        <>
          {/* Power/Interest Quadrant */}
          <div className="analytics-section">
            <h2>Power & Interest Analysis</h2>
            <div className="quadrant-container">
              <div className="quadrant-chart-wrapper">
                <div className="y-axis-label">Power</div>
                <div className="quadrant-chart">
                  <div className="quadrant-grid">
                    <div className="quadrant high-power high-interest">
                      <div className="quadrant-label">Manage Closely</div>
                      <div className="quadrant-count">{stats.byQuadrant?.['Manage Closely'] || 0}</div>
                    </div>
                    <div className="quadrant high-power low-interest">
                      <div className="quadrant-label">Keep Satisfied</div>
                      <div className="quadrant-count">{stats.byQuadrant?.['Keep Satisfied'] || 0}</div>
                    </div>
                    <div className="quadrant low-power high-interest">
                      <div className="quadrant-label">Keep Informed</div>
                      <div className="quadrant-count">{stats.byQuadrant?.['Keep Informed'] || 0}</div>
                    </div>
                    <div className="quadrant low-power low-interest">
                      <div className="quadrant-label">Monitor</div>
                      <div className="quadrant-count">{stats.byQuadrant?.['Monitor'] || 0}</div>
                    </div>
                  </div>
                </div>
                <div className="x-axis-label">Interest</div>
              </div>
            </div>
          </div>

          {/* RAG Status & Position Analysis */}
          <div className="analytics-section">
            <h2>Engagement Health & Change Position</h2>
            <div className="charts-row">
              <div className="chart-container">
                <h3>RAG Status</h3>
                <div className="rag-chart">
                  <div className="rag-item red">
                    <div className="rag-bar" style={{ width: `${((stats.byRAGStatus?.Red || 0) / stats.total) * 100}%` }}></div>
                    <div className="rag-label">Red: {stats.byRAGStatus?.Red || 0}</div>
                  </div>
                  <div className="rag-item amber">
                    <div className="rag-bar" style={{ width: `${((stats.byRAGStatus?.Amber || 0) / stats.total) * 100}%` }}></div>
                    <div className="rag-label">Amber: {stats.byRAGStatus?.Amber || 0}</div>
                  </div>
                  <div className="rag-item green">
                    <div className="rag-bar" style={{ width: `${((stats.byRAGStatus?.Green || 0) / stats.total) * 100}%` }}></div>
                    <div className="rag-label">Green: {stats.byRAGStatus?.Green || 0}</div>
                  </div>
                </div>
              </div>
              <div className="chart-container">
                <h3>Position on Change</h3>
                <div className="position-chart">
                  {['Champion', 'Supporter', 'Neutral', 'Skeptic', 'Resistor'].map(position => {
                    const count = stats.byPosition?.[position] || 0;
                    const percentage = stats.total > 0 ? (count / stats.total) * 100 : 0;
                    return (
                      <div key={position} className={`position-item ${position.toLowerCase()}`}>
                        <div className="position-bar" style={{ width: `${percentage}%` }}></div>
                        <div className="position-label">{position}: {count}</div>
                      </div>
                    );
                  })}
                </div>
              </div>
            </div>
          </div>

          {/* Engagement Gap Analysis */}
          <div className="analytics-section">
            <h2>Engagement Gap Analysis</h2>
            <div className="gap-analysis">
              <div className="gap-summary">
                <div className="gap-stat ahead">
                  <div className="gap-number">{stats.engagementGaps?.ahead || 0}</div>
                  <div className="gap-description">Ahead of Target</div>
                </div>
                <div className="gap-stat on-track">
                  <div className="gap-number">{stats.engagementGaps?.onTrack || 0}</div>
                  <div className="gap-description">On Track</div>
                </div>
                <div className="gap-stat behind">
                  <div className="gap-number">{stats.engagementGaps?.behind || 0}</div>
                  <div className="gap-description">Behind Target</div>
                </div>
              </div>
              <div className="gap-chart">
                <div className="engagement-levels">
                  {[0, 1, 2, 3, 4, 5].map(level => {
                    const current = stats.byEngagementLevel?.[level] || 0;
                    const percentage = stats.total > 0 ? (current / stats.total) * 100 : 0;
                    return (
                      <div key={level} className="engagement-bar">
                        <div className="bar-container">
                          <div className="bar-fill" style={{ height: `${percentage}%` }}></div>
                        </div>
                        <div className="bar-label">L{level}</div>
                        <div className="bar-count">{current}</div>
                      </div>
                    );
                  })}
                </div>
                <div className="levels-title">Current Engagement Levels</div>
              </div>
            </div>
          </div>
        </>
      )}
    </div>
  );
};

export default StakeholderDashboard;