import React, { useState } from 'react';
import { DndContext, DragOverlay, closestCenter, PointerSensor, useSensor, useSensors } from '@dnd-kit/core';
import type { DragEndEvent, DragStartEvent } from '@dnd-kit/core';
import type { Card } from '../types';
import { usePlanStore } from '../state/usePlanStore';
import { useTimelineCalculations } from './timeline/hooks/useTimelineCalculations';

interface DndProviderProps {
  children: React.ReactNode;
}

export default function DndProvider({ children }: DndProviderProps) {
  const { 
    currentPlan,
    moveCard, 
    updateMilestone, 
    setSelectedElement,
    snapToGrid,
    gridSize 
  } = usePlanStore();
  
  const [activeCard, setActiveCard] = useState<Card | null>(null);
  
  // Get timeline calculations for position-to-date conversion
  // Always call the hook, but with fallback values when no plan
  const timelineCalculations = useTimelineCalculations(
    currentPlan?.timeline || { 
      startDate: new Date(), 
      endDate: new Date(), 
      scale: 'weeks', 
      showGrid: true, 
      snapToGrid: true 
    }
  );
  
  const sensors = useSensors(
    useSensor(PointerSensor, {
      activationConstraint: {
        distance: 8,
      },
    })
  );
  
  const handleDragStart = (event: DragStartEvent) => {
    const { active } = event;
    
    setSelectedElement({ 
      type: active.data.current?.type as 'card' | 'milestone' | 'swimlane', 
      id: active.id.toString() 
    });
    
    // Set active card for drag overlay (but only for actual dragging, not resizing)
    if (active.data.current?.type === 'card' && !active.data.current?.isResizing) {
      setActiveCard(active.data.current.card);
    }
  };
  
  const handleDragEnd = (event: DragEndEvent) => {
    const { active, over, delta } = event;
    
    const activeType = active.data.current?.type;
    const activeId = active.id.toString();
    
    if (activeType === 'card' && over && currentPlan) {
      const overType = over.data.current?.type;
      
      if (overType === 'swimlane') {
        // Card dropped on a swimlane - calculate new position and dates
        const targetSwimlaneId = over.data.current?.swimlane?.id;
        const originalCard = active.data.current?.card as Card;
        
        if (targetSwimlaneId && originalCard) {
          // Calculate the horizontal movement (timeline position change)
          const timelineOffset = delta.x; // Horizontal delta represents timeline movement
          
          // Calculate card duration to maintain it after move
          const cardDuration = originalCard.endDate.getTime() - originalCard.startDate.getTime();
          
          // Calculate new start date based on timeline offset
          const currentStartPixel = timelineCalculations.getPixelPosition(originalCard.startDate);
          const newStartPixel = currentStartPixel + timelineOffset;
          
          // Clamp to timeline boundaries
          const clampedStartPixel = Math.max(0, Math.min(timelineCalculations.TIMELINE_WIDTH_PX, newStartPixel));
          
          // Convert back to dates
          const newStartDate = timelineCalculations.getDateFromPixel(clampedStartPixel);
          const newEndDate = new Date(newStartDate.getTime() + cardDuration);
          
          // Ensure end date doesn't exceed timeline end
          const timelineEndDate = currentPlan!.timeline.endDate;
          const finalEndDate = newEndDate > timelineEndDate ? timelineEndDate : newEndDate;
          const finalStartDate = new Date(finalEndDate.getTime() - cardDuration);
          
          // Move card with new dates
          moveCard(activeId, targetSwimlaneId, finalStartDate, finalEndDate);
        }
      }
    } else if (activeType === 'milestone') {
      // Handle milestone movement
      const currentPosition = active.data.current?.position || { x: 0, y: 0 };
      const newPosition = {
        x: snapToGrid ? Math.round((currentPosition.x + delta.x) / gridSize) * gridSize : currentPosition.x + delta.x,
        y: snapToGrid ? Math.round((currentPosition.y + delta.y) / gridSize) * gridSize : currentPosition.y + delta.y
      };
      
      // Ensure position is within bounds
      newPosition.x = Math.max(0, newPosition.x);
      newPosition.y = Math.max(0, newPosition.y);
      
      updateMilestone(activeId, { position: newPosition });
    }
    
    // Reset state
    setSelectedElement(null);
    setActiveCard(null);
  };
  
  return (
    <DndContext
      sensors={sensors}
      collisionDetection={closestCenter}
      onDragStart={handleDragStart}
      onDragEnd={handleDragEnd}
    >
      {children}
      <DragOverlay>
        {activeCard && (
          <div
            className="timeline-card shadow-lg"
            style={{
              backgroundColor: activeCard.backgroundColor || activeCard.color,
              color: activeCard.textColor || 'white',
              fontSize: activeCard.fontSize ? `${activeCard.fontSize}px` : '12px',
              fontWeight: activeCard.fontWeight || '500',
              fontFamily: activeCard.fontFamily || 'inherit',
              opacity: 0.8,
              cursor: 'grabbing',
            }}
          >
            <span className="truncate">{activeCard.title}</span>
            <div className="text-xs opacity-75 ml-2">
              - {Math.ceil((activeCard.endDate.getTime() - activeCard.startDate.getTime()) / (1000 * 60 * 60 * 24 * 7))}w
            </div>
          </div>
        )}
      </DragOverlay>
    </DndContext>
  );
}