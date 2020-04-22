const Clone = require('./clone');

function compareById(e1, e2) {
  return e1['@id'] < e2['@id'] ? -1 : e1['@id'] > e2['@id'] ? 1 : 0;
};
/**
 * Uses central limit theorem to generate an approximation to a gaussian distributed random [0, 1)
 * https://en.wikipedia.org/wiki/Central_limit_theorem
 */
function gaussRandom() {
  return Array.from(new Array(6), Math.random).reduce((sum, n) => sum + n) / 6;
};

/**
 * Random integer [0, upper)
 */
exports.randomInt = function randomInt(upper) {
  return Math.floor(Math.random() * upper);
};

exports.ChaosTest = class {
  constructor(numClones, numRounds) {
    this.clones = Array.from(new Array(numClones), () => new Clone);
    this.timings = { startClone: 0, transact: 0 };
    this.numRounds = numRounds;
    this.maxRoundDurationMillis = 100;
  }

  async setup() {
    await this.clones[0].start(); // Genesis

    let start = process.uptime();
    await Promise.all(this.clones.slice(1).map(clone => clone.start()));
    // Calibrate an approximate start duration
    this.timings.startClone = Math.floor((process.uptime() - start) * 1000);

    // Each clone gets a record of its state in the domain
    start = process.uptime();
    await Promise.all(this.clones.map((clone, i) => clone.transact({
      '@id': `clone${i}`,
      '@type': 'Clone',
      name: `Clone${i}`,
      round: 0
    })));
    // Calibrate an approximate transaction duration
    this.timings.transact = Math.floor((process.uptime() - start) * 1000);
  }

  async tearDown() {
    return Promise.all(this.clones.map(clone => clone.destroy()));
  }

  async test(roundProc/*(clone, index): Promise<DeleteInsert>*/) {
    const chaos = this;
    await Promise.all(this.clones.map((clone, i) => new Promise(async function nextRound(done) {
      let { round } = (await clone.transact({ '@describe': `clone${i}` }))[0];
      if (round < chaos.numRounds) {
        setTimeout(async () => {
          const testUpdate = await roundProc.call(chaos, clone, i);
          // Always update the clone's round count
          await clone.transact({
            '@delete': [{ '@id': `clone${i}`, round }].concat(testUpdate['@delete']),
            '@insert': [{ '@id': `clone${i}`, round: round + 1 }].concat(testUpdate['@insert'])
          });
          nextRound(done);
        }, gaussRandom() * chaos.maxRoundDurationMillis);
      } else {
        done();
      }
    })).concat(
      // Wait for all clones to see that all other clones have finished all rounds
      this.clones.map(clone => Promise.all(this.clones.map((_, i) =>
        clone.updated({ '@id': `clone${i}`, 'round': this.numRounds }))))));

    // TODO: Use json-rql @orderBy
    const describeEntities = { '@describe': '?e', '@where': { '@id': '?e', '@type': 'Entity' } };
    const entities = (await this.clones[0].transact(describeEntities)).sort(compareById);
    return Promise.all(this.clones.slice(1).map(async clone =>
      expect((await clone.transact(describeEntities)).sort(compareById)).toEqual(entities)));
  }
};