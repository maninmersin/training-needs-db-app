import React, { memo, useCallback } from 'react';
import { useDragDrop, DRAG_DROP_ACTIONS } from './DragDropProvider';

const AssignmentActions = memo(({ 
  onClose,
  onSaveAssignments,
  onExportAssignments,
  hasUnsavedChanges = false 
}) => {
  const { state, dispatch } = useDragDrop();
  const { dragMode, loading } = state;

  const handleToggleDragMode = useCallback(() => {
    dispatch({ 
      type: DRAG_DROP_ACTIONS.SET_DRAG_MODE, 
      payload: !dragMode 
    });
  }, [dragMode, dispatch]);

  const handleSave = useCallback(async () => {
    if (onSaveAssignments) {
      dispatch({ type: DRAG_DROP_ACTIONS.SET_LOADING, payload: true });
      try {
        await onSaveAssignments();
      } catch (error) {
        dispatch({ 
          type: DRAG_DROP_ACTIONS.SET_ERROR, 
          payload: error.message 
        });
      } finally {
        dispatch({ type: DRAG_DROP_ACTIONS.SET_LOADING, payload: false });
      }
    }
  }, [onSaveAssignments, dispatch]);

  const handleExport = useCallback(() => {
    if (onExportAssignments) {
      onExportAssignments();
    }
  }, [onExportAssignments]);

  return (
    <div className="assignment-actions">
      <div className="action-group">
        <button
          className={`toggle-button ${dragMode ? 'active' : ''}`}
          onClick={handleToggleDragMode}
          disabled={loading}
        >
          {dragMode ? '🔒 Drag Mode' : '👆 Click Mode'}
        </button>
        
        <span className="mode-info">
          {dragMode 
            ? 'Drag users to assign them to sessions' 
            : 'Click sessions to view/edit details'
          }
        </span>
      </div>

      <div className="action-group">
        <button
          className="export-button"
          onClick={handleExport}
          disabled={loading}
        >
          📊 Export Assignments
        </button>
        
        <button
          className={`save-button ${hasUnsavedChanges ? 'has-changes' : ''}`}
          onClick={handleSave}
          disabled={loading || !hasUnsavedChanges}
        >
          {loading ? '💾 Saving...' : hasUnsavedChanges ? '💾 Save Changes' : '✅ Saved'}
        </button>
        
        <button
          className="close-button"
          onClick={onClose}
          disabled={loading}
        >
          ✕ Close
        </button>
      </div>
    </div>
  );
});

AssignmentActions.displayName = 'AssignmentActions';

export default AssignmentActions;