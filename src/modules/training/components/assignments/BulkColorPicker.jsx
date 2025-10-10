import React, { useState } from 'react';
import { getColorPaletteOptions, getContrastTextColor } from '@core/utils/colorUtils';
import './BulkColorPicker.css';

const BulkColorPicker = ({ isOpen, onClose, selectedEvents, sessions, onApply }) => {
  const [selectedColor, setSelectedColor] = useState('');
  const [customColor, setCustomColor] = useState('#007bff');
  const [useCustomColor, setUseCustomColor] = useState(false);
  const [showPreview, setShowPreview] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);

  const colorPalette = getColorPaletteOptions();

  const getSelectedSessionsData = () => {
    const selectedSessionsData = [];
    Object.entries(sessions).forEach(([location, functionalAreas]) => {
      Object.entries(functionalAreas).forEach(([functionalArea, sessionList]) => {
        sessionList.forEach(session => {
          const eventId = session.eventId || `${session.title}-${session.start.getTime()}-${session.end.getTime()}`;
          if (selectedEvents.has(eventId)) {
            selectedSessionsData.push({
              ...session,
              eventId,
              location,
              functionalArea
            });
          }
        });
      });
    });
    return selectedSessionsData;
  };

  const getSelectedColorData = () => {
    if (useCustomColor) {
      return {
        backgroundColor: customColor,
        textColor: getContrastTextColor(customColor),
        borderColor: customColor,
        name: 'Custom Color'
      };
    } else if (selectedColor) {
      const colorOption = colorPalette.find(c => c.id === selectedColor);
      return {
        backgroundColor: colorOption.backgroundColor,
        textColor: colorOption.textColor,
        borderColor: colorOption.borderColor,
        name: colorOption.name
      };
    }
    return null;
  };

  const handleColorSelect = (colorId) => {
    setSelectedColor(colorId);
    setUseCustomColor(false);
  };

  const handleCustomColorToggle = () => {
    setUseCustomColor(!useCustomColor);
    if (!useCustomColor) {
      setSelectedColor('');
    }
  };

  const handlePreview = () => {
    const colorData = getSelectedColorData();
    if (!colorData) {
      setError('Please select a color');
      return;
    }
    setError(null);
    setShowPreview(true);
  };

  const handleApply = async () => {
    const colorData = getSelectedColorData();
    if (!colorData) {
      setError('Please select a color');
      return;
    }

    setLoading(true);
    setError(null);

    try {
      const selectedSessionsData = getSelectedSessionsData();
      const updatedSessions = { ...sessions };
      
      selectedSessionsData.forEach(sessionData => {
        const { location, functionalArea, eventId } = sessionData;
        
        if (updatedSessions[location] && updatedSessions[location][functionalArea]) {
          updatedSessions[location][functionalArea] = updatedSessions[location][functionalArea].map(session => {
            const currentEventId = session.eventId || `${session.title}-${session.start.getTime()}-${session.end.getTime()}`;
            if (currentEventId === eventId) {
              return {
                ...session,
                color: colorData.backgroundColor,
                text_color: colorData.textColor,
                border_color: colorData.borderColor
              };
            }
            return session;
          });
        }
      });

      await onApply(updatedSessions);
      onClose();
    } catch (error) {
      console.error('Error applying color changes:', error);
      setError('Failed to apply color changes');
    } finally {
      setLoading(false);
    }
  };

  const handleClose = () => {
    setSelectedColor('');
    setCustomColor('#007bff');
    setUseCustomColor(false);
    setShowPreview(false);
    setError(null);
    onClose();
  };

  if (!isOpen) return null;

  const selectedSessionsData = getSelectedSessionsData();
  const selectedColorData = getSelectedColorData();

  return (
    <div className="bulk-color-overlay">
      <div className="bulk-color-modal">
        <div className="modal-header">
          <h3>Change Color for {selectedEvents.size} Events</h3>
          <button onClick={handleClose} className="close-btn" disabled={loading}>
            ×
          </button>
        </div>

        {error && (
          <div className="error-message">
            {error}
          </div>
        )}

        <div className="modal-content">
          {!showPreview ? (
            <>
              <div className="color-selection-section">
                <h4>Select Color</h4>
                
                <div className="preset-colors">
                  <h5>Preset Colors</h5>
                  <div className="color-palette">
                    {colorPalette.map((colorOption) => (
                      <button
                        key={colorOption.id}
                        type="button"
                        className={`color-option ${selectedColor === colorOption.id && !useCustomColor ? 'selected' : ''}`}
                        style={{ 
                          backgroundColor: colorOption.backgroundColor,
                          color: colorOption.textColor,
                          border: `2px solid ${colorOption.borderColor}`
                        }}
                        onClick={() => handleColorSelect(colorOption.id)}
                        title={colorOption.name}
                      >
                        {colorOption.name}
                        {selectedColor === colorOption.id && !useCustomColor && ' ✓'}
                      </button>
                    ))}
                  </div>
                </div>

                <div className="custom-color-section">
                  <div className="custom-color-toggle">
                    <input
                      type="checkbox"
                      id="use-custom-color"
                      checked={useCustomColor}
                      onChange={handleCustomColorToggle}
                    />
                    <label htmlFor="use-custom-color">Use custom color</label>
                  </div>
                  
                  {useCustomColor && (
                    <div className="custom-color-picker">
                      <input
                        type="color"
                        value={customColor}
                        onChange={(e) => setCustomColor(e.target.value)}
                        className="color-input"
                      />
                      <div 
                        className="color-preview"
                        style={{ 
                          backgroundColor: customColor,
                          color: getContrastTextColor(customColor)
                        }}
                      >
                        Custom Color Preview
                      </div>
                    </div>
                  )}
                </div>

                {selectedColorData && (
                  <div className="selected-color-preview">
                    <h5>Selected Color Preview</h5>
                    <div 
                      className="preview-swatch"
                      style={{
                        backgroundColor: selectedColorData.backgroundColor,
                        color: selectedColorData.textColor,
                        border: `2px solid ${selectedColorData.borderColor}`
                      }}
                    >
                      {selectedColorData.name}
                    </div>
                  </div>
                )}
              </div>

              <div className="selected-events-preview">
                <h4>Selected Events ({selectedEvents.size}):</h4>
                <div className="events-list">
                  {selectedSessionsData.slice(0, 5).map((session, index) => (
                    <div key={index} className="event-item">
                      <div className="event-title">{session.title}</div>
                      <div className="event-time">
                        {session.start.toLocaleDateString('en-GB')} {session.start.toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit' })}
                      </div>
                      <div className="current-color-indicator">
                        Current: 
                        <span 
                          className="color-indicator"
                          style={{ backgroundColor: session.color || '#007bff' }}
                        ></span>
                      </div>
                    </div>
                  ))}
                  {selectedSessionsData.length > 5 && (
                    <div className="more-events">
                      ... and {selectedSessionsData.length - 5} more events
                    </div>
                  )}
                </div>
              </div>
            </>
          ) : (
            <div className="preview-section">
              <h4>Preview Color Changes</h4>
              <div className="preview-summary">
                <p><strong>New Color:</strong> {selectedColorData?.name}</p>
                <div 
                  className="new-color-swatch"
                  style={{
                    backgroundColor: selectedColorData?.backgroundColor,
                    color: selectedColorData?.textColor,
                    border: `2px solid ${selectedColorData?.borderColor}`
                  }}
                >
                  {selectedColorData?.name}
                </div>
                <p><strong>Events to update:</strong> {selectedEvents.size}</p>
              </div>
              
              <div className="preview-events">
                <h5>Color Changes:</h5>
                {selectedSessionsData.map((session, index) => (
                  <div key={index} className="preview-event-item">
                    <div className="event-title">{session.title}</div>
                    <div className="color-change">
                      <div className="change-from">
                        From: 
                        <span 
                          className="color-indicator"
                          style={{ backgroundColor: session.color || '#007bff' }}
                        ></span>
                      </div>
                      <span className="change-arrow">→</span>
                      <div className="change-to">
                        To: 
                        <span 
                          className="color-indicator"
                          style={{ backgroundColor: selectedColorData?.backgroundColor }}
                        ></span>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>

        <div className="modal-actions">
          <button onClick={handleClose} className="cancel-btn" disabled={loading}>
            Cancel
          </button>
          {!showPreview ? (
            <button onClick={handlePreview} className="preview-btn" disabled={!selectedColorData}>
              Preview Changes
            </button>
          ) : (
            <>
              <button onClick={() => setShowPreview(false)} className="back-btn">
                Back to Edit
              </button>
              <button 
                onClick={handleApply} 
                className="apply-btn" 
                disabled={loading}
              >
                {loading ? 'Applying...' : 'Apply Changes'}
              </button>
            </>
          )}
        </div>
      </div>
    </div>
  );
};

export default BulkColorPicker;