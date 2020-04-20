const Clone = require('./clone');

/**
 * Basic network partitions (no chaos)
 */
describe('On partition', () => {
  it('shuts down', async () => {
    const clone = new Clone;
    await clone.start();
    return expectAsync(Promise.all([
      clone.partition(),
      clone.closed()
    ])).toBeResolved();
  });
});
