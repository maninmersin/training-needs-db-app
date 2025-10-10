// Core types
export type TimeScale = 'weeks' | 'months' | 'quarters';

export type CardStatus = 'not-started' | 'in-progress' | 'completed' | 'blocked';

export type ElementType = 'card' | 'milestone' | 'swimlane' | 'text' | 'shape';

// Position for freeform elements
export interface Position {
  x: number;
  y: number;
}

// Date range
export interface DateRange {
  start: Date;
  end: Date;
}

// Plan interface
export interface Plan {
  id: string;
  name: string; // File/save name (e.g., "q1-marketing-plan")
  title: string; // Display title (e.g., "Q1 Marketing Campaign Strategy")
  createdAt: Date;
  updatedAt: Date;
  ownerId: string;
  sharedWith: string[]; // User IDs
  timeline: TimelineConfig;
  swimlanes: Swimlane[];
  cards: Card[];
  milestones: Milestone[];
  texts: TextElement[];
  shapes: ShapeElement[];
}

// Timeline configuration
export interface TimelineConfig {
  startDate: Date;
  endDate: Date;
  scale: TimeScale;
  showGrid: boolean;
  snapToGrid: boolean;
}

// Helper type for time period calculations
export interface TimePeriod {
  startDate: Date;
  endDate: Date;
  label: string;
  index: number;
}

// Swimlane interface
export interface Swimlane {
  id: string;
  planId: string;
  title: string;
  subtitle?: string; // Optional subtitle description
  order: number;
  color?: string;
  isCollapsed: boolean;
  parentId?: string; // For hierarchical swimlanes
  level: number; // 0 for root, 1 for child, 2 for grandchild, etc.
  hasChildren?: boolean; // Whether this swimlane has child swimlanes
  milestone?: MilestoneData; // Optional milestone associated with this swimlane
  // Advanced styling options
  backgroundColor?: string;
  textColor?: string;
  fontSize?: number;
  fontWeight?: 'normal' | 'medium' | 'semibold' | 'bold';
  fontFamily?: string;
  isMainCategory?: boolean; // Marks this as a main category (Discovery, Clinical, etc.)
}

// Card interface
export interface Card {
  id: string;
  planId: string;
  swimlaneId: string;
  title: string;
  description?: string;
  startDate: Date;
  endDate: Date;
  color: string;
  status: CardStatus;
  order: number;
  row?: number; // Row/track within the swimlane (0 = top row, 1 = second row, etc.)
  position?: Position; // For freeform positioning
  dependencies?: string[]; // Array of card IDs this card depends on
  milestone?: MilestoneData; // Optional milestone associated with this card
  // Advanced styling options
  backgroundColor?: string;
  textColor?: string;
  fontSize?: number;
  fontWeight?: 'normal' | 'medium' | 'semibold' | 'bold';
  fontFamily?: string;
  textAlign?: 'left' | 'center' | 'right';
}

// Milestone interface
export interface Milestone {
  id: string;
  planId: string;
  swimlaneId?: string;
  title: string;
  date: Date;
  description?: string;
  color: string;
  position?: Position; // For freeform positioning
}

// Shared milestone data for cards and swimlanes
export interface MilestoneData {
  title: string;
  date: Date;
  color: string;
}

// Text Element interface for PowerPoint-style text boxes
export interface TextElement {
  id: string;
  planId: string;
  content: string;
  position: Position;
  size: {
    width: number;
    height: number;
  };
  style: {
    fontSize: number;
    fontFamily: string;
    color: string;
    backgroundColor: string;
    borderColor?: string;
    textAlign: 'left' | 'center' | 'right';
    fontWeight: 'normal' | 'bold';
    fontStyle: 'normal' | 'italic';
  };
  isSelected?: boolean;
  isEditing?: boolean;
  order: number;
  createdAt: Date;
  updatedAt: Date;
}

// Shape element types
export type ShapeType = 'rectangle' | 'circle' | 'arrow' | 'line' | 'triangle' | 'diamond' | 'rounded-rectangle' | 'star' | 'hexagon' | 'ellipse' | 'plus';

// Shape element interface
export interface ShapeElement {
  id: string;
  planId: string;
  shapeType: ShapeType;
  position: Position;
  size: {
    width: number;
    height: number;
  };
  rotation: number;
  zIndex: number;
  style: {
    fillColor: string;
    strokeColor: string;
    strokeWidth: number;
    opacity: number;
  };
  text?: {
    content: string;
    fontSize: number;
    fontFamily: string;
    color: string;
    textAlign: 'left' | 'center' | 'right';
    fontWeight: 'normal' | 'bold';
    fontStyle: 'normal' | 'italic';
  };
  isSelected?: boolean;
  order: number;
  createdAt: Date;
  updatedAt: Date;
}

// API Request/Response Types

// Plan API Types
export interface CreatePlanRequest {
  title: string;
  timeline?: Partial<TimelineConfig>;
}

export interface UpdatePlanRequest {
  title?: string;
  timeline?: Partial<TimelineConfig>;
  sharedWith?: string[];
}

export interface PlanResponse {
  id: string;
  title: string;
  createdAt: string;
  updatedAt: string;
  ownerId: string;
  sharedWith: string[];
  timeline: TimelineConfig;
  swimlanes: Swimlane[];
  cards: Card[];
  milestones: Milestone[];
}

// Swimlane API Types
export interface CreateSwimlaneRequest {
  planId: string;
  title: string;
  color?: string;
  backgroundColor?: string;
  textColor?: string;
  fontSize?: number;
  fontWeight?: 'normal' | 'medium' | 'semibold' | 'bold';
  fontFamily?: string;
  isMainCategory?: boolean;
}

export interface UpdateSwimlaneRequest {
  title?: string;
  color?: string;
  isCollapsed?: boolean;
  order?: number;
  backgroundColor?: string;
  textColor?: string;
  fontSize?: number;
  fontWeight?: 'normal' | 'medium' | 'semibold' | 'bold';
  fontFamily?: string;
}

// Card API Types
export interface CreateCardRequest {
  planId: string;
  swimlaneId: string;
  title: string;
  description?: string;
  startDate: Date;
  endDate: Date;
  color?: string;
  status?: CardStatus;
  row?: number;
  position?: Position;
  backgroundColor?: string;
  textColor?: string;
  fontSize?: number;
  fontWeight?: 'normal' | 'medium' | 'semibold' | 'bold';
  fontFamily?: string;
  textAlign?: 'left' | 'center' | 'right';
}

export interface UpdateCardRequest {
  title?: string;
  description?: string;
  startDate?: Date;
  endDate?: Date;
  color?: string;
  status?: CardStatus;
  swimlaneId?: string;
  order?: number;
  row?: number;
  position?: Position;
  backgroundColor?: string;
  textColor?: string;
  fontSize?: number;
  fontWeight?: 'normal' | 'medium' | 'semibold' | 'bold';
  fontFamily?: string;
  textAlign?: 'left' | 'center' | 'right';
}

// Milestone API Types
export interface CreateMilestoneRequest {
  planId: string;
  swimlaneId?: string;
  title: string;
  date: Date;
  description?: string;
  color?: string;
  position?: Position;
}

export interface UpdateMilestoneRequest {
  title?: string;
  date?: Date;
  description?: string;
  color?: string;
  swimlaneId?: string;
  position?: Position;
}

// UI Component Props Types

// Plan Canvas Props
export interface PlanCanvasProps {
  plan: Plan;
  onTimelineChange: (timeline: Partial<TimelineConfig>) => void;
  onAddSwimlane: () => void;
  onAddCard: (swimlaneId: string) => void;
  onAddMilestone: () => void;
  onProjectTitleChange: (title: string) => void;
  selectedElement?: { type: ElementType; id: string } | null;
  onSelectElement: (element: { type: ElementType; id: string } | null) => void;
}

// Timeline Component Props
export interface TimelineProps {
  config: TimelineConfig;
  onChange: (config: Partial<TimelineConfig>) => void;
}

// Timeline Header Props
export interface TimelineHeaderProps {
  config: TimelineConfig;
  onChange: (config: Partial<TimelineConfig>) => void;
}

// Timeline Grid Props
export interface TimelineGridProps {
  config: TimelineConfig;
  className?: string;
}

// Swimlane Component Props
export interface SwimlaneProps {
  swimlane: Swimlane;
  onUpdate: (updates: Partial<Swimlane>) => void;
  onDelete: () => void;
  onAddCard: () => void;
  isSelected: boolean;
  onSelect: () => void;
}

// Card Component Props
export interface CardProps {
  card: Card;
  timeline: TimelineConfig;
  isSelected: boolean;
  onSelect: () => void;
  onUpdate: (updates: Partial<Card>) => void;
  onDelete: () => void;
  onResize: (startDate: Date, endDate: Date) => void;
}

// Milestone Component Props
export interface MilestoneProps {
  milestone: Milestone;
  timeline: TimelineConfig;
  isSelected: boolean;
  onSelect: () => void;
  onUpdate: (updates: Partial<Milestone>) => void;
  onDelete: () => void;
}

// Toolbar Component Props
export interface ToolbarProps {
  onAddSwimlane: () => void;
  onAddCard: () => void;
  onAddMilestone: () => void;
  onAddText: () => void;
  onSave: () => Promise<void>;
  onLoad: () => Promise<void>;
  onExport: (format: 'png' | 'pdf' | 'json') => void;
  onToggleSnapToGrid: () => void;
  snapToGrid: boolean;
}

// State Management Types

// Plan Store State
export interface PlanState {
  // Current plan
  currentPlan: Plan | null;
  plans: Plan[];
  isLoading: boolean;
  error: string | null;
  
  // UI state
  selectedElement: { type: ElementType; id: string } | null;
  isEditing: boolean;
  snapToGrid: boolean;
  gridSize: number;
  hasUnsavedChanges: boolean;
  lastSavedHash: string | null;
  
  // Actions
  // Plan actions
  createPlan: (title: string, timelineConfig?: Partial<TimelineConfig>) => Promise<void>;
  loadPlan: (id: string) => Promise<void>;
  savePlan: () => Promise<void>;
  saveAsNewPlan: (newName: string, newTitle: string) => Promise<void>;
  deletePlan: (id: string) => Promise<void>;
  loadPlans: () => Promise<void>;
  
  // Card actions
  addCard: (card: Omit<Card, 'id'>) => void;
  updateCard: (id: string, updates: Partial<Card>) => void;
  deleteCard: (id: string) => void;
  moveCard: (id: string, swimlaneId: string, position?: Position) => void;
  resizeCard: (id: string, startDate: Date, endDate: Date) => void;
  
  // Milestone actions
  addMilestone: (milestone: Omit<Milestone, 'id'>) => void;
  updateMilestone: (id: string, updates: Partial<Milestone>) => void;
  deleteMilestone: (id: string) => void;
  
  // Swimlane actions
  addSwimlane: (title: string, parentId?: string) => void;
  addSubCategory: (parentId: string, title: string) => void;
  updateSwimlane: (id: string, updates: Partial<Swimlane>) => void;
  deleteSwimlane: (id: string) => void;
  reorderSwimlanes: (swimlaneIds: string[]) => void;
  
  // Timeline actions
  updateTimeline: (timeline: Partial<TimelineConfig>) => void;
  updatePlanTitle: (title: string) => void;
  setCurrentPlan: (plan: Plan) => void;
  clearCurrentPlan: () => void;
  
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
  
  // UI actions
  setSelectedElement: (element: { type: ElementType; id: string } | null) => void;
  setEditing: (isEditing: boolean) => void;
  setSnapToGrid: (snapToGrid: boolean) => void;
  setGridSize: (size: number) => void;
  
  // Sharing actions
  sharePlan: (userId: string) => Promise<void>;
  unsharePlan: (userId: string) => Promise<void>;
  
  // Unsaved changes actions
  markAsUnsaved: () => void;
  markAsSaved: () => void;
  checkUnsavedChanges: () => boolean;
  
  // Utility actions
  clearError: () => void;
  reset: () => void;
}

// Drag and Drop Types

// Drag and Drop Context
export interface DragDropContext {
  active: { id: string; type: ElementType; data: any } | null;
  over: { id: string; type: ElementType; data: any } | null;
  droppableContainers: Map<string, any>;
}

export interface DragEndEvent {
  active: { id: string; type: ElementType; data: any };
  over: { id: string; type: ElementType; data: any } | null;
  delta: Position;
}

// Draggable Data Types
export interface CardDragData {
  type: 'card';
  id: string;
  card: Card;
  initialPosition: Position;
}

export interface MilestoneDragData {
  type: 'milestone';
  id: string;
  milestone: Milestone;
  initialPosition: Position;
}

export interface SwimlaneDragData {
  type: 'swimlane';
  id: string;
  swimlane: Swimlane;
  initialOrder: number;
}

export type DragData = CardDragData | MilestoneDragData | SwimlaneDragData;

// Category Theme interface for consistent styling
export interface CategoryTheme {
  backgroundColor: string;
  textColor: string;
  fontSize: number;
  fontWeight: 'normal' | 'medium' | 'semibold' | 'bold';
  fontFamily: string;
}

// Category configuration for the editor
export interface CategoryConfig {
  id: string;
  title: string;
  theme: CategoryTheme;
  subCategories: SubCategoryConfig[];
}

// Sub-category configuration
export interface SubCategoryConfig {
  id: string;
  title: string;
  theme?: CategoryTheme; // Optional custom theme, inherits from parent if not specified
  order: number;
}

// Category Editor Modal Props
export interface CategoryEditorData {
  category: CategoryConfig;
  onSave: (categoryConfig: CategoryConfig) => void;
  onCancel: () => void;
}

// Font options for the editor
export const FONT_OPTIONS = [
  { value: 'Inter', label: 'Inter' },
  { value: 'Roboto', label: 'Roboto' },
  { value: 'Arial', label: 'Arial' },
  { value: 'system-ui', label: 'System UI' },
  { value: 'Helvetica Neue', label: 'Helvetica Neue' }
] as const;

// Font weight options
export const FONT_WEIGHT_OPTIONS = [
  { value: 'normal' as const, label: 'Normal' },
  { value: 'medium' as const, label: 'Medium' },
  { value: 'semibold' as const, label: 'Semi-Bold' },
  { value: 'bold' as const, label: 'Bold' }
] as const;

// Card Editor Modal Props
export interface CardEditorModalProps {
  isOpen: boolean;
  card: Card | null;
  onSave: (updates: Partial<Card>) => void;
  onCancel: () => void;
}

// Export Types

// Export Options
export interface ExportOptions {
  format: 'png' | 'pdf' | 'json' | 'svg';
  includeTimeline: boolean;
  includeSwimlaneTitles: boolean;
  includeCardDescriptions: boolean;
  includeMilestones: boolean;
  colorScheme: 'default' | 'monochrome' | 'print-friendly';
}

// Export Data
export interface ExportData {
  plan: Plan;
  options: ExportOptions;
  generatedAt: Date;
}