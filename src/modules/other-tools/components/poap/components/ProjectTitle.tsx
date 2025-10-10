import React, { useState } from 'react';
import { usePlanStore } from '../state/usePlanStore';

interface ProjectTitleProps {
  title: string;
}

export default function ProjectTitle({ title }: ProjectTitleProps) {
  const [isEditing, setIsEditing] = useState(false);
  const [editTitle, setEditTitle] = useState(title);
  const { updatePlanTitle } = usePlanStore();
  
  const handleSave = () => {
    if (editTitle.trim()) {
      updatePlanTitle(editTitle.trim());
      setIsEditing(false);
    }
  };
  
  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter') {
      handleSave();
    } else if (e.key === 'Escape') {
      setEditTitle(title);
      setIsEditing(false);
    }
  };
  
  const handleBlur = () => {
    handleSave();
  };
  
  const handleClick = () => {
    setIsEditing(true);
  };
  
  return (
    <div className="project-title">
      {isEditing ? (
        <input
          type="text"
          value={editTitle}
          onChange={(e) => setEditTitle(e.target.value)}
          onKeyDown={handleKeyDown}
          onBlur={handleBlur}
          autoFocus
          className="text-xl font-bold text-gray-800 bg-transparent border-b border-blue-500 focus:outline-none"
        />
      ) : (
        <h1 
          className="text-xl font-bold text-gray-800 cursor-pointer hover:text-blue-600"
          onClick={handleClick}
        >
          {title}
        </h1>
      )}
    </div>
  );
}