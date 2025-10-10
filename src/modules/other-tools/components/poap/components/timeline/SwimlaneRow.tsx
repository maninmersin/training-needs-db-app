import React from 'react';
import type { Plan, Swimlane } from '../../types';
import TimelineCard from './TimelineCard';
import { useTimelineCalculations } from './hooks/useTimelineCalculations';
import { useDroppable } from '@dnd-kit/core';
import './timeline.css';

interface SwimlaneRowProps {
  swimlane: Swimlane;
  plan: Plan;
  weeks: Array<{
    startPixel: number;
    endPixel: number;
    widthPixels: number;
    widthPercent: number;
    label: string;
    start: Date;
    end: Date;
  }>;
  onMilestoneDoubleClick?: (milestone: any) => void;
}

const SwimlaneRow: React.FC<SwimlaneRowProps> = ({ swimlane, plan, weeks }) => {
  const { getCardPixelPosition } = useTimelineCalculations(plan.timeline);
  
  // Generate percentage-based grid columns that match week boundaries
  const getPercentageGridColumns = () => {
    if (!weeks.length) return 'none';
    
    // Create percentage widths for each week column
    const columns = weeks.map(week => `${week.widthPercent}%`).join(' ');
    return columns;
  };

  // Generate grid line percentage positions for rendering as individual elements
  const getGridLinePositions = () => {
    if (!weeks.length) return [];
    
    const positions: number[] = [];
    let cumulativeWidth = 0;
    
    // Calculate percentage positions for vertical grid lines (except after last week)
    for (let i = 0; i < weeks.length - 1; i++) {
      cumulativeWidth += weeks[i].widthPercent;
      positions.push(cumulativeWidth);
    }
    
    return positions;
  };
  
  // Make swimlane droppable
  const { setNodeRef, isOver } = useDroppable({
    id: `swimlane-${swimlane.id}`,
    data: {
      type: 'swimlane',
      swimlane: swimlane,
    },
  });
  
  // Get cards for this swimlane
  const swimlaneCards = plan.cards.filter(card => card.swimlaneId === swimlane.id);
  
  // Calculate the number of rows needed for this swimlane
  const maxRow = Math.max(0, ...swimlaneCards.map(card => card.row || 0));
  const totalRows = maxRow + 1;
  
  // Constants for row calculations
  const ROW_HEIGHT = 60; // Height per row (cards are 36px + spacing) - increased for better separation
  const MIN_HEIGHT = 80; // Minimum swimlane height
  // Calculate total height: ensure minimum height but expand when needed
  const calculatedHeight = totalRows > 1 ? totalRows * ROW_HEIGHT + 20 : MIN_HEIGHT; // Force expansion for multiple rows
  
  // Debug logging
  console.log(`SwimlaneRow ${swimlane.title}:`, {
    swimlaneCards: swimlaneCards.length,
    cardRows: swimlaneCards.map(card => ({ title: card.title, row: card.row || 0 })),
    maxRow,
    totalRows,
    calculatedHeight
  });
  
  

  return (
    <div 
      ref={setNodeRef}
      className={`swimlane-track ${isOver ? 'bg-blue-50 border-blue-200' : ''}`}
      style={{ 
        '--week-columns': getPercentageGridColumns(),
        '--week-count': weeks.length.toString(),
        gridTemplateColumns: getPercentageGridColumns(),
        width: '100%', // Let parent CSS Grid handle the width
        height: `${calculatedHeight}px`,
        minHeight: `${calculatedHeight}px`,
        maxHeight: `${calculatedHeight}px`, // Force exact height
        borderColor: isOver ? '#3b82f6' : undefined,
        borderWidth: isOver ? '2px' : undefined,
        borderStyle: isOver ? 'dashed' : undefined
      } as React.CSSProperties}
    >
      {/* Grid Lines */}
      {getGridLinePositions().map((position, index) => (
        <div
          key={`grid-line-${index}`}
          className="timeline-grid-line"
          style={{ left: `${position}%` }}
        />
      ))}

      {/* Render Cards */}
      {swimlaneCards.map((card) => {
        const position = getCardPixelPosition(card.startDate, card.endDate);
        const cardRow = card.row || 0;
        const topPosition = cardRow * ROW_HEIGHT + (ROW_HEIGHT - 36) / 2 + 4; // Center 36px card within ROW_HEIGHT + 4px visual adjustment
        
        return (
          <TimelineCard
            key={card.id}
            card={card}
            timeline={plan.timeline}
            style={{
              left: `${position.left}px`,
              width: `${position.width}px`,
              top: `${topPosition}px`,
              height: `36px`, // Fixed card height for consistency
            }}
          />
        );
      })}

    </div>
  );
};

export default SwimlaneRow;