const Clone = require('../clone');

const LOG_LEVEL = process.env.LOG_LEVEL?.toLowerCase() ?? 'warn';

function compareById(e1, e2) {
  return e1['@id'] < e2['@id'] ? -1 : e1['@id'] > e2['@id'] ? 1 : 0;
}
/**
 * Uses central limit theorem to generate an approximation to a
 * gaussian distributed random [0, 2) with mean 1
 * https://en.wikipedia.org/wiki/Central_limit_theorem
 */
function gaussRandom() {
  return Array.from(new Array(6), Math.random).reduce((sum, n) => sum + n) / 3;
}

/**
 * Random integer [0, upper)
 */
function randomInt(upper) {
  return Math.floor(Math.random() * upper);
}

async function updateRandomEntityProperty(clone,
  numEntities = 10, numProperties = 4, numValues = 4) {
  const id = `entity${randomInt(numEntities).toString(16)}`;
  const prop = `prop${randomInt(numProperties).toString(16)}`;
  const value = randomInt(numValues).toString(16);
  const existing = await clone.transact({ '@describe': id });
  const oldValue = (existing.length ? existing[0] : {})[prop];
  return {
    '@delete': oldValue ? { '@id': id, [prop]: oldValue } : [],
    '@insert': { '@id': id, '@type': 'Entity', [prop]: value }
  };
}

async function time(proc) {
  let start = process.uptime();
  const result = await proc();
  return [Math.floor((process.uptime() - start) * 1000), result];
}

function sleep(duration) {
  return new Promise(fin => setTimeout(fin, duration));
}

class ChaosClone extends Clone {
  constructor(index, test) {
    super();
    this.test = test;
    this.running = null; // Tri-state boolean, null means never started
    this.index = index;
    // Gotcha: if a clone starts from a snapshot it will not natively have update events
    this.on('started', async () => {
      this.running = true;
      const others = await this.transact({
        '@describe': '?c', '@where': { '@id': '?c', '@type': 'Clone' }
      });
      others.forEach(state => this.emit('updated', state));
    });
    this.on('stopped', () => this.running = false);
    this.on('killed', () => this.running = false);
  }

  async start(requireOnline = false) {
    const firstStart = this.running == null;
    const [timing, result] = await time(() => super.start(requireOnline));
    this.test.addTiming('startClone', timing);
    if (firstStart) {
      // Each clone gets a record of its state in the domain
      await this.transact({
        '@id': this.id,
        '@type': 'Clone',
        name: `Clone${this.index}`,
        round: 0 // Placeholder
      });
    }
    return result;
  }

  async transact(pattern) {
    const [timing, result] = await time(() => super.transact(pattern));
    this.test.addTiming('transact', timing);
    return result;
  }

  async describeEntities() {
    const entities = await this.transact({
      '@describe': '?e', '@where': { '@id': '?e', '@type': 'Entity' }
    });
    return entities.sort(compareById);
  }
}

function debugLog(...message) {
  if (LOG_LEVEL === 'debug' || LOG_LEVEL === 'trace')
    console.log(...message);
}

class ChaosTest {
  constructor(numClones, numRounds) {
    this.clones = Array.from(new Array(numClones), (_, i) => new ChaosClone(i, this));
    this.timings = { startClone: 0, transact: 0 };
    this.timingsCount = { startClone: 0, transact: 0 };
    this.numRounds = numRounds;
    this.meanRoundDurationMillis = 100;
  }

  addTiming(key, timing) {
    this.timings[key] = ((this.timings[key] * this.timingsCount[key]) + timing)
      / ++this.timingsCount[key];
  }

  async setup(start = true) {
    // Calibrate an approximate start duration from the genesis clone
    await this.clones[0].start(true); // Genesis
    // Start other clones if directed
    if (start)
      await Promise.all(this.clones.slice(1).map(clone => clone.start()));
    debugLog('Setup timings', this.timings);
    return this;
  }

  async tearDown() {
    return Promise.all(this.clones.map(clone => clone && clone.destroy()));
  }

  async test(roundProc/*(clone, round, i): Promise<DeleteInsert>*/) {
    await Promise.all(this.clones.map((clone, i) => this.nextRound(clone, roundProc, 0, i))
      // Wait for all clones to see that all other clones have finished all rounds
      .concat(this.clones.map(clone => this.seenOthersFinish(clone))));

    // TODO: Use json-rql @orderBy
    const entities = await this.clones[0].describeEntities();
    return Promise.all(this.clones.slice(1).map(async clone =>
      expect(await clone.describeEntities())
        .withContext(`Clone ${clone.id}`).toEqual(entities)));
  }

  nextRound = async (clone, roundProc, round, i) => {
    if (round < this.numRounds) {
      return new Promise(done => {
        setTimeout(async () => {
          const testUpdate = await roundProc.call(this, clone, round, i);
          if (clone.running) {
            await clone.transact(testUpdate);
            // Always update the clone's round count
            await clone.transact({
              '@delete': { '@id': clone.id, round: '?' },
              '@insert': { '@id': clone.id, round: round + 1 }
            });
          }
          this.nextRound(clone, roundProc, round + 1, i).then(done);
        }, gaussRandom() * this.meanRoundDurationMillis);
      });
    }
  };

  seenOthersFinish(clone) {
    return Promise.all(this.clones.map(
      other => clone.updated({ '@id': other.id, round: this.numRounds }).then(() => {
        debugLog(`${clone.id} seen ${other.id} finish all rounds`);
      })));
  }
}

module.exports = {
  sleep,
  randomInt,
  updateRandomEntityProperty,
  ChaosTest
};
