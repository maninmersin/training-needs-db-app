import React from 'react';

// Simple wrapper component - in full implementation would use @dnd-kit
const DndProvider = ({ children }) => {
  return <div className="dnd-provider">{children}</div>;
};

export default DndProvider;