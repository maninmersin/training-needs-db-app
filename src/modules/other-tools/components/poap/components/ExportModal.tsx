import { useState } from 'react';
import type { ExportOptions } from '../types';
import Windows11Modal, { ModalBody, ModalSection, ModalField } from './ui/Windows11Modal';

interface ExportModalProps {
  isOpen: boolean;
  onClose: () => void;
  onExport: (options: ExportOptions) => void;
}

export default function ExportModal({ isOpen, onClose, onExport }: ExportModalProps) {
  const [format, setFormat] = useState<ExportOptions['format']>('png');
  const [includeTimeline, setIncludeTimeline] = useState(true);
  const [includeSwimlaneTitles, setIncludeSwimlaneTitles] = useState(true);
  const [includeCardDescriptions, setIncludeCardDescriptions] = useState(true);
  const [includeMilestones, setIncludeMilestones] = useState(true);
  const [colorScheme, setColorScheme] = useState<ExportOptions['colorScheme']>('default');

  const handleExport = () => {
    onExport({
      format,
      includeTimeline,
      includeSwimlaneTitles,
      includeCardDescriptions,
      includeMilestones,
      colorScheme
    });
    onClose();
  };

  const footer = (
    <div className="flex items-center justify-between gap-4">
      <button
        onClick={onClose}
        className="px-4 py-2 text-gray-600 hover:text-gray-800 transition-colors"
      >
        Cancel
      </button>
      <button
        onClick={handleExport}
        className="bg-blue-600 text-white px-6 py-2 rounded-md hover:bg-blue-700 transition-colors"
      >
        Export
      </button>
    </div>
  );

  return (
    <Windows11Modal
      isOpen={isOpen}
      onClose={onClose}
      title="Export Plan"
      width="600px"
      height="500px"
      footer={footer}
    >
      <ModalBody className="p-6">
        <ModalSection>
          <ModalField label="Export Format">
            <select
              value={format}
              onChange={(e) => setFormat(e.target.value as ExportOptions['format'])}
              className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
            >
              <option value="png">PNG Image</option>
              <option value="svg">SVG Vector Graphics</option>
              <option value="pdf">PDF Document</option>
              <option value="json">JSON Data</option>
            </select>
          </ModalField>
          
          <ModalField label="Color Scheme">
            <select
              value={colorScheme}
              onChange={(e) => setColorScheme(e.target.value as ExportOptions['colorScheme'])}
              className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
            >
              <option value="default">Default Colors</option>
              <option value="monochrome">Monochrome</option>
              <option value="print-friendly">Print Friendly</option>
            </select>
          </ModalField>
        </ModalSection>

        <ModalSection title="Include Elements">
          <div className="space-y-3">
            <div className="flex items-center">
              <input
                type="checkbox"
                id="includeTimeline"
                checked={includeTimeline}
                onChange={(e) => setIncludeTimeline(e.target.checked)}
                className="h-4 w-4 text-blue-600 focus:ring-blue-500 border-gray-300 rounded"
              />
              <label htmlFor="includeTimeline" className="ml-3 text-sm text-gray-700">
                Timeline Grid
              </label>
            </div>
            
            <div className="flex items-center">
              <input
                type="checkbox"
                id="includeSwimlaneTitles"
                checked={includeSwimlaneTitles}
                onChange={(e) => setIncludeSwimlaneTitles(e.target.checked)}
                className="h-4 w-4 text-blue-600 focus:ring-blue-500 border-gray-300 rounded"
              />
              <label htmlFor="includeSwimlaneTitles" className="ml-3 text-sm text-gray-700">
                Swimlane Titles
              </label>
            </div>
            
            <div className="flex items-center">
              <input
                type="checkbox"
                id="includeCardDescriptions"
                checked={includeCardDescriptions}
                onChange={(e) => setIncludeCardDescriptions(e.target.checked)}
                className="h-4 w-4 text-blue-600 focus:ring-blue-500 border-gray-300 rounded"
              />
              <label htmlFor="includeCardDescriptions" className="ml-3 text-sm text-gray-700">
                Card Descriptions
              </label>
            </div>
            
            <div className="flex items-center">
              <input
                type="checkbox"
                id="includeMilestones"
                checked={includeMilestones}
                onChange={(e) => setIncludeMilestones(e.target.checked)}
                className="h-4 w-4 text-blue-600 focus:ring-blue-500 border-gray-300 rounded"
              />
              <label htmlFor="includeMilestones" className="ml-3 text-sm text-gray-700">
                Milestones
              </label>
            </div>
          </div>
        </ModalSection>
      </ModalBody>
    </Windows11Modal>
  );
}