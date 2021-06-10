const { ChaosTest, sleep, randomInt, updateRandomEntityProperty } = require('./chaos');

/**
 * Chaotic convergence of three clones with one being killed
 */
describe('Killing chaos', () => {
  const NUM_CLONES = 3, NUM_ROUNDS = 50;
  let chaos;

  beforeEach(async () => {
    chaos = new ChaosTest(NUM_CLONES, NUM_ROUNDS);
    await chaos.setup();
    // Make a round mostly longer than a transaction but sometimes shorter
    chaos.meanRoundDurationMillis = chaos.timings.transact * 1.5;
  });

  it('converges with one being repeatedly killed', () => {
    return chaos.test(async (clone, _round, cloneNo) => {
      // Randomly kill, pause and restart the clone
      if (!randomInt(5)) {
        if (cloneNo === NUM_CLONES - 1) {
          await clone.kill();
          await sleep(chaos.timings.startClone);
          await clone.start();
        } else {
          // Need to slow down the other clones to roughly the same degree
          await sleep(chaos.timings.startClone * 2);
        }
      }
      return updateRandomEntityProperty(clone);
    });
  });

  afterEach(async () => chaos.tearDown());
});
