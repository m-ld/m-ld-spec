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

  test('Two clones start on same domain', async () => {
    await clone1.start();
    await expect(clone2.start()).resolves.toBeDefined();
  });

  afterEach(async () => await Promise.all([clone1.destroy(), clone2.destroy()]));
});

