import React, { useState } from 'react';
import type { Plan, Swimlane } from '../../types';
import SwimlaneRow from './SwimlaneRow';
import { useTimelineCalculations } from './hooks/useTimelineCalculations';
import { usePlanStore } from '../../state/usePlanStore';
import CategoryEditorModal from '../CategoryEditorModal';
import './timeline.css';

interface SwimlaneListProps {
  plan: Plan;
  onMilestoneDoubleClick?: (milestone: any) => void;
}

const SwimlaneList: React.FC<SwimlaneListProps> = ({ plan, onMilestoneDoubleClick }) => {
  const { weeks, getDatePixelPosition } = useTimelineCalculations(plan.timeline);
  const { updateSwimlane } = usePlanStore();
  const [showSwimlaneModal, setShowSwimlaneModal] = useState(false);
  const [selectedSwimlane, setSelectedSwimlane] = useState<Swimlane | null>(null);

  // Generate percentage-based grid columns that match week boundaries
  const getPercentageGridColumns = () => {
    if (!weeks.length) return 'none';
    
    // Create percentage widths for each week column
    const columns = weeks.map(week => `${week.widthPercent}%`).join(' ');
    return columns;
  };

  // Generate percentage positions for grid lines to match header week boundaries
  const getGridLinePositions = () => {
    if (!weeks.length) return '';
    
    // Calculate cumulative percentage positions for vertical grid lines
    // Each line should appear at the end of each week (except the last one)
    const positions: string[] = [];
    let cumulativeWidth = 0;
    
    for (let i = 0; i < weeks.length - 1; i++) {
      cumulativeWidth += weeks[i].widthPercent;
      positions.push(`${cumulativeWidth}%`);
    }
    
    return positions.join(',');
  };

  // Generate grid line percentage positions for rendering as individual elements
  const getGridLineElementPositions = () => {
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

  // Sort swimlanes by order
  const sortedSwimlanes = [...plan.swimlanes].sort((a, b) => a.order - b.order);

  // Helper function to calculate swimlane height
  const calculateSwimlaneHeight = (swimlane: Swimlane) => {
    const swimlaneCards = plan.cards.filter(card => card.swimlaneId === swimlane.id);
    const maxRow = Math.max(0, ...swimlaneCards.map(card => card.row || 0));
    const totalRows = maxRow + 1;
    const ROW_HEIGHT = 60; // Height per row (cards are 36px + spacing) - increased for better separation
    const MIN_HEIGHT = 80; // Minimum swimlane height
    // Calculate total height: ensure minimum height but expand when needed
    const height = totalRows > 1 ? totalRows * ROW_HEIGHT + 20 : MIN_HEIGHT; // Force expansion for multiple rows
    
    // Debug logging
    console.log(`SwimlaneList ${swimlane.title} height calculation:`, {
      swimlaneCards: swimlaneCards.length,
      cardRows: swimlaneCards.map(card => ({ title: card.title, row: card.row || 0 })),
      maxRow,
      totalRows,
      calculatedHeight: height
    });
    
    return height;
  };

  // Group swimlanes by main categories
  const groupedSwimlanes = sortedSwimlanes.reduce((groups, swimlane) => {
    if (swimlane.isMainCategory) {
      // Main category
      groups.push({
        mainCategory: swimlane,
        subCategories: []
      });
    } else if (swimlane.parentId) {
      // Sub-category - find its parent group
      const parentGroup = groups.find(g => g.mainCategory.id === swimlane.parentId);
      if (parentGroup) {
        parentGroup.subCategories.push(swimlane);
      }
    }
    return groups;
  }, [] as Array<{ mainCategory: Swimlane; subCategories: Swimlane[] }>);

  // Handle double-click on swimlane label
  const handleSwimlaneDoubleClick = (swimlane: Swimlane) => {
    setSelectedSwimlane(swimlane);
    setShowSwimlaneModal(true);
  };

  // Handle swimlane save
  const handleSaveSwimlane = (updates: Partial<Swimlane>) => {
    if (selectedSwimlane) {
      updateSwimlane(selectedSwimlane.id, updates);
    }
    setShowSwimlaneModal(false);
    setSelectedSwimlane(null);
  };

  // Handle modal cancel
  const handleCancelSwimlane = () => {
    setShowSwimlaneModal(false);
    setSelectedSwimlane(null);
  };


  return (
    <div className="swimlanes-container">
      {/* Swimlane Labels Column */}
      <div className="swimlane-labels">
        {groupedSwimlanes.length === 0 ? (
          <div className="swimlane-label text-gray-400 italic">
            No swimlanes yet
          </div>
        ) : (
          groupedSwimlanes.map((group) => (
            <div key={group.mainCategory.id} className="swimlane-group">
              {/* Main Category - spans height of all sub-categories */}
              <div 
                className="main-category-label cursor-pointer hover:bg-opacity-80 transition-colors flex items-center justify-center relative"
                onDoubleClick={() => handleSwimlaneDoubleClick(group.mainCategory)}
                title="Double-click to edit main category"
                style={{
                  backgroundColor: group.mainCategory.backgroundColor,
                  color: group.mainCategory.textColor,
                  fontSize: group.mainCategory.fontSize ? `${group.mainCategory.fontSize}px` : '14px',
                  fontWeight: group.mainCategory.fontWeight,
                  fontFamily: group.mainCategory.fontFamily,
                  height: `${group.subCategories.length > 0 
                    ? group.subCategories.reduce((total, subCat) => total + calculateSwimlaneHeight(subCat), 0)
                    : 80}px`,
                  writingMode: 'vertical-rl',
                  textOrientation: 'mixed'
                }}
              >
                <div className="font-semibold transform rotate-180">
                  {group.mainCategory.title}
                </div>
                
              </div>
              
              {/* Sub-categories */}
              <div className="sub-categories">
                {group.subCategories.length > 0 ? (
                  group.subCategories.map((subCategory) => {
                    const subCategoryHeight = calculateSwimlaneHeight(subCategory);
                    return (
                      <div 
                        key={subCategory.id}
                        className="sub-category-label cursor-pointer hover:bg-opacity-80 transition-colors relative"
                        onDoubleClick={() => handleSwimlaneDoubleClick(subCategory)}
                        title="Double-click to edit sub-category"
                        style={{
                          backgroundColor: subCategory.backgroundColor,
                          color: subCategory.textColor,
                          fontSize: subCategory.fontSize ? `${subCategory.fontSize}px` : '12px',
                          fontWeight: subCategory.fontWeight,
                          fontFamily: subCategory.fontFamily,
                          height: `${subCategoryHeight}px`,
                          minHeight: `${subCategoryHeight}px`,
                          maxHeight: `${subCategoryHeight}px`, // Force exact height
                          display: 'flex',
                          alignItems: 'center',
                          paddingLeft: '12px',
                        }}
                      >
                        <div>
                          <div className="font-medium">{subCategory.title}</div>
                          {subCategory.subtitle && (
                            <div className="text-xs opacity-75 mt-1">{subCategory.subtitle}</div>
                          )}
                        </div>
                        
                      </div>
                    );
                  })
                ) : (
                  <div className="sub-category-label text-gray-400 italic h-20 flex items-center px-3">
                    No sub-categories
                  </div>
                )}
              </div>
            </div>
          ))
        )}
      </div>

      {/* Swimlane Content Column */}
      <div className="swimlane-content" style={{ 
        '--week-count': weeks.length.toString(),
        '--grid-line-positions': getGridLinePositions(),
        width: '100%' // Let CSS Grid 1fr handle the width
      } as React.CSSProperties}>
        {groupedSwimlanes.length === 0 ? (
          <div className="swimlane-track" style={{ 
            '--week-columns': getPercentageGridColumns(),
            '--week-count': weeks.length.toString(),
            gridTemplateColumns: getPercentageGridColumns(),
            width: '100%' // Let parent CSS Grid handle the width
          } as React.CSSProperties}>
            {/* Grid Lines */}
            {getGridLineElementPositions().map((position, index) => (
              <div
                key={`grid-line-${index}`}
                className="timeline-grid-line"
                style={{ left: `${position}%` }}
              />
            ))}
            {/* Empty track */}
          </div>
        ) : (
          groupedSwimlanes.map((group) => (
            <div key={group.mainCategory.id} className="main-category-content">
              {/* Render SwimlaneRow for each sub-category */}
              {group.subCategories.length > 0 ? (
                group.subCategories.map((subCategory) => (
                  <SwimlaneRow 
                    key={subCategory.id}
                    swimlane={subCategory} 
                    plan={plan}
                    weeks={weeks}
                    onMilestoneDoubleClick={onMilestoneDoubleClick}
                  />
                ))
              ) : (
                <div className="swimlane-track" style={{ 
                  '--week-columns': getPercentageGridColumns(),
                  '--week-count': weeks.length.toString(),
                  gridTemplateColumns: getPercentageGridColumns(),
                  width: '100%' // Let parent CSS Grid handle the width
                } as React.CSSProperties}>
                  {/* Grid Lines */}
                  {getGridLineElementPositions().map((position, index) => (
                    <div
                      key={`grid-line-${index}`}
                      className="timeline-grid-line"
                      style={{ left: `${position}%` }}
                    />
                  ))}
                  {/* Empty track for main category without sub-categories */}
                </div>
              )}
            </div>
          ))
        )}

        {/* Swimlane Milestones - positioned correctly relative to content */}
        {groupedSwimlanes.map((group, groupIndex) => {
          const milestoneElements: React.ReactElement[] = [];
          let accumulatedHeight = 10; // Starting offset from top (matches padding-top in CSS)
          
          // Calculate accumulated height for each group before this one
          for (let i = 0; i < groupIndex; i++) {
            const prevGroup = groupedSwimlanes[i];
            if (prevGroup.subCategories.length > 0) {
              // Add height of all sub-categories in previous group
              prevGroup.subCategories.forEach(subCat => {
                accumulatedHeight += calculateSwimlaneHeight(subCat);
              });
            } else {
              // Default height for main category without sub-categories
              accumulatedHeight += 80;
            }
            accumulatedHeight += 10; // Gap between groups
          }
          
          // Main category milestone
          if (group.mainCategory.milestone) {
            const xPosition = getDatePixelPosition(group.mainCategory.milestone.date);
            milestoneElements.push(
              <div
                key={`milestone-main-${group.mainCategory.id}`}
                className="absolute pointer-events-auto cursor-pointer"
                style={{
                  left: `${xPosition}px`,
                  top: `${accumulatedHeight - 30}px`, // Position above the group
                  transform: 'translateX(-50%)',
                  zIndex: 50
                }}
                title={`Milestone: ${group.mainCategory.milestone.title} (${group.mainCategory.milestone.date.toLocaleDateString()})`}
              >
                <div 
                  className="milestone-marker" 
                  style={{ borderTopColor: group.mainCategory.milestone.color }}
                >
                  <div 
                    className="milestone-label"
                    style={{ backgroundColor: group.mainCategory.milestone.color }}
                  >
                    {group.mainCategory.milestone.title}
                  </div>
                </div>
              </div>
            );
          }
          
          // Sub-category milestones
          let currentSubCategoryY = accumulatedHeight;
          group.subCategories.forEach((subCategory) => {
            const swimlaneHeight = calculateSwimlaneHeight(subCategory);
            
            if (subCategory.milestone) {
              const xPosition = getDatePixelPosition(subCategory.milestone.date);
              
              milestoneElements.push(
                <div
                  key={`milestone-sub-${subCategory.id}`}
                  className="absolute pointer-events-auto cursor-pointer"
                  style={{
                    left: `${xPosition}px`,
                    top: `${currentSubCategoryY + swimlaneHeight / 2 - 9}px`, // Center in sub-category
                    transform: 'translateX(-50%)',
                    zIndex: 50
                  }}
                  title={`Milestone: ${subCategory.milestone.title} (${subCategory.milestone.date.toLocaleDateString()})`}
                >
                  <div 
                    className="milestone-marker" 
                    style={{ borderTopColor: subCategory.milestone.color }}
                  >
                    <div 
                      className="milestone-label"
                      style={{ backgroundColor: subCategory.milestone.color }}
                    >
                      {subCategory.milestone.title}
                    </div>
                  </div>
                </div>
              );
            }
            currentSubCategoryY += swimlaneHeight;
          });
          
          return milestoneElements;
        }).flat()}

      </div>
      
      {/* Swimlane Editor Modal */}
      <CategoryEditorModal 
        isOpen={showSwimlaneModal}
        swimlane={selectedSwimlane}
        onSave={handleSaveSwimlane}
        onCancel={handleCancelSwimlane}
      />
    </div>
  );
};

export default SwimlaneList;