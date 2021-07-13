const { ChaosTest, sleep, updateRandomEntityProperty } = require('./chaos');

/**
 * Chaotic convergence with clones starting incrementally
 */
describe('Starting chaos', () => {
  const NUM_CLONES = 5, NUM_ROUNDS = 20;
  let chaos;

  beforeEach(async () => {
    chaos = await new ChaosTest(NUM_CLONES, NUM_ROUNDS).setup(false);
    // Make a round mostly longer than a transaction but sometimes shorter
    chaos.meanRoundDurationMillis = chaos.timings.transact * 1.5;
  });

  it('converges with clones starting from snapshot', () => {
    return chaos.test(async (clone, round, i) => {
      // Start clone i clone after 2i rounds
      if (i > 0 && round === 2 * i)
        await clone.start();
      else
        // Slow down transactions so the starting clones are not too far behind
        await sleep(chaos.timings.startClone * Math.random());

      if (clone.running)
        return updateRandomEntityProperty(clone);
    });
  });

  afterEach(async () => chaos.tearDown());
});
