import React, { useEffect, useState } from 'react';
import ScheduleCalendar from '../calendar/ScheduleCalendar';
import { supabase } from '@core/services/supabaseClient';

const TSCReviewAdjustStage = ({
  sessionsForCalendar,
  onSessionUpdated,
  onFinish,
  criteria
}) => {
  // Schedule name state
  const [scheduleName, setScheduleName] = useState(`Training Schedule - ${new Date().toISOString().slice(0, 10)}`);


  useEffect(() => {
    // Check if we have sessions to display
    if (!sessionsForCalendar || Object.keys(sessionsForCalendar).length === 0) {
      console.warn('⚠️ TSCReviewAdjustStage: No sessions received for display');
    }
  }, [sessionsForCalendar]);

  return (
    <div>
      <h3>Final Step: Review Schedule</h3>
      <p>If you need to make amendments - Save this Schedule and use the Schedule Manager to make manual changes or run the Wizard again.</p>

      {/* Schedule Management Action Buttons */}
      <div style={{ 
        marginBottom: '20px',
        padding: '20px', 
        backgroundColor: '#f8f9fa',
        border: '1px solid #dee2e6',
        borderRadius: '8px'
      }}>
        {/* Schedule Name Input */}
        <div style={{ marginBottom: '15px' }}>
          <label style={{ 
            display: 'block', 
            fontWeight: 'bold', 
            marginBottom: '5px',
            color: '#495057'
          }}>
            Schedule Name: <span style={{ color: 'red' }}>*</span>
          </label>
          <input
            type="text"
            value={scheduleName}
            onChange={(e) => setScheduleName(e.target.value)}
            placeholder="Enter schedule name..."
            style={{
              width: '100%',
              padding: '10px',
              border: '1px solid #ced4da',
              borderRadius: '4px',
              fontSize: '14px'
            }}
          />
        </div>
        
        <div style={{ 
          display: 'flex', 
          justifyContent: 'flex-end',
          alignItems: 'center',
          flexWrap: 'wrap',
          gap: '15px'
        }}>

          {/* Action Buttons - Save Only */}
          <div style={{ display: 'flex', gap: '12px', alignItems: 'center' }}>
            {/* Save Button */}
            <button
              onClick={() => {
                if (!scheduleName.trim()) {
                  alert('Please enter a schedule name');
                  return;
                }
                onFinish(scheduleName.trim());
              }}
              disabled={!scheduleName.trim()}
              style={{
                padding: '12px 24px',
                backgroundColor: !scheduleName.trim() ? '#6c757d' : '#28a745',
                color: 'white',
                border: 'none',
                borderRadius: '6px',
                cursor: !scheduleName.trim() ? 'not-allowed' : 'pointer',
                fontSize: '16px',
                fontWeight: 'bold'
              }}
            >
              💾 Save Schedule
            </button>

            {/* Finish & Exit Button */}
            <button
              onClick={() => {
                localStorage.removeItem('tscWizardState');
                window.location.href = '/';
              }}
              style={{
                padding: '10px 18px',
                backgroundColor: '#6c757d',
                color: 'white',
                border: 'none',
                borderRadius: '6px',
                cursor: 'pointer',
                fontSize: '15px',
                fontWeight: '500'
              }}
            >
              🏠 Finish & Exit
            </button>
          </div>
        </div>
      </div>


      {sessionsForCalendar && Object.keys(sessionsForCalendar).length > 0 ? (
        <ScheduleCalendar sessions={sessionsForCalendar} onSessionUpdated={onSessionUpdated} />
      ) : (
        <p>No sessions available to display.</p>
      )}


    </div>
  );
};

export default TSCReviewAdjustStage;
