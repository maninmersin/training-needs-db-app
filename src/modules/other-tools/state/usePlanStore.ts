import { create } from 'zustand';
import { devtools, persist } from 'zustand/middleware';
import { supabase } from '../utils/supabaseClient';
import type { 
  Plan, 
  TimelineConfig, 
  Swimlane, 
  Card, 
  Milestone, 
  TextElement,
  ShapeElement,
  ShapeType,
  CardStatus,
  Position,
  ElementType,
  PlanState
} from '../types';

// Helper function to generate UUID
const generateId = () => crypto.randomUUID();

// Helper function to create a hash of plan data for tracking changes
const createPlanHash = (plan: Plan): string => {
  const hashData = {
    title: plan.title,
    timeline: plan.timeline,
    swimlanes: plan.swimlanes.map(s => ({
      id: s.id,
      title: s.title,
      order: s.order,
      backgroundColor: s.backgroundColor,
      textColor: s.textColor
    })),
    cards: plan.cards.map(c => ({
      id: c.id,
      title: c.title,
      description: c.description,
      startDate: c.startDate.getTime(),
      endDate: c.endDate.getTime(),
      swimlaneId: c.swimlaneId,
      color: c.color,
      status: c.status
    })),
    texts: plan.texts.map(t => ({
      id: t.id,
      content: t.content,
      position: t.position,
      style: t.style
    })),
    shapes: plan.shapes.map(s => ({
      id: s.id,
      shapeType: s.shapeType,
      position: s.position,
      size: s.size,
      style: s.style
    }))
  };
  
  return JSON.stringify(hashData);
};

// Helper function to update unsaved changes state
const updateUnsavedChanges = (set: any, get: any) => {
  const { currentPlan, lastSavedHash } = get();
  if (!currentPlan) {
    set({ hasUnsavedChanges: false });
    return;
  }
  
  const currentHash = createPlanHash(currentPlan);
  const hasChanges = lastSavedHash !== null && currentHash !== lastSavedHash;
  
  set({ hasUnsavedChanges: hasChanges });
};

// Helper function to create a new plan with Training Lead template
const createNewPlan = (name: string, title: string, timelineConfig?: Partial<TimelineConfig>): Plan => {
  const now = new Date();
  const sixMonthsFromNow = new Date();
  sixMonthsFromNow.setMonth(now.getMonth() + 6);
  
  const defaultTimeline: TimelineConfig = {
    startDate: now,
    endDate: sixMonthsFromNow,
    scale: 'weeks',
    showGrid: true,
    snapToGrid: true,
    ...timelineConfig
  };
  
  // Generate IDs for main categories
  const technicalId = generateId();
  const commsId = generateId();
  const trainingId = generateId();
  const bauId = generateId();
  
  // Generate IDs for sub-categories
  const systemAvailabilityId = generateId();
  const testingId = generateId();
  const releasesId = generateId();
  const awarenessId = generateId();
  const invitesId = generateId();
  const analysisId = generateId();
  const designId = generateId();
  const deliverId = generateId();
  const evaluationId = generateId();
  const bauDesignId = generateId();
  const handoverId = generateId();
  
  return {
    id: generateId(),
    name,
    title,
    createdAt: now,
    updatedAt: now,
    ownerId: '', // Will be set from auth
    sharedWith: [],
    timeline: defaultTimeline,
    swimlanes: [
      // Main categories (vertical labels)
      {
        id: technicalId,
        planId: '',
        title: 'Technical',
        order: 0,
        parentId: null,
        isMainCategory: true,
        hasChildren: true,
        backgroundColor: '#4A90A4',
        textColor: '#FFFFFF',
        fontWeight: 'bold' as const,
        fontFamily: 'Inter'
      },
      {
        id: commsId,
        planId: '',
        title: 'Communications',
        order: 1,
        parentId: null,
        isMainCategory: true,
        hasChildren: true,
        backgroundColor: '#5C8A5C',
        textColor: '#FFFFFF',
        fontWeight: 'bold' as const,
        fontFamily: 'Inter'
      },
      {
        id: trainingId,
        planId: '',
        title: 'Training',
        order: 2,
        parentId: null,
        isMainCategory: true,
        hasChildren: true,
        backgroundColor: '#7C3AED',
        textColor: '#FFFFFF',
        fontWeight: 'bold' as const,
        fontFamily: 'Inter'
      },
      {
        id: bauId,
        planId: '',
        title: 'BAU',
        order: 3,
        parentId: null,
        isMainCategory: true,
        hasChildren: true,
        backgroundColor: '#EA580C',
        textColor: '#FFFFFF',
        fontWeight: 'bold' as const,
        fontFamily: 'Inter'
      },
      
      // Sub-categories (timeline tracks)
      {
        id: systemAvailabilityId,
        planId: '',
        title: 'System Availability',
        order: 4,
        parentId: technicalId,
        isMainCategory: false,
        backgroundColor: '#E1F1F5',
        textColor: '#2C5F6B',
        fontWeight: 'medium' as const,
        fontFamily: 'Inter'
      },
      {
        id: testingId,
        planId: '',
        title: 'Testing',
        order: 5,
        parentId: technicalId,
        isMainCategory: false,
        backgroundColor: '#E1F1F5',
        textColor: '#2C5F6B',
        fontWeight: 'medium' as const,
        fontFamily: 'Inter'
      },
      {
        id: releasesId,
        planId: '',
        title: 'Releases',
        order: 6,
        parentId: technicalId,
        isMainCategory: false,
        backgroundColor: '#E1F1F5',
        textColor: '#2C5F6B',
        fontWeight: 'medium' as const,
        fontFamily: 'Inter'
      },
      {
        id: awarenessId,
        planId: '',
        title: 'Awareness',
        order: 7,
        parentId: commsId,
        isMainCategory: false,
        backgroundColor: '#E8F5E8',
        textColor: '#2D5A2D',
        fontWeight: 'medium' as const,
        fontFamily: 'Inter'
      },
      {
        id: invitesId,
        planId: '',
        title: 'Invites',
        order: 8,
        parentId: commsId,
        isMainCategory: false,
        backgroundColor: '#E8F5E8',
        textColor: '#2D5A2D',
        fontWeight: 'medium' as const,
        fontFamily: 'Inter'
      },
      {
        id: analysisId,
        planId: '',
        title: 'Analysis',
        order: 9,
        parentId: trainingId,
        isMainCategory: false,
        backgroundColor: '#F0E7FF',
        textColor: '#4C1D95',
        fontWeight: 'medium' as const,
        fontFamily: 'Inter'
      },
      {
        id: designId,
        planId: '',
        title: 'Design',
        order: 10,
        parentId: trainingId,
        isMainCategory: false,
        backgroundColor: '#F0E7FF',
        textColor: '#4C1D95',
        fontWeight: 'medium' as const,
        fontFamily: 'Inter'
      },
      {
        id: deliverId,
        planId: '',
        title: 'Deliver',
        order: 11,
        parentId: trainingId,
        isMainCategory: false,
        backgroundColor: '#F0E7FF',
        textColor: '#4C1D95',
        fontWeight: 'medium' as const,
        fontFamily: 'Inter'
      },
      {
        id: evaluationId,
        planId: '',
        title: 'Evaluation',
        order: 12,
        parentId: trainingId,
        isMainCategory: false,
        backgroundColor: '#F0E7FF',
        textColor: '#4C1D95',
        fontWeight: 'medium' as const,
        fontFamily: 'Inter'
      },
      {
        id: bauDesignId,
        planId: '',
        title: 'Design',
        order: 13,
        parentId: bauId,
        isMainCategory: false,
        backgroundColor: '#FFF3E0',
        textColor: '#C2410C',
        fontWeight: 'medium' as const,
        fontFamily: 'Inter'
      },
      {
        id: handoverId,
        planId: '',
        title: 'Handover',
        order: 14,
        parentId: bauId,
        isMainCategory: false,
        backgroundColor: '#FFF3E0',
        textColor: '#C2410C',
        fontWeight: 'medium' as const,
        fontFamily: 'Inter'
      }
    ],
    cards: [], // Let TimelinePage.tsx handle sample card creation
    milestones: [], // Embedded in swimlanes and cards
    texts: [],
    shapes: []
  };
};

// Create the store
export const usePlanStore = create<PlanState>()(
  devtools(
    persist(
      (set, get) => ({
        // Initial state
        currentPlan: null,
        plans: [],
        isLoading: false,
        error: null,
        selectedElement: null,
        isEditing: false,
        viewMode: 'timeline',
        zoomLevel: 1,
        panPosition: { x: 0, y: 0 },
        showGrid: true,
        snapToGrid: true,
        gridSize: 20,
        hasUnsavedChanges: false,
        lastSavedHash: null,
        
        // Plan actions - simplified versions for now without full database integration
        createPlan: async (title: string, timelineConfig?: Partial<TimelineConfig>) => {
          console.log('🆕 createPlan called with title:', title);
          set({ isLoading: true, error: null });
          
          try {
            // Generate base name from title
            const baseName = title
              .toLowerCase()
              .replace(/[^a-z0-9\s-]/g, '')
              .replace(/\s+/g, '-')
              .replace(/-+/g, '-')
              .replace(/^-|-$/g, '');
            
            // Ensure the name is unique
            const uniqueName = await get().generateUniquePlanName(baseName);
            
            const newPlan = createNewPlan(uniqueName, title, timelineConfig);
            
            // Get current user for RLS policy
            const { data: { user }, error: userError } = await supabase.auth.getUser();
            console.log('🔐 Current user check:', user, userError);
            if (!user) {
              throw new Error('User must be authenticated to create plans');
            }
            
            // Save plan to Supabase
            const { data: planData, error: planError } = await supabase
              .from('plans')
              .insert({
                id: newPlan.id,
                name: newPlan.name,
                title: newPlan.title,
                owner_id: user.id, // Required for RLS policy
                timeline_start_date: newPlan.timeline.startDate.toISOString(),
                timeline_end_date: newPlan.timeline.endDate.toISOString(),
                timeline_scale: newPlan.timeline.scale,
                timeline_show_grid: newPlan.timeline.showGrid,
                timeline_snap_to_grid: newPlan.timeline.snapToGrid,
                shared_with: newPlan.sharedWith
              })
              .select()
              .single();
            
            if (planError) throw planError;
            
            // Update plan with the returned data
            const planWithId: Plan = {
              ...newPlan,
              id: planData.id,
              ownerId: planData.owner_id,
              swimlanes: newPlan.swimlanes.map(swimlane => ({
                ...swimlane,
                planId: planData.id
              }))
            };
            
            // Save swimlanes to Supabase
            if (planWithId.swimlanes.length > 0) {
              const { error: swimlanesError } = await supabase
                .from('swimlanes')
                .insert(planWithId.swimlanes.map(swimlane => ({
                  id: swimlane.id,
                  plan_id: swimlane.planId,
                  parent_id: swimlane.parentId,
                  is_main_category: swimlane.isMainCategory,
                  has_children: swimlane.hasChildren,
                  order_index: swimlane.order,
                  title: swimlane.title,
                  subtitle: swimlane.subtitle,
                  description: swimlane.description,
                  background_color: swimlane.backgroundColor,
                  text_color: swimlane.textColor,
                  font_size: swimlane.fontSize,
                  font_weight: swimlane.fontWeight,
                  font_family: swimlane.fontFamily,
                  milestone_title: swimlane.milestone?.title,
                  milestone_description: swimlane.milestone?.description,
                  milestone_date: swimlane.milestone?.date?.toISOString(),
                  milestone_color: swimlane.milestone?.color
                })));
              
              if (swimlanesError) throw swimlanesError;
            }
            
            const planHash = createPlanHash(planWithId);
            set({ 
              currentPlan: planWithId,
              isLoading: false,
              lastSavedHash: planHash,
              hasUnsavedChanges: false
            });
            
            // Refresh the plans list from database to ensure consistency
            console.log('🔄 Refreshing plans list after creating new plan');
            try {
              await get().loadPlans();
              console.log('✅ Plans list refreshed after create');
            } catch (refreshError) {
              console.warn('⚠️ Failed to refresh plans list after create:', refreshError);
              // Fallback: manually add the plan if refresh fails
              const updatedPlans = [...get().plans.filter(p => p.id !== planWithId.id), planWithId];
              set({ plans: updatedPlans });
            }
            
            // Don't return the plan - just update state like the working project does
            console.log('✅ Plan created successfully:', planWithId.id);
          } catch (error) {
            set({ 
              error: error instanceof Error ? error.message : 'Failed to create plan',
              isLoading: false 
            });
            throw error;
          }
        },
        
        loadPlan: async (id: string) => {
          set({ isLoading: true, error: null });
          
          try {
            // Load plan
            const { data: planData, error: planError } = await supabase
              .from('plans')
              .select('*')
              .eq('id', id)
              .single();
            
            if (planError) throw planError;
            
            // Load swimlanes
            const { data: swimlanesData, error: swimlanesError } = await supabase
              .from('swimlanes')
              .select('*')
              .eq('plan_id', id)
              .order('order_index');
            
            if (swimlanesError) throw swimlanesError;
            
            // Load cards
            const { data: cardsData, error: cardsError } = await supabase
              .from('cards')
              .select('*')
              .eq('plan_id', id)
              .order('order_index');
            
            if (cardsError) throw cardsError;
            
            // Load text elements
            const { data: textElementsData, error: textElementsError } = await supabase
              .from('text_elements')
              .select('*')
              .eq('plan_id', id)
              .order('z_index');
            
            if (textElementsError) throw textElementsError;
            
            // Load shape elements
            const { data: shapeElementsData, error: shapeElementsError } = await supabase
              .from('shape_elements')
              .select('*')
              .eq('plan_id', id)
              .order('z_index');
            
            if (shapeElementsError) throw shapeElementsError;
            
            // Transform data to our types
            const plan: Plan = {
              id: planData.id,
              name: planData.name,
              title: planData.title,
              createdAt: new Date(planData.created_at),
              updatedAt: new Date(planData.updated_at),
              ownerId: planData.owner_id,
              sharedWith: planData.shared_with || [],
              timeline: {
                startDate: new Date(planData.timeline_start_date),
                endDate: new Date(planData.timeline_end_date),
                scale: planData.timeline_scale,
                showGrid: planData.timeline_show_grid,
                snapToGrid: planData.timeline_snap_to_grid
              },
              swimlanes: (swimlanesData || []).map(swimlane => ({
                id: swimlane.id,
                planId: swimlane.plan_id,
                parentId: swimlane.parent_id,
                title: swimlane.title,
                subtitle: swimlane.subtitle,
                description: swimlane.description,
                order: swimlane.order_index,
                isMainCategory: swimlane.is_main_category,
                hasChildren: swimlane.has_children,
                backgroundColor: swimlane.background_color,
                textColor: swimlane.text_color,
                fontSize: swimlane.font_size,
                fontWeight: swimlane.font_weight,
                fontFamily: swimlane.font_family,
                milestone: swimlane.milestone_title ? {
                  title: swimlane.milestone_title,
                  description: swimlane.milestone_description,
                  date: swimlane.milestone_date ? new Date(swimlane.milestone_date) : undefined,
                  color: swimlane.milestone_color
                } : undefined
              })),
              cards: (cardsData || []).map(card => ({
                id: card.id,
                planId: card.plan_id,
                swimlaneId: card.swimlane_id,
                title: card.title,
                description: card.description,
                startDate: new Date(card.start_date),
                endDate: new Date(card.end_date),
                row: card.row_index,
                order: card.order_index,
                color: card.color,
                backgroundColor: card.background_color,
                textColor: card.text_color,
                fontSize: card.font_size,
                fontWeight: card.font_weight,
                fontFamily: card.font_family,
                status: card.status,
                milestone: card.milestone_title ? {
                  title: card.milestone_title,
                  description: card.milestone_description,
                  date: card.milestone_date ? new Date(card.milestone_date) : undefined,
                  color: card.milestone_color
                } : undefined
              })),
              milestones: [], // Milestones are embedded in cards and swimlanes
              texts: (textElementsData || []).map(textElement => ({
                id: textElement.id,
                planId: textElement.plan_id,
                content: textElement.content,
                position: {
                  x: textElement.position_x,
                  y: textElement.position_y
                },
                size: {
                  width: textElement.width,
                  height: textElement.height
                },
                style: {
                  fontSize: textElement.font_size,
                  fontFamily: textElement.font_family,
                  fontWeight: textElement.font_weight,
                  fontStyle: textElement.font_style,
                  color: textElement.color,
                  backgroundColor: textElement.background_color,
                  textAlign: textElement.text_align
                },
                isSelected: textElement.is_selected,
                isEditing: textElement.is_editing,
                order: textElement.z_index
              })),
              shapes: (shapeElementsData || []).map(shapeElement => ({
                id: shapeElement.id,
                planId: shapeElement.plan_id,
                shapeType: shapeElement.shape_type,
                position: {
                  x: shapeElement.position_x,
                  y: shapeElement.position_y
                },
                size: {
                  width: shapeElement.width,
                  height: shapeElement.height
                },
                style: {
                  fillColor: shapeElement.fill_color,
                  strokeColor: shapeElement.stroke_color,
                  strokeWidth: shapeElement.stroke_width,
                  opacity: shapeElement.opacity
                },
                rotation: shapeElement.properties?.rotation || 0,
                text: shapeElement.properties?.text,
                order: shapeElement.properties?.order || shapeElement.z_index,
                isSelected: shapeElement.is_selected
              }))
            };
            
            const planHash = createPlanHash(plan);
            set({ 
              currentPlan: plan,
              isLoading: false,
              lastSavedHash: planHash,
              hasUnsavedChanges: false
            });
          } catch (error) {
            set({ 
              error: error instanceof Error ? error.message : 'Failed to load plan',
              isLoading: false 
            });
          }
        },
        
        savePlan: async () => {
          const { currentPlan } = get();
          
          if (!currentPlan) return;
          
          set({ isLoading: true, error: null });
          
          try {
            // Update plan in Supabase
            const { error: planError } = await supabase
              .from('plans')
              .update({
                name: currentPlan.name,
                title: currentPlan.title,
                timeline_start_date: currentPlan.timeline.startDate.toISOString(),
                timeline_end_date: currentPlan.timeline.endDate.toISOString(),
                timeline_scale: currentPlan.timeline.scale,
                timeline_show_grid: currentPlan.timeline.showGrid,
                timeline_snap_to_grid: currentPlan.timeline.snapToGrid,
                shared_with: currentPlan.sharedWith,
                updated_at: new Date().toISOString()
              })
              .eq('id', currentPlan.id);
            
            if (planError) throw planError;
            
            // Update swimlanes
            if (currentPlan.swimlanes.length > 0) {
              // Delete existing swimlanes first
              await supabase
                .from('swimlanes')
                .delete()
                .eq('plan_id', currentPlan.id);
                
              // Insert updated swimlanes
              const { error: swimlanesError } = await supabase
                .from('swimlanes')
                .insert(currentPlan.swimlanes.map(swimlane => ({
                  id: swimlane.id,
                  plan_id: swimlane.planId,
                  parent_id: swimlane.parentId,
                  is_main_category: swimlane.isMainCategory,
                  has_children: swimlane.hasChildren,
                  order_index: swimlane.order,
                  title: swimlane.title,
                  subtitle: swimlane.subtitle,
                  description: swimlane.description,
                  background_color: swimlane.backgroundColor,
                  text_color: swimlane.textColor,
                  font_size: swimlane.fontSize,
                  font_weight: swimlane.fontWeight,
                  font_family: swimlane.fontFamily,
                  milestone_title: swimlane.milestone?.title,
                  milestone_description: swimlane.milestone?.description,
                  milestone_date: swimlane.milestone?.date?.toISOString(),
                  milestone_color: swimlane.milestone?.color
                })));
              
              if (swimlanesError) throw swimlanesError;
            }
            
            // Update cards
            if (currentPlan.cards.length > 0) {
              // Delete existing cards first
              await supabase
                .from('cards')
                .delete()
                .eq('plan_id', currentPlan.id);
                
              // Insert updated cards
              const { error: cardsError } = await supabase
                .from('cards')
                .insert(currentPlan.cards.map(card => ({
                  id: card.id,
                  plan_id: card.planId,
                  swimlane_id: card.swimlaneId,
                  title: card.title,
                  description: card.description,
                  start_date: card.startDate.toISOString(),
                  end_date: card.endDate.toISOString(),
                  row_index: card.row || 0,
                  order_index: card.order,
                  color: card.color,
                  background_color: card.backgroundColor,
                  text_color: card.textColor,
                  font_size: card.fontSize,
                  font_weight: card.fontWeight,
                  font_family: card.fontFamily,
                  status: card.status,
                  milestone_title: card.milestone?.title,
                  milestone_description: card.milestone?.description,
                  milestone_date: card.milestone?.date?.toISOString(),
                  milestone_color: card.milestone?.color
                })));
              
              if (cardsError) throw cardsError;
            }
            
            // Update text elements
            if (currentPlan.texts.length > 0) {
              // Delete existing text elements first
              await supabase
                .from('text_elements')
                .delete()
                .eq('plan_id', currentPlan.id);
                
              // Insert updated text elements
              const { error: textElementsError } = await supabase
                .from('text_elements')
                .insert(currentPlan.texts.map(textElement => ({
                  id: textElement.id,
                  plan_id: textElement.planId,
                  content: textElement.content,
                  position_x: textElement.position.x,
                  position_y: textElement.position.y,
                  width: textElement.size.width,
                  height: textElement.size.height,
                  font_size: textElement.style.fontSize,
                  font_family: textElement.style.fontFamily,
                  font_weight: textElement.style.fontWeight,
                  font_style: textElement.style.fontStyle,
                  color: textElement.style.color,
                  background_color: textElement.style.backgroundColor,
                  text_align: textElement.style.textAlign,
                  is_selected: textElement.isSelected,
                  is_editing: textElement.isEditing,
                  z_index: textElement.order
                })));
              
              if (textElementsError) throw textElementsError;
            }
            
            // Update shape elements - always delete first, then insert if there are shapes
            await supabase
              .from('shape_elements')
              .delete()
              .eq('plan_id', currentPlan.id);
            
            if (currentPlan.shapes.length > 0) {
              // Insert updated shape elements
              const { error: shapeElementsError } = await supabase
                .from('shape_elements')
                .insert(currentPlan.shapes.map(shapeElement => ({
                  id: shapeElement.id,
                  plan_id: shapeElement.planId,
                  shape_type: shapeElement.shapeType,
                  position_x: shapeElement.position.x,
                  position_y: shapeElement.position.y,
                  width: shapeElement.size.width,
                  height: shapeElement.size.height,
                  properties: {
                    rotation: shapeElement.rotation,
                    order: shapeElement.order,
                    text: shapeElement.text
                  },
                  fill_color: shapeElement.style.fillColor,
                  stroke_color: shapeElement.style.strokeColor,
                  stroke_width: shapeElement.style.strokeWidth,
                  opacity: shapeElement.style.opacity,
                  is_selected: shapeElement.isSelected,
                  z_index: shapeElement.order
                })));
              
              if (shapeElementsError) throw shapeElementsError;
            }
            
            const updatedPlan = { ...currentPlan, updatedAt: new Date() };
            const planHash = createPlanHash(updatedPlan);
            set({ 
              currentPlan: updatedPlan,
              isLoading: false,
              lastSavedHash: planHash,
              hasUnsavedChanges: false
            });
            
            // Refresh the plans list to ensure consistency
            try {
              await get().loadPlans();
            } catch (refreshError) {
              console.warn('Failed to refresh plans list after save:', refreshError);
            }
          } catch (error) {
            set({ 
              error: error instanceof Error ? error.message : 'Failed to save plan',
              isLoading: false 
            });
          }
        },
        
        saveAsNewPlan: async (newName: string, newTitle: string) => {
          const { currentPlan } = get();
          
          if (!currentPlan) return;
          
          set({ isLoading: true, error: null });
          
          try {
            // Create a copy with new ID and name
            const newPlan = {
              ...currentPlan,
              id: generateId(),
              name: newName,
              title: newTitle,
              createdAt: new Date(),
              updatedAt: new Date()
            };
            
            const planHash = createPlanHash(newPlan);
            set({ 
              currentPlan: newPlan,
              isLoading: false,
              lastSavedHash: planHash,
              hasUnsavedChanges: false
            });
          } catch (error) {
            set({ 
              error: error instanceof Error ? error.message : 'Failed to create new plan',
              isLoading: false 
            });
            throw error;
          }
        },
        
        // Helper functions
        deduplicatePlans: (plans: Plan[]): Plan[] => {
          const seen = new Set();
          return plans.filter(plan => {
            if (seen.has(plan.id)) {
              console.warn('🔍 Removing duplicate plan from store:', plan.name);
              return false;
            }
            seen.add(plan.id);
            return true;
          });
        },

        checkPlanNameExists: async (name: string): Promise<boolean> => {
          try {
            const { data, error } = await supabase
              .from('plans')
              .select('name')
              .eq('name', name)
              .limit(1);
            
            if (error) throw error;
            
            return data && data.length > 0;
          } catch (error) {
            console.warn('Error checking plan name:', error);
            return false;
          }
        },
        
        generateUniquePlanName: async (baseName: string): Promise<string> => {
          let name = baseName.trim();
          let counter = 1;
          
          while (await get().checkPlanNameExists(name)) {
            name = `${baseName.trim()}-${counter}`;
            counter++;
          }
          
          return name;
        },
        
        loadPlans: async () => {
          set({ isLoading: true, error: null });
          
          try {
            const { data, error } = await supabase
              .from('plans')
              .select('id, name, title, created_at, updated_at')
              .order('updated_at', { ascending: false });
            
            if (error) throw error;
            
            const plans = data.map(plan => ({
              id: plan.id,
              name: plan.name,
              title: plan.title,
              createdAt: new Date(plan.created_at),
              updatedAt: new Date(plan.updated_at)
            }));
            
            set({ 
              plans: plans,
              isLoading: false 
            });
          } catch (error) {
            set({ 
              error: error instanceof Error ? error.message : 'Failed to load plans',
              isLoading: false 
            });
          }
        },
        
        deletePlan: async (id: string) => {
          set({ isLoading: true, error: null });
          
          try {
            const { error } = await supabase
              .from('plans')
              .delete()
              .eq('id', id);
            
            if (error) throw error;
            
            // Remove from local state
            set({ 
              plans: get().plans.filter(plan => plan.id !== id),
              isLoading: false 
            });
            
            // Clear current plan if it's the one being deleted
            if (get().currentPlan?.id === id) {
              set({ currentPlan: null, hasUnsavedChanges: false, lastSavedHash: null });
            }
          } catch (error) {
            set({ 
              error: error instanceof Error ? error.message : 'Failed to delete plan',
              isLoading: false 
            });
          }
        },
        
        // Swimlane actions
        addSwimlane: (swimlane: Omit<Swimlane, 'id' | 'planId'>) => {
          const { currentPlan } = get();
          if (!currentPlan) return;
          
          const newSwimlane: Swimlane = {
            ...swimlane,
            id: generateId(),
            planId: currentPlan.id
          };
          
          const updatedPlan = {
            ...currentPlan,
            swimlanes: [...currentPlan.swimlanes, newSwimlane],
            updatedAt: new Date()
          };
          
          set({ currentPlan: updatedPlan });
          updateUnsavedChanges(set, get);
        },
        
        updateSwimlane: (id: string, updates: Partial<Swimlane>) => {
          const { currentPlan } = get();
          if (!currentPlan) return;
          
          const updatedPlan = {
            ...currentPlan,
            swimlanes: currentPlan.swimlanes.map(swimlane =>
              swimlane.id === id ? { ...swimlane, ...updates } : swimlane
            ),
            updatedAt: new Date()
          };
          
          set({ currentPlan: updatedPlan });
          updateUnsavedChanges(set, get);
        },
        
        deleteSwimlane: (id: string) => {
          const { currentPlan } = get();
          if (!currentPlan) return;
          
          const updatedPlan = {
            ...currentPlan,
            swimlanes: currentPlan.swimlanes.filter(swimlane => swimlane.id !== id),
            cards: currentPlan.cards.filter(card => card.swimlaneId !== id),
            updatedAt: new Date()
          };
          
          set({ currentPlan: updatedPlan });
          updateUnsavedChanges(set, get);
        },
        
        // Card actions
        addCard: (card: Omit<Card, 'id' | 'createdAt' | 'updatedAt'>) => {
          const { currentPlan } = get();
          if (!currentPlan) return;
          
          const newCard: Card = {
            ...card,
            id: generateId(),
            createdAt: new Date(),
            updatedAt: new Date()
          };
          
          const updatedPlan = {
            ...currentPlan,
            cards: [...currentPlan.cards, newCard],
            updatedAt: new Date()
          };
          
          set({ currentPlan: updatedPlan });
          updateUnsavedChanges(set, get);
        },
        
        updateCard: (id: string, updates: Partial<Card>) => {
          const { currentPlan } = get();
          if (!currentPlan) return;
          
          const updatedPlan = {
            ...currentPlan,
            cards: currentPlan.cards.map(card =>
              card.id === id ? { ...card, ...updates, updatedAt: new Date() } : card
            ),
            updatedAt: new Date()
          };
          
          set({ currentPlan: updatedPlan });
          updateUnsavedChanges(set, get);
        },
        
        deleteCard: (id: string) => {
          const { currentPlan } = get();
          if (!currentPlan) return;
          
          const updatedPlan = {
            ...currentPlan,
            cards: currentPlan.cards.filter(card => card.id !== id),
            updatedAt: new Date()
          };
          
          set({ currentPlan: updatedPlan });
          updateUnsavedChanges(set, get);
        },
        
        moveCard: (id: string, swimlaneId: string, startDate: Date, endDate: Date) => {
          const { currentPlan } = get();
          if (!currentPlan) return;
          
          const updatedPlan = {
            ...currentPlan,
            cards: currentPlan.cards.map(card =>
              card.id === id ? { 
                ...card, 
                swimlaneId,
                startDate,
                endDate,
                updatedAt: new Date()
              } : card
            ),
            updatedAt: new Date()
          };
          
          set({ currentPlan: updatedPlan });
          updateUnsavedChanges(set, get);
        },
        
        resizeCard: (id: string, startDate: Date, endDate: Date) => {
          const { currentPlan } = get();
          if (!currentPlan) return;
          
          const updatedPlan = {
            ...currentPlan,
            cards: currentPlan.cards.map(card =>
              card.id === id ? { 
                ...card, 
                startDate,
                endDate,
                updatedAt: new Date()
              } : card
            ),
            updatedAt: new Date()
          };
          
          set({ currentPlan: updatedPlan });
          updateUnsavedChanges(set, get);
        },
        
        // Legacy milestone actions (kept for compatibility)
        addMilestone: (milestone: Omit<Milestone, 'id'>) => {
          console.warn('addMilestone is deprecated. Use embedded milestones in swimlanes or cards instead.');
        },
        
        updateMilestone: (id: string, updates: Partial<Milestone>) => {
          console.warn('updateMilestone is deprecated. Use embedded milestones in swimlanes or cards instead.');
        },
        
        deleteMilestone: (id: string) => {
          console.warn('deleteMilestone is deprecated. Use embedded milestones in swimlanes or cards instead.');
        },
        
        // Text element actions
        addTextElement: (position: Position, initialProperties?: Partial<TextElement>) => {
          const { currentPlan } = get();
          if (!currentPlan) return null;
          
          const newText: TextElement = {
            id: generateId(),
            planId: currentPlan.id,
            content: 'New text',
            position,
            size: {
              width: 200,
              height: 50
            },
            style: {
              fontSize: 14,
              fontFamily: 'Arial, sans-serif',
              color: '#000000',
              backgroundColor: 'transparent',
              textAlign: 'left',
              fontWeight: 'normal',
              fontStyle: 'normal'
            },
            isSelected: false,
            isEditing: false,
            order: currentPlan.texts.length,
            createdAt: new Date(),
            updatedAt: new Date(),
            ...initialProperties
          };
          
          const updatedPlan = {
            ...currentPlan,
            texts: [...currentPlan.texts, newText],
            updatedAt: new Date()
          };
          
          set({ currentPlan: updatedPlan });
          updateUnsavedChanges(set, get);
          
          return newText.id;
        },
        
        updateTextElement: (id: string, updates: Partial<TextElement>) => {
          const { currentPlan } = get();
          if (!currentPlan) return;
          
          const updatedPlan = {
            ...currentPlan,
            texts: currentPlan.texts.map(text => 
              text.id === id ? { ...text, ...updates, updatedAt: new Date() } : text
            ),
            updatedAt: new Date()
          };
          
          set({ currentPlan: updatedPlan });
          updateUnsavedChanges(set, get);
        },
        
        deleteTextElement: (id: string) => {
          const { currentPlan } = get();
          if (!currentPlan) return;
          
          const updatedPlan = {
            ...currentPlan,
            texts: currentPlan.texts.filter(text => text.id !== id),
            updatedAt: new Date()
          };
          
          set({ currentPlan: updatedPlan });
          updateUnsavedChanges(set, get);
        },
        
        selectTextElement: (id: string | null) => {
          const { currentPlan } = get();
          if (!currentPlan) return;
          
          set({
            currentPlan: {
              ...currentPlan,
              texts: currentPlan.texts.map(text => ({
                ...text,
                isSelected: text.id === id,
                isEditing: false
              })),
              updatedAt: new Date()
            }
          });
        },
        
        setTextElementEditing: (id: string, isEditing: boolean) => {
          const { currentPlan } = get();
          if (!currentPlan) return;
          
          set({
            currentPlan: {
              ...currentPlan,
              texts: currentPlan.texts.map(text => 
                text.id === id ? { ...text, isEditing, isSelected: !isEditing } : text
              ),
              updatedAt: new Date()
            }
          });
        },
        
        // Shape element actions
        addShape: (shapeType: ShapeType, position: Position, initialProperties?: Partial<ShapeElement>) => {
          const { currentPlan } = get();
          if (!currentPlan) return null;
          
          const newShape: ShapeElement = {
            id: generateId(),
            planId: currentPlan.id,
            shapeType,
            position,
            size: {
              width: shapeType === 'line' ? 100 : shapeType === 'circle' ? 80 : 120,
              height: shapeType === 'line' ? 0 : shapeType === 'circle' ? 80 : 80
            },
            rotation: 0,
            zIndex: currentPlan.shapes.length + 100,
            style: {
              fillColor: shapeType === 'line' ? 'transparent' : '#3B82F6',
              strokeColor: '#1E40AF',
              strokeWidth: 2,
              opacity: 1
            },
            isSelected: false,
            order: currentPlan.shapes.length,
            createdAt: new Date(),
            updatedAt: new Date(),
            ...initialProperties
          };
          
          const updatedPlan = {
            ...currentPlan,
            shapes: [...currentPlan.shapes, newShape],
            updatedAt: new Date()
          };
          
          set({ currentPlan: updatedPlan });
          updateUnsavedChanges(set, get);
          
          return newShape.id;
        },
        
        updateShape: (id: string, updates: Partial<ShapeElement>) => {
          const { currentPlan } = get();
          if (!currentPlan) return;
          
          const updatedPlan = {
            ...currentPlan,
            shapes: currentPlan.shapes.map(shape => 
              shape.id === id ? { ...shape, ...updates, updatedAt: new Date() } : shape
            ),
            updatedAt: new Date()
          };
          
          set({ currentPlan: updatedPlan });
          updateUnsavedChanges(set, get);
        },
        
        deleteShape: (id: string) => {
          const { currentPlan } = get();
          if (!currentPlan) return;
          
          const updatedPlan = {
            ...currentPlan,
            shapes: currentPlan.shapes.filter(shape => shape.id !== id),
            updatedAt: new Date()
          };
          
          set({ currentPlan: updatedPlan });
          updateUnsavedChanges(set, get);
        },
        
        selectShape: (id: string | null) => {
          const { currentPlan } = get();
          if (!currentPlan) return;
          
          set({
            currentPlan: {
              ...currentPlan,
              shapes: currentPlan.shapes.map(shape => ({
                ...shape,
                isSelected: shape.id === id
              })),
              updatedAt: new Date()
            }
          });
        },
        
        // UI state actions
        setSelectedElement: (element: { type: ElementType; id: string } | null) => {
          set({ selectedElement: element });
        },
        
        setEditing: (isEditing: boolean) => {
          set({ isEditing });
        },
        
        setViewMode: (viewMode: 'timeline' | 'whiteboard') => {
          set({ viewMode });
        },
        
        setZoomLevel: (zoomLevel: number) => {
          set({ zoomLevel: Math.max(0.1, Math.min(3, zoomLevel)) });
        },
        
        setPanPosition: (position: Position) => {
          set({ panPosition: position });
        },
        
        setShowGrid: (showGrid: boolean) => {
          set({ showGrid });
        },
        
        setSnapToGrid: (snapToGrid: boolean) => {
          set({ snapToGrid });
        },
        
        // Plan management actions
        updatePlanTitle: (title: string) => {
          const { currentPlan } = get();
          if (!currentPlan) return;
          
          const updatedPlan = {
            ...currentPlan,
            title,
            updatedAt: new Date()
          };
          
          set({ currentPlan: updatedPlan });
          updateUnsavedChanges(set, get);
        },
        
        updateTimeline: (timeline: Partial<TimelineConfig>) => {
          const { currentPlan } = get();
          if (!currentPlan) return;
          
          const updatedPlan = {
            ...currentPlan,
            timeline: {
              ...currentPlan.timeline,
              ...timeline
            },
            updatedAt: new Date()
          };
          
          set({ currentPlan: updatedPlan });
          updateUnsavedChanges(set, get);
        },
        
        // Unsaved changes actions
        markAsUnsaved: () => {
          set({ hasUnsavedChanges: true });
        },
        
        markAsSaved: () => {
          const { currentPlan } = get();
          if (currentPlan) {
            const planHash = createPlanHash(currentPlan);
            set({ 
              hasUnsavedChanges: false,
              lastSavedHash: planHash
            });
          }
        },
        
        checkUnsavedChanges: () => {
          const { currentPlan, lastSavedHash } = get();
          if (!currentPlan || !lastSavedHash) return false;
          
          const currentHash = createPlanHash(currentPlan);
          return currentHash !== lastSavedHash;
        },
        
        clearCurrentPlan: () => {
          set({ 
            currentPlan: null,
            hasUnsavedChanges: false,
            lastSavedHash: null,
            selectedElement: null,
            isEditing: false
          });
        },
        
        reset: () => {
          set({
            currentPlan: null,
            plans: [],
            isLoading: false,
            error: null,
            selectedElement: null,
            isEditing: false,
            viewMode: 'timeline',
            zoomLevel: 1,
            panPosition: { x: 0, y: 0 },
            showGrid: true,
            snapToGrid: true,
            gridSize: 20,
            hasUnsavedChanges: false,
            lastSavedHash: null
          });
        }
      }),
      {
        name: 'plan-store',
        partialize: (state) => ({
          viewMode: state.viewMode,
          zoomLevel: state.zoomLevel,
          showGrid: state.showGrid,
          snapToGrid: state.snapToGrid,
          gridSize: state.gridSize
        })
      }
    )
  )
);

export default usePlanStore;