const fetch = require('node-fetch');

exports.start = (cloneId, domain) => send('start', { cloneId, domain });
exports.destroy = cloneId => send('destroy', { cloneId });

async function send(message, params, body) {
  const url = new URL(message, process.env.MELD_ORCHESTRATOR_URL);
  Object.entries(params).forEach(([name, value]) => url.searchParams.append(name, value));
  const options = { method: 'post' };
  if (body) {
    options.body = JSON.stringify(body);
    options.headers = { 'Content-Type': 'application/json' };
  }
  return checkStatus(await fetch(url.toString(), options)).json();
};

function checkStatus(res) {
  if (res.ok) // res.status >= 200 && res.status < 300
    return res;
  else
    throw new Error(res.statusText);
}