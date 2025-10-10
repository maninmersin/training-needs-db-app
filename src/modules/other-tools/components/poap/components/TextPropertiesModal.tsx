import { useState, useEffect } from 'react';
import type { TextElement } from '../types';
import Windows11Modal, { ModalBody, ModalSection, ModalGrid, ModalField } from './ui/Windows11Modal';

interface TextPropertiesModalProps {
  isOpen: boolean;
  textElement: TextElement | null;
  onSave: (updates: Partial<TextElement>) => void;
  onCancel: () => void;
  onDelete?: () => void;
}

export default function TextPropertiesModal({ 
  isOpen, 
  textElement, 
  onSave, 
  onCancel,
  onDelete 
}: TextPropertiesModalProps) {
  // Form state
  const [content, setContent] = useState('');
  const [fontSize, setFontSize] = useState(14);
  const [fontFamily, setFontFamily] = useState('Arial, sans-serif');
  const [fontWeight, setFontWeight] = useState('normal');
  const [fontStyle, setFontStyle] = useState('normal');
  const [color, setColor] = useState('#000000');
  const [backgroundColor, setBackgroundColor] = useState('transparent');
  const [borderColor, setBorderColor] = useState('transparent');
  const [textAlign, setTextAlign] = useState<'left' | 'center' | 'right'>('left');
  const [width, setWidth] = useState(200);
  const [height, setHeight] = useState(50);

  // Predefined options
  const fontFamilyOptions = [
    { value: 'Arial, sans-serif', label: 'Arial' },
    { value: 'Inter, sans-serif', label: 'Inter' },
    { value: 'Helvetica, sans-serif', label: 'Helvetica' },
    { value: 'Georgia, serif', label: 'Georgia' },
    { value: 'Times New Roman, serif', label: 'Times New Roman' },
    { value: 'Courier New, monospace', label: 'Courier New' },
    { value: 'Verdana, sans-serif', label: 'Verdana' },
    { value: 'system-ui, sans-serif', label: 'System UI' }
  ];

  const fontWeightOptions = [
    { value: 'lighter', label: 'Light' },
    { value: 'normal', label: 'Normal' },
    { value: 'bold', label: 'Bold' }
  ];

  const fontStyleOptions = [
    { value: 'normal', label: 'Normal' },
    { value: 'italic', label: 'Italic' }
  ];

  const textAlignOptions = [
    { value: 'left', label: 'Left', icon: '⬅' },
    { value: 'center', label: 'Center', icon: '⬄' },
    { value: 'right', label: 'Right', icon: '➡' }
  ];

  const colorPresets = [
    { name: 'Black', value: '#000000' },
    { name: 'Dark Gray', value: '#374151' },
    { name: 'Blue', value: '#2563EB' },
    { name: 'Green', value: '#16A34A' },
    { name: 'Red', value: '#DC2626' },
    { name: 'Purple', value: '#9333EA' },
    { name: 'Orange', value: '#EA580C' },
    { name: 'Teal', value: '#0D9488' }
  ];

  // Reset form when modal opens/closes or textElement changes
  useEffect(() => {
    if (isOpen && textElement) {
      setContent(textElement.content);
      setFontSize(textElement.style.fontSize);
      setFontFamily(textElement.style.fontFamily);
      setFontWeight(textElement.style.fontWeight);
      setFontStyle(textElement.style.fontStyle);
      setColor(textElement.style.color);
      setBackgroundColor(textElement.style.backgroundColor);
      setBorderColor(textElement.style.borderColor || 'transparent');
      setTextAlign(textElement.style.textAlign);
      setWidth(textElement.size.width);
      setHeight(textElement.size.height);
    } else if (isOpen && !textElement) {
      // Default values for new text
      setContent('New text');
      setFontSize(14);
      setFontFamily('Arial, sans-serif');
      setFontWeight('normal');
      setFontStyle('normal');
      setColor('#000000');
      setBackgroundColor('transparent');
      setBorderColor('transparent');
      setTextAlign('left');
      setWidth(200);
      setHeight(50);
    }
  }, [isOpen, textElement]);

  const handleSave = () => {
    const updates: Partial<TextElement> = {
      content,
      size: { width, height },
      style: {
        fontSize,
        fontFamily,
        fontWeight,
        fontStyle,
        color,
        backgroundColor,
        borderColor,
        textAlign
      }
    };
    onSave(updates);
  };

  const footerContent = (
    <>
      {onDelete && textElement && (
        <button
          onClick={onDelete}
          className="mr-auto px-4 py-2 text-red-600 hover:text-red-700 hover:bg-red-50 rounded-lg transition-colors"
        >
          Delete Text
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
        className="px-6 py-2 bg-blue-600 text-white hover:bg-blue-700 rounded-lg transition-colors shadow-sm"
      >
        {textElement ? 'Save Changes' : 'Create Text'}
      </button>
    </>
  );

  return (
    <Windows11Modal
      isOpen={isOpen}
      onClose={onCancel}
      title={textElement ? 'Edit Text Properties' : 'Create New Text'}
      width="800px"
      maxHeight="85vh"
      footer={footerContent}
    >
      <ModalBody>
        {/* Content Section */}
        <ModalSection title="Content">
          <ModalField label="Text Content" required>
            <textarea
              value={content}
              onChange={(e) => setContent(e.target.value)}
              rows={3}
              className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 transition-colors resize-none"
              placeholder="Enter your text here..."
              style={{ fontFamily: 'Inter, system-ui, sans-serif' }}
            />
          </ModalField>
        </ModalSection>

        {/* Typography Section */}
        <ModalSection title="Typography">
          <ModalGrid cols={2}>
            <ModalField label="Font Family">
              <select
                value={fontFamily}
                onChange={(e) => setFontFamily(e.target.value)}
                className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 transition-colors bg-white"
              >
                {fontFamilyOptions.map((font) => (
                  <option key={font.value} value={font.value}>{font.label}</option>
                ))}
              </select>
            </ModalField>

            <ModalField label="Font Size">
              <div className="space-y-2">
                <input
                  type="number"
                  value={fontSize}
                  onChange={(e) => setFontSize(parseInt(e.target.value) || 14)}
                  min="8"
                  max="72"
                  className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 transition-colors"
                />
                <input
                  type="range"
                  min="8"
                  max="72"
                  value={fontSize}
                  onChange={(e) => setFontSize(parseInt(e.target.value))}
                  className="w-full h-2 bg-gray-200 rounded-lg appearance-none cursor-pointer slider"
                />
              </div>
            </ModalField>
          </ModalGrid>

          <ModalGrid cols={3}>
            <ModalField label="Font Weight">
              <select
                value={fontWeight}
                onChange={(e) => setFontWeight(e.target.value)}
                className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 transition-colors bg-white"
              >
                {fontWeightOptions.map((weight) => (
                  <option key={weight.value} value={weight.value}>{weight.label}</option>
                ))}
              </select>
            </ModalField>

            <ModalField label="Font Style">
              <select
                value={fontStyle}
                onChange={(e) => setFontStyle(e.target.value)}
                className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 transition-colors bg-white"
              >
                {fontStyleOptions.map((style) => (
                  <option key={style.value} value={style.value}>{style.label}</option>
                ))}
              </select>
            </ModalField>

            <ModalField label="Text Alignment">
              <div className="flex space-x-1">
                {textAlignOptions.map((align) => (
                  <button
                    key={align.value}
                    onClick={() => setTextAlign(align.value as 'left' | 'center' | 'right')}
                    className={`flex-1 px-3 py-3 rounded-lg border transition-all ${
                      textAlign === align.value
                        ? 'bg-blue-500 text-white border-blue-500 shadow-md'
                        : 'bg-white text-gray-700 border-gray-300 hover:bg-gray-50'
                    }`}
                    title={align.label}
                  >
                    <span className="block text-center">{align.icon}</span>
                  </button>
                ))}
              </div>
            </ModalField>
          </ModalGrid>
        </ModalSection>

        {/* Colors Section */}
        <ModalSection title="Colors">
          <ModalGrid cols={3}>
            <ModalField label="Text Color">
              <div className="space-y-3">
                <div className="flex items-center space-x-2">
                  <input
                    type="color"
                    value={color}
                    onChange={(e) => setColor(e.target.value)}
                    className="w-12 h-12 border-2 border-gray-300 rounded-lg cursor-pointer"
                  />
                  <input
                    type="text"
                    value={color}
                    onChange={(e) => setColor(e.target.value)}
                    className="flex-1 px-4 py-3 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 transition-colors font-mono"
                    placeholder="#000000"
                  />
                </div>
                <div className="grid grid-cols-4 gap-2">
                  {colorPresets.map((preset) => (
                    <button
                      key={preset.value}
                      onClick={() => setColor(preset.value)}
                      className={`w-full h-8 rounded-md border-2 transition-all hover:scale-105 ${
                        color === preset.value ? 'border-blue-500 shadow-md' : 'border-gray-300'
                      }`}
                      style={{ backgroundColor: preset.value }}
                      title={preset.name}
                    />
                  ))}
                </div>
              </div>
            </ModalField>

            <ModalField label="Background Color">
              <div className="space-y-3">
                <div className="flex items-center space-x-2">
                  <input
                    type="color"
                    value={backgroundColor === 'transparent' ? '#FFFFFF' : backgroundColor}
                    onChange={(e) => setBackgroundColor(e.target.value)}
                    className="w-12 h-12 border-2 border-gray-300 rounded-lg cursor-pointer"
                  />
                  <input
                    type="text"
                    value={backgroundColor}
                    onChange={(e) => setBackgroundColor(e.target.value)}
                    className="flex-1 px-4 py-3 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 transition-colors font-mono"
                    placeholder="transparent"
                  />
                </div>
                <button
                  onClick={() => setBackgroundColor('transparent')}
                  className={`w-full px-3 py-2 rounded-md border transition-all ${
                    backgroundColor === 'transparent'
                      ? 'bg-blue-500 text-white border-blue-500'
                      : 'bg-white text-gray-700 border-gray-300 hover:bg-gray-50'
                  }`}
                >
                  Transparent
                </button>
              </div>
            </ModalField>

            <ModalField label="Border Color">
              <div className="space-y-3">
                <div className="flex items-center space-x-2">
                  <input
                    type="color"
                    value={borderColor === 'transparent' ? '#000000' : borderColor}
                    onChange={(e) => setBorderColor(e.target.value)}
                    className="w-12 h-12 border-2 border-gray-300 rounded-lg cursor-pointer"
                  />
                  <input
                    type="text"
                    value={borderColor}
                    onChange={(e) => setBorderColor(e.target.value)}
                    className="flex-1 px-4 py-3 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 transition-colors font-mono"
                    placeholder="transparent"
                  />
                </div>
                <button
                  onClick={() => setBorderColor('transparent')}
                  className={`w-full px-3 py-2 rounded-md border transition-all ${
                    borderColor === 'transparent'
                      ? 'bg-blue-500 text-white border-blue-500'
                      : 'bg-white text-gray-700 border-gray-300 hover:bg-gray-50'
                  }`}
                >
                  No Border
                </button>
              </div>
            </ModalField>
          </ModalGrid>
        </ModalSection>

        {/* Size Section */}
        <ModalSection title="Size & Position">
          <ModalGrid cols={2}>
            <ModalField label="Width (px)">
              <input
                type="number"
                value={width}
                onChange={(e) => setWidth(parseInt(e.target.value) || 200)}
                min="50"
                max="1000"
                className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 transition-colors"
              />
            </ModalField>

            <ModalField label="Height (px)">
              <input
                type="number"
                value={height}
                onChange={(e) => setHeight(parseInt(e.target.value) || 50)}
                min="20"
                max="500"
                className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 transition-colors"
              />
            </ModalField>
          </ModalGrid>
        </ModalSection>

        {/* Preview Section */}
        <ModalSection title="Preview">
          <div className="bg-gradient-to-br from-gray-50 to-gray-100 border border-gray-200 rounded-xl p-6 min-h-[120px] flex items-center justify-center">
            <div
              className="rounded-lg p-4 shadow-sm"
              style={{
                backgroundColor: backgroundColor === 'transparent' ? 'rgba(255, 255, 255, 0.8)' : backgroundColor,
                border: borderColor === 'transparent' ? '1px solid rgba(209, 213, 219, 0.5)' : `2px solid ${borderColor}`,
                width: `${Math.min(width, 300)}px`,
                minHeight: `${Math.min(height, 100)}px`,
                display: 'flex',
                alignItems: 'center'
              }}
            >
              <div
                style={{
                  fontSize: `${Math.min(fontSize, 24)}px`,
                  fontFamily,
                  fontWeight,
                  fontStyle,
                  color,
                  textAlign,
                  width: '100%',
                  lineHeight: '1.4'
                }}
              >
                {content || 'Preview text...'}
              </div>
            </div>
          </div>
        </ModalSection>
      </ModalBody>
    </Windows11Modal>
  );
}