import React from 'react';

// Generic modal wrapper
const Modal = ({ isOpen, onClose, children, title }) => {
  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
      <div className="bg-white p-6 rounded-lg shadow-lg w-96 max-w-90vw">
        {title && <h3 className="text-lg font-semibold mb-4">{title}</h3>}
        {children}
      </div>
    </div>
  );
};

// Card Editor Modal
export const CardEditorModal = ({ isOpen, card, onSave, onCancel }) => (
  <Modal isOpen={isOpen} title="Edit Card">
    <div className="space-y-4">
      <input
        type="text"
        placeholder="Card title"
        className="w-full border border-gray-300 rounded px-3 py-2"
      />
      <textarea
        placeholder="Description"
        className="w-full border border-gray-300 rounded px-3 py-2"
        rows="3"
      />
      <div className="flex gap-2 justify-end">
        <button onClick={onCancel} className="px-4 py-2 bg-gray-200 rounded">Cancel</button>
        <button onClick={() => onSave({})} className="px-4 py-2 bg-blue-600 text-white rounded">Save</button>
      </div>
    </div>
  </Modal>
);

// Category Editor Modal
export const CategoryEditorModal = ({ isOpen, swimlane, onSave, onCancel }) => (
  <Modal isOpen={isOpen} title="Edit Swimlane">
    <div className="space-y-4">
      <input
        type="text"
        placeholder="Swimlane title"
        className="w-full border border-gray-300 rounded px-3 py-2"
      />
      <div className="flex gap-2 justify-end">
        <button onClick={onCancel} className="px-4 py-2 bg-gray-200 rounded">Cancel</button>
        <button onClick={() => onSave({})} className="px-4 py-2 bg-blue-600 text-white rounded">Save</button>
      </div>
    </div>
  </Modal>
);

// Milestone Editor Modal
export const MilestoneEditorModal = ({ isOpen, milestone, onSave, onCancel }) => (
  <Modal isOpen={isOpen} title="Edit Milestone">
    <div className="space-y-4">
      <input
        type="text"
        placeholder="Milestone title"
        className="w-full border border-gray-300 rounded px-3 py-2"
      />
      <div className="flex gap-2 justify-end">
        <button onClick={onCancel} className="px-4 py-2 bg-gray-200 rounded">Cancel</button>
        <button onClick={() => onSave({})} className="px-4 py-2 bg-blue-600 text-white rounded">Save</button>
      </div>
    </div>
  </Modal>
);

// Text Properties Modal
export const TextPropertiesModal = ({ isOpen, textElement, onSave, onCancel, onDelete }) => (
  <Modal isOpen={isOpen} title="Text Properties">
    <div className="space-y-4">
      <textarea
        placeholder="Text content"
        className="w-full border border-gray-300 rounded px-3 py-2"
        rows="3"
      />
      <div className="flex gap-2 justify-end">
        {onDelete && <button onClick={onDelete} className="px-4 py-2 bg-red-600 text-white rounded">Delete</button>}
        <button onClick={onCancel} className="px-4 py-2 bg-gray-200 rounded">Cancel</button>
        <button onClick={() => onSave({})} className="px-4 py-2 bg-blue-600 text-white rounded">Save</button>
      </div>
    </div>
  </Modal>
);

// Shape Properties Modal
export const ShapePropertiesModal = ({ isOpen, shape, onSave, onCancel, onDelete }) => (
  <Modal isOpen={isOpen} title="Shape Properties">
    <div className="space-y-4">
      <select className="w-full border border-gray-300 rounded px-3 py-2">
        <option value="rectangle">Rectangle</option>
        <option value="circle">Circle</option>
        <option value="line">Line</option>
      </select>
      <div className="flex gap-2 justify-end">
        {onDelete && <button onClick={onDelete} className="px-4 py-2 bg-red-600 text-white rounded">Delete</button>}
        <button onClick={onCancel} className="px-4 py-2 bg-gray-200 rounded">Cancel</button>
        <button onClick={() => onSave({})} className="px-4 py-2 bg-blue-600 text-white rounded">Save</button>
      </div>
    </div>
  </Modal>
);

// Save As Modal
export const SaveAsModal = ({ isOpen, currentPlanName, onSave, onCancel }) => (
  <Modal isOpen={isOpen} title="Save As">
    <div className="space-y-4">
      <input
        type="text"
        placeholder="Plan name"
        className="w-full border border-gray-300 rounded px-3 py-2"
        defaultValue={currentPlanName}
      />
      <div className="flex gap-2 justify-end">
        <button onClick={onCancel} className="px-4 py-2 bg-gray-200 rounded">Cancel</button>
        <button onClick={() => onSave('new-plan')} className="px-4 py-2 bg-blue-600 text-white rounded">Save</button>
      </div>
    </div>
  </Modal>
);

// Plans Library Modal
export const PlansLibraryModal = ({ isOpen, onClose, onSelectPlan, onCreateNew }) => (
  <Modal isOpen={isOpen} title="Plans Library">
    <div className="space-y-4">
      <p>No saved plans found.</p>
      <div className="flex gap-2 justify-end">
        <button onClick={onClose} className="px-4 py-2 bg-gray-200 rounded">Close</button>
        <button onClick={onCreateNew} className="px-4 py-2 bg-blue-600 text-white rounded">Create New</button>
      </div>
    </div>
  </Modal>
);

// New Plan Modal
export const NewPlanModal = ({ isOpen, onClose, onCreate }) => (
  <Modal isOpen={isOpen} title="Create New Plan">
    <div className="space-y-4">
      <input
        type="text"
        placeholder="Plan title"
        className="w-full border border-gray-300 rounded px-3 py-2"
      />
      <div className="flex gap-2 justify-end">
        <button onClick={onClose} className="px-4 py-2 bg-gray-200 rounded">Cancel</button>
        <button onClick={() => onCreate('New Plan', 'default', {})} className="px-4 py-2 bg-blue-600 text-white rounded">Create</button>
      </div>
    </div>
  </Modal>
);

// Unsaved Changes Modal
export const UnsavedChangesModal = ({ isOpen, onSave, onDiscard, onCancel, planTitle, action }) => (
  <Modal isOpen={isOpen} title="Unsaved Changes">
    <div className="space-y-4">
      <p>You have unsaved changes in "{planTitle}". What would you like to do before you {action}?</p>
      <div className="flex gap-2 justify-end">
        <button onClick={onCancel} className="px-4 py-2 bg-gray-200 rounded">Cancel</button>
        <button onClick={onDiscard} className="px-4 py-2 bg-red-600 text-white rounded">Discard</button>
        <button onClick={onSave} className="px-4 py-2 bg-blue-600 text-white rounded">Save</button>
      </div>
    </div>
  </Modal>
);

// Export Modal
export const ExportModal = ({ isOpen, onClose, onExport }) => (
  <Modal isOpen={isOpen} title="Export Plan">
    <div className="space-y-4">
      <select className="w-full border border-gray-300 rounded px-3 py-2">
        <option value="svg">SVG</option>
        <option value="png">PNG</option>
        <option value="pdf">PDF</option>
      </select>
      <div className="flex gap-2 justify-end">
        <button onClick={onClose} className="px-4 py-2 bg-gray-200 rounded">Cancel</button>
        <button onClick={() => onExport({ format: 'svg' })} className="px-4 py-2 bg-blue-600 text-white rounded">Export</button>
      </div>
    </div>
  </Modal>
);

// Text and Shape components
export const TextBox = ({ textElement, onUpdate, onDelete, onSelect, onStartEdit, onFinishEdit }) => (
  <div 
    className="text-element"
    style={{
      left: textElement.position.x,
      top: textElement.position.y,
      width: textElement.size.width,
      height: textElement.size.height
    }}
    onClick={() => onSelect(textElement.id)}
    onDoubleClick={() => onStartEdit(textElement.id)}
  >
    {textElement.content}
  </div>
);

export const ShapeRenderer = ({ shape, onUpdate, onDelete, onSelect, onStartEdit, onPaste }) => (
  <div 
    className="shape-element"
    style={{
      left: shape.position.x,
      top: shape.position.y,
      width: shape.size.width,
      height: shape.size.height,
      backgroundColor: shape.style.fillColor
    }}
    onClick={() => onSelect(shape.id)}
    onDoubleClick={() => onStartEdit(shape.id)}
  >
    {shape.shapeType}
  </div>
);