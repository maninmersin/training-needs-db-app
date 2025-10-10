import { useState, useEffect } from 'react';
import type { Milestone, Swimlane } from '../types';
import Windows11Modal, { ModalBody, ModalSection, ModalGrid, ModalField } from './ui/Windows11Modal';

interface MilestoneEditorModalProps {
  isOpen: boolean;
  milestone: Milestone | null;
  swimlanes: Swimlane[];
  onSave: (updates: Partial<Milestone>) => void;
  onCancel: () => void;
}

export default function MilestoneEditorModal({ 
  isOpen, 
  milestone, 
  swimlanes: _swimlanes, // Keep for interface compatibility but don't use
  onSave, 
  onCancel 
}: MilestoneEditorModalProps) {
  // Form state
  const [title, setTitle] = useState('');
  const [date, setDate] = useState('');
  const [color, setColor] = useState('#F59E0B');

  // Predefined color options
  const colorOptions = [
    { name: 'Amber', value: '#F59E0B' },
    { name: 'Blue', value: '#3B82F6' },
    { name: 'Green', value: '#10B981' },
    { name: 'Red', value: '#EF4444' },
    { name: 'Purple', value: '#8B5CF6' },
    { name: 'Pink', value: '#EC4899' },
    { name: 'Gray', value: '#6B7280' },
    { name: 'Teal', value: '#14B8A6' },
    { name: 'Orange', value: '#EA580C' },
    { name: 'Indigo', value: '#6366F1' }
  ];

  // Initialize form when modal opens
  useEffect(() => {
    if (isOpen) {
      if (milestone) {
        setTitle(milestone.title);
        setDate(milestone.date.toISOString().split('T')[0]);
        setColor(milestone.color);
      } else {
        // New milestone - set defaults
        setTitle('New Milestone');
        setDate(new Date().toISOString().split('T')[0]);
        setColor('#F59E0B');
      }
    }
  }, [isOpen, milestone?.id]);

  // Handle save
  const handleSave = () => {
    if (!title.trim()) return;

    const updates: Partial<Milestone> = {
      title: title.trim(),
      date: new Date(date),
      color
    };

    onSave(updates);
  };

  // Handle cancel
  const handleCancel = () => {
    if (milestone) {
      setTitle(milestone.title);
      setDate(milestone.date.toISOString().split('T')[0]);
      setColor(milestone.color);
    }
    onCancel();
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
        {milestone ? 'Save Changes' : 'Create Milestone'}
      </button>
    </>
  );

  return (
    <Windows11Modal
      isOpen={isOpen}
      onClose={handleCancel}
      title={milestone ? 'Edit Milestone' : 'Add New Milestone'}
      width="700px"
      maxHeight="85vh"
      footer={footerContent}
    >
      <ModalBody>
        {/* Basic Information Section */}
        <ModalSection title="Basic Information">
          <ModalGrid cols={2}>
            <ModalField label="Title" required>
              <input
                type="text"
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                placeholder="Milestone title..."
                autoFocus
                className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 transition-colors"
                style={{ fontFamily: 'Inter, system-ui, sans-serif' }}
              />
              {!title.trim() && (
                <p className="text-red-500 text-xs mt-1">Title is required</p>
              )}
            </ModalField>

            <ModalField label="Date" required>
              <input
                type="date"
                value={date}
                onChange={(e) => setDate(e.target.value)}
                className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 transition-colors"
              />
            </ModalField>
          </ModalGrid>
        </ModalSection>

        {/* Appearance Section */}
        <ModalSection title="Appearance">
          <ModalField label="Milestone Color">
            <div className="space-y-4">
              <div className="grid grid-cols-5 gap-3">
                {colorOptions.map((colorOption) => (
                  <button
                    key={colorOption.value}
                    onClick={() => setColor(colorOption.value)}
                    className={`w-full h-12 rounded-lg border-2 transition-all hover:scale-105 flex flex-col items-center justify-center ${
                      color === colorOption.value 
                        ? 'border-blue-500 shadow-md ring-2 ring-blue-200' 
                        : 'border-gray-300 hover:border-gray-400'
                    }`}
                    style={{ backgroundColor: colorOption.value }}
                    title={colorOption.name}
                  >
                    <span className="text-xs text-white font-medium drop-shadow-sm">
                      {colorOption.name}
                    </span>
                  </button>
                ))}
              </div>
              
              <div className="flex items-center space-x-3">
                <label className="text-sm font-medium text-gray-700 min-w-0">Custom:</label>
                <input
                  type="color"
                  value={color}
                  onChange={(e) => setColor(e.target.value)}
                  className="flex-1 h-10 border border-gray-300 rounded-lg cursor-pointer"
                />
                <input
                  type="text"
                  value={color}
                  onChange={(e) => setColor(e.target.value)}
                  className="flex-1 px-3 py-2 text-sm border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 transition-colors font-mono"
                  placeholder="#000000"
                />
              </div>
            </div>
          </ModalField>
        </ModalSection>

        {/* Preview Section */}
        <ModalSection title="Preview">
          <div className="bg-gradient-to-br from-gray-50 to-gray-100 border border-gray-200 rounded-xl p-8 min-h-[120px] flex items-center justify-center">
            <div className="flex items-center gap-6">
              {/* Classic milestone marker preview */}
              <div className="flex flex-col items-center">
                <div className="text-xs text-gray-500 mb-2 font-medium">Timeline View</div>
                <div 
                  className="w-0 h-0 border-l-[12px] border-r-[12px] border-t-[18px] border-l-transparent border-r-transparent relative"
                  style={{ borderTopColor: color }}
                  title="Milestone marker"
                >
                  <div 
                    className="absolute -top-[42px] left-1/2 transform -translate-x-1/2 px-2 py-1 rounded text-white text-xs font-semibold whitespace-nowrap shadow-lg"
                    style={{ backgroundColor: color }}
                  >
                    {title || 'Milestone Title'}
                  </div>
                </div>
              </div>

              {/* Simple dot preview */}
              <div className="flex flex-col items-center">
                <div className="text-xs text-gray-500 mb-2 font-medium">Compact View</div>
                <div className="flex items-center gap-3 p-3 bg-white border border-gray-200 rounded-lg shadow-sm">
                  <div 
                    className="w-4 h-4 rounded-full shadow-sm"
                    style={{ backgroundColor: color }}
                  />
                  <span className="text-sm text-gray-700 font-medium">
                    {title || 'Milestone Title'}
                  </span>
                </div>
              </div>
            </div>
          </div>
        </ModalSection>
      </ModalBody>
    </Windows11Modal>
  );
}