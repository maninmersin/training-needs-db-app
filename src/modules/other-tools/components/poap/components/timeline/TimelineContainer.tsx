import React, { useState, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import type { Plan } from '../../types';
import TimelineHeader from './TimelineHeader';
import SwimlaneList from './SwimlaneList';
import DateRangeControls from './DateRangeControls';
import { usePlanStore } from '../../state/usePlanStore';
import DndProvider from '../DndProvider';
import PlanTitleModal from '../PlanTitleModal';
import TopToolbar from '../TopToolbar';
import CardEditorModal from '../CardEditorModal';
import CategoryEditorModal from '../CategoryEditorModal';
import MilestoneEditorModal from '../MilestoneEditorModal';
import TextPropertiesModal from '../TextPropertiesModal';
import ShapePropertiesModal from '../ShapePropertiesModal';
import SaveAsModal from '../SaveAsModal';
import PlansLibraryModal from '../PlansLibraryModal';
import NewPlanModal from '../NewPlanModal';
import UnsavedChangesModal from '../UnsavedChangesModal';
import ExportModal from '../ExportModal';
import TextBox from '../TextBox';
import ShapeRenderer from '../ShapeRenderer';
import { useUnsavedChanges } from '../../hooks/useUnsavedChanges';
import { exportTimelineToSVG, downloadSVG } from '../../utils/svgExport';
import type { ExportOptions } from '../../types';
import './timeline.css';

interface TimelineContainerProps {
  plan: Plan;
}

const TimelineContainer: React.FC<TimelineContainerProps> = ({ plan: initialPlan }) => {
  const navigate = useNavigate();
  const { 
    currentPlan, 
    updateTimeline, 
    updatePlanTitle, 
    addCard, 
    addSwimlane, 
    addMilestone, 
    updateCard, 
    updateSwimlane, 
    updateMilestone,
    addTextElement,
    updateTextElement,
    deleteTextElement,
    selectTextElement,
    setTextElementEditing,
    addShape,
    updateShape,
    deleteShape,
    selectShape,
    savePlan,
    saveAsNewPlan,
    createPlan,
    loadPlan,
    loadPlans,
    hasUnsavedChanges,
    clearCurrentPlan
  } = usePlanStore();
  
  const { 
    checkUnsavedBeforeAction, 
    saveCurrentPlan, 
    discardChangesAndProceed 
  } = useUnsavedChanges();
  const [showTitleModal, setShowTitleModal] = useState(false);
  const [showSaveAsModal, setShowSaveAsModal] = useState(false);
  const [showCardModal, setShowCardModal] = useState(false);
  const [showSwimlaneModal, setShowSwimlaneModal] = useState(false);
  const [showMilestoneModal, setShowMilestoneModal] = useState(false);
  const [showTextModal, setShowTextModal] = useState(false);
  const [showShapeModal, setShowShapeModal] = useState(false);
  const [showPlansLibraryModal, setShowPlansLibraryModal] = useState(false);
  const [showExportModal, setShowExportModal] = useState(false);
  
  const [showNewPlanModal, setShowNewPlanModal] = useState(false);
  const [showUnsavedChangesModal, setShowUnsavedChangesModal] = useState(false);
  const [pendingAction, setPendingAction] = useState<(() => void) | null>(null);
  const [unsavedChangesAction, setUnsavedChangesAction] = useState<string>('continue');
  const [selectedCard, setSelectedCard] = useState<any>(null);
  const [selectedSwimlane, setSelectedSwimlane] = useState<any>(null);
  const [selectedMilestone, setSelectedMilestone] = useState<any>(null);
  const [selectedText, setSelectedText] = useState<any>(null);
  const [selectedShape, setSelectedShape] = useState<any>(null);
  
  // Container ref for potential future use
  const timelineContainerRef = useRef<HTMLDivElement>(null);
  
  // Use the current plan from store, fallback to initial prop
  const plan = currentPlan || initialPlan;

  // JSON export helper function
  const exportPlanToJSON = (plan: Plan, filename: string) => {
    const exportData = {
      id: plan.id,
      title: plan.title,
      name: plan.name,
      timeline: plan.timeline,
      swimlanes: plan.swimlanes,
      cards: plan.cards,
      milestones: plan.milestones,
      texts: plan.texts,
      shapes: plan.shapes,
      exportedAt: new Date().toISOString(),
      version: '1.0'
    };
    
    const jsonContent = JSON.stringify(exportData, null, 2);
    const blob = new Blob([jsonContent], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    
    const link = document.createElement('a');
    link.href = url;
    link.download = filename;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    
    URL.revokeObjectURL(url);
  };

  // Helper function to handle actions that might require saving unsaved changes
  const handleActionWithUnsavedCheck = async (action: () => void, actionDescription: string) => {
    const canProceed = await checkUnsavedBeforeAction(action);
    if (!canProceed) {
      setPendingAction(() => action);
      setUnsavedChangesAction(actionDescription);
      setShowUnsavedChangesModal(true);
    }
  };

  const handleExportPlan = async (options: ExportOptions) => {
    try {
      const baseFilename = plan.title.replace(/[^a-z0-9]/gi, '_').toLowerCase();
      
      if (options.format === 'svg') {
        const svgContent = await exportTimelineToSVG(plan, options);
        const filename = `${baseFilename}_timeline.svg`;
        downloadSVG(svgContent, filename);
      } else if (options.format === 'json') {
        const filename = `${baseFilename}_timeline.json`;
        exportPlanToJSON(plan, filename);
      } else {
        // Handle other export formats (PNG, PDF) here
        console.log('Export format not yet implemented:', options.format);
      }
    } catch (error) {
      console.error('Export failed:', error);
      alert('Export failed. Please try again.');
    }
  };

  // Handle plan switching
  const handleSwitchToPlan = async (planId: string) => {
    await handleActionWithUnsavedCheck(
      () => loadPlan(planId),
      'switch plans'
    );
  };

  // Handle new plan creation
  const handleCreatePlan = async (title: string, template: string, timelineConfig: any) => {
    await handleActionWithUnsavedCheck(
      () => createPlan(title, timelineConfig),
      'create a new plan'
    );
  };

  // Handle unsaved changes modal actions
  const handleSaveChanges = async () => {
    await saveCurrentPlan();
    if (pendingAction) {
      pendingAction();
      setPendingAction(null);
    }
    setShowUnsavedChangesModal(false);
  };

  const handleDiscardChanges = async () => {
    if (pendingAction) {
      await discardChangesAndProceed(pendingAction);
      setPendingAction(null);
    }
    setShowUnsavedChangesModal(false);
  };

  const handleCancelUnsavedChanges = () => {
    setPendingAction(null);
    setShowUnsavedChangesModal(false);
  };

  return (
    <DndProvider>
      <div className="h-screen flex flex-col bg-white">
          {/* Plan Title and Top Toolbar */}
          <div className="px-6 py-4 border-b border-gray-200 bg-white flex items-center justify-between">
            <h1 
              className="text-2xl font-bold text-gray-900 cursor-pointer hover:text-gray-700 transition-colors"
              onDoubleClick={() => setShowTitleModal(true)}
              title="Double-click to edit plan title"
            >
              {plan.title}
            </h1>
            <TopToolbar 
              onAddCard={() => {
                setSelectedCard(null);
                setShowCardModal(true);
              }}
              onAddSwimlane={() => {
                setSelectedSwimlane(null);
                setShowSwimlaneModal(true);
              }}
              onAddMilestone={() => {
                setSelectedMilestone(null);
                setShowMilestoneModal(true);
              }}
              onAddText={() => {
                setSelectedText(null);
                setShowTextModal(true);
              }}
              onAddShape={() => {
                // Open shape modal for creating new shape
                setSelectedShape(null);
                setShowShapeModal(true);
              }}
              onSave={savePlan}
              onSaveAs={() => setShowSaveAsModal(true)}
              onExport={() => setShowExportModal(true)}
              onHome={() => handleActionWithUnsavedCheck(
                () => {
                  clearCurrentPlan();
                  // Stay in POAP but clear current plan to show the home screen
                },
                'go to POAP home'
              )}
            />
          </div>

          {/* Date Range Controls */}
          <DateRangeControls 
            timeline={plan.timeline} 
            onTimelineUpdate={updateTimeline}
          />

          {/* Timeline Grid Container */}
          <div className="flex-1 overflow-hidden">
            <div ref={timelineContainerRef} className="timeline-container h-full">
              {/* Timeline Header */}
              <TimelineHeader timeline={plan.timeline} />
              
              {/* Swimlanes */}
              <SwimlaneList 
                plan={plan}
                onMilestoneDoubleClick={(milestone) => {
                  setSelectedMilestone(milestone);
                  setShowMilestoneModal(true);
                }}
              />
              
              {/* Text Elements */}
              {plan.texts.map(textElement => (
                <TextBox
                  key={textElement.id}
                  textElement={textElement}
                  onUpdate={updateTextElement}
                  onDelete={deleteTextElement}
                  onSelect={selectTextElement}
                  onStartEdit={(id) => {
                    setSelectedText(textElement);
                    setShowTextModal(true);
                  }}
                  onFinishEdit={setTextElementEditing}
                />
              ))}
              
              {/* Shape Elements */}
              {plan.shapes.map(shape => (
                <ShapeRenderer
                  key={shape.id}
                  shape={shape}
                  onUpdate={updateShape}
                  onDelete={deleteShape}
                  onSelect={selectShape}
                  onStartEdit={(id) => {
                    // Use setTimeout to ensure state update happens in next render cycle
                    setTimeout(() => {
                      setSelectedShape(shape);
                      setShowShapeModal(true);
                    }, 0);
                  }}
                  onPaste={(shapeData) => {
                    // Create new shape from clipboard data
                    if (shapeData.shapeType && shapeData.position) {
                      addShape(shapeData.shapeType, shapeData.position, shapeData);
                    }
                  }}
                />
              ))}
            </div>
          </div>
        
        {/* Plan Title Editor Modal */}
        <PlanTitleModal 
          isOpen={showTitleModal}
          currentTitle={plan.title}
          onSave={(newTitle) => {
            updatePlanTitle(newTitle);
            setShowTitleModal(false);
          }}
          onCancel={() => setShowTitleModal(false)}
        />
        
        {/* Card Editor Modal */}
        <CardEditorModal 
          isOpen={showCardModal}
          card={selectedCard}
          onSave={(updates) => {
            if (selectedCard) {
              updateCard(selectedCard.id, updates);
            } else {
              // Create new card - need to determine swimlane
              const firstSubCategory = plan.swimlanes.find(s => !s.isMainCategory);
              if (firstSubCategory) {
                addCard({
                  ...updates,
                  planId: plan.id,
                  swimlaneId: firstSubCategory.id,
                  startDate: updates.startDate || new Date(),
                  endDate: updates.endDate || new Date(),
                  status: updates.status || 'not-started',
                  color: updates.color || '#3B82F6'
                });
              }
            }
            setShowCardModal(false);
            setSelectedCard(null);
          }}
          onCancel={() => {
            setShowCardModal(false);
            setSelectedCard(null);
          }}
        />
        
        {/* Swimlane Editor Modal */}
        <CategoryEditorModal 
          isOpen={showSwimlaneModal}
          swimlane={selectedSwimlane}
          onSave={(updates) => {
            if (selectedSwimlane) {
              updateSwimlane(selectedSwimlane.id, updates);
            } else {
              // Create new main category - no parentId creates a main category
              addSwimlane(updates.title || 'New Main Category');
            }
            setShowSwimlaneModal(false);
            setSelectedSwimlane(null);
          }}
          onCancel={() => {
            setShowSwimlaneModal(false);
            setSelectedSwimlane(null);
          }}
        />
        
        {/* Milestone Editor Modal */}
        <MilestoneEditorModal 
          isOpen={showMilestoneModal}
          milestone={selectedMilestone}
          swimlanes={plan.swimlanes}
          onSave={(updates) => {
            if (selectedMilestone) {
              updateMilestone(selectedMilestone.id, updates);
            } else {
              // Create new milestone
              addMilestone({
                ...updates,
                planId: plan.id,
                title: updates.title || 'New Milestone',
                date: updates.date || new Date(),
                color: updates.color || '#F59E0B'
              });
            }
            setShowMilestoneModal(false);
            setSelectedMilestone(null);
          }}
          onCancel={() => {
            setShowMilestoneModal(false);
            setSelectedMilestone(null);
          }}
        />
        
        {/* Text Properties Modal */}
        <TextPropertiesModal 
          isOpen={showTextModal}
          textElement={selectedText}
          onSave={(updates) => {
            if (selectedText) {
              // Update existing text
              updateTextElement(selectedText.id, updates);
            } else {
              // Create new text with all properties at once
              addTextElement({ x: 400, y: 200 }, updates);
            }
            setShowTextModal(false);
            setSelectedText(null);
          }}
          onCancel={() => {
            setShowTextModal(false);
            setSelectedText(null);
          }}
          onDelete={selectedText ? () => {
            deleteTextElement(selectedText.id);
            setShowTextModal(false);
            setSelectedText(null);
          } : undefined}
        />
        
        {/* Shape Properties Modal */}
        <ShapePropertiesModal 
          isOpen={showShapeModal}
          shape={selectedShape}
          onSave={(updates) => {
            if (selectedShape) {
              // Update existing shape
              updateShape(selectedShape.id, updates);
            } else {
              // Create new shape at center of timeline viewport with all user properties
              if (updates.shapeType) {
                addShape(updates.shapeType, { x: 400, y: 200 }, updates);
              }
            }
            setShowShapeModal(false);
            setSelectedShape(null);
          }}
          onCancel={() => {
            setShowShapeModal(false);
            setSelectedShape(null);
          }}
          onDelete={selectedShape ? () => {
            deleteShape(selectedShape.id);
            setShowShapeModal(false);
            setSelectedShape(null);
          } : undefined}
        />
        
        {/* Save As Modal */}
        <SaveAsModal 
          isOpen={showSaveAsModal}
          currentPlanName={plan.name || plan.title.toLowerCase().replace(/[^a-z0-9\s-]/g, '').replace(/\s+/g, '-').replace(/-+/g, '-').replace(/^-|-$/g, '')}
          onSave={async (newName) => {
            try {
              await saveAsNewPlan(newName, plan.title);
              setShowSaveAsModal(false);
            } catch (error) {
              // Error is handled by the store, modal stays open to show error
              console.error('Failed to save as new plan:', error);
            }
          }}
          onCancel={() => setShowSaveAsModal(false)}
        />

        {/* Export Modal */}
        <ExportModal 
          isOpen={showExportModal}
          onClose={() => setShowExportModal(false)}
          onExport={handleExportPlan}
        />

        {/* Plans Library Modal */}
        <PlansLibraryModal 
          isOpen={showPlansLibraryModal}
          onClose={() => setShowPlansLibraryModal(false)}
          onSelectPlan={handleSwitchToPlan}
          onCreateNew={() => {
            setShowPlansLibraryModal(false);
            setShowNewPlanModal(true);
          }}
        />

        {/* New Plan Modal */}
        <NewPlanModal 
          isOpen={showNewPlanModal}
          onClose={() => setShowNewPlanModal(false)}
          onCreate={handleCreatePlan}
        />

        {/* Unsaved Changes Modal */}
        <UnsavedChangesModal 
          isOpen={showUnsavedChangesModal}
          onSave={handleSaveChanges}
          onDiscard={handleDiscardChanges}
          onCancel={handleCancelUnsavedChanges}
          planTitle={plan.title}
          action={unsavedChangesAction}
        />
      </div>
    </DndProvider>
  );
};

export default TimelineContainer;