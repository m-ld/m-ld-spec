const Clone = require('../clone');

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

  it('leaves partial subjects', async () => {
    await Promise.all([
      clone1.transact({ '@id': 'fred', name: 'Fred', height: 5 }),
      clone2.updated('Fred'),
    ]);

    await Promise.all([
      // Delete the whole subject
      clone1.transact({ '@delete': { '@id': 'fred', name: 'Fred', height: 5 } }),
      // Concurrently, update the height
      clone2.transact({
        '@delete': { '@id': 'fred', height: 5 },
        '@insert': { '@id': 'fred', height: 6 }
      }),
      clone1.updated('@insert', 'height', 6),
      clone2.updated('@delete', 'Fred')
    ]);

    const subjects = await clone1.transact({ '@describe': 'fred' });
    expect(subjects.length).toBe(1);
    expect(subjects[0].name).toBeUndefined();
    expect(subjects[0].height).toBe(6);
  });

  afterEach(async () => {
    await clone1.destroy();
    await clone2.destroy();
  });
});

