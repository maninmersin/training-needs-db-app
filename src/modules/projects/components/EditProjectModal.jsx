import React, { useMemo } from 'react';
import ProjectFormDialog from './ProjectFormDialog';
import { projectToForm } from './projectValidation';

const EditProjectModal = ({ isOpen, onClose, onSubmit, project }) => {
  const initialValues = useMemo(() => (project ? projectToForm(project) : undefined), [project]);
  if (!isOpen || !project) return null;

  return (
    <ProjectFormDialog
      isOpen={isOpen}
      onClose={onClose}
      onSubmit={(form) => onSubmit(project.id, form)}
      title="Edit Project"
      submitLabel="Update Project"
      submittingLabel="Updating Project..."
      initialValues={initialValues}
      showDataSource
    />
  );
};

export default EditProjectModal;
