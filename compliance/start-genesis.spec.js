const Clone = require('./clone');

/**
 * Basic tests for start and transact on a genesis clone
 */
describe('Genesis clone', () => {
  let clone;

  beforeEach(() => clone = new Clone());

  it('starts', async () => {
    const started = await clone.start();
    expect(started).toBeDefined();
  });

  it('accepts a subject', async () => {
    await clone.start();
    const transaction = clone.transact({ '@id': 'fred', name: 'Fred' });
    const updated = new Promise(resolve => clone.on('updated', resolve));
    await transaction;
    await updated;
    const subjects = await clone.transact({ '@describe': 'fred' });
    expect(subjects).toEqual([{ '@id': 'fred', name: 'Fred' }]);
  });

  it('survives restart', async () => {
    await clone.start();
    await clone.transact({ '@id': 'fred', name: 'Fred' });
    await clone.stop();
    await clone.start();
    const subjects = await clone.transact({ '@describe': 'fred' });
    expect(subjects).toEqual([{ '@id': 'fred', name: 'Fred' }]);
  });

  afterEach(async () => await clone.destroy());
});

