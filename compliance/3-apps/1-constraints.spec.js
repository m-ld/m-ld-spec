const Clone = require('../clone');

/**
 * Clone semantic rules
 */
describe('Single-valued property', () => {
  let clones;

  it('resolves two values', async () => {
    clones = Array(2).fill().map(() => new Clone(
      { constraint: { '@type': 'single-valued', property: 'name' } }));
    await clones[0].start();
    await clones[1].start();

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
    clones = Array(5).fill().map(() => new Clone(
      { constraint: { '@type': 'single-valued', property: 'name' } }));
    await clones[0].start();
    await Promise.all(
      clones.slice(1).map(clone => clone.start()));

    await Promise.all([
      // Every clone inserts its own name
      ...clones.map((clone, i) => clone.transact({ '@id': 'fred', name: 'Fred' + i })),
      // And all but the last clone sees their name squashed
      ...clones.slice(0, -1).map((clone, i) => clone.updated('@delete', 'Fred' + i))
    ]);

    const subjectses = await Promise.all(
      clones.map(clone => clone.transact({ '@describe': 'fred' })));
    expect(subjectses[0].length).toBe(1);
    expect(subjectses[0][0].name).toBe('Fred4');
    subjectses.forEach(subjects => expect(subjects).toEqual(subjectses[0]))
  });

  it('applies constraints on rev-up', async () => {
    clones = Array(3).fill().map(() => new Clone(
      { constraint: { '@type': 'single-valued', property: 'name' } }));
    await clones[0].start();
    await clones[1].start();
    await clones[2].start();

    await Promise.all([
      clones[0].transact({ '@id': 'wilma', name: 'Wilma' }),
      clones[0].updated('@insert', 'Wilma'),
      clones[1].updated('@insert', 'Wilma'),
      clones[2].updated('@insert', 'Wilma')
    ]);

    await clones[2].stop();

    await Promise.all([
      clones[0].transact({ '@id': 'fred', name: 'Fred' }),
      clones[1].transact({ '@id': 'fred', name: 'Flintstone' }),
      clones[0].updated({ '@insert': 'Fred' }),
      clones[1].updated({ '@delete': 'Flintstone', '@insert': 'Fred' })
    ]);

    // Not expecting to see any constraint-resolution from the startup of
    // clone[2], due to suppression of a no-op
    clones[0].on('updated', update => fail(update));

    await Promise.all([
      clones[2].start(),
      // We might see insert 'Flintstone' as well, depends on ordering
      clones[2].updated('@insert', 'Fred')
    ]);

    const subjects = await clones[2].transact({ '@describe': 'fred' });
    expect(subjects[0].name).toBe('Fred');
  });

  afterEach(async () => {
    await Promise.all(clones.map(clone => clone.destroy()));
  });
});

