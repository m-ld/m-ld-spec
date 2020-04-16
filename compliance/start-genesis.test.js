const Clone = require('./clone');

/**
 * Basic tests for start and transact on a genesis clone
 */
describe('Genesis clone', () => {
  let clone;

  beforeEach(() => clone = new Clone());

  test('starts', async () => {
    await expect(clone.start()).resolves.toBeDefined();
  });

  test('accepts a subject', async () => {
    await clone.start();
    await clone.transact({ '@id': 'fred', name: 'Fred' });
    const subjects = await clone.transact({ '@describe': 'fred' });
    expect(subjects).toEqual([{ '@id': 'fred', name: 'Fred' }]);
  });

  test('data survives restart', async () => {
    await clone.start();
    await clone.transact({ '@id': 'fred', name: 'Fred' });
    await clone.stop();
    await clone.start();
    const subjects = await clone.transact({ '@describe': 'fred' });
    expect(subjects).toEqual([{ '@id': 'fred', name: 'Fred' }]);
  });

  afterEach(async () => await clone.destroy());
});

