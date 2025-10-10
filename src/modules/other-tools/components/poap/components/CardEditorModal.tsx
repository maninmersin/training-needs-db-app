import { useState, useEffect } from 'react';
import type { Card, CardStatus, MilestoneData } from '../types';
import Windows11Modal, { ModalBody, ModalSection, ModalGrid, ModalField } from './ui/Windows11Modal';

interface CardEditorModalProps {
  isOpen: boolean;
  card: Card | null;
  onSave: (updates: Partial<Card>) => void;
  onCancel: () => void;
}

export default function CardEditorModal({ 
  isOpen, 
  card, 
  onSave, 
  onCancel 
}: CardEditorModalProps) {
  // Basic form state
  const [title, setTitle] = useState('');
  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate] = useState('');
  const [status, setStatus] = useState<CardStatus>('not-started');
  const [row, setRow] = useState(0);

  // Appearance state
  const [color, setColor] = useState('#3B82F6');
  const [backgroundColor, setBackgroundColor] = useState('#FFFFFF');
  const [textColor, setTextColor] = useState('#1F2937');
  const [fontSize, setFontSize] = useState(14);
  const [fontWeight, setFontWeight] = useState<'normal' | 'medium' | 'semibold' | 'bold'>('normal');
  const [fontFamily, setFontFamily] = useState('Inter');
  const [textAlign, setTextAlign] = useState<'left' | 'center' | 'right'>('left');

  // Milestone state
  const [hasMilestone, setHasMilestone] = useState(false);
  const [milestoneTitle, setMilestoneTitle] = useState('');
  const [milestoneDate, setMilestoneDate] = useState('');
  const [milestoneColor, setMilestoneColor] = useState('#F59E0B');

  // Predefined options
  const statusOptions: CardStatus[] = ['not-started', 'in-progress', 'completed', 'blocked'];
  const statusLabels = {
    'not-started': 'Not Started',
    'in-progress': 'In Progress',
    'completed': 'Completed',
    'blocked': 'Blocked'
  };

  const colorPresets = [
    { name: 'Blue', value: '#3B82F6' },
    { name: 'Green', value: '#10B981' },
    { name: 'Amber', value: '#F59E0B' },
    { name: 'Red', value: '#EF4444' },
    { name: 'Violet', value: '#8B5CF6' },
    { name: 'Pink', value: '#EC4899' },
    { name: 'Gray', value: '#6B7280' },
    { name: 'Teal', value: '#14B8A6' }
  ];

  const backgroundColorPresets = [
    { name: 'White', value: '#FFFFFF' },
    { name: 'Light Gray', value: '#F9FAFB' },
    { name: 'Light Blue', value: '#EFF6FF' },
    { name: 'Light Green', value: '#F0FDF4' },
    { name: 'Light Yellow', value: '#FEFCE8' },
    { name: 'Light Red', value: '#FEF2F2' },
    { name: 'Light Purple', value: '#FAF5FF' },
    { name: 'Light Pink', value: '#FDF2F8' }
  ];

  const textColorPresets = [
    { name: 'Dark Gray', value: '#1F2937' },
    { name: 'Black', value: '#000000' },
    { name: 'Blue', value: '#1E40AF' },
    { name: 'White', value: '#FFFFFF' }
  ];

  const fontOptions = [
    { value: 'Inter', label: 'Inter' },
    { value: 'Roboto', label: 'Roboto' },
    { value: 'Arial', label: 'Arial' },
    { value: 'system-ui', label: 'System UI' },
    { value: 'Helvetica Neue', label: 'Helvetica Neue' }
  ];

  const fontWeightOptions = [
    { value: 'normal' as const, label: 'Normal' },
    { value: 'medium' as const, label: 'Medium' },
    { value: 'semibold' as const, label: 'Semi-Bold' },
    { value: 'bold' as const, label: 'Bold' }
  ];

  const textAlignOptions = [
    { value: 'left' as const, label: 'Left', icon: '⬅️' },
    { value: 'center' as const, label: 'Center', icon: '↔️' },
    { value: 'right' as const, label: 'Right', icon: '➡️' }
  ];

  // Initialize form when modal opens
  useEffect(() => {
    if (isOpen && card) {
      setTitle(card.title);
      setStartDate(card.startDate.toISOString().split('T')[0]);
      setEndDate(card.endDate.toISOString().split('T')[0]);
      setStatus(card.status);
      setRow(card.row || 0);
      setColor(card.color);
      setBackgroundColor(card.backgroundColor || '#FFFFFF');
      setTextColor(card.textColor || '#1F2937');
      setFontSize(card.fontSize || 14);
      setFontWeight(card.fontWeight || 'normal');
      setFontFamily(card.fontFamily || 'Inter');
      setTextAlign(card.textAlign || 'left');
      
      // Initialize milestone data
      if (card.milestone) {
        setHasMilestone(true);
        setMilestoneTitle(card.milestone.title);
        setMilestoneDate(card.milestone.date.toISOString().split('T')[0]);
        setMilestoneColor(card.milestone.color);
      } else {
        setHasMilestone(false);
        setMilestoneTitle('');
        setMilestoneDate(new Date().toISOString().split('T')[0]);
        setMilestoneColor('#F59E0B');
      }
    } else if (isOpen && !card) {
      // Default values for new card
      setTitle('New Card');
      setStartDate(new Date().toISOString().split('T')[0]);
      setEndDate(new Date().toISOString().split('T')[0]);
      setStatus('not-started');
      setRow(0);
      setColor('#3B82F6');
      setBackgroundColor('#FFFFFF');
      setTextColor('#1F2937');
      setFontSize(14);
      setFontWeight('normal');
      setFontFamily('Inter');
      setTextAlign('left');
      setHasMilestone(false);
      setMilestoneTitle('');
      setMilestoneDate(new Date().toISOString().split('T')[0]);
      setMilestoneColor('#F59E0B');
    }
  }, [isOpen, card]);

  const handleSave = () => {
    if (!title.trim()) return;

    // Prepare milestone data
    let milestoneData: MilestoneData | undefined = undefined;
    if (hasMilestone && milestoneTitle.trim()) {
      milestoneData = {
        title: milestoneTitle.trim(),
        date: new Date(milestoneDate),
        color: milestoneColor
      };
    }

    const updates: Partial<Card> = {
      title: title.trim(),
      startDate: new Date(startDate),
      endDate: new Date(endDate),
      status,
      row,
      color,
      backgroundColor,
      textColor,
      fontSize,
      fontWeight,
      fontFamily,
      textAlign,
      milestone: milestoneData
    };

    onSave(updates);
  };

  const footerContent = (
    <>
      <button
        onClick={onCancel}
        className="px-6 py-2 text-gray-600 hover:text-gray-700 hover:bg-gray-100 rounded-lg transition-colors"
      >
        Cancel
      </button>
      <button
        onClick={handleSave}
        disabled={!title.trim()}
        className="px-6 py-2 bg-blue-600 text-white hover:bg-blue-700 disabled:bg-gray-400 disabled:cursor-not-allowed rounded-lg transition-colors shadow-sm"
      >
        {card ? 'Save Changes' : 'Create Card'}
      </button>
    </>
  );

  return (
    <Windows11Modal
      isOpen={isOpen}
      onClose={onCancel}
      title={card ? 'Edit Card' : 'Create New Card'}
      width="600px"
      maxHeight="90vh"
      footer={footerContent}
      isDraggable={true}
    >
      <ModalBody>
        {/* Basic Information Section */}
        <ModalSection title="Basic Information">
          <ModalField label="Card Title" required>
            <input
              type="text"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 transition-colors"
              placeholder="Enter card title..."
              style={{ fontFamily: 'Inter, system-ui, sans-serif' }}
            />
            {!title.trim() && (
              <p className="text-red-500 text-xs mt-1">Title is required</p>
            )}
          </ModalField>

          <ModalGrid cols={2}>
            <ModalField label="Status">
              <select
                value={status}
                onChange={(e) => setStatus(e.target.value as CardStatus)}
                className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 transition-colors bg-white"
              >
                {statusOptions.map((statusOption) => (
                  <option key={statusOption} value={statusOption}>
                    {statusLabels[statusOption]}
                  </option>
                ))}
              </select>
            </ModalField>

            <ModalField label="Row/Track">
              <select
                value={row}
                onChange={(e) => setRow(Number(e.target.value))}
                className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 transition-colors bg-white"
              >
                {[0, 1, 2, 3, 4].map((rowOption) => (
                  <option key={rowOption} value={rowOption}>
                    Row {rowOption + 1} {rowOption === 0 ? '(Top)' : ''}
                  </option>
                ))}
              </select>
            </ModalField>
          </ModalGrid>
        </ModalSection>

        {/* Timeline Dates Section */}
        <ModalSection title="Timeline">
          <ModalGrid cols={2}>
            <ModalField label="Start Date" required>
              <input
                type="date"
                value={startDate}
                onChange={(e) => setStartDate(e.target.value)}
                className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 transition-colors"
              />
            </ModalField>

            <ModalField label="End Date" required>
              <input
                type="date"
                value={endDate}
                onChange={(e) => setEndDate(e.target.value)}
                className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 transition-colors"
              />
            </ModalField>
          </ModalGrid>
        </ModalSection>

        {/* Appearance Section */}
        <ModalSection title="Appearance">
          <ModalGrid cols={3}>
            <ModalField label="Border Color">
              <div className="space-y-3">
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
                <input
                  type="color"
                  value={color}
                  onChange={(e) => setColor(e.target.value)}
                  className="w-full h-8 border border-gray-300 rounded-lg cursor-pointer"
                />
              </div>
            </ModalField>

            <ModalField label="Background Color">
              <div className="space-y-3">
                <div className="grid grid-cols-4 gap-2">
                  {backgroundColorPresets.map((preset) => (
                    <button
                      key={preset.value}
                      onClick={() => setBackgroundColor(preset.value)}
                      className={`w-full h-8 rounded-md border-2 transition-all hover:scale-105 ${
                        backgroundColor === preset.value ? 'border-blue-500 shadow-md' : 'border-gray-300'
                      }`}
                      style={{ backgroundColor: preset.value }}
                      title={preset.name}
                    />
                  ))}
                </div>
                <input
                  type="color"
                  value={backgroundColor}
                  onChange={(e) => setBackgroundColor(e.target.value)}
                  className="w-full h-8 border border-gray-300 rounded-lg cursor-pointer"
                />
              </div>
            </ModalField>

            <ModalField label="Text Color">
              <div className="space-y-3">
                <div className="grid grid-cols-2 gap-2">
                  {textColorPresets.map((preset) => (
                    <button
                      key={preset.value}
                      onClick={() => setTextColor(preset.value)}
                      className={`w-full h-8 rounded-md border-2 transition-all hover:scale-105 ${
                        textColor === preset.value ? 'border-blue-500 shadow-md' : 'border-gray-300'
                      }`}
                      style={{ backgroundColor: preset.value }}
                      title={preset.name}
                    />
                  ))}
                </div>
                <input
                  type="color"
                  value={textColor}
                  onChange={(e) => setTextColor(e.target.value)}
                  className="w-full h-8 border border-gray-300 rounded-lg cursor-pointer"
                />
              </div>
            </ModalField>
          </ModalGrid>

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

          <ModalGrid cols={2}>
            <ModalField label="Font Size">
              <div className="space-y-2">
                <input
                  type="number"
                  value={fontSize}
                  onChange={(e) => setFontSize(parseInt(e.target.value) || 14)}
                  min="10"
                  max="24"
                  className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 transition-colors"
                />
                <input
                  type="range"
                  min="10"
                  max="24"
                  value={fontSize}
                  onChange={(e) => setFontSize(parseInt(e.target.value))}
                  className="w-full h-2 bg-gray-200 rounded-lg appearance-none cursor-pointer slider"
                />
              </div>
            </ModalField>

            <ModalField label="Text Alignment">
              <div className="grid grid-cols-3 gap-2">
                {textAlignOptions.map((align) => (
                  <button
                    key={align.value}
                    type="button"
                    onClick={() => setTextAlign(align.value)}
                    className={`px-3 py-3 border-2 rounded-lg transition-all hover:scale-105 focus:outline-none focus:ring-2 focus:ring-blue-500/20 ${
                      textAlign === align.value 
                        ? 'border-blue-500 bg-blue-50 text-blue-700 shadow-md' 
                        : 'border-gray-300 hover:border-gray-400'
                    }`}
                    title={align.label}
                  >
                    <div className="flex flex-col items-center gap-1">
                      <span className="text-lg">{align.icon}</span>
                      <span className="text-xs font-medium">{align.label}</span>
                    </div>
                  </button>
                ))}
              </div>
            </ModalField>
          </ModalGrid>
        </ModalSection>

        {/* Milestone Section */}
        <ModalSection title="Milestone">
          <div className="flex items-center space-x-3 mb-4">
            <input
              type="checkbox"
              id="hasMilestone"
              checked={hasMilestone}
              onChange={(e) => setHasMilestone(e.target.checked)}
              className="h-5 w-5 text-blue-600 border-gray-300 rounded focus:ring-blue-500"
            />
            <label htmlFor="hasMilestone" className="text-sm font-medium text-gray-700">
              Add milestone to this card
            </label>
          </div>

          {hasMilestone && (
            <div className="space-y-4 bg-gray-50/50 p-6 rounded-lg border border-gray-200/50">
              <ModalGrid cols={2}>
                <ModalField label="Milestone Title">
                  <input
                    type="text"
                    value={milestoneTitle}
                    onChange={(e) => setMilestoneTitle(e.target.value)}
                    className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 transition-colors"
                    placeholder="Enter milestone name..."
                  />
                </ModalField>

                <ModalField label="Milestone Date">
                  <input
                    type="date"
                    value={milestoneDate}
                    onChange={(e) => setMilestoneDate(e.target.value)}
                    className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 transition-colors"
                  />
                </ModalField>
              </ModalGrid>

              <ModalField label="Milestone Color">
                <div className="space-y-3">
                  <div className="grid grid-cols-8 gap-2">
                    {colorPresets.map((preset) => (
                      <button
                        key={preset.value}
                        onClick={() => setMilestoneColor(preset.value)}
                        className={`w-full h-8 rounded-md border-2 transition-all hover:scale-105 ${
                          milestoneColor === preset.value ? 'border-blue-500 shadow-md' : 'border-gray-300'
                        }`}
                        style={{ backgroundColor: preset.value }}
                        title={preset.name}
                      />
                    ))}
                  </div>
                  <input
                    type="color"
                    value={milestoneColor}
                    onChange={(e) => setMilestoneColor(e.target.value)}
                    className="w-full h-8 border border-gray-300 rounded-lg cursor-pointer"
                  />
                </div>
              </ModalField>

              {/* Milestone Preview */}
              <ModalField label="Preview">
                <div className="flex items-center gap-3 p-4 bg-white border border-gray-200 rounded-lg">
                  <div 
                    className="w-4 h-4 rounded-full"
                    style={{ backgroundColor: milestoneColor }}
                  />
                  <span className="text-sm text-gray-700">
                    {milestoneTitle || 'Milestone Title'}
                  </span>
                </div>
              </ModalField>
            </div>
          )}
        </ModalSection>

        {/* Card Preview Section */}
        <ModalSection title="Preview">
          <div className="bg-gradient-to-br from-gray-50 to-gray-100 border border-gray-200 rounded-xl p-6 min-h-[120px] flex items-center justify-center">
            <div
              className="rounded-2xl p-3 shadow-sm min-w-[200px] max-w-[300px] relative"
              style={{
                backgroundColor: backgroundColor || color || '#3B82F6',
                color: textColor || 'white',
                fontFamily,
                fontWeight: fontWeight || '500',
                fontSize: `${fontSize}px`,
                textAlign,
                height: '36px',
                display: 'flex',
                alignItems: 'center',
                boxShadow: '0 2px 4px rgba(0, 0, 0, 0.1)'
              }}
            >
              <div className="w-full" style={{ textAlign }}>
                <span className="block font-medium truncate">
                  {title || 'Card Title'}
                </span>
              </div>
              {hasMilestone && milestoneTitle && (
                <div 
                  className="absolute -top-3 left-1/2 transform -translate-x-1/2"
                  title={`Milestone: ${milestoneTitle}`}
                >
                  <div 
                    className="w-2 h-2 rounded-full"
                    style={{ backgroundColor: milestoneColor }}
                  />
                </div>
              )}
            </div>
          </div>
        </ModalSection>
      </ModalBody>
    </Windows11Modal>
  );
}