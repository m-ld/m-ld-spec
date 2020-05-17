const Clone = require('../clone');

/**
 * Basic multi-clone startup tests (no transactions)
 */
describe('Colony', () => {
  let clone1, clone2;

  beforeEach(() => {
    clone1 = new Clone();
    clone2 = new Clone();
  });

  it('clones start', async () => {
    await clone1.start();
    await expectAsync(clone2.start()).toBeResolved();
  });

  it('clone can restart', async () => {
    await clone1.start();
    await clone2.start();
    await clone1.stop();
    await expectAsync(clone1.start()).toBeResolved();
  });

  it('clone can restart alone', async () => {
    await clone1.start();
    await clone2.start();
    await clone1.stop();
    await clone2.stop();
    await expectAsync(clone1.start()).toBeResolved();
  });

  afterEach(async () => await Promise.all([
    clone1.destroy(),
    clone2.destroy()
  ]));
});

