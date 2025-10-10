import React from 'react';

const TSCValidateInputsStage = ({ criteria, onNextStage, onPreviousStage, filteredData = [], groupingKeys = [] }) => {
  const missingFields = [];

  // Base required fields (always required)
  const baseRequiredFields = [
    'max_attendees',
    'total_weeks',
    'daily_hours',
    'days_per_week',
    'contingency',
    'start_date',
    'scheduling_days'
  ];

  // Determine time fields based on scheduling preference
  const schedulingPreference = criteria.scheduling_preference || 'both';
  const timeRequiredFields = [];
  
  if (schedulingPreference === 'both') {
    timeRequiredFields.push('start_time_am', 'end_time_am', 'start_time_pm', 'end_time_pm');
  } else if (schedulingPreference === 'am_only') {
    timeRequiredFields.push('start_time_am', 'end_time_am');
  } else if (schedulingPreference === 'pm_only') {
    timeRequiredFields.push('start_time_pm', 'end_time_pm');
  }

  const allRequiredFields = [...baseRequiredFields, ...timeRequiredFields];

  for (const field of allRequiredFields) {
    if (!criteria[field] || (Array.isArray(criteria[field]) && criteria[field].length === 0)) {
      missingFields.push(field);
    }
  }

  if (filteredData.length === 0) {
    missingFields.push('No end users selected from pivot table.');
  }

  if (groupingKeys.length === 0) {
    missingFields.push('No grouping keys selected from pivot table.');
  }

  const isValid = missingFields.length === 0;

  console.log('🔎 Validate Stage - criteria:', criteria);
  console.log('🔎 Validate Stage - filteredData count:', filteredData.length);
  console.log('🔎 Validate Stage - groupingKeys:', groupingKeys);

  return (
    <div>
      <h3>Stage 3: Validate Inputs</h3>

      {isValid ? (
        <div className="success">✅ All required input criteria and pivot selections are valid.</div>
      ) : (
        <div className="error">
          ⚠️ Missing or invalid fields:
          <ul>
            {missingFields.map((field, idx) => <li key={idx}>{field}</li>)}
          </ul>
        </div>
      )}

      <pre style={{ background: '#f0f0f0', padding: '10px', marginTop: '20px' }}>
        {JSON.stringify(criteria, null, 2)}
      </pre>

      <div style={{ marginTop: '20px', display: 'flex', justifyContent: 'flex-end', gap: '10px' }}>
        {onPreviousStage && <button onClick={onPreviousStage}>Previous</button>}
        {isValid && onNextStage && <button onClick={onNextStage}>Next</button>}
      </div>
    </div>
  );
};

export default TSCValidateInputsStage;
