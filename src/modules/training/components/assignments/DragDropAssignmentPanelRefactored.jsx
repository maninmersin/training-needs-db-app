import React, { useState, useEffect, useCallback, useMemo } from 'react';
import { KeyboardSensor, PointerSensor, useSensor, useSensors } from '@dnd-kit/core';
import { sortableKeyboardCoordinates } from '@dnd-kit/sortable';
import { supabase } from '@core/services/supabaseClient';
import { debugLog, debugWarn, debugError } from '@core/utils/consoleUtils';

// Import the split components
import DragDropProvider, { useDragDrop, DRAG_DROP_ACTIONS } from './DragDropProvider';
import AssignmentFilters from './AssignmentFilters';
import AssignmentGrid from './AssignmentGrid';
import AssignmentActions from './AssignmentActions';
import AssignmentStats from '../AssignmentStats';
import CalendarDayControls from '../CalendarDayControls';

import './DragDropAssignmentPanel.css';

// Main Panel Content Component
const DragDropPanelContent = ({ 
  schedule, 
  currentSchedule, 
  onScheduleChange, 
  onAssignmentUpdate,
  onClose 
}) => {
  const { state, dispatch } = useDragDrop();
  
  // Local state for day visibility controls
  const [visibleDays, setVisibleDays] = useState(() => {
    const saved = localStorage.getItem('calendarVisibleDays');
    if (saved) {
      try {
        return JSON.parse(saved);
      } catch (e) {
        debugWarn('Failed to parse saved day visibility settings');
      }
    }
    return {
      0: false, 1: true, 2: true, 3: true, 4: true, 5: true, 6: false
    };
  });
  
  const [dayControlsCollapsed, setDayControlsCollapsed] = useState(true);
  const [locations, setLocations] = useState([]);
  const [functionalAreas, setFunctionalAreas] = useState([]);

  // Drag and drop sensors
  const sensors = useSensors(
    useSensor(PointerSensor, {
      activationConstraint: {
        distance: 3,
        delay: 100,
        tolerance: 5,
      },
    }),
    useSensor(KeyboardSensor, {
      coordinateGetter: sortableKeyboardCoordinates,
    })
  );

  // Load initial data
  useEffect(() => {
    const loadInitialData = async () => {
      if (!schedule?.id) return;
      
      dispatch({ type: DRAG_DROP_ACTIONS.SET_LOADING, payload: true });
      
      try {
        // Load assignments and user data
        await Promise.all([
          loadAssignments(),
          loadUserCategories(),
          loadFilterOptions()
        ]);
      } catch (error) {
        debugError('Failed to load initial data:', error);
        dispatch({ 
          type: DRAG_DROP_ACTIONS.SET_ERROR, 
          payload: error.message 
        });
      } finally {
        dispatch({ type: DRAG_DROP_ACTIONS.SET_LOADING, payload: false });
      }
    };

    loadInitialData();
  }, [schedule?.id]);

  // Memoized functions for data loading
  const loadAssignments = useCallback(async () => {
    if (!schedule?.id) return;
    
    try {
      const { data, error } = await supabase
        .from('user_assignments')
        .select(`
          *,
          end_users (
            id, name, email, project_role, division, 
            country, organisation, sub_division
          ),
          sessions (
            id, course_name, start_time, end_time, 
            session_number, group_name
          )
        `)
        .eq('schedule_id', schedule.id);

      if (error) throw error;
      
      dispatch({ 
        type: DRAG_DROP_ACTIONS.SET_ASSIGNMENTS, 
        payload: data || [] 
      });
    } catch (error) {
      debugError('Error loading assignments:', error);
      throw error;
    }
  }, [schedule?.id, dispatch]);

  const loadUserCategories = useCallback(async () => {
    // This would contain the complex logic for categorizing users
    // For now, placeholder implementation
    try {
      const { data: users, error } = await supabase
        .from('end_users')
        .select('*')
        .limit(100);

      if (error) throw error;

      const categories = {
        allCoursesNeeded: users?.filter(user => user.project_role) || [],
        someCoursesNeeded: {},
        unassigned: users?.filter(user => !user.project_role) || [],
        partiallyAssigned: []
      };

      dispatch({ 
        type: DRAG_DROP_ACTIONS.SET_USER_CATEGORIES, 
        payload: categories 
      });
    } catch (error) {
      debugError('Error loading user categories:', error);
      throw error;
    }
  }, [dispatch]);

  const loadFilterOptions = useCallback(async () => {
    try {
      // Load unique locations and functional areas
      const { data: locationData } = await supabase
        .from('end_users')
        .select('country')
        .not('country', 'is', null);

      const { data: areaData } = await supabase
        .from('courses')
        .select('functional_area')
        .not('functional_area', 'is', null);

      setLocations([...new Set(locationData?.map(d => d.country) || [])]);
      setFunctionalAreas([...new Set(areaData?.map(d => d.functional_area) || [])]);
    } catch (error) {
      debugError('Error loading filter options:', error);
    }
  }, []);

  // Drag handlers
  const handleDragStart = useCallback((event) => {
    const { active } = event;
    const userData = active.data.current?.userData;
    
    if (userData) {
      dispatch({ 
        type: DRAG_DROP_ACTIONS.SET_ACTIVE_USER, 
        payload: userData 
      });
    }
  }, [dispatch]);

  const handleDragEnd = useCallback((event) => {
    const { active, over } = event;
    
    dispatch({ 
      type: DRAG_DROP_ACTIONS.SET_ACTIVE_USER, 
      payload: null 
    });

    if (!over) return;

    // Handle the assignment logic here
    debugLog('Drag ended:', { active: active.id, over: over.id });
    
    if (onAssignmentUpdate) {
      onAssignmentUpdate({
        userId: active.id,
        sessionId: over.id,
        action: 'assign'
      });
    }
  }, [dispatch, onAssignmentUpdate]);

  // Day visibility handler
  const handleDayVisibilityChange = useCallback((newVisibleDays) => {
    setVisibleDays(newVisibleDays);
    localStorage.setItem('calendarVisibleDays', JSON.stringify(newVisibleDays));
  }, []);

  // Filter handlers
  const handleLocationChange = useCallback((location) => {
    dispatch({ 
      type: DRAG_DROP_ACTIONS.SET_TRAINING_LOCATION, 
      payload: location 
    });
  }, [dispatch]);

  const handleFunctionalAreaChange = useCallback((area) => {
    dispatch({ 
      type: DRAG_DROP_ACTIONS.SET_FUNCTIONAL_AREA, 
      payload: area 
    });
  }, [dispatch]);

  if (state.loading) {
    return (
      <div className="assignment-panel-loading">
        <div className="loading-spinner"></div>
        <p>Loading assignment data...</p>
      </div>
    );
  }

  if (state.error) {
    return (
      <div className="assignment-panel-error">
        <h3>Error Loading Data</h3>
        <p>{state.error}</p>
        <button onClick={() => dispatch({ type: DRAG_DROP_ACTIONS.CLEAR_ERROR })}>
          Retry
        </button>
      </div>
    );
  }

  return (
    <div className="drag-drop-assignment-panel">
      {/* Header Section */}
      <div className="panel-header">
        <h2>Assignment Management: {schedule?.name}</h2>
        
        <AssignmentActions 
          onClose={onClose}
          onSaveAssignments={() => {/* Implement save logic */}}
          onExportAssignments={() => {/* Implement export logic */}}
        />
      </div>

      {/* Controls Section */}
      <div className="panel-controls">
        <AssignmentFilters
          selectedTrainingLocation={state.selectedTrainingLocation}
          setSelectedTrainingLocation={handleLocationChange}
          selectedFunctionalArea={state.selectedFunctionalArea}
          setSelectedFunctionalArea={handleFunctionalAreaChange}
          locations={locations}
          functionalAreas={functionalAreas}
        />

        <CalendarDayControls
          visibleDays={visibleDays}
          onDayVisibilityChange={handleDayVisibilityChange}
          collapsed={dayControlsCollapsed}
          onToggleCollapsed={() => setDayControlsCollapsed(!dayControlsCollapsed)}
        />
      </div>

      {/* Stats Section */}
      <AssignmentStats 
        stats={state.assignmentStats}
        userCategories={state.userCategories}
      />

      {/* Main Content */}
      <AssignmentGrid
        schedule={schedule}
        currentSchedule={currentSchedule}
        visibleDays={visibleDays}
        sensors={sensors}
        onDragStart={handleDragStart}
        onDragEnd={handleDragEnd}
        onScheduleChange={onScheduleChange}
      />
    </div>
  );
};

// Main exported component with provider
const DragDropAssignmentPanelRefactored = (props) => {
  return (
    <DragDropProvider>
      <DragDropPanelContent {...props} />
    </DragDropProvider>
  );
};

export default DragDropAssignmentPanelRefactored;