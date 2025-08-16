import React, { memo } from 'react'
import './Home.css'

const Home = memo(() => {
  return (
    <div className="home-container">
      <h1>Welcome to Training Needs Analysis</h1>
      
      <div className="welcome-intro">
        <p>This application helps you analyze training needs within your organization. Use the navigation menu to access different features and follow the guide below to get started.</p>
      </div>
      
      <div className="steps-container">
        <div className="steps-header">
          <h2>Getting Started Guide</h2>
        </div>
        <div className="steps-content">
          <div className="steps-grid">
            <div className="step-card">
              <div className="step-number">1</div>
              <div className="step-title">User Management</div>
              <ul className="step-features">
                <li>Add and edit end users and their training requirements</li>
                <li>Import and export user data in bulk</li>
                <li>Manage user roles and permissions</li>
              </ul>
            </div>
            
            <div className="step-card">
              <div className="step-number">2</div>
              <div className="step-title">System Configuration</div>
              <ul className="step-features">
                <li>Edit role-course mappings</li>
                <li>Define scheduling criteria</li>
                <li>Configure course settings</li>
              </ul>
            </div>
            
            <div className="step-card">
              <div className="step-number">3</div>
              <div className="step-title">Training Scheduling</div>
              <ul className="step-features">
                <li>Create training schedules with the wizard</li>
                <li>Manage and edit existing schedules</li>
                <li>Export schedules to Excel</li>
              </ul>
            </div>
            
            <div className="step-card">
              <div className="step-number">4</div>
              <div className="step-title">Reports & Analysis</div>
              <ul className="step-features">
                <li>Generate pivot reports for detailed insights</li>
                <li>Analyze training attendance data</li>
                <li>Export data for external analysis</li>
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
