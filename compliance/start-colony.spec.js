const Clone = require('./clone');

/**
 * Basic multi-clone startup tests (no transactions)
 */
describe('Colony', () => {
  let clone1, clone2;

  beforeEach(() => {
    clone1 = new Clone();
    clone2 = new Clone();
  });

  it('Two clones start', async () => {
    await clone1.start();
    const started = await clone2.start();
    expect(started).toBeDefined();
  });

  it('Clone can restart', async () => {
    await clone1.start();
    await clone2.start();
    await clone1.stop();
    const started = await clone1.start();
    return expect(started).toBeDefined();
  });

  // This is obviously a usage problem, see m-ld#11
  it('Clone cannot restart alone', async () => {
    await clone1.start();
    await clone2.start();
    await clone1.stop();
    await clone2.stop();
    try {
      await clone1.start();
      fail();
    } catch (err) {
    }
  });

  afterEach(async () => await Promise.all([clone1.destroy(), clone2.destroy()]));
});

