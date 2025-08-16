import React, { useState, useEffect } from 'react';
import { supabase } from '../supabaseClient';
import './TrainingSessionCalculator.css';
import * as XLSX from 'xlsx';

const TrainingSessionCalculator = () => {
  const [criteria, setCriteria] = useState({
    max_attendees: 10,
    total_weeks: 4,
    daily_hours: 8,
    days_per_week: 5,
    contingency: 1.2
  });
  const [calculations, setCalculations] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [retryCount, setRetryCount] = useState(0);

  useEffect(() => {
    console.log('useEffect triggered, criteria:', criteria);
    const fetchData = async () => {
      try {
        setLoading(true);
        setError(null);

        const { data, error: rpcError } = await supabase.rpc('get_project_roles_data');
        if (rpcError) throw rpcError;

        if (data.length && criteria.max_attendees > 0) {
          const grouped = groupUsers(data);
          const results = calculateSessions(grouped);
          setCalculations(results);
        }
      } catch (error) {
        setError(error.message);
      } finally {
        setLoading(false);
      }
    };

    fetchData();
  }, [criteria]);

  const handleRetry = () => {
    setRetryCount(prev => prev + 1);
  };

  const groupUsers = (users) => {
    return users.reduce((groups, user) => {
      const key = `${user.country}|${user.training_location}|${user.functional_area}`;
      groups[key] = groups[key] || new Map();

      if (!groups[key].has(user.end_user_id)) {
        groups[key].set(user.end_user_id, {
          id: user.end_user_id,
          name: user.name,
          courses: new Map()
        });
      }

      const userData = groups[key].get(user.end_user_id);
      userData.courses.set(user.course_id, user.duration_hrs);

      return groups;
    }, {});
  };

  const calculateSessions = (groupedUsers) => {
    // Recalculating training sessions
    const classroomHoursPerWeek = criteria.days_per_week * criteria.daily_hours;
    const classroomHoursAvailable = classroomHoursPerWeek * criteria.total_weeks; // Total hours a single classroom is available
    const classroomUserHoursCapacity = classroomHoursAvailable * criteria.max_attendees; // User-hours capacity per classroom

    return Object.entries(groupedUsers).map(([key, userMap]) => {
      const [country, training_location, functional_area] = key.split('|');
      const uniqueUserCount = userMap.size;

      let totalTrainingHours = 0;
      for (const user of userMap.values()) {
        for (const duration of user.courses.values()) {
          totalTrainingHours += duration;
        }
      }
      totalTrainingHours = totalTrainingHours * criteria.contingency;

      const numberOfClassrooms = totalTrainingHours / classroomUserHoursCapacity;

      const result = {
        country,
        training_location,
        functional_area,
        uniqueUserCount,
        totalTrainingHours: totalTrainingHours,
        totalClassroomHoursAvailable: classroomHoursAvailable, // Classroom hours available (per classroom)
        userHoursPerClassroom: classroomUserHoursCapacity, // User-hours capacity per classroom
        numberOfClassrooms: numberOfClassrooms,
      };
      return result;
    });
  };

  const exportToCSV = () => {
    const headers = [
      'Country', 'Training Location', 'Functional Area', 'Users',
      'Total Training Hours', 'Total Classroom Hours Available', 'Classrooms Needed'
    ].join(',');

    const rows = calculations.map(calc =>
      [
        `"${calc.country}"`,
        `"${calc.training_location}"`,
        `"${calc.functional_area}"`,
        calc.uniqueUserCount,
        calc.totalTrainingHours,
        calc.totalClassroomHoursAvailable,
        calc.numberOfClassrooms ? calc.numberOfClassrooms.toFixed(2) : 0
      ].join(',')
    ).join('\n');

    const csvContent = `${headers}\n${rows}`;
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.setAttribute('href', url);
    link.setAttribute('download', 'training_sessions.csv');
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  const exportToExcel = () => {
    const worksheet = XLSX.utils.json_to_sheet(calculations.map(calc => ({
      Country: calc.country,
      'Training Location': calc.training_location,
      'Functional Area': calc.functional_area,
      Users: calc.uniqueUserCount,
      'Total Training Hours': calc.totalTrainingHours,
      'Total Classroom Hours Available': calc.totalClassroomHoursAvailable,
      'Classrooms Needed': calc.numberOfClassrooms ? calc.numberOfClassrooms.toFixed(2) : 0
    })));

    const workbook = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(workbook, worksheet, 'Training Sessions');
    XLSX.writeFile(workbook, 'training_sessions.xlsx');
  };

  return (
    <div className="training-session-calculator">
      {loading && (
        <div className="loading">
          <div className="skeleton-loader">
            <div className="skeleton-row"></div>
            <div className="skeleton-row"></div>
            <div className="skeleton-row"></div>
          </div>
        </div>
      )}

      {error && (
        <div className="error">
          Error: {error}
          <button onClick={handleRetry} className="retry-button">
            Retry
          </button>
        </div>
      )}

      <h2>Training Classroom Calculator</h2>

      <div className="controls">
        <div className="input-group">
          <label>
            Max Attendees per Session:
            <input
              type="number"
              value={criteria.max_attendees}
              onChange={(e) => {
                const value = Number(e.target.value);
                if (value > 0) {
                  setCriteria(prev => ({ ...prev, max_attendees: value }));
                }
              }}
              min="1"
            />
          </label>
        </div>

        <div className="input-group">
          <label>
            Total Weeks:
            <input
              type="number"
              value={criteria.total_weeks}
              onChange={(e) => {
                const value = Number(e.target.value);
                if (value > 0) {
                  setCriteria(prev => ({ ...prev, total_weeks: value }));
                }
              }}
              min="1"
            />
          </label>
        </div>

        <div className="input-group">
          <label>
            Daily Hours:
            <input
              type="number"
              value={criteria.daily_hours}
              onChange={(e) => {
                const value = Number(e.target.value);
                if (value > 0) {
                  setCriteria(prev => ({ ...prev, daily_hours: value }));
                }
              }}
              min="1"
            />
          </label>
        </div>

        <div className="input-group">
          <label>
            Days per Week:
            <input
              type="number"
              value={criteria.days_per_week}
              onChange={(e) => {
                const value = parseInt(e.target.value, 10);
                if (!isNaN(value) && value > 0) {
                  setCriteria(prev => ({ ...prev, days_per_week: value }));
                }
              }}
              min="1"
              max="7"
            />
          </label>
        </div>

        <div className="input-group">
          <label>
            Contingency Factor:
            <input
              type="number"
              step="0.1"
              value={criteria.contingency}
              onChange={(e) => {
                const value = Number(e.target.value);
                if (value >= 1) {
                  setCriteria(prev => ({ ...prev, contingency: value }));
                }
              }}
              min="1"
            />
          </label>
        </div>
      </div>

      <table>
        <thead>
          <tr>
            <th>Country</th>
            <th>Training Location</th>
            <th>Functional Area</th>
            <th>Users</th>
            <th>Total Training Hours</th>
            <th>Classroom Hours Available (per classroom)</th>
            <th>User-Hours Capacity per Classroom</th>
            <th>Classrooms Needed</th>
          </tr>
        </thead>
        <tbody>
          {calculations.map((calc, i) => (
            <tr key={i}>
              <td>{calc.country}</td>
              <td>{calc.training_location}</td>
              <td>{calc.functional_area}</td>
              <td>{calc.uniqueUserCount}</td>
              <td>{calc.totalTrainingHours}</td>
              <td>{calc.totalClassroomHoursAvailable}</td>
              <td>{calc.userHoursPerClassroom}</td>
              <td>{calc.numberOfClassrooms && calc.numberOfClassrooms.toFixed(2)}</td>
            </tr>
          ))}
        </tbody>
      </table>

      <div className="export-controls">
        <button
          onClick={() => exportToCSV()}
          className="export-button"
        >
          Export to CSV
        </button>
        <button
          onClick={() => exportToExcel()}
          className="export-button"
        >
          Export to Excel
        </button>
      </div>

      <div className="calculation-details">
        <h2>Calculation Details and Usage Instructions</h2>

        <h3>Form Usage Instructions:</h3>
        <p>
          This form allows you to calculate the number of classrooms needed for training sessions based on several criteria.
        </p>
        <ul>
          <li>
            <strong>Max Attendees per Session:</strong>  Enter the maximum number of users that can attend a single training session in a classroom.
          </li>
          <li>
            <strong>Total Weeks:</strong> Specify the total number of weeks available for training sessions.
          </li>
          <li>
            <strong>Daily Hours:</strong>  Indicate the number of hours per day a classroom is available for training.
          </li>
          <li>
            <strong>Days per Week:</strong> Set the number of days per week a classroom is available for training.
          </li>
          <li>
            <strong>Contingency Factor:</strong>  Use this multiplier to add a buffer for unforeseen circumstances. A value of 1.2 adds a 20% contingency.Adding the contingency to the Total Training Hours per Functional Area (User-Hours) accounts for variations in both the number of users and potential longer course durations or additional training requirements.
          </li>
        </ul>

        <h3>Table Columns:</h3>
        <ul>
          <li><strong>Country, Training Location, Functional Area:</strong> Identifies the grouping for calculations.</li>
          <li><strong>Users:</strong> Number of unique users in the group.</li>
          <li><strong>Total Training Hours:</strong> Sum of training hours for all users in the group, × the Contingency Factor.</li>
          <li><strong>Classroom Hours Available (per classroom):</strong> Calculated as Total Weeks × Days per Week × Daily Hours. Represents the total hours a single classroom is available during the training period.
          </li>
          <li>
            <strong>User-Hours Capacity per Classroom:</strong> Calculated as Classroom Hours Available (per classroom) × Max Attendees per Session. Represents the total user-training hours a single classroom can provide.
          </li>
          <li>
            <strong>Number of Classrooms Needed:</strong> Calculated as Total Training Hours / User-Hours Capacity per Classroom. Indicates the number of classrooms needed for each functional area, considering the classroom capacity.
          </li>
        </ul>

        <h3>Export Buttons:</h3>
        <ul>
          <li><strong>Export to CSV:</strong> Downloads the calculation results as a CSV file.</li>
          <li><strong>Export to Excel:</strong> Downloads the calculation results as an Excel file.</li>
        </ul>
      </div>
    </div>
  );
};

export default TrainingSessionCalculator;
