import React, { useState } from 'react';
import { useDraggable } from '@dnd-kit/core';
import { debugLog } from '@core/utils/consoleUtils';
import './UserPool.css';

const UserPool = ({
  userCategories,
  selectedTrainingLocation,
  selectedFunctionalArea,
  onLocationChange,
  onFunctionalAreaChange,
  availableFunctionalAreas = [],
  availableTrainingLocations = [],
  dragMode,
  successfulDrops = new Set()
}) => {
  const [expandedSections, setExpandedSections] = useState({
    allCoursesReady: true,
    allCoursesPartial: false,
    someCoursesNeeded: {},
    filters: false // Start collapsed to focus on user pool
  });

  // Multi-select state management
  const [selectedUsers, setSelectedUsers] = useState(new Set());
  const [lastSelectedIndex, setLastSelectedIndex] = useState(null);
  const [userIndexMap, setUserIndexMap] = useState(new Map());

  debugLog('👥 UserPool rendering with categories:', {
    allCourses: userCategories.allCoursesNeeded?.length || 0,
    someCourses: Object.keys(userCategories.someCoursesNeeded || {}).length,
    unassigned: userCategories.unassigned?.length || 0,
    selectedCount: selectedUsers.size,
    selectedUserIds: Array.from(selectedUsers)
  });

  // Build user index map for range selection
  React.useEffect(() => {
    const indexMap = new Map();
    let currentIndex = 0;
    const availableUserIds = new Set();
    
    // Add all visible users to index map
    filterUsers(userCategories.allCoursesNeeded || []).forEach(user => {
      indexMap.set(user.id, currentIndex++);
      availableUserIds.add(user.id);
    });
    
    Object.entries(userCategories.someCoursesNeeded || {}).forEach(([courseId, users]) => {
      filterUsers(users).forEach(user => {
        if (!indexMap.has(user.id)) {
          indexMap.set(user.id, currentIndex++);
          availableUserIds.add(user.id);
        }
      });
    });
    
    filterUsers(userCategories.unassigned || []).forEach(user => {
      if (!indexMap.has(user.id)) {
        indexMap.set(user.id, currentIndex++);
        availableUserIds.add(user.id);
      }
    });
    
    setUserIndexMap(indexMap);
    
    // Clean up selection to remove users that are no longer available
    setSelectedUsers(prev => {
      const validSelection = new Set();
      for (const userId of prev) {
        if (availableUserIds.has(userId)) {
          validSelection.add(userId);
        }
      }
      // Only update if the selection actually changed
      if (validSelection.size !== prev.size) {
        return validSelection;
      }
      return prev;
    });
  }, [userCategories, selectedTrainingLocation, selectedFunctionalArea]);

  // Selection management functions
  const handleUserClick = (user, event) => {
    if (!dragMode) return;
    
    const userId = user.id;
    const userIndex = userIndexMap.get(userId);
    
    // Prevent default and stop propagation for selection clicks
    if (event.ctrlKey || event.metaKey || event.shiftKey) {
      event.preventDefault();
      event.stopPropagation();
    }
    
    
    if (event.ctrlKey || event.metaKey) {
      // CTRL+Click: Toggle individual selection
      setSelectedUsers(prev => {
        const newSelection = new Set(prev);
        if (newSelection.has(userId)) {
          newSelection.delete(userId);
        } else {
          newSelection.add(userId);
        }
        return newSelection;
      });
      setLastSelectedIndex(userIndex);
    } else if (event.shiftKey && lastSelectedIndex !== null) {
      // SHIFT+Click: Range selection
      setSelectedUsers(prev => {
        const newSelection = new Set(prev);
        const startIndex = Math.min(lastSelectedIndex, userIndex);
        const endIndex = Math.max(lastSelectedIndex, userIndex);
        
        // Add all users in range
        for (const [id, index] of userIndexMap.entries()) {
          if (index >= startIndex && index <= endIndex) {
            newSelection.add(id);
          }
        }
        
        return newSelection;
      });
    } else {
      // Regular click: Single selection
      setSelectedUsers(new Set([userId]));
      setLastSelectedIndex(userIndex);
    }
  };

  const clearSelection = () => {
    setSelectedUsers(new Set());
    setLastSelectedIndex(null);
  };

  const selectAll = () => {
    const allUserIds = new Set();
    
    filterUsers(userCategories.allCoursesNeeded || []).forEach(user => {
      allUserIds.add(user.id);
    });
    
    Object.values(userCategories.someCoursesNeeded || {}).forEach(users => {
      filterUsers(users).forEach(user => {
        allUserIds.add(user.id);
      });
    });
    
    filterUsers(userCategories.unassigned || []).forEach(user => {
      allUserIds.add(user.id);
    });
    
    setSelectedUsers(allUserIds);
  };

  // Keyboard shortcuts
  React.useEffect(() => {
    if (!dragMode) return;
    
    const handleKeyDown = (event) => {
      // Prevent shortcuts when typing in inputs
      if (event.target.tagName === 'INPUT' || event.target.tagName === 'TEXTAREA') {
        return;
      }
      
      if (event.ctrlKey || event.metaKey) {
        switch (event.key.toLowerCase()) {
          case 'a':
            event.preventDefault();
            selectAll();
            break;
          case 'd':
            event.preventDefault();
            clearSelection();
            break;
        }
      } else if (event.key === 'Escape') {
        event.preventDefault();
        clearSelection();
      }
    };
    
    document.addEventListener('keydown', handleKeyDown);
    return () => {
      document.removeEventListener('keydown', handleKeyDown);
    };
  }, [dragMode, userCategories, selectedTrainingLocation, selectedFunctionalArea]);

  const toggleSection = (sectionKey, subKey = null) => {
    setExpandedSections(prev => {
      if (subKey) {
        return {
          ...prev,
          [sectionKey]: {
            ...prev[sectionKey],
            [subKey]: !prev[sectionKey][subKey]
          }
        };
      } else {
        return {
          ...prev,
          [sectionKey]: !prev[sectionKey]
        };
      }
    });
  };

  // Filter functions (placeholder - would need real filter logic)
  const getUniqueFunctionalAreas = () => {
    // Use the functional areas passed from parent component
    return availableFunctionalAreas.length > 0 ? availableFunctionalAreas : ['General'];
  };

  // Filter users based on selected filters
  const filterUsers = (users) => {
    if (!users) return [];
    
    return users.filter(user => {
      const locationMatch = !selectedTrainingLocation || 
                           user.training_location === selectedTrainingLocation;
      
      // Functional area filtering would need more complex logic based on role mappings
      const functionalAreaMatch = !selectedFunctionalArea || true; // Simplified for now
      
      return locationMatch && functionalAreaMatch;
    });
  };

  return (
    <div className="user-pool">
      {/* Filters Section */}
      <div className="user-pool-filters">
        <div 
          className="filter-header"
          onClick={() => toggleSection('filters')}
        >
          <h3>🎯 Filters</h3>
          <span className={`expand-icon ${expandedSections.filters ? 'expanded' : 'collapsed'}`}>
            {expandedSections.filters ? '▼' : '▶'}
          </span>
        </div>
        
        {expandedSections.filters && (
          <div className="filter-content">
        
        <div className="filter-group">
          <label>🏢 Functional Area:</label>
          <select 
            value={selectedFunctionalArea} 
            onChange={(e) => onFunctionalAreaChange(e.target.value)}
          >
            <option value="">All Areas</option>
            {getUniqueFunctionalAreas().map(area => (
              <option key={area} value={area}>{area}</option>
            ))}
          </select>
        </div>
        
        <div className="filter-group">
          <label>📍 Training Location:</label>
          <select 
            value={selectedTrainingLocation} 
            onChange={(e) => onLocationChange(e.target.value)}
          >
            <option value="">All Locations</option>
            {availableTrainingLocations.map(location => (
              <option key={location} value={location}>{location}</option>
            ))}
          </select>
        </div>
        
        {(selectedTrainingLocation || selectedFunctionalArea) && (
          <div className="active-filters">
            <strong>Active Filters:</strong>
            {selectedFunctionalArea && <span className="filter-tag">🏢 {selectedFunctionalArea}</span>}
            {selectedTrainingLocation && <span className="filter-tag">📍 {selectedTrainingLocation}</span>}
          </div>
        )}
          </div>
        )}
      </div>

      {/* Selection Controls */}
      {dragMode && (
        <div className="selection-controls">
          {selectedUsers.size > 0 ? (
            <div className="selection-info">
              <span className="selection-count">
                ✓ {selectedUsers.size} user{selectedUsers.size > 1 ? 's' : ''} selected
              </span>
              <button 
                className="clear-selection-btn"
                onClick={clearSelection}
                title="Clear selection"
              >
                ✕ Clear
              </button>
            </div>
          ) : (
            <div className="selection-help">
              <div className="help-text">
                <span>💡 CTRL+Click to select multiple, SHIFT+Click for range</span>
                <br />
                <small>⌨️ Shortcuts: CTRL+A (Select All), CTRL+D (Clear), ESC (Clear)</small>
              </div>
              <button 
                className="select-all-btn"
                onClick={selectAll}
                title="Select all visible users (CTRL+A)"
              >
                Select All
              </button>
            </div>
          )}
        </div>
      )}

      {/* All Courses Needed Section */}
      <div className="user-category-section">
        <div 
          className="category-header"
          onClick={() => toggleSection('allCoursesReady')}
        >
          <span className="expand-icon">
            {expandedSections.allCoursesReady ? '▼' : '▶'}
          </span>
          <h3>🟢 ALL COURSES NEEDED ({filterUsers(userCategories.allCoursesNeeded).length})</h3>
        </div>
        
        {expandedSections.allCoursesReady && (
          <div className="user-list">
            <div className="subsection">
              <h4>🟢 Ready to Assign ({filterUsers(userCategories.allCoursesNeeded).length})</h4>
              {filterUsers(userCategories.allCoursesNeeded).map((user, index) => {
                return (
                  <DraggableUser 
                    key={user.id} 
                    user={user} 
                    dragMode={dragMode}
                    category="all-courses"
                    isSelected={selectedUsers.has(user.id)}
                    onUserClick={handleUserClick}
                    selectedUsers={selectedUsers}
                    successfulDrops={successfulDrops}
                  />
                );
              })}
              
              {filterUsers(userCategories.allCoursesNeeded).length === 0 && (
                <div className="empty-message">
                  No users matching current filters
                </div>
              )}
            </div>
          </div>
        )}
      </div>

      {/* Some Courses Needed Section */}
      <div className="user-category-section">
        <div 
          className="category-header"
          onClick={() => toggleSection('someCoursesNeeded', 'main')}
        >
          <span className="expand-icon">
            {expandedSections.someCoursesNeeded.main ? '▼' : '▶'}
          </span>
          <h3>📚 SOME COURSES NEEDED ({Object.values(userCategories.someCoursesNeeded || {}).flat().length})</h3>
        </div>
        
        {expandedSections.someCoursesNeeded.main && (
          <div className="user-list">
            {Object.entries(userCategories.someCoursesNeeded || {}).map(([courseId, users]) => (
              <div key={courseId} className="course-subsection">
                <div 
                  className="subsection-header"
                  onClick={() => toggleSection('someCoursesNeeded', courseId)}
                >
                  <span className="expand-icon">
                    {expandedSections.someCoursesNeeded[courseId] ? '▼' : '▶'}
                  </span>
                  <h4>📖 {userCategories.courseNames?.get(courseId) || courseId} ({filterUsers(users).length})</h4>
                </div>
                
                {expandedSections.someCoursesNeeded[courseId] && (
                  <div className="course-user-list">
                    {filterUsers(users).map(user => (
                      <DraggableUser 
                        key={`${courseId}-${user.id}`} 
                        user={user} 
                        dragMode={dragMode}
                        category={`course-${courseId}`}
                        requiredCourse={null}
                        isSelected={selectedUsers.has(user.id)}
                        onUserClick={handleUserClick}
                        selectedUsers={selectedUsers}
                        successfulDrops={successfulDrops}
                      />
                    ))}
                    
                    {filterUsers(users).length === 0 && (
                      <div className="empty-message">
                        No users matching current filters
                      </div>
                    )}
                  </div>
                )}
              </div>
            ))}
            
            {Object.keys(userCategories.someCoursesNeeded || {}).length === 0 && (
              <div className="empty-message">
                No users need specific courses from this schedule
              </div>
            )}
          </div>
        )}
      </div>

      {/* Unassigned Pool Section */}
      {userCategories.unassigned && userCategories.unassigned.length > 0 && (
        <div className="user-category-section">
          <div 
            className="category-header"
            onClick={() => toggleSection('unassigned')}
          >
            <span className="expand-icon">
              {expandedSections.unassigned ? '▼' : '▶'}
            </span>
            <h3>❌ UNASSIGNED POOL ({filterUsers(userCategories.unassigned).length})</h3>
          </div>
          
          {expandedSections.unassigned && (
            <div className="user-list">
              <p className="section-description">
                Users who don't require any courses from this schedule
              </p>
              {filterUsers(userCategories.unassigned).map(user => (
                <DraggableUser 
                  key={user.id} 
                  user={user} 
                  dragMode={dragMode}
                  category="unassigned"
                  isSelected={selectedUsers.has(user.id)}
                  onUserClick={handleUserClick}
                  selectedUsers={selectedUsers}
                  successfulDrops={successfulDrops}
                />
              ))}
            </div>
          )}
        </div>
      )}

      {/* Drag Mode Indicator */}
      {dragMode && (
        <div className="drag-mode-indicator">
          🎯 <strong>Drag Mode Active</strong>
          <br />
          <small>Click and drag users to calendar events</small>
        </div>
      )}
    </div>
  );
};

// Draggable User Component
const DraggableUser = ({ 
  user, 
  dragMode, 
  category, 
  requiredCourse, 
  isSelected = false, 
  onUserClick,
  selectedUsers = new Set(),
  successfulDrops = new Set()
}) => {
  // Determine drag data based on selection
  const dragData = selectedUsers.size > 1 && isSelected ? {
    type: 'multi-user',
    userIds: Array.from(selectedUsers),
    primaryUser: user,
    category,
    requiredCourse
  } : {
    type: 'single-user',
    user,
    category,
    requiredCourse
  };


  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    isDragging,
  } = useDraggable({
    id: user.id.toString(),
    data: dragData,
    disabled: !dragMode
  });


  // Disable transform to prevent ghost trailing - use only CSS classes for drag feedback
  const style = isDragging ? {
    zIndex: 1000,
    opacity: 0.8
  } : undefined;

  const handleClick = (event) => {
    // Always call the handler for click events in drag mode
    if (dragMode && onUserClick) {
      onUserClick(user, event);
    }
  };

  // Create a mouse down handler that checks for modifier keys
  const handleMouseDown = (event) => {
    // If modifier keys are pressed, prevent drag listeners from interfering
    if (event.ctrlKey || event.metaKey || event.shiftKey) {
      // Don't call drag listeners, let the click event handle it
      return;
    }
    
    // For normal mouse down without modifiers, allow drag listeners
    if (listeners?.onMouseDown) {
      listeners.onMouseDown(event);
    }
  };

  // Create conditional listeners object
  const conditionalListeners = dragMode ? {
    ...listeners,
    onMouseDown: handleMouseDown
  } : {};

  return (
    <div
      ref={setNodeRef} 
      style={style}
      {...attributes}
      {...conditionalListeners}
      onClick={handleClick}
      className={`user-item ${dragMode ? 'draggable' : ''} ${isDragging ? 'dragging' : ''} ${isSelected ? 'selected' : ''} ${successfulDrops.has(user.id) || successfulDrops.has(user.id?.toString()) ? 'drop-success' : ''}`}
    >
      {isSelected && <div className="selection-indicator">✓</div>}
      {selectedUsers.size > 1 && isSelected && (
        <div className="multi-select-badge">{selectedUsers.size}</div>
      )}
      <div className="user-avatar">
        👤
      </div>
      <div className="user-info">
        <div className="user-name">{user.name}</div>
        <div className="user-details">
          <span className="user-role">{user.project_role}</span>
          {user.training_location && (
            <span className="user-location">📍 {user.training_location}</span>
          )}
        </div>
        {requiredCourse && (
          <div className="required-course">
            📖 Needs: {requiredCourse}
          </div>
        )}
      </div>
      
      {dragMode && (
        <div className="drag-handle">
          ⋮⋮
        </div>
      )}
    </div>
  );
};

export default UserPool;