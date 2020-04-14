const { start, destroy, transact } = require('./orchestrator');

test('Genesis clone starts', async () => {
  await expect(start('clone1', 'start-genesis.m-ld.org')).resolves.toBeDefined();
});

test('Genesis clone accepts a subject', async () => {
  await start('clone1', 'start-genesis.m-ld.org');
  await transact('clone1', { '@id': 'fred', name: 'Fred' });
  const subjects = await transact('clone1', { '@describe': 'fred' });
  expect(subjects).toEqual([{ '@id': 'fred', name: 'Fred' }]);
});

afterEach(async () => await destroy('clone1'));