const Clone = require('../clone');

/**
 * Clone semantic rules
 */
describe('Single-valued property', () => {
  let clones;

  it('resolves two values', async () => {
    clones = await Clone.start(2, {
      constraints: [{ '@type': 'single-valued', property: 'name' }]
    });

    await Promise.all([
      clones[0].transact({ '@id': 'fred', name: 'Fred' }),
      clones[1].transact({ '@id': 'fred', name: 'Flintstone' }),
      clones[0].updated({ '@insert': 'Fred' }),
      // clones[0] never sees 'Flintstone' in its updates
      clones[1].updated({ '@delete': 'Flintstone', '@insert': 'Fred' })
    ]);

    const subjects1 = await clones[0].transact({ '@describe': 'fred' });
    const subjects2 = await clones[1].transact({ '@describe': 'fred' });
    expect(subjects1.length).toBe(1);
    expect(subjects1[0].name).toBe('Fred');
    expect(subjects1).toEqual(subjects2);
  });

  it('resolves n values', async () => {
    clones = await Clone.start(5, {
      constraints: [{ '@type': 'single-valued', property: 'name' }]
    });

    const outcomes = await Promise.all(clones.map((clone, i) =>
      // Every clone inserts its own name
      clone.transact({ '@id': 'fred', name: 'Fred' + i }).then(
        // All but the last clone sees their name squashed
        async () => {
          if (i < 4)
            await clone.updated('@delete', 'Fred' + i);
          return 'squashed';
        },
        // OR they got someone else's name first and failed. This should be rare
        // because it requires the clone to be very slow to accept the txn.
        err => {
          if (!`${err}`.includes('Multiple values'))
            throw err;
          return 'rejected';
        })));
    if (!outcomes.includes('squashed'))
      fail('Invalid test: all clones rejected the conflict');

    const subjectses = await Promise.all(
      clones.map(clone => clone.transact({ '@describe': 'fred' })));
    expect(subjectses[0].length).toBe(1);
    expect(subjectses[0][0].name).toBe('Fred4');
    subjectses.forEach(subjects => expect(subjects).toEqual(subjectses[0]))
  });

  it('applies constraints on rev-up', async () => {
    clones = await Clone.start(3, {
      constraints: [{ '@type': 'single-valued', property: 'name' }]
    });

    await Promise.all([
      clones[0].transact({ '@id': 'wilma', name: 'Wilma' }),
      ...clones.map(clone => clone.updated('@insert', 'Wilma'))
    ]);

    await clones[2].stop();

    // Transact conflicting values and await resolution
    await Promise.all([
      clones[0].transact({ '@id': 'fred', name: 'Fred' }),
      clones[1].transact({ '@id': 'fred', name: 'Flintstone' }),
      clones[0].updated({ '@insert': 'Fred' }),
      clones[1].updated({ '@delete': 'Flintstone', '@insert': 'Fred' })
    ]);

    // Now change our minds unilaterally
    await Promise.all([
      clones[0].transact({
        '@delete': { '@id': 'fred', name: 'Fred' },
        '@insert': { '@id': 'fred', name: 'Flintstone' }
      }),
      clones[1].updated({ '@delete': 'Fred', '@insert': 'Flintstone' })
    ]);

    // We expect the clones[2] rev-up to do its own resolution, prior to
    // receiving the changed mind, but it should not change anyone's state
    clones[0].updated('@delete', 'Flintstone').then(fail);

    await Promise.all([
      clones[2].start(),
      clones[2].updated('@insert', 'Fred'),
      clones[2].updated({ '@delete': 'Fred', '@insert': 'Flintstone' })
    ]);

    const subjects = await Promise.all(clones.map(async clone =>
      (await clone.transact({ '@describe': 'fred' }))[0]));
    
    expect(subjects[0].name).toBe('Flintstone');
    expect(subjects[1]).toEqual(subjects[0]);
    expect(subjects[2]).toEqual(subjects[0]);
  });

  afterEach(async () => {
    await Promise.all(clones.map(clone => clone.destroy()));
  });
});

