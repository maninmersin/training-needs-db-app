import React, { useState } from 'react';

interface SwimlaneProps {
  id: string;
  title: string;
  order: number;
  color?: string;
  isCollapsed: boolean;
  parentId?: string;
  level: number;
  hasChildren?: boolean;
  onUpdate: (id: string, updates: { title?: string; color?: string }) => void;
  onDelete: (id: string) => void;
  onAddChild?: (parentId: string) => void;
  onToggleCollapse?: (id: string) => void;
}

export default function Swimlane({ 
  id, 
  title, 
  order, 
  color, 
  isCollapsed, 
  parentId,
  level,
  hasChildren,
  onUpdate, 
  onDelete,
  onAddChild,
  onToggleCollapse
}: SwimlaneProps) {
  const [isEditing, setIsEditing] = useState(false);
  const [editedTitle, setEditedTitle] = useState(title);
  const [showMenu, setShowMenu] = useState(false);

  const handleSave = () => {
    if (editedTitle.trim()) {
      onUpdate(id, { title: editedTitle.trim() });
      setIsEditing(false);
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter') {
      handleSave();
    } else if (e.key === 'Escape') {
      setEditedTitle(title);
      setIsEditing(false);
    }
  };

  const handleBlur = () => {
    handleSave();
  };

  const handleColorChange = (newColor: string) => {
    onUpdate(id, { color: newColor });
    setShowMenu(false);
  };

  const defaultColors = [
    '#3B82F6', // blue
    '#10B981', // green
    '#F59E0B', // amber
    '#EF4444', // red
    '#8B5CF6', // violet
    '#EC4899', // pink
  ];

  return (
    <div className="border-b last:border-b-0" style={{ borderColor: '#E0E0E0' }}>
      <div 
        className={`flex items-center justify-between cursor-pointer hover:bg-gray-50 transition-colors ${
          isCollapsed ? 'bg-gray-50' : ''
        }`}
        style={{ paddingLeft: `${12 + (level * 20)}px`, paddingRight: '12px', paddingTop: '12px', paddingBottom: '12px' }}
      >
        <div className="flex items-center flex-1">
          {/* Hierarchy controls */}
          <div className="flex items-center mr-2">
            {hasChildren && (
              <button
                onClick={() => onToggleCollapse?.(id)}
                className="p-1 text-gray-400 hover:text-gray-600 hover:bg-gray-200 rounded mr-1"
                title={isCollapsed ? 'Expand' : 'Collapse'}
              >
                <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  {isCollapsed ? (
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                  ) : (
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                  )}
                </svg>
              </button>
            )}
            
            {level > 0 && !hasChildren && (
              <div className="w-4 h-4 mr-1 flex items-center justify-center">
                <div className="w-2 h-2 rounded-full bg-gray-300"></div>
              </div>
            )}
          </div>
          
          {/* Miro-style colored badge */}
          <div 
            className="px-2 py-1 rounded text-xs font-medium mr-3"
            style={{ 
              backgroundColor: color || (level === 0 ? '#FCE588' : '#E5E7EB'),
              color: '#333'
            }}
          >
            {level === 0 ? (order + 1) : '•'}
          </div>
          
          {isEditing ? (
            <input
              type="text"
              value={editedTitle}
              onChange={(e) => setEditedTitle(e.target.value)}
              onBlur={handleBlur}
              onKeyDown={handleKeyDown}
              className="flex-1 bg-transparent border-b border-gray-300 focus:outline-none focus:border-blue-500 px-1 text-sm font-medium"
              autoFocus
            />
          ) : (
            <h3 
              className={`text-gray-900 flex-1 text-sm ${
                level === 0 ? 'font-semibold' : 'font-medium'
              }`}
              onClick={() => setIsEditing(true)}
            >
              {title}
            </h3>
          )}
        </div>
        
        <div className="flex items-center space-x-1">
          {level === 0 && onAddChild && (
            <button
              onClick={() => onAddChild(id)}
              className="p-1 text-gray-400 hover:text-blue-600 hover:bg-blue-50 rounded"
              title="Add sub-task"
            >
              <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 6v6m0 0v6m0-6h6m-6 0H6" />
              </svg>
            </button>
          )}
          
          <button
            onClick={() => setShowMenu(!showMenu)}
            className="p-1 text-gray-400 hover:text-gray-600 hover:bg-gray-100 rounded"
            title="More options"
          >
            <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 5v.01M12 12v.01M12 19v.01M12 6a1 1 0 110-2 1 1 0 010 2zm0 7a1 1 0 110-2 1 1 0 010 2zm0 7a1 1 0 110-2 1 1 0 010 2z" />
            </svg>
          </button>
          
          <button
            onClick={() => onDelete(id)}
            className="p-1 text-gray-400 hover:text-red-600 hover:bg-gray-100 rounded"
            title="Delete swimlane"
          >
            <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
            </svg>
          </button>
        </div>
      </div>
      
      {showMenu && (
        <div className="absolute bg-white shadow-lg rounded-md py-1 z-10 border border-gray-200">
          <div className="px-3 py-2 text-xs text-gray-500 font-medium">Color</div>
          <div className="flex px-2 pb-2">
            {defaultColors.map((colorOption) => (
              <button
                key={colorOption}
                onClick={() => handleColorChange(colorOption)}
                className={`w-6 h-6 rounded-full mx-1 ${
                  color === colorOption ? 'ring-2 ring-offset-2 ring-gray-400' : ''
                }`}
                style={{ backgroundColor: colorOption }}
                title={colorOption}
              />
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
