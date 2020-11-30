const { ChaosTest, randomInt, updateRandomEntityProperty } = require('./chaos');

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

  it('converges with at least one running', () => {
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
        await new Promise(fin => setTimeout(fin,
          Math.random() * chaos.timings.startClone));
        await clone.start();
        stopped--;
      }
      return updateRandomEntityProperty(clone);
    });
  });

  afterEach(async () => chaos.tearDown());
});
