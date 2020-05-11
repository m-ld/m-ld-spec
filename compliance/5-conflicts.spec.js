const Clone = require('./clone');

/**
 * Basic multi-clone transaction tests (no chaos)
 */
describe('On conflict', () => {
  let clone1 = new Clone, clone2 = new Clone

  beforeEach(async () => {
    await clone1.start();
    await clone2.start();
  });

  it('makes values arrays', async () => {
    await Promise.all([
      clone1.transact({ '@id': 'fred', name: 'Fred' }),
      clone2.transact({ '@id': 'fred', name: 'Flintstone' }),
      clone2.updated('Fred'),
      clone2.updated('Flintstone')
    ]);

    const subjects = await clone2.transact({ '@describe': 'fred' });
    expect(subjects.length).toBe(1);
    expect(subjects[0].name.length).toBe(2);
    expect(subjects[0].name.includes('Fred')).toBe(true);
    expect(subjects[0].name.includes('Flintstone')).toBe(true);
  });

  afterEach(async () => {
    await clone1.destroy();
    await clone2.destroy();
  });
});

