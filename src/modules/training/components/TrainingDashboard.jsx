import React from 'react';
import { Link } from 'react-router-dom';
import { 
  FaGraduationCap, FaCalendarAlt, FaUsers, FaChartPie, 
  FaCalculator, FaMagic, FaHandPaper 
} from 'react-icons/fa';
import './TrainingDashboard.css';

const TrainingDashboard = () => {
  const coreProcesses = [
    {
      title: 'Setup & Configuration',
      description: 'Configure courses, user roles, trainers, and system reference data',
      icon: FaUsers,
      path: '/reference-data',
      color: '#3498db'
    },
    {
      title: 'Schedule Creation',
      description: 'Use advanced algorithms to create optimized training schedules',
      icon: FaMagic,
      path: '/training-scheduler?restart=true',
      color: '#9b59b6'
    },
    {
      title: 'Schedule Management',
      description: 'Edit, modify, and manage existing training schedules',
      icon: FaCalendarAlt,
      path: '/schedule-manager?restart=true',
      color: '#e74c3c'
    },
    {
      title: 'User Assignment',
      description: 'Assign learners to training sessions and manage stakeholder calendars',
      icon: FaHandPaper,
      path: '/drag-drop-assignments',
      color: '#f39c12'
    }
  ];

  const keyFeatures = [
    {
      title: 'Multi-Location Support',
      description: 'Independent scheduling for multiple locations with varying classroom capacities',
      icon: FaChartPie,
      color: '#27ae60'
    },
    {
      title: 'Intelligent Scheduling',
      description: 'Per-location optimization maximizing classroom utilization and minimizing gaps',
      icon: FaChartPie,
      color: '#16a085'
    },
    {
      title: 'Comprehensive Reporting',
      description: 'Pivot tables, data exports, and detailed training analytics',
      icon: FaChartPie,
      color: '#8e44ad'
    }
  ];

  return (
    <div className="training-dashboard">
      <div className="dashboard-header">
        <div className="header-content">
          <FaGraduationCap className="header-icon" />
          <div>
            <h1>Training Needs Analysis</h1>
            <p>Systematically identify, analyze, and address organizational training requirements</p>
          </div>
        </div>
      </div>

      <div className="dashboard-content">
        <section className="quick-actions">
          <h2>Core TNA Process</h2>
          <div className="actions-grid">
            {coreProcesses.map((process, index) => {
              const IconComponent = process.icon;
              return (
                <Link 
                  key={index} 
                  to={process.path} 
                  className="action-card"
                  style={{ borderLeftColor: process.color }}
                >
                  <div className="action-icon" style={{ backgroundColor: process.color }}>
                    <IconComponent />
                  </div>
                  <div className="action-content">
                    <h3>{process.title}</h3>
                    <p>{process.description}</p>
                  </div>
                </Link>
              );
            })}
          </div>
        </section>

        <section className="upcoming-features">
          <h2>Key Features</h2>
          <div className="features-grid">
            {keyFeatures.map((feature, index) => {
              const IconComponent = feature.icon;
              return (
                <div 
                  key={index} 
                  className="feature-card"
                  style={{ borderLeftColor: feature.color }}
                >
                  <div className="feature-icon" style={{ backgroundColor: feature.color }}>
                    <IconComponent />
                  </div>
                  <div className="feature-content">
                    <h3>{feature.title}</h3>
                    <p>{feature.description}</p>
                  </div>
                </div>
              );
            })}
          </div>
        </section>

        <section className="stats-overview">
          <h2>TNA Benefits</h2>
          <div className="stats-grid">
            <div className="stat-card">
              <div className="stat-number">✓</div>
              <div className="stat-label">Identify Skill Gaps</div>
            </div>
            <div className="stat-card">
              <div className="stat-number">✓</div>
              <div className="stat-label">Optimize Resources</div>
            </div>
            <div className="stat-card">
              <div className="stat-number">✓</div>
              <div className="stat-label">Improve Performance</div>
            </div>
            <div className="stat-card">
              <div className="stat-number">✓</div>
              <div className="stat-label">Strategic Alignment</div>
            </div>
          </div>
        </section>
      </div>
    </div>
  );
};

export default TrainingDashboard;