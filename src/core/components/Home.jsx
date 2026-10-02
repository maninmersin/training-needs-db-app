import React, { memo } from 'react'
import { useProject } from '@core/contexts/ProjectContext'
import './Home.css'

const Home = memo(() => {
  const { currentProject } = useProject()
  
  return (
    <div className="home-container">
      <div className="home-header">
        <div className="home-title">
          <h1>Change Management Platform</h1>
        </div>
      </div>
      
      {currentProject && (
        <div className="current-project-info">
          <div className="project-badge">
            <strong>Current Project:</strong> {currentProject.title}
          </div>
        </div>
      )}

      <div className="welcome-intro">
        <p>A comprehensive Training Needs Analysis (TNA) platform designed to streamline training management, scheduling, and user assignments for your organization.</p>
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
              <div className="step-title">Training Management (TNA)</div>
              <ul className="step-features">
                <li>Configure courses, trainers, and user requirements</li>
                <li>Create optimized training schedules with TSC Wizard</li>
                <li>Manage user assignments with drag-drop interface</li>
                <li>Track attendance and generate training reports</li>
              </ul>
            </div>

            <div className="step-card">
              <div className="step-number">3</div>
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
