import React, { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { 
  FaProjectDiagram, FaPlus, FaFolderOpen, FaDownload,
  FaCog, FaQuestionCircle, FaCalendarAlt, FaUsers
} from 'react-icons/fa';
import './POAPLandingPage.css';

const POAPLandingPage = () => {
  const navigate = useNavigate();
  const [recentPlans] = useState([
    {
      id: '1',
      title: 'Q1 Marketing Campaign',
      lastModified: '2 hours ago',
      description: 'Marketing initiatives for Q1 2025'
    },
    {
      id: '2', 
      title: 'Product Development Roadmap',
      lastModified: '1 day ago',
      description: 'Feature development timeline'
    },
    {
      id: '3',
      title: 'Training Implementation Plan',
      lastModified: '3 days ago',
      description: 'Company-wide training rollout schedule'
    }
  ]);

  const handleCreateNew = () => {
    navigate('/other-tools/poap/editor?planId=new');
  };

  const handleOpenPlan = (planId) => {
    navigate(`/other-tools/poap/editor?planId=${planId}`);
  };

  const handleBrowsePlans = () => {
    navigate('/other-tools/poap/browse');
  };

  return (
    <div className="poap-landing">
      <div className="landing-header">
        <div className="header-content">
          <FaProjectDiagram className="header-icon" />
          <div className="header-text">
            <h1>Plan on a Page</h1>
            <p>Create beautiful project timelines and roadmaps with drag-and-drop simplicity</p>
          </div>
        </div>
      </div>

      <div className="landing-content">
        <div className="quick-actions-section">
          <h2>Quick Actions</h2>
          <div className="actions-row">
            <button className="action-button primary" onClick={handleCreateNew}>
              <FaPlus />
              <span>Create New Plan</span>
            </button>
            <button className="action-button secondary" onClick={handleBrowsePlans}>
              <FaFolderOpen />
              <span>Browse Plans</span>
            </button>
            <button className="action-button secondary">
              <FaDownload />
              <span>Import Plan</span>
            </button>
          </div>
        </div>

        <div className="two-column-layout">
          <div className="recent-plans">
            <h3>Recent Plans</h3>
            <div className="plans-list">
              {recentPlans.length > 0 ? (
                recentPlans.map(plan => (
                  <div key={plan.id} className="plan-item">
                    <div className="plan-icon">
                      <FaProjectDiagram />
                    </div>
                    <div className="plan-info">
                      <h4>{plan.title}</h4>
                      <p>{plan.description}</p>
                      <small>Modified {plan.lastModified}</small>
                    </div>
                    <div className="plan-actions">
                      <button className="btn-link" onClick={() => handleOpenPlan(plan.id)}>Open</button>
                    </div>
                  </div>
                ))
              ) : (
                <div className="empty-state">
                  <FaProjectDiagram className="empty-icon" />
                  <p>No plans yet. Create your first plan to get started!</p>
                </div>
              )}
            </div>
          </div>

          <div className="getting-started">
            <h3>Getting Started</h3>
            <div className="help-cards">
              <div className="help-card">
                <FaCalendarAlt className="help-icon" />
                <div className="help-content">
                  <h4>Timeline Planning</h4>
                  <p>Create project timelines with swimlanes, cards, and milestones</p>
                </div>
              </div>
              <div className="help-card">
                <FaUsers className="help-icon" />
                <div className="help-content">
                  <h4>Team Collaboration</h4>
                  <p>Share plans with stakeholders and export in multiple formats</p>
                </div>
              </div>
              <div className="help-card">
                <FaProjectDiagram className="help-icon" />
                <div className="help-content">
                  <h4>Visual Planning</h4>
                  <p>Drag-and-drop interface makes planning intuitive and efficient</p>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default POAPLandingPage;