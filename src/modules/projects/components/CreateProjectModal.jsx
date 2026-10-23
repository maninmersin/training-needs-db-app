import React from 'react';
import ProjectFormDialog from './ProjectFormDialog';

const CreateProjectModal = ({ isOpen, onClose, onSubmit }) => (
  <ProjectFormDialog
    isOpen={isOpen}
    onClose={onClose}
    onSubmit={onSubmit}
    title="Create New Project"
    submitLabel="Create Project"
    submittingLabel="Creating Project..."
  />
);

export default CreateProjectModal;
