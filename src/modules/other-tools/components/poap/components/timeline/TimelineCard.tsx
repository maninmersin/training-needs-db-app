import React, { useState, useRef, useCallback } from 'react';
import type { Card } from '../../types';
import { usePlanStore } from '../../state/usePlanStore';
import { useDraggable } from '@dnd-kit/core';
import { useTimelineCalculations } from './hooks/useTimelineCalculations';
import CardEditorModal from '../CardEditorModal';
import './timeline.css';

interface TimelineCardProps {
  card: Card;
  style?: React.CSSProperties;
  timeline?: any; // Timeline config for date calculations
  timelineWidth?: number; // Dynamic timeline width for consistent calculations
  onResize?: (cardId: string, startDate: Date, endDate: Date) => void;
}

const TimelineCard: React.FC<TimelineCardProps> = ({ card, style, timeline, timelineWidth, onResize }) => {
  const { updateCard, resizeCard } = usePlanStore();
  const { TIMELINE_WIDTH_PX, getDateFromPixel } = useTimelineCalculations(timeline, timelineWidth);
  const [showModal, setShowModal] = useState(false);
  const [isHovering, setIsHovering] = useState(false);
  const [isResizing, setIsResizing] = useState(false);
  const [resizeType, setResizeType] = useState<'start' | 'end' | null>(null);
  const cardRef = useRef<HTMLDivElement>(null);
  
  // Preview state for real-time visual feedback during resize
  const [previewStartDate, setPreviewStartDate] = useState<Date | null>(null);
  const [previewEndDate, setPreviewEndDate] = useState<Date | null>(null);

  // Calculate preview position for real-time visual feedback
  const { getCardPixelPosition } = useTimelineCalculations(timeline);
  const getPreviewPosition = () => {
    if (!isResizing || !previewStartDate || !previewEndDate) {
      return null;
    }
    return getCardPixelPosition(previewStartDate, previewEndDate);
  };
  

  // Make card draggable (completely disabled when resizing)
  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    isDragging,
  } = useDraggable({
    id: card.id,
    data: {
      type: 'card',
      card: card,
      isResizing: isResizing, // Pass resize state to prevent drag overlay
    },
    disabled: isResizing, // Disable drag when resizing
  });

  const handleDoubleClick = () => {
    setShowModal(true);
  };

  const handleSaveCard = (updates: Partial<Card>) => {
    updateCard(card.id, updates);
    setShowModal(false);
  };

  const handleCancelEdit = () => {
    setShowModal(false);
  };

  // Handle resize start
  const handleResizeStart = useCallback((type: 'start' | 'end', event: React.MouseEvent) => {
    event.preventDefault();
    event.stopPropagation(); // Prevent card drag from starting
    
    if (!timeline || !cardRef.current) {
      return;
    }
    
    setIsResizing(true);
    setResizeType(type);
    
    const originalStartDate = new Date(card.startDate);
    const originalEndDate = new Date(card.endDate);
    
    // Get timeline container bounds for proper calculations
    const timelineTrack = cardRef.current.closest('.swimlane-track');
    if (!timelineTrack) {
      setIsResizing(false);
      return;
    }
    
    const trackRect = timelineTrack.getBoundingClientRect();
    
    // Convert mouse position to date using pixel-perfect timeline system
    const mouseToDate = (mouseX: number): Date => {
      const relativeX = mouseX - trackRect.left; // Get pixel offset from left edge
      const clampedX = Math.max(0, Math.min(TIMELINE_WIDTH_PX, relativeX)); // Clamp to timeline width
      
      // Round to nearest pixel for better precision
      const roundedX = Math.round(clampedX);
      return getDateFromPixel(roundedX);
    };
    
    const handleMouseMove = (e: MouseEvent) => {
      e.preventDefault();
      e.stopPropagation();
      
      const newDate = mouseToDate(e.clientX);
      
      let newStartDate = originalStartDate;
      let newEndDate = originalEndDate;
      
      if (type === 'start') {
        // Adjust start date, keep end date fixed
        newStartDate = newDate;
        
        // Prevent start date from going beyond end date (minimum 1 day)
        const minStartDate = new Date(originalEndDate.getTime() - 24 * 60 * 60 * 1000);
        if (newStartDate > minStartDate) {
          newStartDate = minStartDate;
        }
        
        // Keep end date unchanged
        newEndDate = originalEndDate;
      } else {
        // Adjust end date, keep start date fixed  
        newEndDate = newDate;
        
        // Prevent end date from going before start date (minimum 1 day)
        const minEndDate = new Date(originalStartDate.getTime() + 24 * 60 * 60 * 1000);
        if (newEndDate < minEndDate) {
          newEndDate = minEndDate;
        }
        
        // Keep start date unchanged
        newStartDate = originalStartDate;
      }
      
      // Update preview state for real-time visual feedback
      setPreviewStartDate(newStartDate);
      setPreviewEndDate(newEndDate);
    };
    
    const handleMouseUp = (e: MouseEvent) => {
      e.preventDefault();
      e.stopPropagation();
      
      const finalDate = mouseToDate(e.clientX);
      
      let finalStartDate = originalStartDate;
      let finalEndDate = originalEndDate;
      
      if (type === 'start') {
        finalStartDate = finalDate;
        finalEndDate = originalEndDate; // Keep end date unchanged
      } else {
        finalEndDate = finalDate;
        finalStartDate = originalStartDate; // Keep start date unchanged
      }
      
      // Apply the resize
      if (onResize) {
        onResize(card.id, finalStartDate, finalEndDate);
      } else {
        resizeCard(card.id, finalStartDate, finalEndDate);
      }
      
      // Note: Component will re-render with updated card data from store
      
      setIsResizing(false);
      setResizeType(null);
      setPreviewStartDate(null);
      setPreviewEndDate(null);
      document.removeEventListener('mousemove', handleMouseMove);
      document.removeEventListener('mouseup', handleMouseUp);
    };
    
    document.addEventListener('mousemove', handleMouseMove);
    document.addEventListener('mouseup', handleMouseUp);
  }, [card.startDate, card.endDate, card.id, timeline, onResize, resizeCard]);

  const handleMouseEnter = () => setIsHovering(true);
  const handleMouseLeave = () => setIsHovering(false);

  const getStatusColor = () => {
    switch (card.status) {
      case 'completed':
        return '#10b981'; // green
      case 'in-progress':
        return '#3b82f6'; // blue
      case 'blocked':
        return '#ef4444'; // red
      default:
        return '#6b7280'; // gray
    }
  };

  // Apply preview dimensions during resize for real-time visual feedback
  const previewPosition = getPreviewPosition();
  const cardStyle: React.CSSProperties = {
    ...style,
    // Use preview position during resize, otherwise use original style
    ...(previewPosition && isResizing ? {
      left: `${previewPosition.left}px`,
      width: `${previewPosition.width}px`
    } : {}),
    backgroundColor: card.backgroundColor || card.color || getStatusColor(),
    color: card.textColor || 'white',
    fontSize: card.fontSize ? `${card.fontSize}px` : '12px',
    fontWeight: card.fontWeight || '500',
    fontFamily: card.fontFamily || 'inherit',
    // Only apply transform when NOT resizing
    transform: (transform && !isResizing) ? `translate3d(${transform.x}px, ${transform.y}px, 0)` : undefined,
    opacity: isDragging ? 0.5 : 1,
    cursor: isDragging ? 'grabbing' : 'grab',
    zIndex: isDragging ? 1000 : (isResizing ? 1001 : 10), // Higher z-index during resize
    // Add visual feedback during resize
    boxShadow: isResizing ? '0 0 0 2px rgba(59, 130, 246, 0.5)' : undefined, // Blue outline during resize
    transition: isResizing ? 'none' : 'all 0.2s ease', // Disable transitions during resize for immediate feedback
  };


  return (
    <>
        <div
          ref={(node) => {
            setNodeRef(node);
            cardRef.current = node;
          }}
          className="timeline-card hover:shadow-md transition-shadow duration-200"
          style={{
            ...cardStyle,
            position: 'relative', // Ensure relative positioning for absolute children
            cursor: isResizing ? 'default' : cardStyle.cursor, // Override cursor during resize
          }}
          onDoubleClick={handleDoubleClick}
          onMouseEnter={handleMouseEnter}
          onMouseLeave={handleMouseLeave}
          {...(!isResizing ? listeners : {})} // Only apply drag listeners when not resizing
          {...(!isResizing ? attributes : {})} // Only apply drag attributes when not resizing
        >
          <div className="w-full" style={{ textAlign: card.textAlign || 'left' }}>
            <span className="block">{card.title}</span>
          </div>

          {/* Card Milestone - positioned by date */}
          {card.milestone && (() => {
            // Calculate milestone position relative to card
            const cardStartTime = card.startDate.getTime();
            const cardEndTime = card.endDate.getTime();
            const milestoneTime = card.milestone.date.getTime();
            
            // Calculate relative position within the card (0 to 1)
            let relativePosition = 0.5; // Default to center if outside range
            if (milestoneTime >= cardStartTime && milestoneTime <= cardEndTime) {
              relativePosition = (milestoneTime - cardStartTime) / (cardEndTime - cardStartTime);
            } else if (milestoneTime < cardStartTime) {
              relativePosition = 0; // Before card start
            } else {
              relativePosition = 1; // After card end
            }
            
            // Calculate pixel position (percentage of card width)
            const leftPercentage = relativePosition * 100;
            
            return (
              <div 
                className="absolute -top-8 transform -translate-x-1/2 z-50"
                style={{ left: `${leftPercentage}%` }}
                title={`Milestone: ${card.milestone.title} (${card.milestone.date.toLocaleDateString()})`}
              >
                <div 
                  className="milestone-marker" 
                  style={{ borderTopColor: card.milestone.color }}
                >
                  <div 
                    className="milestone-label text-xs"
                    style={{ 
                      backgroundColor: card.milestone.color,
                      padding: '2px 4px',
                      fontSize: '10px',
                      whiteSpace: 'nowrap'
                    }}
                  >
                    {card.milestone.title}
                  </div>
                </div>
              </div>
            );
          })()}

          {/* Resize Handles - show on hover */}
          {isHovering && !isDragging && (
            <>
              {/* Left resize handle - adjusts start date */}
              <div
                className="absolute cursor-ew-resize flex items-center justify-center hover:bg-white hover:bg-opacity-30 transition-colors"
                style={{
                  left: '-3px',
                  top: '0px',
                  bottom: '0px', 
                  width: '6px',
                  zIndex: 1002,
                  backgroundColor: 'rgba(255, 255, 255, 0.2)',
                  pointerEvents: 'all',
                }}
                onMouseDown={(e) => {
                  e.preventDefault();
                  e.stopPropagation();
                  e.nativeEvent.stopImmediatePropagation();
                  handleResizeStart('start', e);
                }}
                title="Drag to adjust start date"
              >
                <div className="w-1 h-4 bg-white rounded-full opacity-80" />
              </div>
              
              {/* Right resize handle - adjusts end date */}
              <div
                className="absolute cursor-ew-resize flex items-center justify-center hover:bg-white hover:bg-opacity-30 transition-colors"
                style={{
                  right: '-3px',
                  top: '0px',
                  bottom: '0px',
                  width: '6px', 
                  zIndex: 1002,
                  backgroundColor: 'rgba(255, 255, 255, 0.2)',
                  pointerEvents: 'all',
                }}
                onMouseDown={(e) => {
                  e.preventDefault();
                  e.stopPropagation();
                  e.nativeEvent.stopImmediatePropagation();
                  handleResizeStart('end', e);
                }}
                title="Drag to adjust end date"
              >
                <div className="w-1 h-4 bg-white rounded-full opacity-80" />
              </div>
            </>
          )}
          
          {/* Resize feedback */}
          {isResizing && (
            <div className="absolute inset-0 bg-blue-200 bg-opacity-30 border-2 border-blue-400 border-dashed rounded-lg pointer-events-none" />
          )}
        </div>
    
    <CardEditorModal 
      isOpen={showModal}
      card={card}
      onSave={handleSaveCard}
      onCancel={handleCancelEdit}
    />
  </>
  );
};

export default TimelineCard;