import React, { createContext, useContext, useReducer, memo } from 'react';

// Initial state for drag and drop operations
const initialState = {
  dragMode: true,
  activeUser: null,
  loading: false,
  error: null,
  userCategories: {
    allCoursesNeeded: [],
    someCoursesNeeded: {},
    unassigned: [],
    partiallyAssigned: []
  },
  assignments: [],
  capacityData: {},
  assignmentStats: {
    total: 0,
    fullyAssigned: 0,
    partiallyAssigned: 0,
    unassigned: 0,
    waitlisted: 0
  },
  contextMenu: {
    visible: false,
    x: 0,
    y: 0,
    userInfo: null,
    sessionInfo: null
  },
  selectedTrainingLocation: '',
  selectedFunctionalArea: ''
};

// Action types
export const DRAG_DROP_ACTIONS = {
  SET_DRAG_MODE: 'SET_DRAG_MODE',
  SET_ACTIVE_USER: 'SET_ACTIVE_USER',
  SET_LOADING: 'SET_LOADING',
  SET_ERROR: 'SET_ERROR',
  SET_USER_CATEGORIES: 'SET_USER_CATEGORIES',
  SET_ASSIGNMENTS: 'SET_ASSIGNMENTS',
  SET_CAPACITY_DATA: 'SET_CAPACITY_DATA',
  SET_ASSIGNMENT_STATS: 'SET_ASSIGNMENT_STATS',
  SET_CONTEXT_MENU: 'SET_CONTEXT_MENU',
  SET_TRAINING_LOCATION: 'SET_TRAINING_LOCATION',
  SET_FUNCTIONAL_AREA: 'SET_FUNCTIONAL_AREA',
  CLEAR_ERROR: 'CLEAR_ERROR'
};

// Reducer function
const dragDropReducer = (state, action) => {
  switch (action.type) {
    case DRAG_DROP_ACTIONS.SET_DRAG_MODE:
      return { ...state, dragMode: action.payload };
    
    case DRAG_DROP_ACTIONS.SET_ACTIVE_USER:
      return { ...state, activeUser: action.payload };
    
    case DRAG_DROP_ACTIONS.SET_LOADING:
      return { ...state, loading: action.payload };
    
    case DRAG_DROP_ACTIONS.SET_ERROR:
      return { ...state, error: action.payload };
    
    case DRAG_DROP_ACTIONS.SET_USER_CATEGORIES:
      return { ...state, userCategories: action.payload };
    
    case DRAG_DROP_ACTIONS.SET_ASSIGNMENTS:
      return { ...state, assignments: action.payload };
    
    case DRAG_DROP_ACTIONS.SET_CAPACITY_DATA:
      return { ...state, capacityData: action.payload };
    
    case DRAG_DROP_ACTIONS.SET_ASSIGNMENT_STATS:
      return { ...state, assignmentStats: action.payload };
    
    case DRAG_DROP_ACTIONS.SET_CONTEXT_MENU:
      return { ...state, contextMenu: action.payload };
    
    case DRAG_DROP_ACTIONS.SET_TRAINING_LOCATION:
      return { ...state, selectedTrainingLocation: action.payload };
    
    case DRAG_DROP_ACTIONS.SET_FUNCTIONAL_AREA:
      return { ...state, selectedFunctionalArea: action.payload };
    
    case DRAG_DROP_ACTIONS.CLEAR_ERROR:
      return { ...state, error: null };
    
    default:
      return state;
  }
};

// Context
const DragDropContext = createContext();

// Provider component
const DragDropProvider = memo(({ children }) => {
  const [state, dispatch] = useReducer(dragDropReducer, initialState);

  return (
    <DragDropContext.Provider value={{ state, dispatch }}>
      {children}
    </DragDropContext.Provider>
  );
});

// Custom hook for using the context
export const useDragDrop = () => {
  const context = useContext(DragDropContext);
  if (!context) {
    throw new Error('useDragDrop must be used within a DragDropProvider');
  }
  return context;
};

DragDropProvider.displayName = 'DragDropProvider';

export default DragDropProvider;