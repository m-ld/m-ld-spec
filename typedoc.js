
module.exports = {
  mode: 'file',
  out: '_site',
  theme: 'node_modules/@m-ld/typedoc-theme/bin/minimal',
  readme: './doc/index.md',
  readmeToc: require('./doc/toc.json'),
  includes: './doc/includes',
  media: './doc/media',
  disableSources: true,
  includeVersion: true
}