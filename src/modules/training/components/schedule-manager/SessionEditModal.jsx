import React, { useState, useEffect } from 'react';
import { supabase } from '@core/services/supabaseClient';
import { getColorPaletteOptions, getColorByCourseTitle, getContrastTextColor } from '@core/utils/colorUtils';
import './SessionEditModal.css';

const SessionEditModal = ({ session, isOpen, onClose, onSave, onDelete, criteria }) => {
  const [formData, setFormData] = useState({
    title: '',
    custom_title: '',
    start: '',
    end: '',
    trainer_id: '',
    trainer_name: '',
    color: '#007bff',
    location: '',
    max_participants: '',
    current_participants: 0
  });
  const [trainers, setTrainers] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);

  // Get the modern color palette
  const colorPalette = getColorPaletteOptions();

  // Load trainers on component mount
  useEffect(() => {
    if (isOpen) {
      fetchTrainers();
    }
  }, [isOpen]);

  // Populate form when session changes
  useEffect(() => {
    if (session && isOpen) {
      const startDate = new Date(session.start);
      const endDate = new Date(session.end);
      
      // Get auto-assigned color if no custom color is set
      const courseTitle = session.course?.course_name || session.title;
      const autoColor = getColorByCourseTitle(courseTitle);
      const defaultColor = session.color || autoColor.backgroundColor;
      
      setFormData({
        title: session.title || '',
        custom_title: session.custom_title || '',
        start: formatDateTimeLocal(startDate),
        end: formatDateTimeLocal(endDate),
        trainer_id: session.trainer_id || '',
        trainer_name: session.trainer_name || '',
        color: defaultColor,
        location: session.location || '',
        max_participants: session.max_participants || criteria?.max_attendees || '',
        current_participants: session.current_participants || 0
      });
    }
  }, [session, isOpen, criteria]);

  const fetchTrainers = async () => {
    try {
      const { data, error } = await supabase
        .from('trainers')
        .select('id, name, email, specializations, active')
        .eq('active', true)
        .order('name');

      if (error) throw error;
      setTrainers(data || []);
    } catch (error) {
      console.error('Error fetching trainers:', error);
      setError('Failed to load trainers');
    }
  };

  const formatDateTimeLocal = (date) => {
    const year = date.getFullYear();
    const month = String(date.getMonth() + 1).padStart(2, '0');
    const day = String(date.getDate()).padStart(2, '0');
    const hours = String(date.getHours()).padStart(2, '0');
    const minutes = String(date.getMinutes()).padStart(2, '0');
    return `${year}-${month}-${day}T${hours}:${minutes}`;
  };

  const handleTrainerChange = (trainerId) => {
    const selectedTrainer = trainers.find(t => t.id === trainerId);
    setFormData({
      ...formData,
      trainer_id: trainerId,
      trainer_name: selectedTrainer ? selectedTrainer.name : ''
    });
  };

  const handleColorSelect = (color) => {
    setFormData({ ...formData, color });
  };

  const generateTitle = () => {
    const parts = [];
    if (session?.course?.course_name) parts.push(session.course.course_name);
    if (session?.sessionNumber) parts.push(`Group ${session.sessionNumber}`);
    
    // Preserve Part information from original title
    const originalTitle = session?.title || '';
    
    // Try multiple patterns for Part detection including AM/PM
    let partMatch = originalTitle.match(/\(Part \d+\s*(AM|PM)?\)/); // Pattern: (Part 1 AM) or (Part 1)
    if (!partMatch) {
      partMatch = originalTitle.match(/Part \d+\s*(AM|PM)?/); // Pattern: Part 1 AM or Part 1
    }
    if (!partMatch) {
      partMatch = originalTitle.match(/- Part \d+\s*(AM|PM)?/); // Pattern: - Part 1 AM
    }
    if (!partMatch) {
      partMatch = originalTitle.match(/\(Part \d+[^)]*\)/); // Pattern: (Part 1 anything)
    }
    
    if (partMatch) {
      const partText = partMatch[0].includes('(') ? partMatch[0] : `(${partMatch[0]})`;
      parts.push(partText);
    }
    
    if (formData.trainer_name) parts.push(`(${formData.trainer_name})`);
    
    return parts.join(' - ');
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setLoading(true);
    setError(null);

    try {
      console.log('🔄 SessionEditModal: Starting save process');
      console.log('📝 Form data:', formData);
      console.log('📊 Original session:', session);

      // Validate required fields
      if (!formData.start || !formData.end) {
        throw new Error('Start and end times are required');
      }

      const startDate = new Date(formData.start);
      const endDate = new Date(formData.end);

      if (isNaN(startDate.getTime()) || isNaN(endDate.getTime())) {
        throw new Error('Invalid date format');
      }

      if (endDate <= startDate) {
        throw new Error('End time must be after start time');
      }

      const updatedSession = {
        ...session,
        title: formData.custom_title || generateTitle(),
        custom_title: formData.custom_title,
        start: startDate,
        end: endDate,
        trainer_id: formData.trainer_id || null,
        trainer_name: formData.trainer_name,
        instructor_id: formData.trainer_id || null, // For database compatibility
        instructor_name: formData.trainer_name, // For database compatibility
        color: formData.color,
        text_color: getContrastTextColor(formData.color),
        background_color: formData.color + '20', // Add transparency
        location: formData.location,
        max_participants: formData.max_participants ? parseInt(formData.max_participants) : null,
        current_participants: parseInt(formData.current_participants) || 0,
        // Preserve original identifying information for matching
        originalStart: session.originalStart || session.start,
        originalEnd: session.originalEnd || session.end,
        originalTitle: session.originalTitle || session.title
      };

      console.log('💾 Updated session object:', updatedSession);

      if (typeof onSave !== 'function') {
        throw new Error('onSave callback is not a function');
      }

      await onSave(updatedSession);
      console.log('✅ Save completed successfully');
      onClose();
    } catch (error) {
      console.error('❌ Error in SessionEditModal save:', error);
      setError(error.message || 'An error occurred while saving');
    } finally {
      setLoading(false);
    }
  };

  const handleDelete = async () => {
    if (!onDelete) {
      setError('Delete functionality not available');
      return;
    }

    const confirmMessage = `Are you sure you want to delete this session?\n\n"${session.title}"\n\nThis action cannot be undone.`;
    
    if (!window.confirm(confirmMessage)) {
      return;
    }

    try {
      setLoading(true);
      setError(null);
      
      console.log('🗑️ SessionEditModal: Starting delete process');
      console.log('📅 Session to delete:', session);
      
      await onDelete(session);
      console.log('✅ Delete completed successfully');
      onClose();
      
    } catch (err) {
      console.error('❌ Error deleting session:', err);
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  const calculateDuration = () => {
    if (formData.start && formData.end) {
      const start = new Date(formData.start);
      const end = new Date(formData.end);
      const diffMs = end - start;
      const diffHours = diffMs / (1000 * 60 * 60);
      return diffHours > 0 ? diffHours.toFixed(1) : '0';
    }
    return '0';
  };

  if (!isOpen) return null;

  return (
    <div className="session-edit-overlay">
      <div className="session-edit-modal">
        <div className="modal-header">
          <h3>Edit Training Session</h3>
          <button onClick={onClose} className="close-btn" disabled={loading}>
            ×
          </button>
        </div>

        {error && (
          <div className="error-message">
            {error}
          </div>
        )}

        <form onSubmit={handleSubmit} className="session-form">
          <div className="form-section">
            <h4>Session Information</h4>
            <div className="form-grid">
              <div className="form-group">
                <label htmlFor="generated-title">Generated Title</label>
                <input
                  type="text"
                  id="generated-title"
                  value={generateTitle()}
                  disabled
                  className="generated-title"
                />
              </div>
              <div className="form-group">
                <label htmlFor="custom-title">Custom Title (Optional)</label>
                <input
                  type="text"
                  id="custom-title"
                  value={formData.custom_title}
                  onChange={(e) => setFormData({ ...formData, custom_title: e.target.value })}
                  placeholder="Override the generated title..."
                />
              </div>
            </div>
          </div>

          <div className="form-section">
            <h4>Schedule & Details</h4>
            <div className="form-grid">
              <div className="form-group">
                <label htmlFor="start-time">Start Time</label>
                <input
                  type="datetime-local"
                  id="start-time"
                  required
                  value={formData.start}
                  onChange={(e) => setFormData({ ...formData, start: e.target.value })}
                />
              </div>
              <div className="form-group">
                <label htmlFor="end-time">End Time</label>
                <input
                  type="datetime-local"
                  id="end-time"
                  required
                  value={formData.end}
                  onChange={(e) => setFormData({ ...formData, end: e.target.value })}
                />
              </div>
              <div className="form-group">
                <label>Duration</label>
                <input
                  type="text"
                  value={`${calculateDuration()} hours`}
                  disabled
                  className="duration-display"
                />
              </div>
              <div className="form-group">
                <label htmlFor="location">Location</label>
                <input
                  type="text"
                  id="location"
                  value={formData.location}
                  onChange={(e) => setFormData({ ...formData, location: e.target.value })}
                  placeholder="Training location..."
                />
              </div>
              <div className="form-group">
                <label htmlFor="trainer">Trainer</label>
                <select
                  id="trainer"
                  value={formData.trainer_id}
                  onChange={(e) => handleTrainerChange(e.target.value)}
                >
                  <option value="">Select a trainer...</option>
                  {trainers.map(trainer => (
                    <option key={trainer.id} value={trainer.id}>
                      {trainer.name} {trainer.email && `(${trainer.email})`}
                    </option>
                  ))}
                </select>
              </div>
              <div className="form-group">
                <label htmlFor="color-picker">Session Color</label>
                <input
                  type="color"
                  id="color-picker"
                  value={formData.color}
                  onChange={(e) => handleColorSelect(e.target.value)}
                />
              </div>
            </div>
            {formData.trainer_id && (
              <div className="trainer-info">
                {(() => {
                  const selectedTrainer = trainers.find(t => t.id === formData.trainer_id);
                  return selectedTrainer && selectedTrainer.specializations && selectedTrainer.specializations.length > 0 ? (
                    <div className="trainer-specializations">
                      <strong>{selectedTrainer.name}:</strong>
                      {selectedTrainer.specializations.map((spec, index) => (
                        <span key={index} className="specialization-badge">
                          {spec}
                        </span>
                      ))}
                    </div>
                  ) : null;
                })()}
              </div>
            )}
          </div>

          <div className="form-section">
            <h4>Quick Color Palette</h4>
            <div className="color-palette">
              {colorPalette.map((colorOption) => (
                <button
                  key={colorOption.id}
                  type="button"
                  className={`color-option ${formData.color === colorOption.backgroundColor ? 'selected' : ''}`}
                  style={{ 
                    backgroundColor: colorOption.backgroundColor,
                    color: colorOption.textColor,
                    border: `2px solid ${colorOption.borderColor}`
                  }}
                  onClick={() => handleColorSelect(colorOption.backgroundColor)}
                  title={colorOption.name}
                >
                  {/* Color swatch only, name in tooltip */}
                </button>
              ))}
            </div>
          </div>

          <div className="form-section">
            <h4>Participants</h4>
            <div className="form-grid">
              <div className="form-group">
                <label htmlFor="max-participants">
                  Max Participants
                  {criteria?.max_attendees && !session.max_participants && (
                    <span style={{ fontSize: '12px', fontWeight: 'normal', color: '#6c757d' }}>
                      (from criteria: {criteria.max_attendees})
                    </span>
                  )}
                </label>
                <input
                  type="number"
                  id="max-participants"
                  min="1"
                  value={formData.max_participants}
                  onChange={(e) => setFormData({ ...formData, max_participants: e.target.value })}
                  placeholder={criteria?.max_attendees ? `Default: ${criteria.max_attendees}` : "Max..."}
                />
              </div>
              <div className="form-group">
                <label htmlFor="current-participants">Current Participants</label>
                <input
                  type="number"
                  id="current-participants"
                  min="0"
                  value={formData.current_participants}
                  onChange={(e) => setFormData({ ...formData, current_participants: e.target.value })}
                />
              </div>
            </div>
          </div>

          <div className="form-actions">
            <div className="left-actions">
              {onDelete && (
                <button 
                  type="button" 
                  onClick={handleDelete} 
                  className="delete-btn" 
                  disabled={loading}
                >
                  {loading ? 'Deleting...' : '🗑️ Delete Session'}
                </button>
              )}
            </div>
            <div className="right-actions">
              <button type="button" onClick={onClose} className="cancel-btn" disabled={loading}>
                Cancel
              </button>
              <button type="submit" className="save-btn" disabled={loading}>
                {loading ? 'Saving...' : 'Save Changes'}
              </button>
            </div>
          </div>
        </form>
      </div>
    </div>
  );
};

export default SessionEditModal;