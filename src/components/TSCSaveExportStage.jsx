import React from 'react';
import * as XLSX from 'xlsx';

const TSCSaveExportStage = ({ sessionsForCalendar, onPreviousStage, onNextStage }) => {
  const exportToExcel = () => {
    const flattened = Object.values(sessionsForCalendar)
      .flatMap(groupType => Object.values(groupType))
      .flatMap(groupName => groupName);

    const data = flattened.map(session => ({
      Course: session.course.course_name,
      Session: session.sessionNumber,
      Group: session.groupName,
      GroupType: session.groupType,
      Start: session.start.toLocaleString('en-GB'),
      End: session.end.toLocaleString('en-GB'),
      Duration: session.duration
    }));

    const ws = XLSX.utils.json_to_sheet(data);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, 'Training Sessions');
    XLSX.writeFile(wb, 'training_sessions.xlsx');
  };

  return (
    <div>
      <h3>Stage 6: Save & Export</h3>
      <p>You can now export your finalized schedule.</p>

      <div style={{ margin: '20px 0' }}>
        <button onClick={exportToExcel}>📤 Export to Excel</button>
      </div>

      <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '10px' }}>
        {onPreviousStage && <button onClick={onPreviousStage}>Previous</button>}
        {onNextStage && <button onClick={onNextStage}>Next</button>}
      </div>
    </div>
  );
};

export default TSCSaveExportStage;
