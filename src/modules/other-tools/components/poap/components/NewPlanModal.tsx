import React, { useState } from 'react';
import Windows11Modal, { ModalBody, ModalSection, ModalField, ModalGrid } from './ui/Windows11Modal';
import type { TimelineConfig } from '../types';

interface PlanTemplate {
  id: string;
  name: string;
  description: string;
  icon: string;
  defaultTimeline: Partial<TimelineConfig>;
}

const PLAN_TEMPLATES: PlanTemplate[] = [
  {
    id: 'blank',
    name: 'Blank Plan',
    description: 'Start with an empty timeline and build your plan from scratch',
    icon: '',
    defaultTimeline: {
      scale: 'weeks',
      showGrid: true,
      snapToGrid: true
    }
  },
  {
    id: 'training-lead',
    name: 'Training Lead Template',
    description: 'Pre-configured with Technical, Communications, Training, and BAU swimlanes',
    icon: '',
    defaultTimeline: {
      scale: 'weeks',
      showGrid: true,
      snapToGrid: true
    }
  }
];

interface NewPlanModalProps {
  isOpen: boolean;
  onClose: () => void;
  onCreate: (title: string, template: string, timelineConfig: Partial<TimelineConfig>) => void;
}

export default function NewPlanModal({ isOpen, onClose, onCreate }: NewPlanModalProps) {
  const [selectedTemplate, setSelectedTemplate] = useState<string>('training-lead');
  const [title, setTitle] = useState('');
  const [startDate, setStartDate] = useState(() => {
    const today = new Date();
    return today.toISOString().split('T')[0];
  });
  const [endDate, setEndDate] = useState(() => {
    const futureDate = new Date();
    futureDate.setMonth(futureDate.getMonth() + 6);
    return futureDate.toISOString().split('T')[0];
  });
  const [scale, setScale] = useState<'weeks' | 'months' | 'quarters'>('weeks');
  const [errors, setErrors] = useState<{ [key: string]: string }>({});

  const selectedTemplateData = PLAN_TEMPLATES.find(t => t.id === selectedTemplate);

  const validateForm = () => {
    const newErrors: { [key: string]: string } = {};
    
    if (!title.trim()) {
      newErrors.title = 'Plan title is required';
    }
    
    if (!startDate) {
      newErrors.startDate = 'Start date is required';
    }
    
    if (!endDate) {
      newErrors.endDate = 'End date is required';
    }
    
    if (startDate && endDate && new Date(startDate) >= new Date(endDate)) {
      newErrors.endDate = 'End date must be after start date';
    }
    
    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const handleCreate = () => {
    if (!validateForm()) return;
    
    const timelineConfig: Partial<TimelineConfig> = {
      startDate: new Date(startDate),
      endDate: new Date(endDate),
      scale,
      ...selectedTemplateData?.defaultTimeline
    };
    
    onCreate(title.trim(), selectedTemplate, timelineConfig);
    
    // Reset form
    setTitle('');
    setSelectedTemplate('training-lead');
    setErrors({});
    onClose();
  };

  const handleClose = () => {
    setTitle('');
    setSelectedTemplate('training-lead');
    setErrors({});
    onClose();
  };

  const footer = (
    <div className="flex items-center justify-between gap-4">
      <button
        onClick={handleClose}
        className="px-4 py-2 text-gray-600 hover:text-gray-800 transition-colors"
      >
        Cancel
      </button>
      <button
        onClick={handleCreate}
        disabled={!title.trim()}
        className="bg-blue-600 text-white px-6 py-2 rounded-md hover:bg-blue-700 disabled:bg-gray-300 disabled:cursor-not-allowed transition-colors"
      >
        Create Plan
      </button>
    </div>
  );

  return (
    <Windows11Modal
      isOpen={isOpen}
      onClose={handleClose}
      title="Create New Plan"
      width="700px"
      height="auto"
      footer={footer}
    >
      <ModalBody className="p-6">
        <ModalSection title="Plan Details">
          <ModalField label="Plan Title" required error={errors.title}>
            <input
              type="text"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="Enter plan title..."
              className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
            />
          </ModalField>
        </ModalSection>

        <ModalSection title="Choose Template">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            {PLAN_TEMPLATES.map((template) => (
              <div
                key={template.id}
                className={`p-4 border-2 rounded-lg cursor-pointer transition-all duration-200 ${
                  selectedTemplate === template.id
                    ? 'border-blue-500 bg-blue-50'
                    : 'border-gray-200 hover:border-gray-300 hover:bg-gray-50'
                }`}
                onClick={() => setSelectedTemplate(template.id)}
              >
                <div className="flex items-start gap-3">
                  <div className="flex-1">
                    <h3 className="font-semibold text-gray-900 mb-1">
                      {template.name}
                    </h3>
                    <p className="text-sm text-gray-600">
                      {template.description}
                    </p>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </ModalSection>

        <ModalSection title="Timeline Configuration">
          <ModalGrid cols={2}>
            <ModalField label="Start Date" required error={errors.startDate}>
              <input
                type="date"
                value={startDate}
                onChange={(e) => setStartDate(e.target.value)}
                className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              />
            </ModalField>
            
            <ModalField label="End Date" required error={errors.endDate}>
              <input
                type="date"
                value={endDate}
                onChange={(e) => setEndDate(e.target.value)}
                className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              />
            </ModalField>
          </ModalGrid>
          
          <ModalField label="Timeline Scale">
            <select
              value={scale}
              onChange={(e) => setScale(e.target.value as 'weeks' | 'months' | 'quarters')}
              className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
            >
              <option value="weeks">Weeks</option>
              <option value="months">Months</option>
              <option value="quarters">Quarters</option>
            </select>
          </ModalField>
        </ModalSection>
      </ModalBody>
    </Windows11Modal>
  );
}