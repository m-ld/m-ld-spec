const { sleep, ChaosTest, randomInt, updateRandomEntityProperty } = require('./chaos');

/**
 * Chaotic convergence with stopping (no killing)
 */
describe('Stopping chaos', () => {
  const NUM_CLONES = 5, NUM_ROUNDS = 20;
  let chaos;

  beforeEach(async () => {
    chaos = await new ChaosTest(NUM_CLONES, NUM_ROUNDS).setup();
    // Make a round mostly longer than a transaction but sometimes shorter
    chaos.meanRoundDurationMillis = chaos.timings.transact * 1.5;
  });

  it('converges with at least one running', () => {
    let stopped = 0;
    return chaos.test(async clone => {
      // Randomly stop, pause and restart the clone
      if (!randomInt(8) && stopped < NUM_CLONES - 1) {
        stopped++;
        await clone.stop();
        await sleep(Math.random() * chaos.timings.startClone);
        await clone.start();
        stopped--;
      }
      return updateRandomEntityProperty(clone);
    });
  });

  it('converges with maybe none running', () => {
    let stopped = 0;
    return chaos.test(async clone => {
      // Stop about once in the whole test, but also if anyone else has stopped
      if (!randomInt(NUM_ROUNDS) || stopped > 0) {
        stopped++;
        await clone.stop();
        await sleep(Math.random() * chaos.timings.startClone);
        await clone.start();
        stopped--;
      }
      return updateRandomEntityProperty(clone);
    });
  }, jasmine.DEFAULT_TIMEOUT_INTERVAL * 2);

  afterEach(async () => chaos.tearDown());
});
