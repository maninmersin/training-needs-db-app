import React, { memo, useMemo } from 'react';
import { DndContext, DragOverlay, closestCenter } from '@dnd-kit/core';
import UserPool from '../UserPool';
import EnhancedScheduleCalendar from '../EnhancedScheduleCalendar';
import UserContextMenu from '../UserContextMenu';
import { useDragDrop } from './DragDropProvider';

const AssignmentGrid = memo(({ 
  schedule,
  currentSchedule,
  visibleDays,
  sensors,
  onDragStart,
  onDragEnd,
  onScheduleChange
}) => {
  const { state } = useDragDrop();
  const { 
    activeUser, 
    userCategories, 
    assignments, 
    capacityData, 
    contextMenu,
    selectedTrainingLocation,
    selectedFunctionalArea 
  } = state;

  // Memoize filtered user data
  const filteredUserCategories = useMemo(() => {
    if (!selectedTrainingLocation && !selectedFunctionalArea) {
      return userCategories;
    }

    const filterUsers = (users) => {
      return users.filter(user => {
        const locationMatch = !selectedTrainingLocation || 
          user.training_location === selectedTrainingLocation;
        const areaMatch = !selectedFunctionalArea || 
          user.functional_area === selectedFunctionalArea;
        return locationMatch && areaMatch;
      });
    };

    return {
      ...userCategories,
      allCoursesNeeded: filterUsers(userCategories.allCoursesNeeded || []),
      unassigned: filterUsers(userCategories.unassigned || []),
      partiallyAssigned: filterUsers(userCategories.partiallyAssigned || [])
    };
  }, [userCategories, selectedTrainingLocation, selectedFunctionalArea]);

  return (
    <div className="assignment-grid">
      <DndContext 
        sensors={sensors}
        collisionDetection={closestCenter}
        onDragStart={onDragStart}
        onDragEnd={onDragEnd}
      >
        <div className="grid-layout">
          {/* User Pool Section */}
          <div className="user-pool-section">
            <UserPool 
              userCategories={filteredUserCategories}
              assignments={assignments}
              capacityData={capacityData}
            />
          </div>
          
          {/* Calendar Section */}
          <div className="calendar-section">
            <EnhancedScheduleCalendar
              schedule={schedule}
              currentSchedule={currentSchedule}
              assignments={assignments}
              capacityData={capacityData}
              visibleDays={visibleDays}
              onScheduleChange={onScheduleChange}
            />
          </div>
        </div>

        {/* Drag Overlay */}
        <DragOverlay>
          {activeUser ? (
            <div className="drag-overlay-user">
              <div className="user-card">
                <span className="user-name">{activeUser.name}</span>
                <span className="user-details">
                  {activeUser.project_role} | {activeUser.division}
                </span>
              </div>
            </div>
          ) : null}
        </DragOverlay>
      </DndContext>

      {/* Context Menu */}
      {contextMenu.visible && (
        <UserContextMenu
          visible={contextMenu.visible}
          x={contextMenu.x}
          y={contextMenu.y}
          userInfo={contextMenu.userInfo}
          sessionInfo={contextMenu.sessionInfo}
          onClose={() => {
            // This should be handled by the parent component
            // through the context or callback
          }}
        />
      )}
    </div>
  );
});

AssignmentGrid.displayName = 'AssignmentGrid';

export default AssignmentGrid;