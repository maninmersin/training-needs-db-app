import React, { useEffect, useRef } from 'react';
import './UserContextMenu.css';

const UserContextMenu = ({ 
  x, 
  y, 
  visible, 
  onClose, 
  onRemoveFromGroup, 
  onRemoveFromCourse,
  userInfo,
  sessionInfo 
}) => {
  const menuRef = useRef(null);

  useEffect(() => {
    const handleClickOutside = (event) => {
      if (menuRef.current && !menuRef.current.contains(event.target)) {
        onClose();
      }
    };

    const handleKeyDown = (event) => {
      if (event.key === 'Escape') {
        onClose();
      }
    };

    if (visible) {
      document.addEventListener('mousedown', handleClickOutside);
      document.addEventListener('keydown', handleKeyDown);
    }

    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
      document.removeEventListener('keydown', handleKeyDown);
    };
  }, [visible, onClose]);

  if (!visible) return null;

  const handleRemoveFromGroup = () => {
    onRemoveFromGroup(userInfo, sessionInfo);
    onClose();
  };

  const handleRemoveFromCourse = () => {
    onRemoveFromCourse(userInfo, sessionInfo);
    onClose();
  };

  return (
    <div 
      ref={menuRef}
      className="user-context-menu"
      style={{
        position: 'fixed',
        top: y,
        left: x,
        zIndex: 1000
      }}
    >
      <div className="context-menu-header">
        <span className="user-name">{userInfo?.name || `User ${userInfo?.userId}`}</span>
      </div>
      
      <div className="context-menu-items">
        <button 
          className="context-menu-item remove-from-group"
          onClick={handleRemoveFromGroup}
        >
          <span className="menu-icon">👥</span>
          <span className="menu-text">Remove from Group</span>
        </button>
        
        <button 
          className="context-menu-item remove-from-course"
          onClick={handleRemoveFromCourse}
        >
          <span className="menu-icon">📚</span>
          <span className="menu-text">Remove from Course</span>
        </button>
      </div>
    </div>
  );
};

export default UserContextMenu;