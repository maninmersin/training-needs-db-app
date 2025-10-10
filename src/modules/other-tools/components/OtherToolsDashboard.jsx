import React from 'react';
import { Link } from 'react-router-dom';
import { 
  FaToolbox, FaProjectDiagram, FaCalendarAlt, FaFileExport,
  FaCog, FaPlus, FaChartLine, FaTable
} from 'react-icons/fa';
import './OtherToolsDashboard.css';

const OtherToolsDashboard = () => {
  const availableTools = [
    {
      title: 'Plan on a Page',
      description: 'Visual project timeline and roadmap creator with drag-and-drop functionality',
      icon: FaProjectDiagram,
      path: '/other-tools/poap/editor',
      color: '#3498db',
      status: 'active'
    },
    {
      title: 'Advanced Analytics',
      description: 'Comprehensive data analysis and visualization tools',
      icon: FaChartLine,
      path: '/other-tools/analytics',
      color: '#e74c3c',
      status: 'coming-soon'
    },
    {
      title: 'Report Builder',
      description: 'Custom report generation and automated insights',
      icon: FaTable,
      path: '/other-tools/reports',
      color: '#f39c12',
      status: 'coming-soon'
    }
  ];

  const poapFeatures = [
    {
      title: 'Timeline Visualization',
      description: 'Create beautiful project timelines with swimlanes and milestones',
      icon: FaCalendarAlt,
      color: '#27ae60'
    },
    {
      title: 'Drag & Drop Interface',
      description: 'Intuitive drag-and-drop functionality for easy project planning',
      icon: FaPlus,
      color: '#16a085'
    },
    {
      title: 'Export Capabilities',
      description: 'Export your plans as PNG, PDF, or share with stakeholders',
      icon: FaFileExport,
      color: '#8e44ad'
    }
  ];

  const handleToolClick = (tool) => {
    if (tool.status === 'coming-soon') {
      alert(`${tool.title} is coming soon! This powerful tool will provide ${tool.description.toLowerCase()}.`);
      return;
    }
    // Navigation will be handled by Link component for active tools
  };

  return (
    <div className="other-tools-dashboard">
      <div className="dashboard-header">
        <div className="header-content">
          <FaToolbox className="header-icon" />
          <div>
            <h1>Other Tools & Utilities</h1>
            <p>Additional specialized tools for project planning, visualization, and analysis</p>
          </div>
        </div>
      </div>

      <div className="dashboard-content">
        <section className="available-tools">
          <h2>Available Tools</h2>
          <div className="tools-grid">
            {availableTools.map((tool, index) => {
              const IconComponent = tool.icon;
              const isActive = tool.status === 'active';
              
              return isActive ? (
                <Link 
                  key={index} 
                  to={tool.path} 
                  className="tool-card"
                  style={{ borderLeftColor: tool.color }}
                >
                  <div className="tool-icon" style={{ backgroundColor: tool.color }}>
                    <IconComponent />
                  </div>
                  <div className="tool-content">
                    <h3>{tool.title}</h3>
                    <p>{tool.description}</p>
                    {tool.status === 'active' && (
                      <span className="status-badge active">Available Now</span>
                    )}
                  </div>
                </Link>
              ) : (
                <div
                  key={index}
                  className="tool-card coming-soon"
                  style={{ borderLeftColor: tool.color }}
                  onClick={() => handleToolClick(tool)}
                >
                  <div className="tool-icon" style={{ backgroundColor: tool.color }}>
                    <IconComponent />
                  </div>
                  <div className="tool-content">
                    <h3>{tool.title}</h3>
                    <p>{tool.description}</p>
                    <span className="status-badge coming-soon">Coming Soon</span>
                  </div>
                </div>
              );
            })}
          </div>
        </section>

        <section className="featured-tool">
          <h2>Featured: Plan on a Page (POAP)</h2>
          <div className="features-grid">
            {poapFeatures.map((feature, index) => {
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

        <section className="getting-started">
          <h2>Getting Started</h2>
          <div className="getting-started-content">
            <div className="step-card">
              <div className="step-number">1</div>
              <div className="step-content">
                <h3>Choose Your Tool</h3>
                <p>Select from available specialized tools based on your current needs</p>
              </div>
            </div>
            <div className="step-card">
              <div className="step-number">2</div>
              <div className="step-content">
                <h3>Create & Design</h3>
                <p>Use intuitive interfaces to create plans, visualizations, or reports</p>
              </div>
            </div>
            <div className="step-card">
              <div className="step-number">3</div>
              <div className="step-content">
                <h3>Share & Export</h3>
                <p>Export your work or share with stakeholders for collaboration</p>
              </div>
            </div>
          </div>
        </section>
      </div>
    </div>
  );
};

export default OtherToolsDashboard;