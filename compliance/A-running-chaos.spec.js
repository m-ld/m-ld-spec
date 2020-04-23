const { ChaosTest, randomInt } = require('./chaos');

/**
 * Chaotic convergence without stopping/killing
 */
describe('Running chaos', () => {
  const NUM_CLONES = 5, NUM_ROUNDS = 20;
  let chaos;

  beforeEach(async () => {
    chaos = new ChaosTest(NUM_CLONES, NUM_ROUNDS);
    await chaos.setup();
    // Make a round mostly longer than a transaction but sometimes shorter
    chaos.meanRoundDurationMillis = chaos.timings.transact * 1.5;
  });

  it('converges entities', () => chaos.test(async () => {
    // Each clone.round add an entity or remove an existing one
    const id = `entity${randomInt(NUM_CLONES * NUM_ROUNDS)}`;
    const name = randomInt(16).toString(16);
    return randomInt(10) < 2 ?
      { '@delete': { '@id': id } } :
      { '@insert': { '@id': id, '@type': 'Entity', name } };
  }));

  it('converges fields', () => chaos.test(async clone => {
    const NUM_ENTITIES = 16;
    // Each clone.round pick an entity and field to update
    const id = `entity${randomInt(NUM_ENTITIES).toString(16)}`;
    const name = randomInt(NUM_ENTITIES).toString(16);
    const length = randomInt(NUM_ENTITIES);
    const existing = await clone.transact({ '@describe': id });
    const { name: oldName, length: oldLength } = existing.length ? existing[0] : {};
    return {
      '@delete': { '@id': id, name: oldName, length: oldLength },
      '@insert': { '@id': id, '@type': 'Entity', name, length }
    };
  }));

  afterEach(async () => chaos.tearDown());
});
