import { filterTrainers, formToTrainer, parseSpecializations, trainerToForm, trainersToCsv, validateTrainerForm } from '../trainersLogic';

const TRAINERS = [
  { id: 't1', name: 'Alice Smith', email: 'alice@x.com', phone: '0123', specializations: ['Safety Training', 'Leadership'], bio: 'Ex-ops', active: true },
  { id: 't2', name: 'Bob Jones', email: null, phone: null, specializations: [], bio: null, active: false },
  { id: 't3', name: 'Cara "CJ" Lee', email: 'cara@x.com', phone: null, specializations: ['IT'], bio: 'Says "hi"', active: true }
];

describe('filterTrainers', () => {
  const ids = (term) => filterTrainers(TRAINERS, term).map((t) => t.id);

  test('matches name, email or any specialization, ignoring case', () => {
    expect(ids('ALICE')).toEqual(['t1']);
    expect(ids('cara@')).toEqual(['t3']);
    expect(ids('leader')).toEqual(['t1']);
    expect(ids('it')).toEqual(expect.arrayContaining(['t1', 't3']));
  });

  test('a trainer with no email or specializations does not break the search', () => {
    expect(ids('bob')).toEqual(['t2']);
    expect(ids('zzz')).toEqual([]);
    expect(ids('')).toHaveLength(3);
  });
});

describe('specializations and the form', () => {
  test('comma-separated text becomes a clean list', () => {
    expect(parseSpecializations('Safety, IT ,, Leadership ')).toEqual(['Safety', 'IT', 'Leadership']);
    expect(parseSpecializations('')).toEqual([]);
  });

  test('a trainer round-trips through the form', () => {
    expect(formToTrainer(trainerToForm(TRAINERS[0]))).toEqual({
      name: 'Alice Smith', email: 'alice@x.com', phone: '0123', specializations: ['Safety Training', 'Leadership'], bio: 'Ex-ops', active: true
    });
  });

  test('missing optional values show as empty text', () => {
    expect(trainerToForm(TRAINERS[1])).toEqual({ name: 'Bob Jones', email: '', phone: '', specializations: '', bio: '', active: false });
  });

  test('the name is required and a given email must be a full address', () => {
    const form = { name: 'A', email: '', phone: '', specializations: '', bio: '', active: true };
    expect(validateTrainerForm(form)).toEqual({});
    expect(validateTrainerForm({ ...form, name: '  ' }).name).toBe('Name is required');
    expect(validateTrainerForm({ ...form, email: 'alice@x' }).email).toBe('Enter a full email address');
    expect(validateTrainerForm({ ...form, email: ' alice@x.com ' })).toEqual({});
  });
});

describe('trainersToCsv', () => {
  test('has a header, one line per trainer, and doubled quotes inside values', () => {
    const lines = trainersToCsv(TRAINERS).split('\n');
    expect(lines[0]).toBe('"Name","Email","Phone","Specializations","Status","Bio"');
    expect(lines[1]).toBe('"Alice Smith","alice@x.com","0123","Safety Training; Leadership","Active","Ex-ops"');
    expect(lines[2]).toBe('"Bob Jones","","","","Inactive",""');
    expect(lines[3]).toBe('"Cara ""CJ"" Lee","cara@x.com","","IT","Active","Says ""hi"""');
  });
});
