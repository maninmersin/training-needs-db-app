import React, { useState } from 'react';
import type { ShapeElement } from '../types';

interface ShapeRendererProps {
  shape: ShapeElement;
  onUpdate: (id: string, updates: Partial<ShapeElement>) => void;
  onDelete: (id: string) => void;
  onSelect: (id: string | null) => void;
  onStartEdit: (id: string) => void;
  onPaste?: (shapeData: Partial<ShapeElement>) => void;
}

const ShapeRenderer: React.FC<ShapeRendererProps> = ({
  shape,
  onUpdate,
  onDelete,
  onSelect,
  onStartEdit,
  onPaste
}) => {
  const [isDragging, setIsDragging] = useState(false);
  const [dragOffset, setDragOffset] = useState({ x: 0, y: 0 });
  const [isResizing, setIsResizing] = useState(false);
  const [resizeDirection, setResizeDirection] = useState<string | null>(null);
  const [initialSize, setInitialSize] = useState({ width: 0, height: 0 });
  const [initialMousePos, setInitialMousePos] = useState({ x: 0, y: 0 });
  const [initialPosition, setInitialPosition] = useState({ x: 0, y: 0 });
  const [isRotating, setIsRotating] = useState(false);
  const [initialRotation, setInitialRotation] = useState(0);
  const [shapeCenterPoint, setShapeCenterPoint] = useState({ x: 0, y: 0 });

  // Debug logging - can be removed in production
  // console.log('ShapeRenderer render:', { shapeId: shape.id, isSelected: shape.isSelected });

  const handleMouseDown = (e: React.MouseEvent) => {
    e.stopPropagation();
    
    // Select the shape
    onSelect(shape.id);
    
    // Focus the element so it can receive keyboard events, but prevent scrolling
    (e.currentTarget as HTMLElement).focus({ preventScroll: true });
    
    // Start dragging - calculate offset relative to timeline container
    const timelineContainer = document.querySelector('.timeline-container');
    if (!timelineContainer) return;
    
    const timelineRect = timelineContainer.getBoundingClientRect();
    const dragOffsetCalc = {
      x: e.clientX - timelineRect.left - shape.position.x,
      y: e.clientY - timelineRect.top - shape.position.y
    };
    
    // Debug: Uncomment to verify drag calculations
    // console.log('Drag start:', { shapePos: shape.position, offset: dragOffsetCalc });
    
    setDragOffset(dragOffsetCalc);
    setIsDragging(true);
  };

  const handleDoubleClick = (e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    onStartEdit(shape.id);
  };

  const handleResizeMouseDown = (direction: string) => (e: React.MouseEvent) => {
    e.stopPropagation();
    e.preventDefault();
    
    console.log('Resize handle clicked:', { direction, shapeId: shape.id });
    
    onSelect(shape.id);
    setIsResizing(true);
    setResizeDirection(direction);
    setInitialSize({ width: shape.size.width, height: shape.size.height });
    setInitialPosition({ x: shape.position.x, y: shape.position.y });
    setInitialMousePos({ x: e.clientX, y: e.clientY });
    
    console.log('Resize state set:', { isResizing: true, direction, initialSize: shape.size });
  };

  const handleRotateMouseDown = (e: React.MouseEvent) => {
    e.stopPropagation();
    e.preventDefault();
    
    console.log('Rotate handle clicked:', { shapeId: shape.id });
    
    onSelect(shape.id);
    setIsRotating(true);
    setInitialRotation(shape.rotation);
    setInitialMousePos({ x: e.clientX, y: e.clientY });
    
    // Calculate shape center point in screen coordinates
    const timelineContainer = document.querySelector('.timeline-container');
    if (timelineContainer) {
      const rect = timelineContainer.getBoundingClientRect();
      const centerX = rect.left + shape.position.x + (shape.size.width / 2);
      const centerY = rect.top + shape.position.y + (shape.size.height / 2);
      setShapeCenterPoint({ x: centerX, y: centerY });
    }
    
    console.log('Rotation state set:', { isRotating: true, initialRotation: shape.rotation });
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Delete' && shape.isSelected) {
      onDelete(shape.id);
    } else if (e.key === 'c' && (e.ctrlKey || e.metaKey) && shape.isSelected) {
      // Copy shape (Ctrl+C or Cmd+C)
      e.preventDefault();
      e.stopPropagation();
      console.log('Copying shape:', shape.id);
      
      // Store shape data in localStorage as clipboard
      const shapeData = {
        ...shape,
        id: undefined, // Remove ID so new shape gets generated
        isSelected: false // New shape shouldn't be selected initially
      };
      localStorage.setItem('shape-clipboard', JSON.stringify(shapeData));
    } else if (e.key === 'v' && (e.ctrlKey || e.metaKey) && shape.isSelected) {
      // Paste shape (Ctrl+V or Cmd+V)
      e.preventDefault();
      e.stopPropagation();
      console.log('Pasting shape near:', shape.id);
      
      try {
        const clipboardData = localStorage.getItem('shape-clipboard');
        if (clipboardData) {
          const copiedShape = JSON.parse(clipboardData);
          
          // Position the new shape slightly offset from the current shape
          const newPosition = {
            x: shape.position.x + 20,
            y: shape.position.y + 20
          };
          
          // Create the new shape using the onPaste callback
          if (onPaste) {
            onPaste({ ...copiedShape, position: newPosition });
            console.log('Shape pasted at:', newPosition);
          } else {
            console.warn('onPaste callback not provided');
          }
        }
      } catch (error) {
        console.error('Failed to paste shape:', error);
      }
    }
  };

  // Handle mouse move for dragging and resizing
  React.useEffect(() => {
    const handleMouseMove = (e: MouseEvent) => {
      if (isDragging) {
        // Handle dragging
        const timelineContainer = document.querySelector('.timeline-container');
        if (!timelineContainer) return;
        
        const rect = timelineContainer.getBoundingClientRect();
        const newX = e.clientX - rect.left - dragOffset.x;
        const newY = e.clientY - rect.top - dragOffset.y;
        
        // Debug: Uncomment to verify drag movement
        // console.log('Drag move:', { newPos: { x: newX, y: newY } });
        
        onUpdate(shape.id, {
          position: { x: Math.max(0, newX), y: Math.max(0, newY) }
        });
      } else if (isResizing && resizeDirection) {
        // Handle resizing
        const deltaX = e.clientX - initialMousePos.x;
        const deltaY = e.clientY - initialMousePos.y;
        
        console.log('Resizing:', { direction: resizeDirection, deltaX, deltaY });
        
        let newWidth = initialSize.width;
        let newHeight = initialSize.height;
        let newX = initialPosition.x;
        let newY = initialPosition.y;

        // Calculate new dimensions based on resize direction
        switch (resizeDirection) {
          case 'nw': // Northwest
            newWidth = Math.max(20, initialSize.width - deltaX);
            newHeight = Math.max(20, initialSize.height - deltaY);
            newX = initialPosition.x + (initialSize.width - newWidth);
            newY = initialPosition.y + (initialSize.height - newHeight);
            break;
          case 'ne': // Northeast
            newWidth = Math.max(20, initialSize.width + deltaX);
            newHeight = Math.max(20, initialSize.height - deltaY);
            newX = initialPosition.x; // X position stays the same
            newY = initialPosition.y + (initialSize.height - newHeight);
            break;
          case 'sw': // Southwest
            newWidth = Math.max(20, initialSize.width - deltaX);
            newHeight = Math.max(20, initialSize.height + deltaY);
            newX = initialPosition.x + (initialSize.width - newWidth);
            newY = initialPosition.y; // Y position stays the same
            break;
          case 'se': // Southeast
            newWidth = Math.max(20, initialSize.width + deltaX);
            newHeight = Math.max(20, initialSize.height + deltaY);
            newX = initialPosition.x; // X position stays the same
            newY = initialPosition.y; // Y position stays the same
            break;
        }

        // For circles, maintain aspect ratio
        if (shape.shapeType === 'circle') {
          const avgSize = (newWidth + newHeight) / 2;
          newWidth = avgSize;
          newHeight = avgSize;
        }

        // Update shape with new size and position
        onUpdate(shape.id, {
          size: { width: newWidth, height: newHeight },
          position: { x: newX, y: newY }
        });
      } else if (isRotating) {
        // Handle rotation
        const currentMouseX = e.clientX;
        const currentMouseY = e.clientY;
        
        // Calculate angle from shape center to current mouse position
        const deltaX = currentMouseX - shapeCenterPoint.x;
        const deltaY = currentMouseY - shapeCenterPoint.y;
        const currentAngle = Math.atan2(deltaY, deltaX) * (180 / Math.PI);
        
        // Calculate angle from shape center to initial mouse position
        const initialDeltaX = initialMousePos.x - shapeCenterPoint.x;
        const initialDeltaY = initialMousePos.y - shapeCenterPoint.y;
        const initialAngle = Math.atan2(initialDeltaY, initialDeltaX) * (180 / Math.PI);
        
        // Calculate rotation change
        const rotationDelta = currentAngle - initialAngle;
        const newRotation = initialRotation + rotationDelta;
        
        console.log('Rotating:', { currentAngle, initialAngle, rotationDelta, newRotation });
        
        // Update shape rotation
        onUpdate(shape.id, {
          rotation: newRotation
        });
      }
    };

    const handleMouseUp = () => {
      setIsDragging(false);
      setIsResizing(false);
      setIsRotating(false);
      setResizeDirection(null);
    };

    if (isDragging || isResizing || isRotating) {
      document.addEventListener('mousemove', handleMouseMove);
      document.addEventListener('mouseup', handleMouseUp);
    }

    return () => {
      document.removeEventListener('mousemove', handleMouseMove);
      document.removeEventListener('mouseup', handleMouseUp);
    };
  }, [isDragging, isResizing, isRotating, dragOffset, resizeDirection, initialSize, initialMousePos, initialPosition, initialRotation, shapeCenterPoint, shape.id, shape.position, shape.shapeType, onUpdate]);

  const renderShape = () => {
    const { shapeType, size, rotation, style } = shape;
    const { fillColor, strokeColor, strokeWidth, opacity } = style;
    const { width, height } = size;

    // Transform string for rotation
    const transform = rotation !== 0 
      ? `rotate(${rotation} ${width / 2} ${height / 2})` 
      : undefined;

    switch (shapeType) {
      case 'rectangle':
        return (
          <rect
            x={0}
            y={0}
            width={width}
            height={height}
            fill={fillColor}
            stroke={strokeColor}
            strokeWidth={strokeWidth}
            opacity={opacity}
            transform={transform}
          />
        );

      case 'circle': {
        const radius = Math.min(width, height) / 2;
        return (
          <circle
            cx={width / 2}
            cy={height / 2}
            r={radius}
            fill={fillColor}
            stroke={strokeColor}
            strokeWidth={strokeWidth}
            opacity={opacity}
          />
        );
      }

      case 'line':
        return (
          <line
            x1={0}
            y1={height / 2}
            x2={width}
            y2={height / 2}
            stroke={strokeColor}
            strokeWidth={strokeWidth}
            opacity={opacity}
            transform={transform}
          />
        );

      case 'triangle': {
        const trianglePoints = `${width / 2},0 0,${height} ${width},${height}`;
        return (
          <polygon
            points={trianglePoints}
            fill={fillColor}
            stroke={strokeColor}
            strokeWidth={strokeWidth}
            opacity={opacity}
            transform={transform}
          />
        );
      }

      case 'diamond': {
        const diamondPoints = `${width / 2},0 ${width},${height / 2} ${width / 2},${height} 0,${height / 2}`;
        return (
          <polygon
            points={diamondPoints}
            fill={fillColor}
            stroke={strokeColor}
            strokeWidth={strokeWidth}
            opacity={opacity}
            transform={transform}
          />
        );
      }

      case 'arrow': {
        // Create arrow shape with head pointing right
        const arrowWidth = width * 0.8;
        const arrowHeight = height * 0.4;
        const arrowY = height / 2;
        const arrowPoints = `
          0,${arrowY - arrowHeight / 2} 
          ${arrowWidth},${arrowY - arrowHeight / 2} 
          ${arrowWidth},${arrowY - height * 0.3} 
          ${width},${arrowY} 
          ${arrowWidth},${arrowY + height * 0.3} 
          ${arrowWidth},${arrowY + arrowHeight / 2} 
          0,${arrowY + arrowHeight / 2}
        `;
        return (
          <polygon
            points={arrowPoints}
            fill={fillColor}
            stroke={strokeColor}
            strokeWidth={strokeWidth}
            opacity={opacity}
            transform={transform}
          />
        );
      }

      case 'rounded-rectangle':
        return (
          <rect
            x={0}
            y={0}
            width={width}
            height={height}
            rx={12}
            ry={12}
            fill={fillColor}
            stroke={strokeColor}
            strokeWidth={strokeWidth}
            opacity={opacity}
            transform={transform}
          />
        );

      case 'ellipse':
        return (
          <ellipse
            cx={width / 2}
            cy={height / 2}
            rx={width / 2}
            ry={height / 2}
            fill={fillColor}
            stroke={strokeColor}
            strokeWidth={strokeWidth}
            opacity={opacity}
            transform={transform}
          />
        );

      case 'star': {
        const starPoints = `
          ${width / 2},${height * 0.05} 
          ${width * 0.61},${height * 0.35} 
          ${width * 0.95},${height * 0.35} 
          ${width * 0.68},${height * 0.57} 
          ${width * 0.79},${height * 0.91} 
          ${width / 2},${height * 0.7} 
          ${width * 0.21},${height * 0.91} 
          ${width * 0.32},${height * 0.57} 
          ${width * 0.05},${height * 0.35} 
          ${width * 0.39},${height * 0.35}
        `;
        return (
          <polygon
            points={starPoints}
            fill={fillColor}
            stroke={strokeColor}
            strokeWidth={strokeWidth}
            opacity={opacity}
            transform={transform}
          />
        );
      }

      case 'hexagon': {
        const hexPoints = `
          ${width / 2},${height * 0.05} 
          ${width * 0.85},${height * 0.25} 
          ${width * 0.85},${height * 0.75} 
          ${width / 2},${height * 0.95} 
          ${width * 0.15},${height * 0.75} 
          ${width * 0.15},${height * 0.25}
        `;
        return (
          <polygon
            points={hexPoints}
            fill={fillColor}
            stroke={strokeColor}
            strokeWidth={strokeWidth}
            opacity={opacity}
            transform={transform}
          />
        );
      }

      case 'plus': {
        const plusPoints = `
          ${width * 0.4},${height * 0.1} 
          ${width * 0.6},${height * 0.1} 
          ${width * 0.6},${height * 0.4} 
          ${width * 0.9},${height * 0.4} 
          ${width * 0.9},${height * 0.6} 
          ${width * 0.6},${height * 0.6} 
          ${width * 0.6},${height * 0.9} 
          ${width * 0.4},${height * 0.9} 
          ${width * 0.4},${height * 0.6} 
          ${width * 0.1},${height * 0.6} 
          ${width * 0.1},${height * 0.4} 
          ${width * 0.4},${height * 0.4}
        `;
        return (
          <polygon
            points={plusPoints}
            fill={fillColor}
            stroke={strokeColor}
            strokeWidth={strokeWidth}
            opacity={opacity}
            transform={transform}
          />
        );
      }

      default:
        return null;
    }
  };

  const renderText = () => {
    if (!shape.text || !shape.text.content) return null;

    const { size } = shape;
    const { width, height } = size;
    const text = shape.text;

    // Calculate text position based on shape type and alignment
    const getTextPosition = () => {
      let x = width / 2; // Default center
      let y = height / 2; // Default center

      switch (shape.shapeType) {
        case 'line':
          // Position text slightly below the line
          x = width / 2;
          y = height / 2 + text.fontSize + 4;
          break;
        case 'arrow':
          // Position text in the middle of arrow body
          x = width * 0.4;
          y = height / 2;
          break;
        default:
          // Center for most shapes
          x = width / 2;
          y = height / 2;
      }

      // Apply text alignment
      if (text.textAlign === 'left') {
        x = text.fontSize * 0.5; // Small padding from left
      } else if (text.textAlign === 'right') {
        x = width - text.fontSize * 0.5; // Small padding from right
      }

      return { x, y };
    };

    const { x, y } = getTextPosition();

    // Split text into lines if it's too long
    const words = text.content.split(' ');
    const maxWordsPerLine = Math.max(1, Math.floor(width / (text.fontSize * 0.6)));
    const lines: string[] = [];
    
    for (let i = 0; i < words.length; i += maxWordsPerLine) {
      lines.push(words.slice(i, i + maxWordsPerLine).join(' '));
    }

    // Calculate vertical offset for multiple lines
    const lineHeight = text.fontSize * 1.2;
    const totalHeight = lines.length * lineHeight;
    const startY = y - (totalHeight / 2) + (text.fontSize / 2);

    return (
      <g>
        {lines.map((line, index) => (
          <text
            key={index}
            x={x}
            y={startY + (index * lineHeight)}
            textAnchor={text.textAlign === 'left' ? 'start' : text.textAlign === 'right' ? 'end' : 'middle'}
            dominantBaseline="central"
            fontSize={text.fontSize}
            fontFamily={text.fontFamily}
            fontWeight={text.fontWeight}
            fontStyle={text.fontStyle}
            fill={text.color}
            style={{ userSelect: 'none', pointerEvents: 'none' }}
          >
            {line}
          </text>
        ))}
      </g>
    );
  };

  // Calculate container dimensions - add consistent padding for stroke and selection border
  // Always reserve space for selection handles (8px = 4px base + 4px for selection)
  const padding = Math.max(shape.style.strokeWidth || 0, 8);
  const containerWidth = shape.size.width + padding * 2;
  const containerHeight = shape.shapeType === 'line' 
    ? Math.max(20, (shape.style.strokeWidth || 2) + padding * 2)
    : shape.size.height + padding * 2;

  // Calculate final positions accounting for padding
  const finalLeft = shape.position.x - padding;
  const finalTop = shape.position.y - padding;

  return (
    <div
      className={`absolute cursor-pointer focus:outline-none shape-element ${
        shape.isSelected ? 'ring-2 ring-blue-500 ring-opacity-50' : ''
      } ${isDragging ? 'cursor-grabbing' : 'cursor-grab'}`}
      style={{
        left: finalLeft,
        top: finalTop,
        width: containerWidth,
        height: containerHeight,
        zIndex: shape.zIndex || shape.order + 100,
        outline: 'none' // Remove focus outline
      }}
      tabIndex={shape.isSelected ? 0 : -1} // Make focusable when selected
      onMouseDown={handleMouseDown}
      onDoubleClick={handleDoubleClick}
      onKeyDown={handleKeyDown}
      title={`${shape.shapeType} - Double-click to edit | Delete: remove | Ctrl+C: copy | Ctrl+V: paste`}
    >
      <svg
        width={containerWidth}
        height={containerHeight}
        className="drop-shadow-sm"
        style={{ 
          overflow: 'visible', 
          outline: 'none', 
          border: 'none',
          boxShadow: 'none'
        }}
      >
        <g transform={`translate(${padding}, ${padding})`}>
          {renderShape()}
          {shape.text && shape.text.content && renderText()}
        </g>
      </svg>
      
      {/* Selection handles */}
      {shape.isSelected && (
        <>
          {/* Corner resize handles */}
          <div 
            className="resize-handle absolute w-4 h-4 bg-blue-500 border-2 border-white rounded-full cursor-nw-resize hover:bg-blue-600 hover:scale-110 transition-all shadow-lg"
            style={{ zIndex: 50, top: '-8px', left: '-8px' }}
            onMouseDown={handleResizeMouseDown('nw')}
            title="Resize northwest"
          />
          <div 
            className="resize-handle absolute w-4 h-4 bg-blue-500 border-2 border-white rounded-full cursor-ne-resize hover:bg-blue-600 hover:scale-110 transition-all shadow-lg"
            style={{ zIndex: 50, top: '-8px', right: '-8px' }}
            onMouseDown={handleResizeMouseDown('ne')}
            title="Resize northeast"
          />
          <div 
            className="resize-handle absolute w-4 h-4 bg-blue-500 border-2 border-white rounded-full cursor-sw-resize hover:bg-blue-600 hover:scale-110 transition-all shadow-lg"
            style={{ zIndex: 50, bottom: '-8px', left: '-8px' }}
            onMouseDown={handleResizeMouseDown('sw')}
            title="Resize southwest"
          />
          <div 
            className="resize-handle absolute w-4 h-4 bg-blue-500 border-2 border-white rounded-full cursor-se-resize hover:bg-blue-600 hover:scale-110 transition-all shadow-lg"
            style={{ zIndex: 50, bottom: '-8px', right: '-8px' }}
            onMouseDown={handleResizeMouseDown('se')}
            title="Resize southeast"
          />
          
          {/* Rotation handle */}
          <div 
            className="resize-handle absolute w-3 h-3 bg-green-500 border-2 border-white rounded-full cursor-grab hover:cursor-grabbing hover:bg-green-600 hover:scale-110 transition-all shadow-lg" 
            style={{ zIndex: 50, top: '-16px', left: '50%', transform: 'translateX(-50%)' }}
            onMouseDown={handleRotateMouseDown}
            title="Rotate shape"
          />
        </>
      )}
    </div>
  );
};

export default ShapeRenderer;