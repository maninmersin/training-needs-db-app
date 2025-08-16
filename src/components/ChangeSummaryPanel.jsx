import React from 'react';
import { debugLog } from '../utils/consoleUtils';
import './ChangeSummaryPanel.css';

/**
 * Change Summary Panel - Modal overlay showing all pending changes
 * 
 * Provides review interface before applying changes:
 * - Groups changes by type (Add, Remove, Move)
 * - Shows clear descriptions of each change
 * - Allows removing individual changes
 * - Bulk apply or cancel all changes
 */
const ChangeSummaryPanel = ({
  pendingChanges,
  onClose,
  onApplyChanges,
  onRemoveChange
}) => {
  debugLog('📋 ChangeSummaryPanel opened with changes:', pendingChanges.length);

  // Group changes by action type for better organization
  const groupedChanges = {
    add: pendingChanges.filter(c => c.action === 'add'),
    remove: pendingChanges.filter(c => c.action === 'remove'),
    move: pendingChanges.filter(c => c.action === 'move')
  };

  const totalChanges = pendingChanges.length;

  const handleApplyChanges = () => {
    debugLog('✅ Applying all changes from summary panel');
    onApplyChanges();
  };

  const handleRemoveChange = (changeId) => {
    debugLog('🗑️ Removing individual change:', changeId);
    onRemoveChange(changeId);
  };

  const renderChangeItem = (change) => (
    <div key={change.id} className="change-item">
      <div className="change-description">
        <span className="change-text">
          {change.description}
        </span>
        <div className="change-details">
          <span className="user-name">{change.userName}</span>
          {change.action === 'move' && change.newSessionTitle && (
            <span className="destination">→ {change.newSessionTitle}</span>
          )}
        </div>
      </div>
      
      <button
        className="remove-change-btn"
        onClick={() => handleRemoveChange(change.id)}
        title="Remove this change"
      >
        ❌
      </button>
    </div>
  );

  return (
    <div className="change-summary-overlay">
      <div className="change-summary-panel">
        {/* Header */}
        <div className="summary-header">
          <h2>📝 Review Pending Changes</h2>
          <p className="summary-description">
            Review all changes before applying them to the schedule
          </p>
          <div className="change-count">
            <span className="total-count">{totalChanges} total changes</span>
          </div>
        </div>

        {/* Changes Content */}
        <div className="summary-content">
          {totalChanges === 0 ? (
            <div className="no-changes">
              <h3>📋 No Changes Pending</h3>
              <p>You haven't made any changes yet. Click sessions in the calendar to start editing.</p>
            </div>
          ) : (
            <div className="changes-by-type">
              
              {/* Add Changes */}
              {groupedChanges.add.length > 0 && (
                <div className="change-group add-changes">
                  <div className="group-header">
                    <h3>➕ Adding Users ({groupedChanges.add.length})</h3>
                    <p>These users will be assigned to sessions:</p>
                  </div>
                  <div className="change-list">
                    {groupedChanges.add.map(renderChangeItem)}
                  </div>
                </div>
              )}

              {/* Remove Changes */}
              {groupedChanges.remove.length > 0 && (
                <div className="change-group remove-changes">
                  <div className="group-header">
                    <h3>🗑️ Removing Users ({groupedChanges.remove.length})</h3>
                    <p>These users will be unassigned from sessions:</p>
                  </div>
                  <div className="change-list">
                    {groupedChanges.remove.map(renderChangeItem)}
                  </div>
                </div>
              )}

              {/* Move Changes */}
              {groupedChanges.move.length > 0 && (
                <div className="change-group move-changes">
                  <div className="group-header">
                    <h3>🔄 Moving Users ({groupedChanges.move.length})</h3>
                    <p>These users will be reassigned to different sessions:</p>
                  </div>
                  <div className="change-list">
                    {groupedChanges.move.map(renderChangeItem)}
                  </div>
                </div>
              )}

            </div>
          )}
        </div>

        {/* Footer Actions */}
        <div className="summary-footer">
          <div className="footer-info">
            <div className="change-impact">
              <h4>📊 Change Impact:</h4>
              <ul>
                <li>👥 {groupedChanges.add.length} users will be added to sessions</li>
                <li>➖ {groupedChanges.remove.length} users will be removed from sessions</li>
                <li>🔄 {groupedChanges.move.length} users will be moved between sessions</li>
              </ul>
            </div>

            <div className="warning-notes">
              <p>⚠️ <strong>Important:</strong> These changes will be applied immediately and cannot be undone automatically.</p>
              <p>💡 <strong>Tip:</strong> Double-check session capacities and user requirements before applying.</p>
            </div>
          </div>

          <div className="footer-actions">
            <button
              className="cancel-all-btn"
              onClick={onClose}
            >
              ❌ Close Review
            </button>

            {totalChanges > 0 && (
              <>
                <button
                  className="clear-all-btn"
                  onClick={() => {
                    pendingChanges.forEach(change => onRemoveChange(change.id));
                  }}
                >
                  🗑️ Clear All Changes
                </button>

                <button
                  className="apply-all-btn"
                  onClick={handleApplyChanges}
                >
                  ✅ Apply All Changes ({totalChanges})
                </button>
              </>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};

export default ChangeSummaryPanel;