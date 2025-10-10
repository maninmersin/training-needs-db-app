import { useState, useEffect } from 'react';
import Windows11Modal, { ModalBody, ModalSection, ModalGrid, ModalField } from './ui/Windows11Modal';

interface PlanTitleModalProps {
  isOpen: boolean;
  currentTitle: string;
  onSave: (newTitle: string) => void;
  onCancel: () => void;
}

export default function PlanTitleModal({ 
  isOpen, 
  currentTitle, 
  onSave, 
  onCancel 
}: PlanTitleModalProps) {
  const [title, setTitle] = useState('');
  const [textColor, setTextColor] = useState('#1F2937');
  const [fontSize, setFontSize] = useState(24);
  const [fontWeight, setFontWeight] = useState<'normal' | 'medium' | 'semibold' | 'bold'>('bold');
  const [fontFamily, setFontFamily] = useState('Inter');

  // Color options
  const textColorOptions = [
    { name: 'Dark Gray', value: '#1F2937' },
    { name: 'Black', value: '#000000' },
    { name: 'Blue', value: '#1E40AF' },
    { name: 'Green', value: '#166534' },
    { name: 'Red', value: '#B91C1C' },
    { name: 'Purple', value: '#7C3AED' },
    { name: 'Orange', value: '#EA580C' },
    { name: 'Teal', value: '#0D9488' }
  ];

  const fontOptions = [
    { value: 'Inter', label: 'Inter' },
    { value: 'Roboto', label: 'Roboto' },
    { value: 'Arial', label: 'Arial' },
    { value: 'system-ui', label: 'System UI' },
    { value: 'Helvetica Neue', label: 'Helvetica Neue' },
    { value: 'Georgia', label: 'Georgia' },
    { value: 'Times New Roman', label: 'Times New Roman' }
  ];

  const fontWeightOptions = [
    { value: 'normal' as const, label: 'Normal' },
    { value: 'medium' as const, label: 'Medium' },
    { value: 'semibold' as const, label: 'Semi-Bold' },
    { value: 'bold' as const, label: 'Bold' }
  ];

  // Initialize form when modal opens
  useEffect(() => {
    if (isOpen) {
      setTitle(currentTitle);
      // Reset to default styling values
      setTextColor('#1F2937');
      setFontSize(24);
      setFontWeight('bold');
      setFontFamily('Inter');
    }
  }, [isOpen, currentTitle]);

  // Handle save
  const handleSave = () => {
    const trimmedTitle = title.trim();
    if (!trimmedTitle) return; // Don't save empty titles
    
    onSave(trimmedTitle);
  };

  // Handle cancel
  const handleCancel = () => {
    setTitle(currentTitle); // Reset to original title
    onCancel();
  };

  // Handle Enter key press
  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter') {
      e.preventDefault();
      handleSave();
    } else if (e.key === 'Escape') {
      e.preventDefault();
      handleCancel();
    }
  };

  const footerContent = (
    <>
      <button
        onClick={handleCancel}
        className="px-6 py-2 text-gray-600 hover:text-gray-700 hover:bg-gray-100 rounded-lg transition-colors"
      >
        Cancel
      </button>
      <button
        onClick={handleSave}
        disabled={!title.trim()}
        className="px-6 py-2 bg-blue-600 text-white hover:bg-blue-700 disabled:bg-gray-400 disabled:cursor-not-allowed rounded-lg transition-colors shadow-sm"
      >
        Save Title
      </button>
    </>
  );

  return (
    <Windows11Modal
      isOpen={isOpen}
      onClose={handleCancel}
      title="Edit Plan Title"
      width="700px"
      maxHeight="85vh"
      footer={footerContent}
    >
      <ModalBody>
        {/* Plan Information Section */}
        <ModalSection title="Plan Information">
          <ModalField label="Title" required>
            <input
              type="text"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              onKeyDown={handleKeyDown}
              placeholder="Enter plan title..."
              autoFocus
              className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 transition-colors"
              style={{ fontFamily: 'Inter, system-ui, sans-serif' }}
            />
            {!title.trim() && (
              <p className="text-red-500 text-xs mt-1">Title cannot be empty</p>
            )}
          </ModalField>
        </ModalSection>

        {/* Appearance Section */}
        <ModalSection title="Appearance">
          <ModalField label="Text Color">
            <div className="space-y-3">
              <div className="grid grid-cols-8 gap-2">
                {textColorOptions.map((colorOption) => (
                  <button
                    key={colorOption.value}
                    onClick={() => setTextColor(colorOption.value)}
                    className={`w-8 h-8 rounded-md transition-all hover:scale-105 border-2 ${
                      textColor === colorOption.value 
                        ? 'border-blue-500 shadow-md' 
                        : 'border-gray-300 hover:border-gray-400'
                    }`}
                    style={{ backgroundColor: colorOption.value }}
                    title={colorOption.name}
                  />
                ))}
              </div>
              <input
                type="color"
                value={textColor}
                onChange={(e) => setTextColor(e.target.value)}
                className="w-full h-10 border border-gray-300 rounded-lg cursor-pointer"
              />
            </div>
          </ModalField>

          <ModalGrid cols={2}>
            <ModalField label="Font Family">
              <select
                value={fontFamily}
                onChange={(e) => setFontFamily(e.target.value)}
                className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 transition-colors bg-white"
              >
                {fontOptions.map((font) => (
                  <option key={font.value} value={font.value}>{font.label}</option>
                ))}
              </select>
            </ModalField>

            <ModalField label="Font Weight">
              <select
                value={fontWeight}
                onChange={(e) => setFontWeight(e.target.value as any)}
                className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 transition-colors bg-white"
              >
                {fontWeightOptions.map((weight) => (
                  <option key={weight.value} value={weight.value}>{weight.label}</option>
                ))}
              </select>
            </ModalField>
          </ModalGrid>

          <ModalField label={`Font Size: ${fontSize}px`}>
            <div className="space-y-2">
              <input
                type="number"
                value={fontSize}
                onChange={(e) => setFontSize(Number(e.target.value))}
                min="16"
                max="48"
                className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 transition-colors"
              />
              <input
                type="range"
                min="16"
                max="48"
                value={fontSize}
                onChange={(e) => setFontSize(Number(e.target.value))}
                className="w-full h-2 bg-gray-200 rounded-lg appearance-none cursor-pointer slider"
              />
            </div>
          </ModalField>
        </ModalSection>

        {/* Preview Section */}
        <ModalSection title="Preview">
          <div className="bg-gradient-to-br from-gray-50 to-gray-100 border border-gray-200 rounded-xl p-8 min-h-[100px] flex items-center justify-center">
            <h1 
              style={{
                color: textColor,
                fontSize: `${fontSize}px`,
                fontWeight: fontWeight,
                fontFamily: fontFamily,
                margin: 0,
                textAlign: 'center'
              }}
            >
              {title || 'Your Plan Title'}
            </h1>
          </div>
        </ModalSection>
      </ModalBody>
    </Windows11Modal>
  );
}