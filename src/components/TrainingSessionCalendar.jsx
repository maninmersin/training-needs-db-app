import React, { useState, useCallback } from 'react';
import './TrainingSessionCalendar.css';
import ScheduleCalendar from './ScheduleCalendar';
import TSCDefineCriteriaStage from './TSCDefineCriteriaStage';
import TSCFetchDataStage from './TSCFetchDataStage';
import TSCProcessDataStage from './TSCProcessDataStage';
import TSCReviewAdjustStage from './TSCReviewAdjustStage';
import TSCSaveExportStage from './TSCSaveExportStage';
import { toLocalDateTime } from '../utils/dateTimeUtils';
import * as XLSX from 'xlsx';

const TrainingSessionCalendar = () => {
  const [currentStage, setCurrentStage] = useState(1);
  const [sessionsForCalendar, setSessionsForCalendar] = useState({
    'Functional Area': {}
  });
  const [schedulesList, setSchedulesList] = useState([]);
  const [loadingSchedules, setLoadingSchedules] = useState(false);
  const [selectedFunctionalArea, setSelectedFunctionalArea] = useState('default');
  const [showCalendar, setShowCalendar] = useState(false);
  const [error, setError] = useState(null); // Added error state

  const [criteria, setCriteria] = useState({
    default: {
      functionalArea: 'default',
      start_time_am: '',
      end_time_am: '',
      start_time_pm: '',
      end_time_pm: ''
    }
  });


  const validateTimeInputs = useCallback((times) => {
    const { start_time_am, end_time_am, start_time_pm, end_time_pm, scheduling_preference = 'both' } = times;
    
    // Validate AM times if they are required
    if ((scheduling_preference === 'both' || scheduling_preference === 'am_only') && 
        start_time_am && end_time_am && end_time_am <= start_time_am) {
      setError('Morning end time must be after morning start time');
      return false;
    }
    
    // Validate PM times if they are required
    if ((scheduling_preference === 'both' || scheduling_preference === 'pm_only') && 
        start_time_pm && end_time_pm && end_time_pm <= start_time_pm) {
      setError('Afternoon end time must be after afternoon start time');
      return false;
    }
    
    return true;
  }, []);

  const handleNextStage = () => {
    setCurrentStage((prevStage) => prevStage + 1);
  };

  const handlePreviousStage = () => {
    setCurrentStage((prevStage) => Math.max(prevStage - 1, 1));
  };

  const handleComplete = () => {
    setCurrentStage(5); // Ensure completion moves to the final stage
    setShowCalendar(true);
  };

  const renderNavigationButtons = () => {
    return (
      <div className="navigation-buttons">
        {currentStage > 1 && (
          <button onClick={handlePreviousStage}>Previous</button>
        )}
        {currentStage < 5 ? (
          <button onClick={handleNextStage}>Next</button>
        ) : (
          <button onClick={handleComplete}>Complete</button>
        )}
      </div>
    );
  };


  const exportToCSV = () => {
    if (!sessionsForCalendar || !sessionsForCalendar['Functional Area']) {
      console.warn("No sessions to export.");
      return;
    }
    const sessionsArray = sessionsForCalendar['Functional Area'].flatMap(sessions => sessions);
    const exportData = sessionsArray.map(session => ({
      Course: session.course.course_name,
      Session: session.sessionNumber,
      Group: session.groupName,
      GroupType: session.groupType,
      Start: session.start.toLocaleString('en-GB'),
      End: session.end.toLocaleString('en-GB'),
      Duration: session.duration
    }));
    const ws = XLSX.utils.json_to_sheet(exportData);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, 'Training Sessions');
    XLSX.writeFile(wb, 'training_sessions.csv');
  };

  const exportToExcel = () => {
    if (!sessionsForCalendar || !sessionsForCalendar['Functional Area']) {
      console.warn("No sessions to export.");
      return;
    }
    const sessionsArray = sessionsForCalendar['Functional Area'].flatMap(sessions => sessions);
    const exportData = sessionsArray.map(session => ({
      Course: session.course.course_name,
      Session: session.sessionNumber,
      Group: session.groupName,
      GroupType: session.groupType,
      Start: session.start.toLocaleString('en-GB'),
      End: session.end.toLocaleString('en-GB'),
      Duration: session.duration
    }));
    const ws = XLSX.utils.json_to_sheet(exportData);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, 'Training Sessions');
    XLSX.writeFile(wb, 'training_sessions.xlsx');
  };

  const handleTimeChange = (field, value) => {
    setCriteria(prev => {
      const newCriteria = {
        ...prev,
        [selectedFunctionalArea]: {
          ...prev[selectedFunctionalArea],
          [field]: value
        }
      };
      validateTimeInputs(newCriteria[selectedFunctionalArea]);
      return newCriteria;
    });
  };

  const handleSaveSchedule = async () => {
    const scheduleName = prompt("Enter a name for this schedule:");
    if (!scheduleName) {
      alert("Schedule name is required to save.");
      return;
    }

    const sessionDataForSave = Object.values(sessionsForCalendar)
      .flatMap(groupType => Object.values(groupType))
      .flatMap(groupName => groupName)
        .map(session => {
          return {
            course_id: String(session.course.id),
            course_name: session.course.course_name,
            sessionNumber: session.sessionNumber,
            groupType: session.groupType,
            groupName: session.groupName,
            start: toLocalDateTime(session.start),
            end: toLocalDateTime(session.end),
          };
        });

    const scheduleCriteria = criteria[selectedFunctionalArea];

    try {
      setLoadingSchedules(true);
      const { data, error } = await supabase
        .rpc('save_schedule', {
          schedule_name: scheduleName,
          schedule_criteria: scheduleCriteria,
          session_data: sessionDataForSave,
        });

      if (error) {
        console.error("Error saving schedule:", error);
        setError(`Failed to save schedule: ${error.message}`);
        alert(`Failed to save schedule: ${error.message}`);
      } else {
        alert(`Schedule saved successfully with ID: ${data}`);
        console.log("Schedule saved successfully:", data);
      }
    } catch (error) {
      console.error("Unexpected error saving schedule:", error);
      setError(`Unexpected error saving schedule: ${error.message}`);
      alert(`Unexpected error saving schedule: ${error.message}`);
    } finally {
      setLoadingSchedules(false);
    }
  };

  const handleLoadSchedule = async (scheduleId) => {
    if (!scheduleId) return;
    setLoadingSchedules(true);
    try {
      const { data, error: rpcError } = await supabase.rpc('load_schedule', { schedule_id_input: scheduleId });
      if (rpcError) {
        throw rpcError;
      }

      if (data && Array.isArray(data) && data.length > 0) {
        const loadedScheduleData = data[0];
        const loadedSchedule = loadedScheduleData.schedule;
        const loadedSessions = loadedScheduleData.sessions || [];

        if (loadedScheduleData && loadedScheduleData.schedule && loadedScheduleData.schedule.criteria) {
          setCriteria({
            [loadedScheduleData.schedule.criteria.functionalArea || 'default']: loadedScheduleData.schedule.criteria,
          });
          setSelectedFunctionalArea(loadedScheduleData.schedule.criteria.functionalArea || 'default');
        } else {
          console.warn("Criteria data is missing in loaded schedule.");
          alert("Criteria data is missing in loaded schedule.");
        }

        if (loadedSessions.length > 0) {
          const sessionsByGroup = {
            Country: {},
            'Training Location': {},
            'Functional Area': {},
          };
          loadedSessions.forEach(session => {
            if (!sessionsByGroup[session.group_type][session.group_name]) {
              sessionsByGroup[session.group_type][session.group_name] = [];
            }
            sessionsByGroup[session.group_type][session.group_name].push({
              title: `${session.course_name} - Group ${session.session_number} (${session.group_name}, ${session.group_type})`,
              start: new Date(session.start),
              end: new Date(session.end),
              course: {
                id: session.course_id,
                course_name: session.course_name,
                duration_hrs: 0
              },
              sessionNumber: session.session_number,
              groupType: session.group_type,
              groupName: session.group_name,
              duration: 0
            });
          });
          setSessionsForCalendar(sessionsByGroup);
        } else {
          setSessionsForCalendar({});
        }

        alert(`Schedule "${loadedSchedule.name}" loaded successfully.`);
      } else {
        alert("Schedule loaded successfully, but no data found.");
      }
    } catch (error) {
      console.error("Error loading schedule:", error);
      setError(`Failed to load schedule: ${error.message}`);
      alert(`Failed to load schedule: ${error.message}`);
    } finally {
      setLoadingSchedules(false);
    }
  };


  return (
    <div className="training-session-calculator">
      {error && (
        <div className="error">
          Error: {error}
        </div>
      )}

      <h2>Training Scheduler</h2>

      {currentStage === 1 && (
        <TSCDefineCriteriaStage
          selectedFunctionalArea={selectedFunctionalArea}
          setSelectedFunctionalArea={setSelectedFunctionalArea}
          criteria={criteria[selectedFunctionalArea]}
          setCriteria={(newCriteria) => {
            setCriteria(prev => ({
              ...prev,
              [selectedFunctionalArea]: newCriteria
            }));
          }}
          onNextStage={handleNextStage}
        />
      )}

      {currentStage === 2 && (
        <TSCFetchDataStage
          criteria={criteria[selectedFunctionalArea]}
          selectedFunctionalArea={selectedFunctionalArea} // Prop drilling down
          setSchedulesList={setSchedulesList}
          setLoadingSchedules={setLoadingSchedules}
          onNextStage={handleNextStage}
          onPreviousStage={handlePreviousStage}
        />
      )}

      {currentStage === 3 && (
        <TSCProcessDataStage
          criteria={criteria[selectedFunctionalArea]}
          selectedFunctionalArea={selectedFunctionalArea}
          setSessionsForCalendar={setSessionsForCalendar}
          courses={schedulesList.courses}
          endUsers={schedulesList.end_users}
          onNextStage={handleNextStage}
          onPreviousStage={handlePreviousStage}
        />
      )}

      {currentStage === 4 && (
        <TSCReviewAdjustStage
          sessionsForCalendar={sessionsForCalendar}
          onSessionUpdated={setSessionsForCalendar} // Assuming this is how you want to update sessions from this stage
          onNextStage={handleNextStage}
          onPreviousStage={handlePreviousStage}
        />
      )}

      {currentStage === 5 && (
        <TSCSaveExportStage
          sessionsForCalendar={sessionsForCalendar}
          onPreviousStage={handlePreviousStage}
        />
      )}


      {showCalendar && sessionsForCalendar && Object.keys(sessionsForCalendar).length > 0 && (
  <ScheduleCalendar sessions={sessionsForCalendar} />
)}
      {renderNavigationButtons()}
    </div>
  );
};

export default TrainingSessionCalendar;
