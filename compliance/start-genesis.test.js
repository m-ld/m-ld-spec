const { start, stop, destroy, transact } = require('./orchestrator');

describe('Genesis clone', () => {
  test('starts', async () => {
    await expect(start('clone1', 'start-genesis.m-ld.org')).resolves.toBeDefined();
  });

  test('accepts a subject', async () => {
    await start('clone1', 'start-genesis.m-ld.org');
    await transact('clone1', { '@id': 'fred', name: 'Fred' });
    const subjects = await transact('clone1', { '@describe': 'fred' });
    expect(subjects).toEqual([{ '@id': 'fred', name: 'Fred' }]);
  });

  test('data survives restart', async () => {
    await start('clone1', 'start-genesis.m-ld.org');
    await transact('clone1', { '@id': 'fred', name: 'Fred' });
    await stop('clone1');
    await start('clone1', 'start-genesis.m-ld.org');
    const subjects = await transact('clone1', { '@describe': 'fred' });
    expect(subjects).toEqual([{ '@id': 'fred', name: 'Fred' }]);
  });

  afterEach(async () => await destroy('clone1'));
});

