import { useState, useEffect } from 'react';
import type { ShapeElement, ShapeType } from '../types';
import Windows11Modal, { ModalBody, ModalSection, ModalGrid, ModalField } from './ui/Windows11Modal';

interface ShapePropertiesModalProps {
  isOpen: boolean;
  shape: ShapeElement | null;
  onSave: (updates: Partial<ShapeElement>) => void;
  onCancel: () => void;
  onDelete?: () => void;
}

export default function ShapePropertiesModal({ 
  isOpen, 
  shape, 
  onSave, 
  onCancel,
  onDelete 
}: ShapePropertiesModalProps) {
  // Form state
  const [shapeType, setShapeType] = useState<ShapeType>('rectangle');
  const [width, setWidth] = useState(120);
  const [height, setHeight] = useState(80);
  const [rotation, setRotation] = useState(0);
  const [fillColor, setFillColor] = useState('#3B82F6');
  const [strokeColor, setStrokeColor] = useState('#1E40AF');
  const [strokeWidth, setStrokeWidth] = useState(2);
  const [opacity, setOpacity] = useState(1);
  
  // Text properties
  const [textContent, setTextContent] = useState('');
  const [textFontSize, setTextFontSize] = useState(14);
  const [textFontFamily, setTextFontFamily] = useState('Inter');
  const [textColor, setTextColor] = useState('#000000');
  const [textAlign, setTextAlign] = useState<'left' | 'center' | 'right'>('center');
  const [textFontWeight, setTextFontWeight] = useState<'normal' | 'bold'>('normal');
  const [textFontStyle, setTextFontStyle] = useState<'normal' | 'italic'>('normal');

  // Shape type options
  const shapeTypeOptions = [
    { value: 'rectangle' as ShapeType, label: 'Rectangle', icon: '▬' },
    { value: 'rounded-rectangle' as ShapeType, label: 'Rounded Rect', icon: '▢' },
    { value: 'circle' as ShapeType, label: 'Circle', icon: '●' },
    { value: 'ellipse' as ShapeType, label: 'Ellipse', icon: '⭕' },
    { value: 'arrow' as ShapeType, label: 'Arrow', icon: '→' },
    { value: 'line' as ShapeType, label: 'Line', icon: '─' },
    { value: 'triangle' as ShapeType, label: 'Triangle', icon: '▲' },
    { value: 'diamond' as ShapeType, label: 'Diamond', icon: '◆' },
    { value: 'star' as ShapeType, label: 'Star', icon: '⭐' },
    { value: 'hexagon' as ShapeType, label: 'Hexagon', icon: '⬡' },
    { value: 'plus' as ShapeType, label: 'Plus', icon: '➕' }
  ];

  // Color presets
  const colorPresets = [
    { name: 'Blue', value: '#3B82F6' },
    { name: 'Green', value: '#10B981' },
    { name: 'Red', value: '#EF4444' },
    { name: 'Orange', value: '#F97316' },
    { name: 'Purple', value: '#8B5CF6' },
    { name: 'Pink', value: '#EC4899' },
    { name: 'Yellow', value: '#EAB308' },
    { name: 'Gray', value: '#6B7280' }
  ];

  const strokeColorPresets = [
    { name: 'Dark Blue', value: '#1E40AF' },
    { name: 'Dark Green', value: '#059669' },
    { name: 'Dark Red', value: '#DC2626' },
    { name: 'Dark Orange', value: '#EA580C' },
    { name: 'Dark Purple', value: '#7C3AED' },
    { name: 'Dark Pink', value: '#BE185D' },
    { name: 'Black', value: '#000000' },
    { name: 'Dark Gray', value: '#374151' }
  ];

  // Reset form when modal opens/closes or shape changes
  useEffect(() => {
    if (isOpen && shape) {
      setShapeType(shape.shapeType);
      setWidth(shape.size.width);
      setHeight(shape.size.height);
      setRotation(shape.rotation);
      setFillColor(shape.style.fillColor);
      setStrokeColor(shape.style.strokeColor);
      setStrokeWidth(shape.style.strokeWidth);
      setOpacity(shape.style.opacity);
      
      // Set text properties
      if (shape.text) {
        setTextContent(shape.text.content);
        setTextFontSize(shape.text.fontSize);
        setTextFontFamily(shape.text.fontFamily);
        setTextColor(shape.text.color);
        setTextAlign(shape.text.textAlign);
        setTextFontWeight(shape.text.fontWeight);
        setTextFontStyle(shape.text.fontStyle);
      } else {
        // Default text values
        setTextContent('');
        setTextFontSize(14);
        setTextFontFamily('Inter');
        setTextColor('#000000');
        setTextAlign('center');
        setTextFontWeight('normal');
        setTextFontStyle('normal');
      }
    } else if (isOpen && !shape) {
      // Default values for new shape
      setShapeType('rectangle');
      setWidth(120);
      setHeight(80);
      setRotation(0);
      setFillColor('#3B82F6');
      setStrokeColor('#1E40AF');
      setStrokeWidth(2);
      setOpacity(1);
      
      // Default text values
      setTextContent('');
      setTextFontSize(14);
      setTextFontFamily('Inter');
      setTextColor('#000000');
      setTextAlign('center');
      setTextFontWeight('normal');
      setTextFontStyle('normal');
    }
  }, [isOpen, shape]);

  const handleSave = () => {
    const updates: Partial<ShapeElement> = {
      shapeType,
      size: { width, height },
      rotation,
      style: {
        fillColor,
        strokeColor,
        strokeWidth,
        opacity
      }
    };
    
    // Add text properties if there's text content
    if (textContent.trim()) {
      updates.text = {
        content: textContent,
        fontSize: textFontSize,
        fontFamily: textFontFamily,
        color: textColor,
        textAlign: textAlign,
        fontWeight: textFontWeight,
        fontStyle: textFontStyle
      };
    } else {
      // Remove text if content is empty
      updates.text = undefined;
    }
    
    onSave(updates);
  };

  const footerContent = (
    <div className="flex items-center justify-end gap-3 w-full">
      {onDelete && shape && (
        <button
          onClick={onDelete}
          className="mr-auto px-4 py-2 text-red-600 hover:text-red-700 hover:bg-red-50 rounded-lg transition-colors"
        >
          Delete Shape
        </button>
      )}
      <button
        onClick={onCancel}
        className="px-6 py-2 text-gray-600 hover:text-gray-700 hover:bg-gray-100 rounded-lg transition-colors"
      >
        Cancel
      </button>
      <button
        onClick={handleSave}
        className="px-8 py-2 bg-blue-600 text-white hover:bg-blue-700 rounded-lg transition-colors shadow-sm font-medium"
      >
        {shape ? 'Save Changes' : 'Create Shape'}
      </button>
    </div>
  );

  // Debug logging
  console.log('ShapePropertiesModal render:', { 
    isOpen, 
    shape: shape ? 'exists' : 'null', 
    buttonText: shape ? 'Save Changes' : 'Create Shape' 
  });

  return (
    <Windows11Modal
      isOpen={isOpen}
      onClose={onCancel}
      title={shape ? 'Edit Shape Properties' : 'Create New Shape'}
      width="600px"
      height="85vh"
      maxHeight="85vh"
      footer={footerContent}
    >
      <ModalBody>
        {/* Basic Properties Section */}
        <ModalSection title="Basic Properties">
          <ModalField label="Shape Type">
            <div className="grid grid-cols-4 gap-2">
              {shapeTypeOptions.map((option) => (
                <button
                  key={option.value}
                  onClick={() => setShapeType(option.value)}
                  className={`p-3 rounded-lg border-2 transition-all hover:scale-105 flex flex-col items-center gap-1 ${
                    shapeType === option.value
                      ? 'border-blue-500 bg-blue-50 shadow-md'
                      : 'border-gray-200 hover:border-gray-300'
                  }`}
                >
                  <span className="text-lg">{option.icon}</span>
                  <span className="text-xs font-medium">{option.label}</span>
                </button>
              ))}
            </div>
          </ModalField>

          <ModalGrid cols={shapeType === 'line' ? 3 : 2}>
            {shapeType !== 'line' && (
              <ModalField label={`Width: ${width}px`}>
                <div className="space-y-2">
                  <input
                    type="number"
                    value={width}
                    onChange={(e) => setWidth(parseInt(e.target.value) || 120)}
                    min="10"
                    max="500"
                    className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 transition-colors"
                  />
                  <input
                    type="range"
                    min="10"
                    max="500"
                    value={width}
                    onChange={(e) => setWidth(parseInt(e.target.value))}
                    className="w-full h-2 bg-gray-200 rounded-lg appearance-none cursor-pointer slider"
                  />
                </div>
              </ModalField>
            )}
            
            {shapeType !== 'line' && shapeType !== 'circle' && shapeType !== 'star' && shapeType !== 'hexagon' && shapeType !== 'plus' && (
              <ModalField label={`Height: ${height}px`}>
                <div className="space-y-2">
                  <input
                    type="number"
                    value={height}
                    onChange={(e) => setHeight(parseInt(e.target.value) || 80)}
                    min="10"
                    max="500"
                    className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 transition-colors"
                  />
                  <input
                    type="range"
                    min="10"
                    max="500"
                    value={height}
                    onChange={(e) => setHeight(parseInt(e.target.value))}
                    className="w-full h-2 bg-gray-200 rounded-lg appearance-none cursor-pointer slider"
                  />
                </div>
              </ModalField>
            )}

            <ModalField label={`Rotation: ${rotation}°`}>
              <div className="space-y-2">
                <input
                  type="number"
                  value={rotation}
                  onChange={(e) => setRotation(parseInt(e.target.value) || 0)}
                  min="0"
                  max="360"
                  className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 transition-colors"
                />
                <input
                  type="range"
                  min="0"
                  max="360"
                  value={rotation}
                  onChange={(e) => setRotation(parseInt(e.target.value))}
                  className="w-full h-2 bg-gray-200 rounded-lg appearance-none cursor-pointer slider"
                />
              </div>
            </ModalField>
          </ModalGrid>
        </ModalSection>

        {/* Styling Section */}
        <ModalSection title="Styling">
          <ModalGrid cols={2}>
            {shapeType !== 'line' && (
              <ModalField label="Fill Color">
                <div className="space-y-3">
                  <div className="grid grid-cols-4 gap-2">
                    {colorPresets.map((preset) => (
                      <button
                        key={preset.value}
                        onClick={() => setFillColor(preset.value)}
                        className={`w-full h-8 rounded-md border-2 transition-all hover:scale-105 ${
                          fillColor === preset.value ? 'border-blue-500 shadow-md' : 'border-gray-300'
                        }`}
                        style={{ backgroundColor: preset.value }}
                        title={preset.name}
                      />
                    ))}
                  </div>
                  <div className="flex items-center space-x-2">
                    <input
                      type="color"
                      value={fillColor}
                      onChange={(e) => setFillColor(e.target.value)}
                      className="w-12 h-12 border-2 border-gray-300 rounded-lg cursor-pointer"
                    />
                    <input
                      type="text"
                      value={fillColor}
                      onChange={(e) => setFillColor(e.target.value)}
                      className="flex-1 px-4 py-3 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 transition-colors font-mono"
                      placeholder="#3B82F6"
                    />
                  </div>
                </div>
              </ModalField>
            )}

            <ModalField label="Stroke Color">
              <div className="space-y-3">
                <div className="grid grid-cols-4 gap-2">
                  {strokeColorPresets.map((preset) => (
                    <button
                      key={preset.value}
                      onClick={() => setStrokeColor(preset.value)}
                      className={`w-full h-8 rounded-md border-2 transition-all hover:scale-105 ${
                        strokeColor === preset.value ? 'border-blue-500 shadow-md' : 'border-gray-300'
                      }`}
                      style={{ backgroundColor: preset.value }}
                      title={preset.name}
                    />
                  ))}
                </div>
                <div className="flex items-center space-x-2">
                  <input
                    type="color"
                    value={strokeColor}
                    onChange={(e) => setStrokeColor(e.target.value)}
                    className="w-12 h-12 border-2 border-gray-300 rounded-lg cursor-pointer"
                  />
                  <input
                    type="text"
                    value={strokeColor}
                    onChange={(e) => setStrokeColor(e.target.value)}
                    className="flex-1 px-4 py-3 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 transition-colors font-mono"
                    placeholder="#1E40AF"
                  />
                </div>
              </div>
            </ModalField>
          </ModalGrid>

          <ModalGrid cols={2}>
            <ModalField label={`Stroke Width: ${strokeWidth}px`}>
              <div className="space-y-2">
                <input
                  type="number"
                  value={strokeWidth}
                  onChange={(e) => setStrokeWidth(parseInt(e.target.value) || 2)}
                  min="0"
                  max="20"
                  className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 transition-colors"
                />
                <input
                  type="range"
                  min="0"
                  max="20"
                  value={strokeWidth}
                  onChange={(e) => setStrokeWidth(parseInt(e.target.value))}
                  className="w-full h-2 bg-gray-200 rounded-lg appearance-none cursor-pointer slider"
                />
              </div>
            </ModalField>

            <ModalField label={`Opacity: ${Math.round(opacity * 100)}%`}>
              <div className="space-y-2">
                <input
                  type="number"
                  value={Math.round(opacity * 100)}
                  onChange={(e) => setOpacity((parseInt(e.target.value) || 100) / 100)}
                  min="0"
                  max="100"
                  className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 transition-colors"
                />
                <input
                  type="range"
                  min="0"
                  max="100"
                  value={Math.round(opacity * 100)}
                  onChange={(e) => setOpacity(parseInt(e.target.value) / 100)}
                  className="w-full h-2 bg-gray-200 rounded-lg appearance-none cursor-pointer slider"
                />
              </div>
            </ModalField>
          </ModalGrid>
        </ModalSection>

        {/* Text Content Section */}
        <ModalSection title="Text Content">
          <ModalField label="Text">
            <textarea
              value={textContent}
              onChange={(e) => setTextContent(e.target.value)}
              placeholder="Enter text to display in shape..."
              className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 transition-colors resize-none"
              rows={2}
            />
          </ModalField>

          {textContent.trim() && (
            <>
              <ModalGrid cols={2}>
                <ModalField label={`Font Size: ${textFontSize}px`}>
                  <div className="space-y-1">
                    <input
                      type="range"
                      min="8"
                      max="48"
                      value={textFontSize}
                      onChange={(e) => setTextFontSize(parseInt(e.target.value))}
                      className="w-full h-2 bg-gray-200 rounded-lg appearance-none cursor-pointer slider"
                    />
                  </div>
                </ModalField>

                <ModalField label="Text Color">
                  <div className="flex items-center space-x-2">
                    <input
                      type="color"
                      value={textColor}
                      onChange={(e) => setTextColor(e.target.value)}
                      className="w-10 h-10 border-2 border-gray-300 rounded-lg cursor-pointer"
                    />
                    <select
                      value={textFontFamily}
                      onChange={(e) => setTextFontFamily(e.target.value)}
                      className="flex-1 px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 transition-colors text-sm"
                    >
                      <option value="Inter">Inter</option>
                      <option value="Roboto">Roboto</option>
                      <option value="Arial">Arial</option>
                    </select>
                  </div>
                </ModalField>
              </ModalGrid>

              <ModalGrid cols={3}>
                <ModalField label="Align">
                  <div className="flex gap-1">
                    {['left', 'center', 'right'].map((align) => (
                      <button
                        key={align}
                        onClick={() => setTextAlign(align as 'left' | 'center' | 'right')}
                        className={`flex-1 py-1.5 px-2 rounded text-xs transition-all capitalize ${
                          textAlign === align
                            ? 'bg-blue-500 text-white'
                            : 'bg-gray-200 hover:bg-gray-300'
                        }`}
                      >
                        {align[0].toUpperCase()}
                      </button>
                    ))}
                  </div>
                </ModalField>

                <ModalField label="Weight">
                  <div className="flex gap-1">
                    {[{ value: 'normal', label: 'N' }, { value: 'bold', label: 'B' }].map((weight) => (
                      <button
                        key={weight.value}
                        onClick={() => setTextFontWeight(weight.value as 'normal' | 'bold')}
                        className={`flex-1 py-1.5 px-2 rounded text-xs transition-all ${
                          textFontWeight === weight.value
                            ? 'bg-blue-500 text-white'
                            : 'bg-gray-200 hover:bg-gray-300'
                        }`}
                      >
                        {weight.label}
                      </button>
                    ))}
                  </div>
                </ModalField>

                <ModalField label="Style">
                  <div className="flex gap-1">
                    {[{ value: 'normal', label: 'N' }, { value: 'italic', label: 'I' }].map((style) => (
                      <button
                        key={style.value}
                        onClick={() => setTextFontStyle(style.value as 'normal' | 'italic')}
                        className={`flex-1 py-1.5 px-2 rounded text-xs transition-all ${
                          textFontStyle === style.value
                            ? 'bg-blue-500 text-white'
                            : 'bg-gray-200 hover:bg-gray-300'
                        }`}
                      >
                        {style.label}
                      </button>
                    ))}
                  </div>
                </ModalField>
              </ModalGrid>
            </>
          )}
        </ModalSection>

        {/* Preview Section */}
        <ModalSection title="Preview">
          <div className="bg-gradient-to-br from-gray-50 to-gray-100 border border-gray-200 rounded-xl p-6 min-h-[80px] flex items-center justify-center">
            <div className="relative">
              {/* Simple SVG preview based on shape type */}
              {shapeType === 'rectangle' && (
                <svg width="120" height="80" className="drop-shadow-sm">
                  <rect
                    x="2"
                    y="2"
                    width={width > 116 ? 116 : width}
                    height={height > 76 ? 76 : height}
                    fill={fillColor}
                    stroke={strokeColor}
                    strokeWidth={strokeWidth}
                    opacity={opacity}
                    transform={`rotate(${rotation} ${width/2} ${height/2})`}
                  />
                </svg>
              )}
              {shapeType === 'circle' && (
                <svg width="100" height="100" className="drop-shadow-sm">
                  <circle
                    cx="50"
                    cy="50"
                    r={Math.min(width, 96) / 2}
                    fill={fillColor}
                    stroke={strokeColor}
                    strokeWidth={strokeWidth}
                    opacity={opacity}
                  />
                </svg>
              )}
              {shapeType === 'line' && (
                <svg width="120" height="20" className="drop-shadow-sm">
                  <line
                    x1="10"
                    y1="10"
                    x2="110"
                    y2="10"
                    stroke={strokeColor}
                    strokeWidth={strokeWidth}
                    opacity={opacity}
                    transform={`rotate(${rotation} 60 10)`}
                  />
                </svg>
              )}
              {shapeType === 'triangle' && (
                <svg width="100" height="90" className="drop-shadow-sm">
                  <polygon
                    points="50,10 10,80 90,80"
                    fill={fillColor}
                    stroke={strokeColor}
                    strokeWidth={strokeWidth}
                    opacity={opacity}
                    transform={`rotate(${rotation} 50 45)`}
                  />
                </svg>
              )}
              {shapeType === 'diamond' && (
                <svg width="100" height="100" className="drop-shadow-sm">
                  <polygon
                    points="50,10 90,50 50,90 10,50"
                    fill={fillColor}
                    stroke={strokeColor}
                    strokeWidth={strokeWidth}
                    opacity={opacity}
                    transform={`rotate(${rotation} 50 50)`}
                  />
                </svg>
              )}
              {shapeType === 'arrow' && (
                <svg width="120" height="60" className="drop-shadow-sm">
                  <polygon
                    points="10,30 80,10 80,20 110,20 110,40 80,40 80,50"
                    fill={fillColor}
                    stroke={strokeColor}
                    strokeWidth={strokeWidth}
                    opacity={opacity}
                    transform={`rotate(${rotation} 60 30)`}
                  />
                </svg>
              )}
              {shapeType === 'rounded-rectangle' && (
                <svg width="120" height="80" className="drop-shadow-sm">
                  <rect
                    x="2"
                    y="2"
                    width={width > 116 ? 116 : width}
                    height={height > 76 ? 76 : height}
                    rx="12"
                    ry="12"
                    fill={fillColor}
                    stroke={strokeColor}
                    strokeWidth={strokeWidth}
                    opacity={opacity}
                    transform={`rotate(${rotation} ${width/2} ${height/2})`}
                  />
                </svg>
              )}
              {shapeType === 'ellipse' && (
                <svg width="120" height="80" className="drop-shadow-sm">
                  <ellipse
                    cx="60"
                    cy="40"
                    rx={Math.min(width, 116) / 2}
                    ry={Math.min(height, 76) / 2}
                    fill={fillColor}
                    stroke={strokeColor}
                    strokeWidth={strokeWidth}
                    opacity={opacity}
                    transform={`rotate(${rotation} 60 40)`}
                  />
                </svg>
              )}
              {shapeType === 'star' && (
                <svg width="100" height="100" className="drop-shadow-sm">
                  <polygon
                    points="50,5 61,35 95,35 68,57 79,91 50,70 21,91 32,57 5,35 39,35"
                    fill={fillColor}
                    stroke={strokeColor}
                    strokeWidth={strokeWidth}
                    opacity={opacity}
                    transform={`rotate(${rotation} 50 50)`}
                  />
                </svg>
              )}
              {shapeType === 'hexagon' && (
                <svg width="100" height="100" className="drop-shadow-sm">
                  <polygon
                    points="50,5 85,25 85,65 50,85 15,65 15,25"
                    fill={fillColor}
                    stroke={strokeColor}
                    strokeWidth={strokeWidth}
                    opacity={opacity}
                    transform={`rotate(${rotation} 50 50)`}
                  />
                </svg>
              )}
              {shapeType === 'plus' && (
                <svg width="100" height="100" className="drop-shadow-sm">
                  <polygon
                    points="40,10 60,10 60,40 90,40 90,60 60,60 60,90 40,90 40,60 10,60 10,40 40,40"
                    fill={fillColor}
                    stroke={strokeColor}
                    strokeWidth={strokeWidth}
                    opacity={opacity}
                    transform={`rotate(${rotation} 50 50)`}
                  />
                </svg>
              )}
            </div>
          </div>
        </ModalSection>
      </ModalBody>
    </Windows11Modal>
  );
}