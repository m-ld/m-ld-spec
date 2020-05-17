const { ChaosTest, randomInt, safeStart } = require('./chaos');

/**
 * Chaotic convergence with stopping (no killing)
 */
describe('Stopping chaos', () => {
  const NUM_CLONES = 5, NUM_ROUNDS = 20;
  let chaos;

  beforeEach(async () => {
    chaos = new ChaosTest(NUM_CLONES, NUM_ROUNDS);
    await chaos.setup();
    // Make a round mostly longer than a transaction but sometimes shorter
    chaos.meanRoundDurationMillis = chaos.timings.transact * 1.5;
  });

  it('converges', () => {
    // We have to leave one clone running
    // https://github.com/gsvarovsky/m-ld-spec/issues/5
    let stopped = 0;
    return chaos.test(async clone => {
      // Randomly stop, pause and restart the clone
      if (!randomInt(8) && stopped < NUM_CLONES - 1) {
        stopped++;
        await clone.stop();
        await new Promise(fin => setTimeout(fin, chaos.timings.startClone));
        await clone.start();
        stopped--;
      }
      const id = `entity${randomInt(10).toString(16)}`;
      const prop = `prop${randomInt(4).toString(16)}`;
      const value = randomInt(4).toString(16);
      const existing = await clone.transact({ '@describe': id });
      const oldValue = (existing.length ? existing[0] : {})[prop];
      return {
        '@delete': oldValue ? { '@id': id, [prop]: oldValue } : [],
        '@insert': { '@id': id, '@type': 'Entity', [prop]: value }
      };
    });
  });

  afterEach(async () => chaos.tearDown());
});
