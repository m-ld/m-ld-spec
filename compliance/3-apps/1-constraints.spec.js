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
      (async () => {
        await clones[0].updated('@delete', 'Flintstone');
        // Also expecting clone[1]'s resolution
        await clones[0].updated('@delete', 'Flintstone');
      })(),
      (async () => {
        await clones[1].updated({ '@delete': 'Flintstone', '@insert': 'Fred' });
        // Also expecting clone[0]'s resolution
        await clones[1].updated('@delete', 'Flintstone');
      })()
    ]);

    // All updates look like this:
    // clone[0] { "@ticks": 1, "@delete": [], "@insert": [{ "@id": "fred", "name": "Fred" }] }
    // clone[1] { "@ticks": 1, "@delete": [], "@insert": [{ "@id": "fred", "name": "Flintstone" }] }
    // clone[1] { "@ticks": 3, "@delete": [{ "@id": "fred", "name": "Flintstone" }], "@insert": [{ "@id": "fred", "name": "Fred" }] }
    // clone[0] { "@ticks": 3, "@delete": [{ "@id": "fred", "name": "Flintstone" }], "@insert": [] }
    // clone[1] { "@ticks": 4, "@delete": [{ "@id": "fred", "name": "Flintstone" }], "@insert": [] }
    // clone[0] { "@ticks": 4, "@delete": [{ "@id": "fred", "name": "Flintstone" }], "@insert": [] }

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

    await Promise.all(
      clones.map((clone, i) => clone.transact({ '@id': 'fred', name: 'Fred' + i }))
        .concat(clones.map(clone => Promise.all(
          clones.slice(0, -1).map((_, i) => clone.updated('@delete', 'Fred' + i))))));

    const subjectses = await Promise.all(
      clones.map(clone => clone.transact({ '@describe': 'fred' })));
    expect(subjectses[0].length).toBe(1);
    expect(subjectses[0][0].name).toBe('Fred4');
    subjectses.forEach(subjects => expect(subjects).toEqual(subjectses[0]))
  });

  it('does not redo constraints on rev-up', async () => {
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
      (async () => {
        await clones[0].updated('@delete', 'Flintstone');
        // Also expecting clone[1]'s resolution
        await clones[0].updated('@delete', 'Flintstone');
      })(),
      (async () => {
        await clones[1].updated({ '@delete': 'Flintstone', '@insert': 'Fred' });
        // Also expecting clone[0]'s resolution
        await clones[1].updated('@delete', 'Flintstone');
      })()
    ]);

    // Not expecting any constraint-resolution from the startup of clone[2]
    clones[0].on('updated', () => fail());

    await Promise.all([
      clones[2].start(),
      clones[2].updated('@insert', 'Fred'),
      clones[2].updated('@delete', 'Flintstone')
    ]);

    const subjects = await clones[2].transact({ '@describe': 'fred' });
    expect(subjects[0].name).toBe('Fred');
  });

  afterEach(async () => {
    await Promise.all(clones.map(clone => clone.destroy()));
  });
});

