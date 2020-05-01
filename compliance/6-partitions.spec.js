const Clone = require('./clone');

/**
 * Basic network partitions (no chaos)
 */
describe('On partition', () => {
  let clone;

  beforeEach(() => clone = new Clone);

  it('still accepts transactions', async () => {
    await clone.start();
    await clone.partition();
    await clone.transact({ '@id': 'fred', name: 'Fred' });
  });

  afterEach(() => clone.destroy());
});
