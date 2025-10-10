import React, { useRef, useEffect, useState, useCallback } from 'react';
import type { TextElement } from '../types';

interface TextBoxProps {
  textElement: TextElement;
  onUpdate: (id: string, updates: Partial<TextElement>) => void;
  onDelete: (id: string) => void;
  onSelect: (id: string | null) => void;
  onStartEdit: (id: string) => void;
  onFinishEdit: (id: string) => void;
}

export default function TextBox({
  textElement,
  onUpdate,
  onDelete,
  onSelect,
  onStartEdit,
  onFinishEdit
}: TextBoxProps) {
  const [isDragging, setIsDragging] = useState(false);
  const [dragStart, setDragStart] = useState({ x: 0, y: 0 });
  const [localContent, setLocalContent] = useState(textElement.content);
  const textRef = useRef<HTMLDivElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);

  // Sync local content when textElement changes (but not during editing)
  useEffect(() => {
    if (!textElement.isEditing) {
      setLocalContent(textElement.content);
    }
  }, [textElement.content, textElement.isEditing]);

  // Handle editing focus
  useEffect(() => {
    if (textElement.isEditing && textRef.current) {
      // Set the initial content directly in the DOM to avoid React re-renders
      textRef.current.textContent = textElement.content;
      textRef.current.focus();
      // Set cursor at end
      setTimeout(() => {
        if (textRef.current) {
          const range = document.createRange();
          const selection = window.getSelection();
          range.selectNodeContents(textRef.current);
          range.collapse(false);
          if (selection) {
            selection.removeAllRanges();
            selection.addRange(range);
          }
        }
      }, 10);
    }
  }, [textElement.isEditing, textElement.content]);

  const handleClick = useCallback((e: React.MouseEvent) => {
    e.stopPropagation();
    if (!textElement.isSelected && !textElement.isEditing) {
      onSelect(textElement.id);
    }
  }, [textElement.isSelected, textElement.isEditing, onSelect, textElement.id]);

  const handleDoubleClick = useCallback((e: React.MouseEvent) => {
    e.stopPropagation();
    if (!textElement.isEditing) {
      onStartEdit(textElement.id);
    }
  }, [textElement.isEditing, onStartEdit, textElement.id]);

  const handleKeyDown = useCallback((e: React.KeyboardEvent) => {
    if (textElement.isEditing) {
      if (e.key === 'Enter' && !e.shiftKey) {
        e.preventDefault();
        handleFinishEditing();
      } else if (e.key === 'Escape') {
        e.preventDefault();
        // Revert content on escape
        setLocalContent(textElement.content);
        onFinishEdit(textElement.id);
      }
    } else if (textElement.isSelected) {
      if (e.key === 'Delete' || e.key === 'Backspace') {
        e.preventDefault();
        onDelete(textElement.id);
      } else if (e.key === 'Enter') {
        e.preventDefault();
        onStartEdit(textElement.id);
      }
    }
  }, [textElement.isEditing, textElement.isSelected, textElement.id, textElement.content, onFinishEdit, onStartEdit, onDelete]);

  const handleInput = useCallback((e: React.FormEvent<HTMLDivElement>) => {
    const target = e.currentTarget;
    const newContent = target.textContent || '';
    setLocalContent(newContent);
    // Don't call onUpdate here - wait until editing finishes
  }, []);

  const handleFinishEditing = useCallback(() => {
    // Update the parent with final content
    onUpdate(textElement.id, { content: localContent });
    onFinishEdit(textElement.id);
  }, [localContent, textElement.id, onUpdate, onFinishEdit]);

  const handleBlur = useCallback(() => {
    if (textElement.isEditing) {
      handleFinishEditing();
    }
  }, [textElement.isEditing, handleFinishEditing]);

  // Mouse drag handling
  const handleMouseDown = useCallback((e: React.MouseEvent) => {
    if (textElement.isEditing) return;
    
    e.preventDefault();
    e.stopPropagation();
    
    setIsDragging(true);
    setDragStart({
      x: e.clientX - textElement.position.x,
      y: e.clientY - textElement.position.y
    });
    
    onSelect(textElement.id);
  }, [textElement.isEditing, textElement.position, textElement.id, onSelect]);

  const handleMouseMove = useCallback((e: MouseEvent) => {
    if (!isDragging) return;
    
    const newX = e.clientX - dragStart.x;
    const newY = e.clientY - dragStart.y;
    
    onUpdate(textElement.id, {
      position: { x: Math.max(0, newX), y: Math.max(0, newY) }
    });
  }, [isDragging, dragStart, textElement.id, onUpdate]);

  const handleMouseUp = useCallback(() => {
    setIsDragging(false);
  }, []);

  // Set up global mouse events for dragging
  useEffect(() => {
    if (isDragging) {
      document.addEventListener('mousemove', handleMouseMove);
      document.addEventListener('mouseup', handleMouseUp);
      return () => {
        document.removeEventListener('mousemove', handleMouseMove);
        document.removeEventListener('mouseup', handleMouseUp);
      };
    }
  }, [isDragging, handleMouseMove, handleMouseUp]);

  // Selection handles
  const renderSelectionHandles = () => {
    if (!textElement.isSelected || textElement.isEditing) return null;

    return (
      <>
        <div className="absolute -top-1 -left-1 w-2 h-2 bg-blue-500 border border-white rounded-sm cursor-nw-resize"></div>
        <div className="absolute -top-1 -right-1 w-2 h-2 bg-blue-500 border border-white rounded-sm cursor-ne-resize"></div>
        <div className="absolute -bottom-1 -left-1 w-2 h-2 bg-blue-500 border border-white rounded-sm cursor-sw-resize"></div>
        <div className="absolute -bottom-1 -right-1 w-2 h-2 bg-blue-500 border border-white rounded-sm cursor-se-resize"></div>
      </>
    );
  };

  return (
    <div
      ref={containerRef}
      className={`
        absolute select-none
        ${isDragging ? 'opacity-70' : 'opacity-100'}
        ${textElement.isEditing ? 'cursor-text' : 'cursor-move'}
      `}
      style={{
        left: `${textElement.position.x}px`,
        top: `${textElement.position.y}px`,
        width: `${textElement.size.width}px`,
        minHeight: `${textElement.size.height}px`,
        backgroundColor: textElement.style.backgroundColor,
        border: textElement.style.borderColor && textElement.style.borderColor !== 'transparent' 
          ? `2px solid ${textElement.style.borderColor}` 
          : 'none',
        boxShadow: 
          // Only show selection/editing indicators if there's a visible border
          (textElement.style.borderColor && textElement.style.borderColor !== 'transparent') 
            ? (textElement.isSelected && !textElement.isEditing
                ? '0 0 0 2px rgba(59, 130, 246, 0.5)'
                : textElement.isEditing
                ? '0 0 0 2px rgba(147, 197, 253, 1)'
                : 'none')
            : 'none',
        zIndex: textElement.isEditing ? 1000 : textElement.order + 10,
      }}
      onClick={handleClick}
      onDoubleClick={handleDoubleClick}
      onKeyDown={handleKeyDown}
      onMouseDown={handleMouseDown}
      tabIndex={0}
    >
      <div
        ref={textRef}
        contentEditable={textElement.isEditing}
        suppressContentEditableWarning={true}
        className={`
          w-full h-full outline-none p-2 whitespace-pre-wrap break-words
          ${textElement.isEditing ? 'bg-white border border-blue-300 rounded' : ''}
        `}
        style={{
          fontSize: `${textElement.style.fontSize}px`,
          fontFamily: textElement.style.fontFamily,
          color: textElement.style.color,
          textAlign: textElement.style.textAlign,
          fontWeight: textElement.style.fontWeight,
          fontStyle: textElement.style.fontStyle,
          minHeight: textElement.isEditing ? '24px' : 'auto',
        }}
        onInput={handleInput}
        onBlur={handleBlur}
        spellCheck={false}
      >
        {textElement.isEditing ? '' : textElement.content}
      </div>
      
      {renderSelectionHandles()}
    </div>
  );
}