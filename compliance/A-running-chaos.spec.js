const Clone = require('./clone');
const compareById = (e1, e2) => e1['@id'] < e2['@id'] ? -1 : e1['@id'] > e2['@id'] ? 1 : 0;

/**
 * Chaotic convergence without stopping/killing
 */
describe('Running chaos', () => {
  const NUM_CLONES = 5, NUM_ROUNDS = 10;
  let clones;
  let roundDuration; // Millis

  beforeEach(async () => {
    clones = Array.from(new Array(NUM_CLONES), () => new Clone);
    await clones[0].start(); // Genesis
    await Promise.all(clones.slice(1).map(clone => clone.start()));
    // Calibrate an approximate transaction duration
    // to get nice overlapping updates in the test
    let start = process.uptime();
    await Promise.all(clones.map((clone, i) => clone.transact({
      '@id': `clone${i}`,
      '@type': 'Clone',
      name: `Clone${i}`,
      round: 0
    })));
    roundDuration = Math.floor((process.uptime() - start) * 1000);
  });

  it('converges entities', async () => {
    // Each clone.round add an entity or remove an existing one
    await Promise.all(clones.map((clone, i) => new Promise(async function nextRound(done) {
      let { round } = (await clone.transact({ '@describe': `clone${i}` }))[0];
      if (round < NUM_ROUNDS) {
        setTimeout(async () => {
          const id = Math.floor(Math.random() * NUM_CLONES * NUM_ROUNDS);
          const name = Math.floor(Math.random() * 16).toString(16);
          const deleteRound = { '@id': `clone${i}`, round };
          const insertRound = { '@id': `clone${i}`, round: round + 1 };
          const update = Math.random() < 0.2 ?
            { '@delete': [{ '@id': `entity${id}` }, deleteRound], '@insert': insertRound } :
            { '@insert': [{ '@id': `entity${id}`, '@type': 'Entity', name }, insertRound], '@delete': deleteRound };
          await clone.transact(update);
          nextRound(done);
        }, Math.random() * roundDuration);
      } else {
        done();
      }
    })).concat(clones.map(clone => Promise.all(clones.map((_, i) =>
      clone.updated({ '@id': `clone${i}`, 'round': NUM_ROUNDS }))))));

    const describeEntities = { '@describe': '?e', '@where': { '@id': '?e', '@type': 'Entity' } };
    const entities = (await clones[0].transact(describeEntities)).sort(compareById);
    return Promise.all(clones.slice(1).map(async clone =>
      expect((await clone.transact(describeEntities)).sort(compareById)).toEqual(entities)));
  });

  // it('converges fields', async () => {
  //   // Each clone.round pick an entity and field to update
  // });

  afterEach(async () => await Promise.all(clones.map(clone => clone.destroy())));
});
