import { useState, useEffect } from 'react';
import Windows11Modal, { ModalBody, ModalSection, ModalField } from './ui/Windows11Modal';
import { usePlanStore } from '../state/usePlanStore';

interface SaveAsModalProps {
  isOpen: boolean;
  currentPlanName: string;
  onSave: (newName: string) => Promise<void>;
  onCancel: () => void;
}

export default function SaveAsModal({ 
  isOpen, 
  currentPlanName, 
  onSave, 
  onCancel 
}: SaveAsModalProps) {
  const [newName, setNewName] = useState('');
  const [isSaving, setIsSaving] = useState(false);
  const [nameError, setNameError] = useState('');
  const { generateUniquePlanName, checkPlanNameExists } = usePlanStore();
  
  // Reset form when modal opens
  useEffect(() => {
    if (isOpen) {
      const initializeName = async () => {
        const baseName = `${currentPlanName}-copy`;
        const uniqueName = await generateUniquePlanName(baseName);
        setNewName(uniqueName);
        setIsSaving(false);
        setNameError('');
      };
      initializeName();
    }
  }, [isOpen, currentPlanName, generateUniquePlanName]);

  const handleSave = async () => {
    if (!newName.trim()) {
      setNameError('Plan name is required');
      return;
    }
    
    // Check for duplicate name
    const nameExists = await checkPlanNameExists(newName.trim());
    if (nameExists) {
      setNameError('A plan with this name already exists. Please choose a different name.');
      return;
    }
    
    setNameError('');
    setIsSaving(true);
    try {
      await onSave(newName.trim());
    } catch (error) {
      if (error instanceof Error && error.message.includes('duplicate') || error.message.includes('unique')) {
        setNameError('A plan with this name already exists. Please choose a different name.');
      }
      setIsSaving(false);
    } finally {
      // Don't set isSaving to false here if save was successful, as the modal will close
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSave();
    } else if (e.key === 'Escape') {
      e.preventDefault();
      onCancel();
    }
  };

  // Validate name as user types (with debouncing)
  useEffect(() => {
    if (!newName.trim()) {
      setNameError('');
      return;
    }

    const timeoutId = setTimeout(async () => {
      if (newName.trim() && newName.trim() !== currentPlanName) {
        const exists = await checkPlanNameExists(newName.trim());
        if (exists) {
          setNameError('A plan with this name already exists');
        } else {
          setNameError('');
        }
      }
    }, 500); // 500ms debounce

    return () => clearTimeout(timeoutId);
  }, [newName, checkPlanNameExists, currentPlanName]);

  const footerContent = (
    <>
      <button
        onClick={onCancel}
        className="px-6 py-2 text-gray-600 hover:text-gray-700 hover:bg-gray-100 rounded-lg transition-colors"
        disabled={isSaving}
      >
        Cancel
      </button>
      <button
        onClick={handleSave}
        disabled={!newName.trim() || isSaving || !!nameError}
        className="px-6 py-2 bg-teal-600 text-white hover:bg-teal-700 disabled:bg-gray-300 disabled:cursor-not-allowed rounded-lg transition-colors shadow-sm"
      >
        {isSaving ? 'Creating...' : 'Save As New Plan'}
      </button>
    </>
  );

  return (
    <Windows11Modal
      isOpen={isOpen}
      onClose={onCancel}
      title="Save As New Plan"
      width="500px"
      footer={footerContent}
    >
      <ModalBody>
        <ModalSection title="Save Plan As">
          <ModalField label="Plan Name">
            <input
              type="text"
              value={newName}
              onChange={(e) => setNewName(e.target.value)}
              onKeyDown={handleKeyDown}
              placeholder="Enter the plan name (e.g., q1-marketing-plan)"
              className={`w-full px-4 py-3 border rounded-lg focus:outline-none focus:ring-2 transition-colors font-mono text-sm ${
                nameError 
                  ? 'border-red-300 focus:ring-red-500/20 focus:border-red-500' 
                  : 'border-gray-300 focus:ring-teal-500/20 focus:border-teal-500'
              }`}
              autoFocus
            />
            {nameError ? (
              <div className="mt-1 text-xs text-red-600">
                {nameError}
              </div>
            ) : (
              <div className="mt-1 text-xs text-gray-500">
                This name will be used to identify and organize your plan in the database.
              </div>
            )}
          </ModalField>
          
          <div className="mt-4 p-4 bg-blue-50 border border-blue-200 rounded-lg">
            <div className="flex items-start gap-3">
              <svg width="20" height="20" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={2} className="text-blue-600 mt-0.5 flex-shrink-0">
                <circle cx="12" cy="12" r="10"/>
                <path d="M12 16v-4"/>
                <path d="M12 8h.01"/>
              </svg>
              <div className="text-sm text-blue-800">
                <p className="font-medium mb-1">What happens when you save as?</p>
                <ul className="space-y-1 text-blue-700">
                  <li>• Creates a complete copy of your current plan</li>
                  <li>• Includes all cards, text, shapes, and timeline settings</li>
                  <li>• Saves with the name you specify</li>
                  <li>• Switches to the new plan automatically</li>
                </ul>
              </div>
            </div>
          </div>
        </ModalSection>
      </ModalBody>
    </Windows11Modal>
  );
}