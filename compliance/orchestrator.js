const fetch = require('node-fetch');
const from = require('highland');

/**
 * Starts a clone in a given domain.
 */
exports.start = (cloneId, domain) => send('start', { cloneId, domain });
/**
 * Stops the given clone normally, keeping any persisted data for that ID.
 */
exports.stop = cloneId => send('stop', { cloneId });
/**
 * Kills the clone process completely without any normal shutdown.
 */
exports.kill = cloneId => send('kill', { cloneId });
/**
 * Stops the given clone normally and then deletes any persisted data,
 * such that a re-start of the same clone ID will be as if brand-new.
 */
exports.destroy = cloneId => send('destroy', { cloneId });
/**
 * Sends the given transaction request to the given clone.
 */
exports.transact = (cloneId, pattern) => send('transact', { cloneId }, pattern);

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
      .collect().toPromise(Promise); // TODO: option to output the stream
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