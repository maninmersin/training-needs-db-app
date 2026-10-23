import { applyNames, idsMissingNames, personOf } from '../assignmentNames';

describe('assignment names', () => {
  const rows = [
    { id: 1, end_user_id: 7, user_name: 'Pat' },
    { id: 2, end_user_id: 8, user_name: null },
    { id: 3, end_user_id: 8, user_name: '' },
    { id: 4, end_user_id: 9, end_users: { name: 'Sam' } },
    { id: 5, end_user_id: 10 }
  ];

  test('lists each person without a name once', () => {
    expect(idsMissingNames(rows)).toEqual([8, 10]);
    expect(idsMissingNames(null)).toEqual([]);
  });

  test('fills missing names and emails from the directory, leaving named rows and unknown people alone', () => {
    const directory = new Map([[8, { id: 8, name: 'Lee Example', email: 'lee@x.com' }]]);
    const result = applyNames(rows, directory);
    expect(result[0]).toBe(rows[0]);
    expect(result[1]).toMatchObject({ user_name: 'Lee Example', user_email: 'lee@x.com' });
    expect(result[2].user_name).toBe('Lee Example');
    expect(result[3]).toBe(rows[3]);
    expect(result[4]).toBe(rows[4]); // not in the directory
  });

  test('keeps an email already on the row', () => {
    const result = applyNames([{ end_user_id: 8, user_email: 'own@x.com' }], new Map([[8, { name: 'Lee', email: 'dir@x.com' }]]));
    expect(result[0].user_email).toBe('own@x.com');
  });
});

describe('personOf', () => {
  test('prefers what the row carries, then the embed, then a placeholder', () => {
    expect(personOf({ user_name: 'Pat', user_email: 'p@x.com', training_location: 'Dubai', end_users: { name: 'Other', project_role: 'Clerk' } }))
      .toEqual({ name: 'Pat', email: 'p@x.com', role: 'Clerk', location: 'Dubai' });
    expect(personOf({ end_users: { name: 'Sam', email: 's@x.com', training_location: 'Leeds' } })).toMatchObject({ name: 'Sam', email: 's@x.com', location: 'Leeds' });
    expect(personOf({})).toEqual({ name: 'Unknown User', email: '', role: '', location: '' });
  });
});
