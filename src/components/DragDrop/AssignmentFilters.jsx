import React, { memo } from 'react';

const AssignmentFilters = memo(({ 
  selectedTrainingLocation, 
  setSelectedTrainingLocation,
  selectedFunctionalArea,
  setSelectedFunctionalArea,
  locations = [],
  functionalAreas = []
}) => {
  return (
    <div className="assignment-filters">
      <div className="filter-group">
        <label htmlFor="training-location">Training Location:</label>
        <select
          id="training-location"
          value={selectedTrainingLocation}
          onChange={(e) => setSelectedTrainingLocation(e.target.value)}
          className="filter-select"
        >
          <option value="">All Locations</option>
          {locations.map(location => (
            <option key={location} value={location}>
              {location}
            </option>
          ))}
        </select>
      </div>
      
      <div className="filter-group">
        <label htmlFor="functional-area">Functional Area:</label>
        <select
          id="functional-area"
          value={selectedFunctionalArea}
          onChange={(e) => setSelectedFunctionalArea(e.target.value)}
          className="filter-select"
        >
          <option value="">All Areas</option>
          {functionalAreas.map(area => (
            <option key={area} value={area}>
              {area}
            </option>
          ))}
        </select>
      </div>
    </div>
  );
});

AssignmentFilters.displayName = 'AssignmentFilters';

export default AssignmentFilters;