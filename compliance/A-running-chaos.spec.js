const Clone = require('./clone');
const { compareById, gaussRandom, randomInt } = require('./util');

/**
 * Chaotic convergence without stopping/killing
 */
describe('Running chaos', () => {
  const NUM_CLONES = 5, NUM_ROUNDS = 20;
  let clones;
  let maxRoundDurationMillis;

  beforeEach(async () => {
    clones = Array.from(new Array(NUM_CLONES), () => new Clone);
    await clones[0].start(); // Genesis
    await Promise.all(clones.slice(1).map(clone => clone.start()));
    // Calibrate an approximate transaction duration while setting up
    let start = process.uptime();
    await Promise.all(clones.map((clone, i) => clone.transact({
      '@id': `clone${i}`,
      '@type': 'Clone',
      name: `Clone${i}`,
      round: 0
    })));
    // Make a round mostly longer than a transaction but sometimes shorter
    maxRoundDurationMillis = Math.floor((process.uptime() - start) * 1000) * 3;
  });

  async function testConvergence(roundUpdate/*(clone, index): Promise<DeleteInsert>*/) {
    await Promise.all(clones.map((clone, i) => new Promise(async function nextRound(done) {
      let { round } = (await clone.transact({ '@describe': `clone${i}` }))[0];
      if (round < NUM_ROUNDS) {
        setTimeout(async () => {
          const testUpdate = await roundUpdate(clone, i);
          // Always update the clone's round count
          await clone.transact({
            '@delete': [{ '@id': `clone${i}`, round }].concat(testUpdate['@delete']),
            '@insert': [{ '@id': `clone${i}`, round: round + 1 }].concat(testUpdate['@insert'])
          });
          nextRound(done);
        }, gaussRandom() * maxRoundDurationMillis);
      } else {
        done();
      }
    })).concat(clones.map(clone => Promise.all(clones.map((_, i) =>
      clone.updated({ '@id': `clone${i}`, 'round': NUM_ROUNDS }))))));

    const describeEntities = { '@describe': '?e', '@where': { '@id': '?e', '@type': 'Entity' } };
    const entities = (await clones[0].transact(describeEntities)).sort(compareById);
    return Promise.all(clones.slice(1).map(async clone =>
      expect((await clone.transact(describeEntities)).sort(compareById)).toEqual(entities)));
  }

  it('converges entities', () => testConvergence(async () => {
    // Each clone.round add an entity or remove an existing one
    const id = `entity${randomInt(NUM_CLONES * NUM_ROUNDS)}`;
    const name = randomInt(16).toString(16);
    return randomInt(10) < 2 ?
      { '@delete': { '@id': id } } :
      { '@insert': { '@id': id, '@type': 'Entity', name } };
  }));

  it('converges fields', () => testConvergence(async clone => {
    // Each clone.round pick an entity and field to update
    const id = `entity${randomInt(16).toString(16)}`; // Only 16 entities total
    const name = randomInt(16).toString(16); // 16 different names
    const length = randomInt(16); // 16 different lengths
    const existing = await clone.transact({ '@describe': id });
    const { name: oldName, length: oldLength } = existing.length ? existing[0] : {};
    return {
      '@delete': { '@id': id, name: oldName, length: oldLength },
      '@insert': { '@id': id, '@type': 'Entity', name, length }
    };
  }));

  afterEach(async () => await Promise.all(clones.map(clone => clone.destroy())));
});
