const Clone = require('../clone');

const LOG_LEVEL = Number(process.env.LOG_LEVEL);

function compareById(e1, e2) {
  return e1['@id'] < e2['@id'] ? -1 : e1['@id'] > e2['@id'] ? 1 : 0;
};
/**
 * Uses central limit theorem to generate an approximation to a
 * gaussian distributed random [0, 2) with mean 1
 * https://en.wikipedia.org/wiki/Central_limit_theorem
 */
function gaussRandom() {
  return Array.from(new Array(6), Math.random).reduce((sum, n) => sum + n) / 3;
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
    this.meanRoundDurationMillis = 100;
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
      '@id': clone.id,
      '@type': 'Clone',
      name: `Clone${i}`,
      round: 0
    })));
    // Calibrate an approximate transaction duration
    this.timings.transact = Math.floor((process.uptime() - start) * 1000);

    // Gotcha: if a clone starts from a snapshot it will not natively have update events
    this.clones.forEach(clone => clone.on('started', async () => {
      const others = await clone.transact({
        '@describe': '?c', '@where': { '@id': '?c', '@type': 'Clone' }
      });
      if (others.length !== this.clones.length) {
        console.error(`${clone.id}: DATA LOSS: ${others.length} clones out of ${this.clones.length} visible.`);
        process.exit(1); // FIXME: bit abrupt!
      } else {
        others.forEach(state => clone.emit('updated', state));
      }
    }));
  }

  async tearDown() {
    return Promise.all(this.clones.map(clone => clone.destroy()));
  }

  async test(roundProc/*(clone, round): Promise<DeleteInsert>*/) {
    const chaos = this;
    await Promise.all(this.clones.map((clone, i) => new Promise(async function nextRound(done) {
      let { round } = (await clone.transact({ '@describe': clone.id }))[0];
      if (round < chaos.numRounds) {
        setTimeout(async () => {
          const testUpdate = await roundProc.call(chaos, clone, round);
          // Always update the clone's round count
          await clone.transact({
            '@delete': [{ '@id': clone.id, round }].concat(testUpdate['@delete']),
            '@insert': [{ '@id': clone.id, round: round + 1 }].concat(testUpdate['@insert'])
          });
          nextRound(done);
        }, gaussRandom() * chaos.meanRoundDurationMillis);
      } else {
        done();
      }
    })).concat(
      // Wait for all clones to see that all other clones have finished all rounds
      this.clones.map(clone => Promise.all(this.clones.map(other =>
        clone.updated({ '@id': other.id, round: this.numRounds }).then(() => {
          if (LOG_LEVEL < 2) // Info
            console.log(`${clone.id} seen ${other.id} finish all rounds`);
        }))))));

    // TODO: Use json-rql @orderBy
    const describeEntities = { '@describe': '?e', '@where': { '@id': '?e', '@type': 'Entity' } };
    const entities = (await this.clones[0].transact(describeEntities)).sort(compareById);
    return Promise.all(this.clones.slice(1).map(async clone =>
      expect((await clone.transact(describeEntities)).sort(compareById)).toEqual(entities)));
  }
};
