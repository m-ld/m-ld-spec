const Clone = require('./clone');

describe('Genesis clone', () => {
  let clone;

  beforeEach(() => clone = new Clone('clone1'));

  test('starts', async () => {
    await expect(clone.start('start-genesis.m-ld.org')).resolves.toBeDefined();
  });

  test('accepts a subject', async () => {
    await clone.start('start-genesis.m-ld.org');
    await clone.transact({ '@id': 'fred', name: 'Fred' });
    const subjects = await clone.transact({ '@describe': 'fred' });
    expect(subjects).toEqual([{ '@id': 'fred', name: 'Fred' }]);
  });

  test('data survives restart', async () => {
    await clone.start('start-genesis.m-ld.org');
    await clone.transact({ '@id': 'fred', name: 'Fred' });
    await clone.stop();
    await clone.start('start-genesis.m-ld.org');
    const subjects = await clone.transact({ '@describe': 'fred' });
    expect(subjects).toEqual([{ '@id': 'fred', name: 'Fred' }]);
  });

  afterEach(async () => await clone.destroy());
});

