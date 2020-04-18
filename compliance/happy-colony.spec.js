const Clone = require('./clone');

/**
 * Multi-clone transaction tests (no chaos)
 */
describe('Happy colony', () => {
  let clones = new Array(3);

  beforeEach(async () => {
    for (let i = 0; i < clones.length; i++){
      clones[i] = new Clone();
      await clones[i].start();
    }
  });

  it('converges from genesis clone', async () => {
    const transaction = clones[0].transact({ '@id': 'fred', name: 'Fred' });
    const updated = Promise.all(clones.map(clone =>
      new Promise(resolve => clone.on('updated', resolve))));

    await transaction;
    await updated;

    for (let i = 1; i < clones.length; i++) {
      const subjects = await clones[i].transact({ '@describe': 'fred' });
      expect(subjects).toEqual([{ '@id': 'fred', name: 'Fred' }]);
    }
  });

  afterEach(async () => await Promise.all(clones.map(clone => clone.destroy())));
});

