import React, { useState, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';

/**
 * Process Impact Heatmap - Hierarchical visualization of process impacts
 * Shows L0/L1/L2 process levels with color-coded impact ratings
 */
const ProcessImpactHeatmap = ({ data, filters, loading }) => {
  const navigate = useNavigate();
  const [expandedL0, setExpandedL0] = useState(new Set());
  const [expandedL1, setExpandedL1] = useState(new Set());
  const [selectedProcess, setSelectedProcess] = useState(null);

  // Filter and organize the data
  const filteredData = useMemo(() => {
    if (!data || !data.hierarchicalData) return { L0: {}, L1: {}, L2: {} };
    
    const { hierarchicalData } = data;
    const filtered = { L0: {}, L1: {}, L2: {} };
    
    Object.entries(hierarchicalData.L0).forEach(([code, process]) => {
      // Apply filters
      if (filters.impactThreshold > 0 && process.impact < filters.impactThreshold) return;
      if (filters.department !== 'all' && process.department !== filters.department) return;
      if (filters.processLevel !== 'all' && filters.processLevel !== 'L0') return;
      
      filtered.L0[code] = process;
    });
    
    Object.entries(hierarchicalData.L1).forEach(([code, process]) => {
      if (filters.impactThreshold > 0 && process.impact < filters.impactThreshold) return;
      if (filters.department !== 'all' && process.department !== filters.department) return;
      if (filters.processLevel !== 'all' && filters.processLevel !== 'L1') return;
      
      filtered.L1[code] = process;
    });
    
    Object.entries(hierarchicalData.L2).forEach(([code, process]) => {
      if (filters.impactThreshold > 0 && process.impact < filters.impactThreshold) return;
      if (filters.department !== 'all' && process.department !== filters.department) return;
      if (filters.processLevel !== 'all' && filters.processLevel !== 'L2') return;
      
      filtered.L2[code] = process;
    });
    
    return filtered;
  }, [data, filters]);

  const getImpactColor = (rating) => {
    if (!rating || rating === 0) return 'impact-none';
    if (rating >= 4.5) return 'impact-critical';
    if (rating >= 3.5) return 'impact-high';
    if (rating >= 2.5) return 'impact-medium';
    if (rating >= 1.5) return 'impact-low';
    return 'impact-minimal';
  };

  const getImpactLabel = (rating) => {
    if (!rating || rating === 0) return 'No Impact';
    if (rating >= 4.5) return 'Critical';
    if (rating >= 3.5) return 'High';
    if (rating >= 2.5) return 'Medium';
    if (rating >= 1.5) return 'Low';
    return 'Minimal';
  };

  const handleProcessClick = (process) => {
    setSelectedProcess(process);
    // Navigate to process details if available
    if (process.id) {
      console.log('Navigate to process:', process.process_code);
      // navigate(`/impact-assessment/process/${process.id}`);
    }
  };

  const toggleL0Expansion = (code) => {
    const newExpanded = new Set(expandedL0);
    if (newExpanded.has(code)) {
      newExpanded.delete(code);
    } else {
      newExpanded.add(code);
    }
    setExpandedL0(newExpanded);
  };

  const toggleL1Expansion = (code) => {
    const newExpanded = new Set(expandedL1);
    if (newExpanded.has(code)) {
      newExpanded.delete(code);
    } else {
      newExpanded.add(code);
    }
    setExpandedL1(newExpanded);
  };

  if (loading) {
    return (
      <div className="heatmap-loading">
        <div className="loading-spinner"></div>
        <p>Loading process heatmap...</p>
      </div>
    );
  }

  if (!data || !data.hierarchicalData) {
    return (
      <div className="heatmap-empty">
        <div className="empty-icon">🗺️</div>
        <h3>No Process Data Available</h3>
        <p>No process impacts found for the selected assessment.</p>
      </div>
    );
  }

  const totalProcesses = Object.keys(filteredData.L0).length + 
                         Object.keys(filteredData.L1).length + 
                         Object.keys(filteredData.L2).length;

  return (
    <div className="process-impact-heatmap">
      {/* Heatmap Header */}
      <div className="heatmap-header">
        <div className="header-info">
          <h3>Process Impact Heatmap</h3>
          <p>Hierarchical view of process impact ratings ({totalProcesses} processes)</p>
        </div>
        
        {/* Impact Legend */}
        <div className="impact-legend">
          <span className="legend-label">Impact Scale:</span>
          <div className="legend-items">
            <div className="legend-item impact-none">
              <div className="legend-color"></div>
              <span>None (0)</span>
            </div>
            <div className="legend-item impact-minimal">
              <div className="legend-color"></div>
              <span>Low (1-2)</span>
            </div>
            <div className="legend-item impact-medium">
              <div className="legend-color"></div>
              <span>Medium (2-3)</span>
            </div>
            <div className="legend-item impact-high">
              <div className="legend-color"></div>
              <span>High (3-4)</span>
            </div>
            <div className="legend-item impact-critical">
              <div className="legend-color"></div>
              <span>Critical (4-5)</span>
            </div>
          </div>
        </div>
      </div>

      {/* Process Hierarchy */}
      <div className="process-hierarchy">
        {/* L0 Processes */}
        {Object.entries(filteredData.L0).map(([code, process]) => (
          <div key={code} className="process-l0">
            <div 
              className={`process-node l0-node ${getImpactColor(process.impact)}`}
              onClick={() => handleProcessClick(process)}
            >
              <div className="node-header">
                <button
                  className="expand-button"
                  onClick={(e) => {
                    e.stopPropagation();
                    toggleL0Expansion(code);
                  }}
                >
                  {expandedL0.has(code) ? '▼' : '▶'}
                </button>
                <div className="node-info">
                  <span className="node-code">L0: {code}</span>
                  <span className="node-name">{process.process_name}</span>
                </div>
                <div className="node-impact">
                  <span className="impact-rating">{process.impact}/5</span>
                  <span className="impact-label">{getImpactLabel(process.impact)}</span>
                </div>
              </div>
              
              {process.department && (
                <div className="node-metadata">
                  <span className="metadata-item">📁 {process.department}</span>
                  {process.functionalArea && (
                    <span className="metadata-item">🏢 {process.functionalArea}</span>
                  )}
                </div>
              )}
            </div>

            {/* L1 Children */}
            {expandedL0.has(code) && process.children && process.children.length > 0 && (
              <div className="child-processes l1-children">
                {process.children.map((l1Process) => (
                  <div key={l1Process.process_code} className="process-l1">
                    <div 
                      className={`process-node l1-node ${getImpactColor(l1Process.impact)}`}
                      onClick={() => handleProcessClick(l1Process)}
                    >
                      <div className="node-header">
                        <button
                          className="expand-button"
                          onClick={(e) => {
                            e.stopPropagation();
                            toggleL1Expansion(l1Process.process_code);
                          }}
                        >
                          {expandedL1.has(l1Process.process_code) ? '▼' : '▶'}
                        </button>
                        <div className="node-info">
                          <span className="node-code">L1: {l1Process.process_code}</span>
                          <span className="node-name">{l1Process.process_name}</span>
                        </div>
                        <div className="node-impact">
                          <span className="impact-rating">{l1Process.impact}/5</span>
                          <span className="impact-label">{getImpactLabel(l1Process.impact)}</span>
                        </div>
                      </div>
                    </div>

                    {/* L2 Children */}
                    {expandedL1.has(l1Process.process_code) && l1Process.children && l1Process.children.length > 0 && (
                      <div className="child-processes l2-children">
                        {l1Process.children.map((l2Process) => (
                          <div 
                            key={l2Process.process_code} 
                            className={`process-node l2-node ${getImpactColor(l2Process.impact)}`}
                            onClick={() => handleProcessClick(l2Process)}
                          >
                            <div className="node-header">
                              <div className="node-connector">└─</div>
                              <div className="node-info">
                                <span className="node-code">L2: {l2Process.process_code}</span>
                                <span className="node-name">{l2Process.process_name}</span>
                              </div>
                              <div className="node-impact">
                                <span className="impact-rating">{l2Process.impact}/5</span>
                                <span className="impact-label">{getImpactLabel(l2Process.impact)}</span>
                              </div>
                            </div>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                ))}
              </div>
            )}
          </div>
        ))}

        {/* Standalone L1 Processes */}
        {Object.entries(filteredData.L1)
          .filter(([code, process]) => !Object.values(filteredData.L0).some(l0 => 
            l0.children?.some(child => child.process_code === code)
          ))
          .map(([code, process]) => (
            <div key={code} className="process-l1 standalone">
              <div 
                className={`process-node l1-node ${getImpactColor(process.impact)}`}
                onClick={() => handleProcessClick(process)}
              >
                <div className="node-header">
                  <div className="node-info">
                    <span className="node-code">L1: {code}</span>
                    <span className="node-name">{process.process_name}</span>
                  </div>
                  <div className="node-impact">
                    <span className="impact-rating">{process.impact}/5</span>
                    <span className="impact-label">{getImpactLabel(process.impact)}</span>
                  </div>
                </div>
              </div>
            </div>
          ))}

        {/* Standalone L2 Processes */}
        {Object.entries(filteredData.L2)
          .filter(([code, process]) => !Object.values(filteredData.L1).some(l1 => 
            l1.children?.some(child => child.process_code === code)
          ))
          .map(([code, process]) => (
            <div key={code} className="process-l2 standalone">
              <div 
                className={`process-node l2-node ${getImpactColor(process.impact)}`}
                onClick={() => handleProcessClick(process)}
              >
                <div className="node-header">
                  <div className="node-info">
                    <span className="node-code">L2: {code}</span>
                    <span className="node-name">{process.process_name}</span>
                  </div>
                  <div className="node-impact">
                    <span className="impact-rating">{process.impact}/5</span>
                    <span className="impact-label">{getImpactLabel(process.impact)}</span>
                  </div>
                </div>
              </div>
            </div>
          ))}
      </div>

      {/* Process Detail Sidebar */}
      {selectedProcess && (
        <div className="process-detail-sidebar">
          <div className="sidebar-header">
            <h4>Process Details</h4>
            <button 
              className="close-button"
              onClick={() => setSelectedProcess(null)}
            >
              ×
            </button>
          </div>
          
          <div className="sidebar-content">
            <div className="process-summary">
              <div className="summary-field">
                <span className="field-label">Process Code:</span>
                <span className="field-value">{selectedProcess.process_code}</span>
              </div>
              <div className="summary-field">
                <span className="field-label">Process Name:</span>
                <span className="field-value">{selectedProcess.process_name}</span>
              </div>
              <div className="summary-field">
                <span className="field-label">Impact Rating:</span>
                <span className={`field-value impact-badge ${getImpactColor(selectedProcess.impact)}`}>
                  {selectedProcess.impact}/5 - {getImpactLabel(selectedProcess.impact)}
                </span>
              </div>
              {selectedProcess.department && (
                <div className="summary-field">
                  <span className="field-label">Department:</span>
                  <span className="field-value">{selectedProcess.department}</span>
                </div>
              )}
              {selectedProcess.functionalArea && (
                <div className="summary-field">
                  <span className="field-label">Functional Area:</span>
                  <span className="field-value">{selectedProcess.functionalArea}</span>
                </div>
              )}
            </div>

            <div className="process-actions">
              <button className="btn btn-primary" onClick={() => console.log('Edit process')}>
                Edit Process
              </button>
              <button className="btn btn-secondary" onClick={() => console.log('View RACI')}>
                View RACI
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Statistics Summary */}
      <div className="heatmap-statistics">
        <h4>Impact Distribution</h4>
        <div className="stats-grid">
          {data.statistics && (
            <>
              <div className="stat-item">
                <span className="stat-value">{data.statistics.total}</span>
                <span className="stat-label">Total Processes</span>
              </div>
              <div className="stat-item">
                <span className="stat-value">{data.statistics.averageImpact}</span>
                <span className="stat-label">Average Impact</span>
              </div>
              <div className="stat-item">
                <span className="stat-value">{data.statistics.highImpactPercentage}%</span>
                <span className="stat-label">High Impact</span>
              </div>
            </>
          )}
        </div>
      </div>
    </div>
  );
};

export default ProcessImpactHeatmap;