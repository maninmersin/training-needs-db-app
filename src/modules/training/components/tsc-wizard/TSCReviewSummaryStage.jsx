import React from 'react';

const TSCReviewSummaryStage = ({ criteria, sessionsForCalendar, onPreviousStage, onFinish }) => {
  return (
    <div>
      <h3>Stage 7: Review Summary</h3>
      <p>Final overview before exiting or exporting.</p>

      <h4>Criteria</h4>
      <pre style={{ maxHeight: 300, overflowY: 'auto' }}>
        {JSON.stringify(criteria, null, 2)}
      </pre>

      <h4>Sessions</h4>
      <pre style={{ maxHeight: 300, overflowY: 'auto' }}>
        {JSON.stringify(sessionsForCalendar, null, 2)}
      </pre>

      <div style={{ marginTop: '20px' }}>
        <button onClick={onPreviousStage}>Previous Stage</button>
        <button onClick={onFinish} style={{ marginLeft: '10px' }}>Finish</button>
      </div>
    </div>
  );
};

export default TSCReviewSummaryStage;
