const Clone = require('./clone');

/**
 * Basic multi-clone transaction tests (no chaos)
 */
describe('Active colony', () => {
  let clones = new Array(3);

  beforeEach(async () => {
    for (let i = 0; i < clones.length; i++) {
      clones[i] = new Clone();
      await clones[i].start();
    }
  });

  async function basicConvergenceTest(originator) {
    const updated = Promise.all(clones.map(clone => clone.updated().then(update => {
      // Insist that the clones are updated only once
      clone.on('updated', fail);
      return update;
    })));
    await clones[originator].transact({ '@id': 'fred', name: 'Fred' });
    const updates = await updated;
    for (let i = 0; i < clones.length; i++) {
      if (i !== originator) {
        const subjects = await clones[i].transact({ '@describe': 'fred' });
        expect(subjects).toEqual([{ '@id': 'fred', name: 'Fred' }]);
        expect(updates[i]).toEqual(updates[originator]);
      }
    }
  }

  it('converges from genesis clone', () => basicConvergenceTest(0));
  it('converges from non-genesis clone', () => basicConvergenceTest(1));

  it('converges with deletion', async () => {
    await clones[0].transact({ '@id': 'fred', name: 'Fred' });

    let updated = clones[1].updated('@insert', 'wilma');
    await clones[0].transact({ '@id': 'wilma', name: 'Wilma' });
    await updated;

    updated = Promise.all(clones.map(clone => clone.updated('@delete', 'fred')));
    await clones[1].transact({ '@delete': { '@id': 'fred' } });
    await updated;

    for (let i = 0; i < clones.length; i++) {
      const subjects = await clones[i].transact({ '@describe': 'fred' });
      expect(subjects).toEqual([]);
    }
  });

  afterEach(async () => await Promise.all(clones.map(clone => clone.destroy())));
});

