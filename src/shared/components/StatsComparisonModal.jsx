import React, { useState, useEffect } from 'react';
import { supabase } from '@core/services/supabaseClient';
import './StatsComparisonModal.css';

const StatsComparisonModal = ({ 
  scheduleId,
  isOpen,
  onClose 
}) => {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [comparisonData, setComparisonData] = useState({
    assignmentsData: null,
    exportData: null,
    stats: null
  });

  useEffect(() => {
    if (isOpen) {
      fetchComparisonData();
    }
  }, [isOpen]);

  const fetchComparisonData = async () => {
    try {
      setLoading(true);
      setError(null);

      // Fetch assignments data
      const { data: assignmentsData } = await supabase
        .from('user_assignments')
        .select('*')
        .eq('schedule_id', scheduleId);

      // Fetch export data
      const { data: exportData } = await supabase
        .rpc('get_project_roles_data');

      // Calculate comparison stats
      const stats = calculateStats(assignmentsData, exportData);

      setComparisonData({
        assignmentsData,
        exportData,
        stats
      });
    } catch (err) {
      setError(err.message);
      console.error('Error fetching comparison data:', err);
    } finally {
      setLoading(false);
    }
  };

  const calculateStats = (assignments, exportData) => {
    if (!assignments || !exportData) {
      return {
        totalAssignments: 0,
        userAssignments: 0,
        exportAssignments: 0
      };
    }

    // Count all assignment records
    const userAssignments = assignments.length;
    const exportAssignments = exportData.length;

    return {
      totalAssignments: userAssignments + exportAssignments,
      userAssignments,
      exportAssignments
    };
  };

  if (!isOpen) return null;

  return (
    <div className="stats-modal-overlay">
      <div className="stats-modal-content">
        <button className="close-modal" onClick={onClose}>
          &times;
        </button>
        
        <h2>Assignment Statistics Comparison</h2>
        
        {loading ? (
          <p>Loading comparison data...</p>
        ) : error ? (
          <p className="error">Error: {error}</p>
        ) : (
          <div className="comparison-results">
            <table>
              <thead>
                <tr>
                  <th>Metric</th>
                  <th>User Assignments</th>
                  <th>Export Assignments</th>
                </tr>
              </thead>
              <tbody>
                <tr>
                  <td>Total Assignments</td>
                  <td>{comparisonData.stats?.userAssignments || '-'}</td>
                  <td>{comparisonData.stats?.exportAssignments || '-'}</td>
                </tr>
                <tr>
                  <td>Combined Total</td>
                  <td colSpan="2" style={{textAlign: 'center'}}>
                    {comparisonData.stats?.totalAssignments || '-'}
                  </td>
                </tr>
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
};

export default StatsComparisonModal;
