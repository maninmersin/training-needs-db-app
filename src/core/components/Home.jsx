import React, { memo } from 'react'
import { useNavigate } from 'react-router-dom'
import { useProject } from '@core/contexts/ProjectContext'
import ProjectSwitcher from '@modules/projects/components/ProjectSwitcher'
import './Home.css'

const Home = memo(() => {
  const navigate = useNavigate()
  const { currentProject, projects, isLoading } = useProject()
  
  return (
    <div className="home-container">
      <div className="home-header">
        <div className="home-title">
          <h1>Change Management Platform</h1>
        </div>
      </div>
      
      <div className="project-selection-section">
        <div className="project-selection-header">
          <h2>Project Selection</h2>
          <p>Please select the project you want to work on to access all platform features</p>
        </div>
        
        <div className="project-selection-content">
          <div className="project-switcher-wrapper">
            <label className="project-switcher-label">Current Project:</label>
            <ProjectSwitcher />
          </div>
          
          {!currentProject && !isLoading && (
            <div className="no-project-message">
              <div className="alert-icon">⚠️</div>
              <div className="alert-content">
                <strong>No project selected</strong>
                <p>You need to select or create a project to access the platform features.</p>
                <button 
                  className="btn btn-primary create-project-btn"
                  onClick={() => navigate('/projects')}
                >
                  Create or Manage Projects
                </button>
              </div>
            </div>
          )}
          
          {currentProject && (
            <div className="current-project-success">
              <div className="success-icon">✅</div>
              <div className="success-content">
                <strong>Project selected successfully</strong>
                <p>You're now working on: <strong>{currentProject.title}</strong></p>
              </div>
            </div>
          )}
        </div>
      </div>

      <div className="welcome-intro">
        <p>A comprehensive platform designed to support organizational change management through integrated training, stakeholder engagement, and impact assessment capabilities.</p>
      </div>
      
      <div className="steps-container">
        <div className="steps-header">
          <h2>Platform Modules</h2>
        </div>
        <div className="steps-content">
          <div className="steps-grid">
            <div className="step-card">
              <div className="step-number">1</div>
              <div className="step-title">Project Management</div>
              <ul className="step-features">
                <li>Create and manage multiple projects</li>
                <li>Organize training, assessment, and engagement by project</li>
                <li>Switch between projects seamlessly</li>
                <li>Complete data isolation between projects</li>
              </ul>
            </div>
            
            <div className="step-card">
              <div className="step-number">2</div>
              <div className="step-title">Training Management</div>
              <ul className="step-features">
                <li>Configure courses, trainers, and user requirements</li>
                <li>Create optimized training schedules with Schedule Creator</li>
                <li>Manage user assignments and stakeholder calendars</li>
                <li>Generate comprehensive training reports</li>
              </ul>
            </div>
            
            <div className="step-card">
              <div className="step-number">3</div>
              <div className="step-title">Stakeholder Engagement</div>
              <ul className="step-features">
                <li>Map and analyze stakeholder relationships</li>
                <li>Plan communication strategies and touchpoints</li>
                <li>Track engagement effectiveness and feedback</li>
                <li>Monitor stakeholder sentiment and adoption</li>
              </ul>
            </div>
            
            <div className="step-card">
              <div className="step-number">4</div>
              <div className="step-title">Impact Assessment</div>
              <ul className="step-features">
                <li>Evaluate business impact and risk factors</li>
                <li>Measure change readiness and adoption rates</li>
                <li>Analyze ROI and success metrics</li>
                <li>Generate impact reports and recommendations</li>
              </ul>
            </div>
            
            <div className="step-card">
              <div className="step-number">5</div>
              <div className="step-title">Administration</div>
              <ul className="step-features">
                <li>Manage user access and permissions</li>
                <li>Configure system settings and roles</li>
                <li>Monitor platform usage and performance</li>
                <li>Maintain data security and compliance</li>
              </ul>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
});

Home.displayName = 'Home';

export default Home;
