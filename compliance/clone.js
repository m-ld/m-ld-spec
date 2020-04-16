const fetch = require('node-fetch');
const from = require('highland');

let domain;
jasmine.getEnv().addReporter({
  specStarted: (result) =>
    domain = encodeURIComponent(result.fullName.toLowerCase().replace(/\s+/g, '-')) + '.m-ld.org'
});

let nextCloneId = Math.floor(Math.random() * 0xFFFFFFFF);

module.exports = class Clone {
  constructor() {
    this.id = (nextCloneId++).toString(16);
  }

  /**
   * Starts a clone. The domain is inferred from the running test name.
   * http://orchestrator:port/start?cloneId=hexclonid&domain=full-test-name.m-ld.org
   * => { '@type': 'started' }
   */
  async start() {
    return send('start', { cloneId: this.id, domain });
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
   * => Array<Subject>
   */
  async transact(pattern) {
    return send('transact', { cloneId: this.id }, pattern);
  };
}

async function send(message, params, body) {
  const url = new URL(message, process.env.MELD_ORCHESTRATOR_URL);
  Object.entries(params).forEach(([name, value]) => url.searchParams.append(name, value));
  const options = { method: 'post' };
  if (body) {
    options.body = JSON.stringify(body);
    options.headers = { 'Content-Type': 'application/json' };
  }
  const res = checkStatus(await fetch(url.toString(), options));
  if (res.headers.get('transfer-encoding') === 'chunked') {
    return from(res.body)
      .map(chunk => JSON.parse(chunk.toString()))
      .collect().toPromise(Promise); // TODO: option to return the stream
  } else {
    return res.json();
  }
};

function checkStatus(res) {
  if (res.ok) // res.status >= 200 && res.status < 300
    return res;
  else
    throw new Error(res.statusText);
}