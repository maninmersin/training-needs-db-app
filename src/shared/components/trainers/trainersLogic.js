// Pure rules for the Trainers screen: search, form validation, and the CSV export. No React, no database.

const EMAIL = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

/** Search over name, email and specializations (any one containing the text). */
export function filterTrainers(trainers, searchTerm) {
  const needle = searchTerm.toLowerCase();
  return trainers.filter(
    (trainer) =>
      trainer.name.toLowerCase().includes(needle) ||
      Boolean(trainer.email?.toLowerCase().includes(needle)) ||
      Boolean(trainer.specializations?.some((spec) => spec.toLowerCase().includes(needle)))
  );
}

/** "Safety, IT ,, Leadership" -> ['Safety', 'IT', 'Leadership'] */
export const parseSpecializations = (text) =>
  text
    .split(',')
    .map((part) => part.trim())
    .filter((part) => part.length > 0);

export const BLANK_TRAINER_FORM = { name: '', email: '', phone: '', specializations: '', bio: '', active: true };

export const trainerToForm = (trainer) => ({
  name: trainer.name,
  email: trainer.email || '',
  phone: trainer.phone || '',
  specializations: trainer.specializations?.join(', ') || '',
  bio: trainer.bio || '',
  active: trainer.active
});

/** { field: message } for the form; empty means valid. */
export function validateTrainerForm(form) {
  const errors = {};
  if (!form.name.trim()) errors.name = 'Name is required';
  if (form.email.trim() && !EMAIL.test(form.email.trim())) errors.email = 'Enter a full email address';
  return errors;
}

/** What is saved: the form with specializations turned into a list. */
export const formToTrainer = (form) => ({ ...form, specializations: parseSpecializations(form.specializations) });

const csvField = (value) => `"${String(value).replace(/"/g, '""')}"`;

/** CSV text for the Export button (quotes inside a value are doubled so the file opens correctly). */
export function trainersToCsv(trainers) {
  const headers = ['Name', 'Email', 'Phone', 'Specializations', 'Status', 'Bio'];
  const rows = trainers.map((trainer) => [
    trainer.name,
    trainer.email || '',
    trainer.phone || '',
    trainer.specializations?.join('; ') || '',
    trainer.active ? 'Active' : 'Inactive',
    trainer.bio || ''
  ]);
  return [headers, ...rows].map((row) => row.map(csvField).join(',')).join('\n');
}
