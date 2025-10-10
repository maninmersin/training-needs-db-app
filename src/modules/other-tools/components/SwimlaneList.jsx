import React from 'react';

const SwimlaneList = ({ plan, onMilestoneDoubleClick }) => {
  return (
    <div className="swimlanes-list">
      {plan.swimlanes.map(swimlane => (
        <div key={swimlane.id} className="swimlane-row">
          <div 
            className="swimlane-header" 
            style={{ 
              backgroundColor: swimlane.backgroundColor,
              color: swimlane.textColor 
            }}
          >
            <span>{swimlane.title}</span>
          </div>
          <div className="swimlane-content">
            {plan.cards
              .filter(card => card.swimlaneId === swimlane.id)
              .map(card => (
                <div
                  key={card.id}
                  className="timeline-card"
                  style={{ backgroundColor: card.color }}
                >
                  <div className="card-title">{card.title}</div>
                  <div className="card-description">{card.description}</div>
                </div>
              ))}
          </div>
        </div>
      ))}
    </div>
  );
};

export default SwimlaneList;