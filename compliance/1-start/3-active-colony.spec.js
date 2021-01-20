const Clone = require('../clone');

/**
 * Basic multi-clone transaction tests (no chaos)
 */
describe('Active colony', () => {
  let clones;

  beforeEach(async () => {
    clones = Array.from(new Array(3), () => new Clone);
    await clones[0].start(); // Genesis
    await Promise.all(clones.slice(1).map(clone => clone.start()));
  });

  async function basicConvergenceTest(originator) {
    clones[originator].transact({ '@id': 'fred', name: 'Fred' });
    const updates = await Promise.all(clones.map(clone => clone.updated().then(update => {
      // Insist that the clones are updated only once
      clone.on('updated', fail);
      return update;
    })));
    await Promise.all(clones.map(async (clone, i) => {
      expect(updates[i]['@delete']).toEqual(updates[originator]['@delete']);
      expect(updates[i]['@insert']).toEqual(updates[originator]['@insert']);
      expect(await clone.transact({ '@describe': 'fred' }))
        .toEqual([{ '@id': 'fred', name: 'Fred' }]);
    }));
  }

  it('converges from genesis clone', () => basicConvergenceTest(0));
  it('converges from non-genesis clone', () => basicConvergenceTest(1));

  it('converges with deletion', async () => {
    await clones[0].transact({ '@id': 'fred', name: 'Fred' });

    await Promise.all([
      clones[0].transact({ '@id': 'wilma', name: 'Wilma' }),
      clones[1].updated('@insert', 'wilma')
    ]);

    await Promise.all([
      clones[1].transact({ '@delete': { '@id': 'fred' } })
    ].concat(clones.map(clone => clone.updated('@delete', 'fred'))));

    for (let i = 0; i < clones.length; i++) {
      const subjects = await clones[i].transact({ '@describe': 'fred' });
      expect(subjects).toEqual([]);
    }
  });

  afterEach(async () => await Promise.all(clones.map(clone => clone.destroy())));
});

