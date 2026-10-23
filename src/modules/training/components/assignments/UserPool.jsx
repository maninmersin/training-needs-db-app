import React, { useState } from 'react';
import { useDraggable } from '@dnd-kit/core';
import { debugLog } from '@core/utils/consoleUtils';
import { Check, ChevronDown, ChevronRight, Filter, GripVertical, MapPin, UserRound, X } from 'lucide-react';
import { cn } from '@/lib/utils';
import { Badge, Button } from '@/components/ui';
import ChoiceField from '@shared/components/ChoiceField';

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

  const readyUsers = filterUsers(userCategories.allCoursesNeeded);
  const someCoursesUsers = Object.values(userCategories.someCoursesNeeded || {}).flat();
  const unassignedUsers = filterUsers(userCategories.unassigned);

  const userRowProps = { dragMode, onUserClick: handleUserClick, selectedUsers, successfulDrops };

  return (
    <div className="user-pool flex flex-col">
      {/* Filters */}
      <PoolSection
        title="Filters"
        icon={<Filter className="size-3.5" />}
        open={expandedSections.filters}
        onToggle={() => toggleSection('filters')}
      >
        <div className="flex flex-col gap-3 px-3 py-3">
          <ChoiceField
            label="Functional Area"
            value={selectedFunctionalArea}
            options={getUniqueFunctionalAreas()}
            placeholder="All Areas"
            onChange={onFunctionalAreaChange}
          />
          <ChoiceField
            label="Training Location"
            value={selectedTrainingLocation}
            options={availableTrainingLocations}
            placeholder="All Locations"
            onChange={onLocationChange}
          />
          {(selectedTrainingLocation || selectedFunctionalArea) && (
            <div className="flex flex-wrap items-center gap-1.5 text-xs">
              <strong>Active Filters:</strong>
              {selectedFunctionalArea && <Badge variant="primary">{selectedFunctionalArea}</Badge>}
              {selectedTrainingLocation && <Badge variant="success">{selectedTrainingLocation}</Badge>}
            </div>
          )}
        </div>
      </PoolSection>

      {/* Selection controls */}
      {dragMode && (
        <div className="selection-controls border-b border-border bg-secondary px-3 py-2 text-xs">
          {selectedUsers.size > 0 ? (
            <div className="flex items-center justify-between gap-2">
              <span className="font-medium text-primary">{selectedUsers.size} user{selectedUsers.size > 1 ? 's' : ''} selected</span>
              <Button size="sm" variant="ghost" onClick={clearSelection} title="Clear selection"><X /> Clear</Button>
            </div>
          ) : (
            <div className="flex items-start justify-between gap-2">
              <p className="text-muted-foreground">
                CTRL+Click to select multiple, SHIFT+Click for range.
                <br />
                <span className="text-subtle-foreground">Shortcuts: CTRL+A (Select All), CTRL+D (Clear), ESC (Clear)</span>
              </p>
              <Button size="sm" onClick={selectAll} title="Select all visible users (CTRL+A)">Select All</Button>
            </div>
          )}
        </div>
      )}

      {/* All courses needed */}
      <PoolSection
        title="ALL COURSES NEEDED"
        count={readyUsers.length}
        tone="success"
        open={expandedSections.allCoursesReady}
        onToggle={() => toggleSection('allCoursesReady')}
      >
        <h4 className="px-3 pt-2 text-xs font-semibold text-muted-foreground">Ready to Assign ({readyUsers.length})</h4>
        <div className="flex flex-col gap-1 px-2 py-2">
          {readyUsers.map((user) => (
            <DraggableUser key={user.id} user={user} category="all-courses" isSelected={selectedUsers.has(user.id)} {...userRowProps} />
          ))}
          {readyUsers.length === 0 && <p className="px-1 py-2 text-xs italic text-muted-foreground">No users matching current filters</p>}
        </div>
      </PoolSection>

      {/* Some courses needed */}
      <PoolSection
        title="SOME COURSES NEEDED"
        count={someCoursesUsers.length}
        tone="warning"
        open={Boolean(expandedSections.someCoursesNeeded.main)}
        onToggle={() => toggleSection('someCoursesNeeded', 'main')}
      >
        <div className="flex flex-col">
          {Object.entries(userCategories.someCoursesNeeded || {}).map(([courseId, users]) => {
            const shown = filterUsers(users);
            const open = Boolean(expandedSections.someCoursesNeeded[courseId]);
            return (
              <div key={courseId} className="border-b border-border last:border-b-0">
                <button
                  type="button"
                  aria-expanded={open}
                  onClick={() => toggleSection('someCoursesNeeded', courseId)}
                  className="flex w-full items-center gap-1.5 px-3 py-1.5 text-left text-xs font-medium hover:bg-accent"
                >
                  {open ? <ChevronDown className="size-3.5" /> : <ChevronRight className="size-3.5" />}
                  <span className="truncate">{userCategories.courseNames?.get(courseId) || courseId}</span>
                  <span className="ml-auto text-muted-foreground">({shown.length})</span>
                </button>
                {open && (
                  <div className="flex flex-col gap-1 px-2 pb-2">
                    {shown.map((user) => (
                      <DraggableUser key={`${courseId}-${user.id}`} user={user} category={`course-${courseId}`} requiredCourse={null} isSelected={selectedUsers.has(user.id)} {...userRowProps} />
                    ))}
                    {shown.length === 0 && <p className="px-1 py-2 text-xs italic text-muted-foreground">No users matching current filters</p>}
                  </div>
                )}
              </div>
            );
          })}
          {Object.keys(userCategories.someCoursesNeeded || {}).length === 0 && (
            <p className="px-3 py-3 text-xs italic text-muted-foreground">No users need specific courses from this schedule</p>
          )}
        </div>
      </PoolSection>

      {/* Unassigned pool */}
      {userCategories.unassigned && userCategories.unassigned.length > 0 && (
        <PoolSection
          title="UNASSIGNED POOL"
          count={unassignedUsers.length}
          open={Boolean(expandedSections.unassigned)}
          onToggle={() => toggleSection('unassigned')}
        >
          <p className="px-3 pt-2 text-xs text-muted-foreground">Users who don't require any courses from this schedule</p>
          <div className="flex flex-col gap-1 px-2 py-2">
            {unassignedUsers.map((user) => (
              <DraggableUser key={user.id} user={user} category="unassigned" isSelected={selectedUsers.has(user.id)} {...userRowProps} />
            ))}
          </div>
        </PoolSection>
      )}

      {dragMode && (
        <div className="drag-mode-indicator m-3 rounded-md bg-primary-soft px-3 py-2 text-xs text-primary-soft-foreground">
          <strong>Drag Mode Active</strong>
          <br />
          Click and drag users to calendar events
        </div>
      )}
    </div>
  );
};

const TONE = { success: 'bg-success', warning: 'bg-warning', none: 'bg-border-strong' };

// A collapsible group in the pool
function PoolSection({ title, count, tone = 'none', icon, open, onToggle, children }) {
  return (
    <section className="user-category-section border-b border-border">
      <button
        type="button"
        aria-expanded={open}
        onClick={onToggle}
        className="flex w-full items-center gap-2 bg-secondary px-3 py-2 text-left text-xs font-semibold hover:bg-accent"
      >
        {open ? <ChevronDown className="size-3.5" /> : <ChevronRight className="size-3.5" />}
        {icon || <span className={`size-2 rounded-full ${TONE[tone]}`} aria-hidden="true" />}
        <span>{title}{count !== undefined ? ` (${count})` : ''}</span>
      </button>
      {open && children}
    </section>
  );
}

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
    isDragging,
  } = useDraggable({
    id: user.id.toString(),
    data: dragData,
    disabled: !dragMode
  });

  const handleClick = (event) => {
    if (dragMode && onUserClick) onUserClick(user, event);
  };

  // With a modifier key held the click selects, so the drag listener must not take the mouse-down
  const handleMouseDown = (event) => {
    if (event.ctrlKey || event.metaKey || event.shiftKey) return;
    if (listeners?.onMouseDown) listeners.onMouseDown(event);
  };

  const conditionalListeners = dragMode ? { ...listeners, onMouseDown: handleMouseDown } : {};
  const dropped = successfulDrops.has(user.id) || successfulDrops.has(user.id?.toString());

  return (
    <div
      ref={setNodeRef}
      {...attributes}
      {...conditionalListeners}
      onClick={handleClick}
      className={cn(
        'user-item relative flex items-center gap-2 rounded-md border border-border bg-card px-2 py-1.5 text-sm',
        dragMode && 'draggable cursor-grab select-none hover:bg-accent active:cursor-grabbing',
        isDragging && 'dragging z-[1000] opacity-80',
        isSelected && 'selected border-primary bg-selected',
        dropped && 'drop-success border-success bg-success-soft'
      )}
    >
      <UserRound className="size-4 shrink-0 text-muted-foreground" aria-hidden="true" />
      <div className="user-info flex min-w-0 flex-1 flex-col leading-tight">
        <span className="user-name truncate font-medium">{user.name}</span>
        <span className="user-details flex flex-wrap items-center gap-x-2 text-xs text-muted-foreground">
          <span className="user-role">{user.project_role}</span>
          {user.training_location && <span className="user-location inline-flex items-center gap-0.5"><MapPin className="size-3" /> {user.training_location}</span>}
        </span>
        {requiredCourse && <span className="required-course text-xs text-muted-foreground">Needs: {requiredCourse}</span>}
      </div>
      {isSelected && <Check className="selection-indicator size-4 shrink-0 text-primary" aria-label="Selected" />}
      {selectedUsers.size > 1 && isSelected && <Badge variant="primary" className="multi-select-badge">{selectedUsers.size}</Badge>}
      {dragMode && <GripVertical className="drag-handle size-4 shrink-0 text-subtle-foreground" aria-hidden="true" />}
    </div>
  );
};

export default UserPool;
