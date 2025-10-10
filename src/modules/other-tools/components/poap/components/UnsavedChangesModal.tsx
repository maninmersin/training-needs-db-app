import React from 'react';
import Windows11Modal from './ui/Windows11Modal';

interface UnsavedChangesModalProps {
  isOpen: boolean;
  onSave: () => void;
  onDiscard: () => void;
  onCancel: () => void;
  planTitle?: string;
  action?: string; // e.g., "switch plans", "close plan", "navigate away"
}

export default function UnsavedChangesModal({ 
  isOpen, 
  onSave, 
  onDiscard, 
  onCancel,
  planTitle = "this plan",
  action = "continue"
}: UnsavedChangesModalProps) {
  
  const footer = (
    <div className="flex items-center justify-end gap-3">
      <button
        onClick={onCancel}
        className="px-4 py-2 text-gray-600 hover:text-gray-800 transition-colors"
      >
        Cancel
      </button>
      <button
        onClick={onDiscard}
        className="px-4 py-2 text-red-600 hover:text-red-700 border border-red-300 rounded-md hover:bg-red-50 transition-colors"
      >
        Don't Save
      </button>
      <button
        onClick={onSave}
        className="bg-blue-600 text-white px-6 py-2 rounded-md hover:bg-blue-700 transition-colors"
      >
        Save Changes
      </button>
    </div>
  );

  return (
    <Windows11Modal
      isOpen={isOpen}
      onClose={onCancel}
      title="Unsaved Changes"
      width="500px"
      height="auto"
      footer={footer}
      isDraggable={false}
    >
      <div className="p-6">
        <div className="flex items-start gap-4">
          {/* Warning Icon */}
          <div className="flex-shrink-0">
            <div className="w-12 h-12 bg-yellow-100 rounded-full flex items-center justify-center">
              <svg className="w-6 h-6 text-yellow-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-2.5L13.732 4c-.77-.833-1.964-.833-2.732 0L4.082 16.5c-.77.833.192 2.5 1.732 2.5z" />
              </svg>
            </div>
          </div>
          
          {/* Content */}
          <div className="flex-1">
            <h3 className="text-lg font-semibold text-gray-900 mb-2">
              Save changes to "{planTitle}"?
            </h3>
            <p className="text-gray-600 mb-4">
              You have unsaved changes that will be lost if you {action} without saving.
            </p>
            <p className="text-sm text-gray-500">
              Choose "Save Changes" to keep your work, or "Don't Save" to discard changes.
            </p>
          </div>
        </div>
      </div>
    </Windows11Modal>
  );
}