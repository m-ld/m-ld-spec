const { start, destroy } = require('./orchestrator');

test('Genesis clone starts', async () => {
  await expect(start('clone1', 'start-genesis.m-ld.org')).resolves.toBeDefined();
});

afterEach(async () => await destroy('clone1'));