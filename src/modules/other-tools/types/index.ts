// Base types
export interface Position {
  x: number;
  y: number;
}

export interface Size {
  width: number;
  height: number;
}

// Timeline configuration
export type TimelineScale = 'days' | 'weeks' | 'months' | 'quarters';

export interface TimelineConfig {
  startDate: Date;
  endDate: Date;
  scale: TimelineScale;
  showGrid?: boolean;
  snapToGrid?: boolean;
}

// Plan types
export interface Plan {
  id: string;
  name: string;
  title: string;
  createdAt: Date;
  updatedAt: Date;
  ownerId: string;
  sharedWith: string[];
  timeline: TimelineConfig;
  swimlanes: Swimlane[];
  cards: Card[];
  milestones: Milestone[];
  texts: TextElement[];
  shapes: ShapeElement[];
}

// Swimlane types
export interface Swimlane {
  id: string;
  planId: string;
  parentId: string | null;
  title: string;
  subtitle?: string;
  description?: string;
  order: number;
  isMainCategory?: boolean;
  hasChildren?: boolean;
  backgroundColor: string;
  textColor: string;
  fontSize?: number;
  fontWeight?: 'normal' | 'medium' | 'bold';
  fontFamily?: string;
  milestone?: {
    title: string;
    description?: string;
    date: Date;
    color: string;
  };
}

// Card types
export type CardStatus = 'not-started' | 'in-progress' | 'completed' | 'on-hold' | 'cancelled';

export interface Card {
  id: string;
  planId: string;
  swimlaneId: string;
  title: string;
  description?: string;
  startDate: Date;
  endDate: Date;
  row?: number;
  order: number;
  color: string;
  backgroundColor?: string;
  textColor?: string;
  fontSize?: number;
  fontWeight?: string;
  fontFamily?: string;
  status: CardStatus;
  milestone?: {
    title: string;
    description?: string;
    date: Date;
    color: string;
  };
  createdAt: Date;
  updatedAt: Date;
}

// Milestone types (legacy - now embedded in swimlanes and cards)
export interface Milestone {
  id: string;
  planId: string;
  title: string;
  description?: string;
  date: Date;
  color: string;
  swimlaneId?: string;
  order: number;
}

// Text element types
export interface TextElement {
  id: string;
  planId: string;
  content: string;
  position: Position;
  size: Size;
  style: {
    fontSize: number;
    fontFamily: string;
    fontWeight: string;
    fontStyle: string;
    color: string;
    backgroundColor: string;
    textAlign: 'left' | 'center' | 'right';
  };
  isSelected: boolean;
  isEditing: boolean;
  order: number;
  createdAt: Date;
  updatedAt: Date;
}

// Shape element types
export type ShapeType = 'rectangle' | 'circle' | 'line' | 'arrow' | 'triangle' | 'diamond';

export interface ShapeElement {
  id: string;
  planId: string;
  shapeType: ShapeType;
  position: Position;
  size: Size;
  rotation: number;
  zIndex: number;
  style: {
    fillColor: string;
    strokeColor: string;
    strokeWidth: number;
    opacity: number;
  };
  text?: string;
  isSelected: boolean;
  order: number;
  createdAt: Date;
  updatedAt: Date;
}

// UI state types
export type ElementType = 'card' | 'swimlane' | 'milestone' | 'text' | 'shape';
export type ViewMode = 'timeline' | 'whiteboard';

// Store state interface
export interface PlanState {
  // Data state
  currentPlan: Plan | null;
  plans: Plan[];
  isLoading: boolean;
  error: string | null;
  
  // UI state
  selectedElement: { type: ElementType; id: string } | null;
  isEditing: boolean;
  viewMode: ViewMode;
  zoomLevel: number;
  panPosition: Position;
  showGrid: boolean;
  snapToGrid: boolean;
  gridSize: number;
  
  // Unsaved changes state
  hasUnsavedChanges: boolean;
  lastSavedHash: string | null;
  
  // Plan actions
  createPlan: (title: string, timelineConfig?: Partial<TimelineConfig>) => Promise<void>;
  loadPlan: (id: string) => Promise<void>;
  savePlan: () => Promise<void>;
  saveAsNewPlan: (newName: string, newTitle: string) => Promise<void>;
  loadPlans: () => Promise<void>;
  deletePlan: (id: string) => Promise<void>;
  
  // Helper functions
  checkPlanNameExists: (name: string) => Promise<boolean>;
  generateUniquePlanName: (baseName: string) => Promise<string>;
  deduplicatePlans: (plans: Plan[]) => Plan[];
  
  // Swimlane actions
  addSwimlane: (swimlane: Omit<Swimlane, 'id' | 'planId'>) => void;
  updateSwimlane: (id: string, updates: Partial<Swimlane>) => void;
  deleteSwimlane: (id: string) => void;
  
  // Card actions
  addCard: (card: Omit<Card, 'id' | 'createdAt' | 'updatedAt'>) => void;
  updateCard: (id: string, updates: Partial<Card>) => void;
  deleteCard: (id: string) => void;
  moveCard: (id: string, swimlaneId: string, startDate: Date, endDate: Date) => void;
  resizeCard: (id: string, startDate: Date, endDate: Date) => void;
  
  // Milestone actions (legacy - kept for compatibility)
  addMilestone: (milestone: Omit<Milestone, 'id'>) => void;
  updateMilestone: (id: string, updates: Partial<Milestone>) => void;
  deleteMilestone: (id: string) => void;
  
  // Text element actions
  addTextElement: (position: Position, initialProperties?: Partial<TextElement>) => string | null;
  updateTextElement: (id: string, updates: Partial<TextElement>) => void;
  deleteTextElement: (id: string) => void;
  selectTextElement: (id: string | null) => void;
  setTextElementEditing: (id: string, isEditing: boolean) => void;
  
  // Shape element actions
  addShape: (shapeType: ShapeType, position: Position, initialProperties?: Partial<ShapeElement>) => string | null;
  updateShape: (id: string, updates: Partial<ShapeElement>) => void;
  deleteShape: (id: string) => void;
  selectShape: (id: string | null) => void;
  
  // UI state actions
  setSelectedElement: (element: { type: ElementType; id: string } | null) => void;
  setEditing: (isEditing: boolean) => void;
  setViewMode: (viewMode: ViewMode) => void;
  setZoomLevel: (zoomLevel: number) => void;
  setPanPosition: (position: Position) => void;
  setShowGrid: (showGrid: boolean) => void;
  setSnapToGrid: (snapToGrid: boolean) => void;
  
  // Plan management actions
  updatePlanTitle: (title: string) => void;
  updateTimeline: (timeline: Partial<TimelineConfig>) => void;
  
  // Unsaved changes actions
  markAsUnsaved: () => void;
  markAsSaved: () => void;
  checkUnsavedChanges: () => boolean;
  clearCurrentPlan: () => void;
  reset: () => void;
}

// Export options for timeline export
export interface ExportOptions {
  format: 'png' | 'pdf' | 'svg' | 'json';
  includeGrid?: boolean;
  backgroundColor?: string;
  width?: number;
  height?: number;
  quality?: number;
}