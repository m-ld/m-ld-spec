const fetch = require('node-fetch');
const EventEmitter = require('events');
const { Transform } = require('stream');

/**
 * @typedef { import("../types").MeldConfig } MeldConfig
 * @typedef { import("../types").MeldUpdate } MeldUpdate
 */

let domain;
jasmine.getEnv().addReporter({
  specStarted: (result) =>
    domain = encodeURIComponent(result.fullName.toLowerCase().replace(/\s+/g, '-')) + '.m-ld.org'
});
jasmine.DEFAULT_TIMEOUT_INTERVAL = 30000;

const ids = new Set;
function newId() {
  let id;
  // noinspection StatementWithEmptyBodyJS
  while (ids.has(id = Math.floor(Math.random() * 0xFFFFFFFF).toString(16)));
  ids.add(id);
  return id;
}
/**
 * A clone object wraps the orchestrator API for a single clone.
 */
module.exports = class Clone extends EventEmitter {
  constructor(config) {
    super();
    this.id = newId();
    this.config = config;
    this.domain = domain;
  }

  /**
   * Creates the requested number of clones, with the given configuration. The
   * returned clones are not started.
   * @param {number} count number of clones
   * @param {MeldConfig} [config] configuration for all clones
   */
  static create(count, config) {
    return Array(count).fill(undefined).map(() => new Clone(config));
  }

  /**
   * Creates and starts the requested number of clones, with the given
   * configuration. If you want to start a subset of the clones, call
   * {@link create} instead and start them yourself.
   * @param {number} count number of clones
   * @param {MeldConfig} config configuration for all clones
   */
  static async start(count, config) {
    const clones = Clone.create(count, config);
    await clones[0].start(true);
    await Promise.all(clones.slice(1).map(clone => clone.start()));
    return clones;
  }

  /**
   * Starts a clone. The domain is inferred from the running test name.
   * The 'start' end-point sets up an HTTP Stream. The first chunk is the 'started' message;
   * all subsequent chunks are 'updated' messages, which are emitted by this class as events.
   * http://orchestrator:port/start?cloneId=hexclonid&domain=full-test-name.m-ld.org
   * <= config: { constraints: [{ '@type'... }] }
   * => { '@type': 'started' },
   *    { '@type: 'status', body: MeldStatus },
   *    { '@type: 'updated', body: MeldUpdate }...
   * @param {boolean} requireOnline if `true`, wait for the clone to have status online
   */
  async start(requireOnline = false) {
    const events = await send('start', { cloneId: this.id, domain }, this.config);
    return new Promise((resolve, reject) => {
      events.on('data', event => {
        if (requireOnline && event['@type'] === 'status' && event.body.online)
          resolve(event);
        else if (!requireOnline && event['@type'] === 'started')
          resolve(event);
        this.emit(event['@type'], event.body);
      });
      events.on('end', () => this.emit('closed'));
      events.on('error', reject);
    });
  }

  /**
   * Stops the given clone normally, keeping any persisted data for that ID.
   * http://orchestrator:port/stop?cloneId=hexclonid
   * => { '@type': 'stopped' }
   */
  async stop() {
    return send('stop', { cloneId: this.id });
  };

  /**
   * Kills the clone process completely without any normal shutdown.
   * http://orchestrator:port/kill?cloneId=hexclonid
   * => { '@type': 'killed' }
   */
  async kill() {
    return send('kill', { cloneId: this.id });
  };

  /**
   * Stops the given clone normally and then deletes any persisted data,
   * such that a re-start of the same clone ID will be as if brand-new.
   * Note that this should not error if the clone is already dead, but
   * still destroy its data.
   * http://orchestrator:port/destroy?cloneId=hexclonid
   * => { '@type': 'destroyed' }
   */
  async destroy() {
    return send('destroy', { cloneId: this.id });
  };

  /**
   * Sends the given transaction request to the given clone.
   * http://orchestrator:port/transact?cloneId=hexclonid
   * <= json-rql
   * => Subject ...
   */
  async transact(pattern) {
    const subjects = await send('transact', { cloneId: this.id }, pattern);
    // TODO: option to just return the stream
    return new Promise((resolve, reject) => {
      const all = [];
      subjects.on('data', subject => all.push(subject));
      subjects.on('end', () => resolve(all));
      subjects.on('error', reject);
    });
  };

  /**
   * Isolates the clone from the messaging layer.
   * http://orchestrator:port/kill?cloneId=hexclonid
   * => { '@type': 'partitioned' }
   */
  async partition(state = true) {
    return send('partition', { cloneId: this.id, state });
  };

  /**
   * Utility returning a promise that resolves when an update is emitted with
   * the given path. The path matching requires the last path element to be a
   * deep value which has the prior path elements appearing, in order, in its
   * deep path.
   * @param {...any} path any sparse path that the update must contain
   * @returns {Promise<MeldUpdate>} the update
   */
  async updated(...path) {
    return new Promise(resolve => this.on('updated',
      update => hasPath(update, path) && resolve(update)));
  }

  /**
   * Utility returning a promise that resolves when the given status value has
   * been emitted by the clone.
   * @param {'online' | 'outdated' | silo} status
   * @param {boolean} value
   */
  async status(status, value) {
    return new Promise(resolve => this.on('status', newStatus => {
      if (newStatus != null && newStatus[status] === value)
        resolve();
    }));
  }

  /**
   * Utility returning a promise when the clone closes. This may be independent of
   * any active stop(), kill() or destroy().
   */
  async closed() {
    return new Promise(resolve => this.on('closed', resolve));
  }
}

async function send(message, params, body) {
  const url = new URL(message, process.env.MELD_ORCHESTRATOR_URL);
  Object.entries(params).forEach(([name, value]) => url.searchParams.append(name, value));
  const options = { method: 'post' };
  if (body) {
    options.body = JSON.stringify(body);
    options.headers = { 'Content-Type': 'application/json' };
  }
  const res = await checkStatus(await fetch(url.toString(), options), url);
  if (res.headers.get('transfer-encoding') === 'chunked') {
    return res.body.pipe(new Transform({
      objectMode: true,
      transform(chunk, _, callback) {
        try {
          callback(null, JSON.parse(chunk.toString()));
        } catch (err) {
          callback(err);
        }
      }
    }));
  } else {
    return res.json();
  }
}

async function checkStatus(res, url) {
  if (res.ok) { // res.status >= 200 && res.status < 300
    return res;
  } else {
    // Try to get the error message from the body
    throw await res.json()
      .then(err => new Error(err.message))
      .catch(() => res.text())
      .catch(() => `message unavailable, ${res.statusText} for ${url}`);
  }
}

function hasPath(obj, path) {
  if (path == null || !path.length || (path.length === 1 && obj === path[0])) {
    return true;
  } else if (typeof path[0] === 'object') {
    return Object.entries(path[0]).every(e => hasPath(obj, e.concat(path.slice(1))));
  } else if (typeof obj === 'object') {
    if (path.length > 1 && path[0] in obj)
      return hasPath(obj[path[0]], path.slice(1));
    else
      return Object.values(obj).some(val => hasPath(val, path));
  }
  return false;
}