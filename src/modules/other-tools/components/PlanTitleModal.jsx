import React, { useState } from 'react';

const PlanTitleModal = ({ isOpen, currentTitle, onSave, onCancel }) => {
  const [title, setTitle] = useState(currentTitle);

  if (!isOpen) return null;

  const handleSave = () => {
    onSave(title);
  };

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
      <div className="bg-white p-6 rounded-lg shadow-lg w-96">
        <h3 className="text-lg font-semibold mb-4">Edit Plan Title</h3>
        <input
          type="text"
          value={title}
          onChange={(e) => setTitle(e.target.value)}
          className="w-full border border-gray-300 rounded px-3 py-2 mb-4"
          placeholder="Plan title"
        />
        <div className="flex gap-2 justify-end">
          <button 
            onClick={onCancel}
            className="px-4 py-2 bg-gray-200 rounded hover:bg-gray-300"
          >
            Cancel
          </button>
          <button 
            onClick={handleSave}
            className="px-4 py-2 bg-blue-600 text-white rounded hover:bg-blue-700"
          >
            Save
          </button>
        </div>
      </div>
    </div>
  );
};

export default PlanTitleModal;