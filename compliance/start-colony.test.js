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

  test('Two clones start', async () => {
    await clone1.start();
    return expect(clone2.start()).resolves.toBeDefined();
  });

  test('Clone can restart', async () => {
    await clone1.start();
    await clone2.start();
    await clone1.stop();
    return expect(clone1.start()).resolves.toBeDefined();
  });

  test('Clone cannot restart alone', async () => {
    await clone1.start();
    await clone2.start();
    await clone1.stop();
    await clone2.stop();
    return expect(clone1.start()).rejects.toThrow();
  });

  afterEach(async () => await Promise.all([clone1.destroy(), clone2.destroy()]));
});

