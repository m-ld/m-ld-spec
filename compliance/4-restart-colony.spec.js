const Clone = require('./clone');

/**
 * Basic multi-clone snapshot & revup tests (no chaos)
 */
describe('Restart colony', () => {
  let genesis = new Clone, clone = new Clone

  beforeEach(async () => {
    await genesis.start();
  });

  it('new clone starts with snapshot', async () => {
    await genesis.transact({ '@id': 'fred', name: 'Fred' });
    await clone.start();

    const subjects = await clone.transact({ '@describe': 'fred' });
    expect(subjects).toEqual([{ '@id': 'fred', name: 'Fred' }]);
  });

  it('restarting clone revs-up', async () => {
    await clone.start();
    const updated = clone.updated();
    await genesis.transact({ '@id': 'fred', name: 'Fred' });
    await updated;

    await clone.stop();
    await genesis.transact({ '@id': 'wilma', name: 'Wilma' });
    await clone.start();

    const subjects = await clone.transact({ '@describe': 'fred' });
    expect(subjects).toEqual([{ '@id': 'fred', name: 'Fred' }]);
  });

  afterEach(async () => {
    await genesis.destroy();
    await clone.destroy();
  });
});

