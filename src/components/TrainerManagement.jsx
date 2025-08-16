import React, { useState, useEffect } from 'react';
import { supabase } from '../supabaseClient';
import './TrainerManagement.css';

const TrainerManagement = () => {
  const [trainers, setTrainers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [searchTerm, setSearchTerm] = useState('');
  const [showAddForm, setShowAddForm] = useState(false);
  const [editingTrainer, setEditingTrainer] = useState(null);
  const [formData, setFormData] = useState({
    name: '',
    email: '',
    phone: '',
    specializations: '',
    bio: '',
    active: true
  });

  // Filter trainers based on search term
  const filteredTrainers = trainers.filter(trainer => {
    const searchLower = searchTerm.toLowerCase();
    return (
      trainer.name.toLowerCase().includes(searchLower) ||
      trainer.email?.toLowerCase().includes(searchLower) ||
      trainer.specializations?.some(spec => spec.toLowerCase().includes(searchLower))
    );
  });

  // Fetch trainers from database
  useEffect(() => {
    fetchTrainers();
  }, []);

  const fetchTrainers = async () => {
    try {
      setLoading(true);
      const { data, error } = await supabase
        .from('trainers')
        .select('*')
        .order('name', { ascending: true });

      if (error) throw error;
      setTrainers(data || []);
    } catch (error) {
      setError(error.message);
    } finally {
      setLoading(false);
    }
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    try {
      const trainerData = {
        ...formData,
        specializations: formData.specializations
          .split(',')
          .map(s => s.trim())
          .filter(s => s.length > 0)
      };

      if (editingTrainer) {
        // Update existing trainer
        const { error } = await supabase
          .from('trainers')
          .update(trainerData)
          .eq('id', editingTrainer.id);

        if (error) throw error;
      } else {
        // Create new trainer
        const { error } = await supabase
          .from('trainers')
          .insert([trainerData]);

        if (error) throw error;
      }

      // Reset form and refresh data
      resetForm();
      fetchTrainers();
    } catch (error) {
      setError(error.message);
    }
  };

  const handleEdit = (trainer) => {
    setEditingTrainer(trainer);
    setFormData({
      name: trainer.name,
      email: trainer.email || '',
      phone: trainer.phone || '',
      specializations: trainer.specializations?.join(', ') || '',
      bio: trainer.bio || '',
      active: trainer.active
    });
    setShowAddForm(true);
  };

  const handleDelete = async (trainerId) => {
    if (!window.confirm('Are you sure you want to delete this trainer?')) {
      return;
    }

    try {
      const { error } = await supabase
        .from('trainers')
        .delete()
        .eq('id', trainerId);

      if (error) throw error;
      fetchTrainers();
    } catch (error) {
      setError(error.message);
    }
  };

  const toggleStatus = async (trainer) => {
    try {
      const { error } = await supabase
        .from('trainers')
        .update({ active: !trainer.active })
        .eq('id', trainer.id);

      if (error) throw error;
      fetchTrainers();
    } catch (error) {
      setError(error.message);
    }
  };

  const resetForm = () => {
    setFormData({
      name: '',
      email: '',
      phone: '',
      specializations: '',
      bio: '',
      active: true
    });
    setEditingTrainer(null);
    setShowAddForm(false);
  };

  const exportToCSV = () => {
    const headers = ['Name', 'Email', 'Phone', 'Specializations', 'Status', 'Bio'];
    const csvData = filteredTrainers.map(trainer => [
      trainer.name,
      trainer.email || '',
      trainer.phone || '',
      trainer.specializations?.join('; ') || '',
      trainer.active ? 'Active' : 'Inactive',
      trainer.bio || ''
    ]);

    const csvContent = [headers, ...csvData]
      .map(row => row.map(field => `"${field}"`).join(','))
      .join('\n');

    const blob = new Blob([csvContent], { type: 'text/csv' });
    const url = window.URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'trainers.csv';
    a.click();
    window.URL.revokeObjectURL(url);
  };

  if (loading) {
    return (
      <div className="trainer-management">
        <div className="loading-state">
          <h3>Loading trainers...</h3>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="trainer-management">
        <div className="error-state">
          <h3>Error loading trainers</h3>
          <p>{error}</p>
          <button onClick={fetchTrainers} className="retry-btn">
            Retry
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="trainer-management">
      <div className="trainer-header">
        <h2>Trainer Management</h2>
        <p className="trainer-description">
          Manage training instructors, their specializations, and contact information.
        </p>
      </div>

      <div className="trainer-controls">
        <div className="search-container">
          <div className="search-section">
            <input
              type="text"
              placeholder="Search trainers by name, email, or specialization..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="search-input"
            />
          </div>
          <div className="action-section">
            <button
              onClick={() => setShowAddForm(true)}
              className="add-trainer-btn"
            >
              Add New Trainer
            </button>
            <button
              onClick={exportToCSV}
              className="export-btn"
              disabled={filteredTrainers.length === 0}
            >
              Export to CSV
            </button>
          </div>
        </div>
      </div>

      {showAddForm && (
        <div className="trainer-form-container">
          <div className="trainer-form-header">
            <h3>{editingTrainer ? 'Edit Trainer' : 'Add New Trainer'}</h3>
            <button onClick={resetForm} className="close-btn">×</button>
          </div>
          <form onSubmit={handleSubmit} className="trainer-form">
            <div className="form-grid">
              <div className="form-group">
                <label htmlFor="name">Name *</label>
                <input
                  type="text"
                  id="name"
                  required
                  value={formData.name}
                  onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                />
              </div>
              <div className="form-group">
                <label htmlFor="email">Email</label>
                <input
                  type="email"
                  id="email"
                  value={formData.email}
                  onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                />
              </div>
              <div className="form-group">
                <label htmlFor="phone">Phone</label>
                <input
                  type="tel"
                  id="phone"
                  value={formData.phone}
                  onChange={(e) => setFormData({ ...formData, phone: e.target.value })}
                />
              </div>
              <div className="form-group">
                <label htmlFor="active">Status</label>
                <select
                  id="active"
                  value={formData.active}
                  onChange={(e) => setFormData({ ...formData, active: e.target.value === 'true' })}
                >
                  <option value="true">Active</option>
                  <option value="false">Inactive</option>
                </select>
              </div>
            </div>
            <div className="form-group">
              <label htmlFor="specializations">Specializations (comma-separated)</label>
              <input
                type="text"
                id="specializations"
                placeholder="e.g., Safety Training, IT Training, Leadership"
                value={formData.specializations}
                onChange={(e) => setFormData({ ...formData, specializations: e.target.value })}
              />
            </div>
            <div className="form-group">
              <label htmlFor="bio">Bio</label>
              <textarea
                id="bio"
                rows="3"
                placeholder="Brief description of trainer's background and expertise..."
                value={formData.bio}
                onChange={(e) => setFormData({ ...formData, bio: e.target.value })}
              />
            </div>
            <div className="form-actions">
              <button type="button" onClick={resetForm} className="cancel-btn">
                Cancel
              </button>
              <button type="submit" className="save-btn">
                {editingTrainer ? 'Update Trainer' : 'Add Trainer'}
              </button>
            </div>
          </form>
        </div>
      )}

      <div className="trainers-table-container">
        <table className="trainers-table">
          <thead className="table-header">
            <tr>
              <th style={{width: '20%'}}>Name</th>
              <th style={{width: '18%'}}>Email</th>
              <th style={{width: '12%'}}>Phone</th>
              <th style={{width: '25%'}}>Specializations</th>
              <th style={{width: '10%'}}>Status</th>
              <th style={{width: '15%'}}>Actions</th>
            </tr>
          </thead>
          <tbody>
            {filteredTrainers.map((trainer) => (
              <tr key={trainer.id}>
                <td className="trainer-name">{trainer.name}</td>
                <td>{trainer.email || 'N/A'}</td>
                <td>{trainer.phone || 'N/A'}</td>
                <td>
                  <div className="specializations">
                    {trainer.specializations?.map((spec, index) => (
                      <span key={index} className="specialization-tag">
                        {spec}
                      </span>
                    )) || 'None'}
                  </div>
                </td>
                <td>
                  <span className={`status-badge ${trainer.active ? 'active' : 'inactive'}`}>
                    {trainer.active ? 'Active' : 'Inactive'}
                  </span>
                </td>
                <td>
                  <div className="action-buttons">
                    <button
                      onClick={() => handleEdit(trainer)}
                      className="edit-btn"
                      title="Edit trainer"
                    >
                      Edit
                    </button>
                    <button
                      onClick={() => toggleStatus(trainer)}
                      className={`toggle-btn ${trainer.active ? 'deactivate' : 'activate'}`}
                      title={trainer.active ? 'Deactivate' : 'Activate'}
                    >
                      {trainer.active ? 'Deactivate' : 'Activate'}
                    </button>
                    <button
                      onClick={() => handleDelete(trainer.id)}
                      className="delete-btn"
                      title="Delete trainer"
                    >
                      Delete
                    </button>
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>

        <div className="table-footer">
          Showing {filteredTrainers.length} of {trainers.length} trainers
        </div>
      </div>
    </div>
  );
};

export default TrainerManagement;