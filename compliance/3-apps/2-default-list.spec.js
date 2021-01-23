const Clone = require('../clone');

/**
 * Clone semantic rules
 */
describe('Default list handling', () => {
  let clones;

  it('transacts serial list inserts from two clones', async () => {
    clones = Clone.create(2);
    await clones[0].start(true);
    await clones[1].start();

    await Promise.all([
      clones[0].transact({ '@id': 'shopping', '@list': ['Bread'] }),
      clones[1].updated('shopping')
    ]);
    await Promise.all([
      clones[1].transact({ '@id': 'shopping', '@list': { 1: 'Milk' } }),
      clones[0].updated('shopping')
    ]);

    expect(await clones[0].transact({ '@describe': 'shopping' })).toEqual([{
      '@id': 'shopping',
      '@type': 'http://m-ld.org/RdfLseq',
      '@list': ['Bread', 'Milk']
    }]);
  });

  it('transacts parallel list inserts from two clones', async () => {
    clones = Clone.create(2);
    await clones[0].start(true);
    await clones[1].start();

    await Promise.all([
      clones[0].transact({ '@id': 'shopping', '@list': ['Bread'] }),
      clones[1].updated('shopping')
    ]);
    await Promise.all([
      clones[0].transact({ '@id': 'shopping', '@list': { 1: 'Spam' } }),
      clones[1].transact({ '@id': 'shopping', '@list': { 1: 'Milk' } }),
      clones[0].updated('Milk')
    ]);

    const shopping = await clones[0].transact({ '@describe': 'shopping' });
    expect(shopping[0]['@list'][0]).toEqual('Bread');
    expect(new Set(shopping[0]['@list'])).toEqual(new Set(['Bread', 'Milk', 'Spam']));
  });

  it('transacts parallel list deletes from two clones', async () => {
    clones = Clone.create(2);
    await clones[0].start(true);
    await clones[1].start();

    await Promise.all([
      clones[0].transact({ '@id': 'shopping', '@list': ['Bread', 'Milk'] }),
      clones[1].updated('shopping')
    ]);
    await Promise.all([
      clones[0].transact({ '@delete': { '@id': 'shopping', '@list': { 1: 'Milk' } } }),
      clones[1].transact({ '@delete': { '@id': 'shopping', '@list': { 1: 'Milk' } } }),
      clones[0].updated('Milk')
    ]);

    expect(await clones[0].transact({ '@describe': 'shopping' })).toEqual([{
      '@id': 'shopping',
      '@type': 'http://m-ld.org/RdfLseq',
      '@list': ['Bread']
    }]);
  });

  it('transacts parallel list moves from two clones', async () => {
    clones = Clone.create(2);
    await clones[0].start(true);
    await clones[1].start();

    await Promise.all([
      clones[0].transact({ '@id': 'shopping', '@list': ['Bread', 'Milk', 'Spam'] }),
      clones[1].updated('shopping')
    ]);
    await Promise.all([
      clones[0].transact({
        '@delete': { '@id': 'shopping', '@list': { 1: { '@id': '?slot', '@item': 'Milk' } } },
        '@insert': { '@id': 'shopping', '@list': { 0: { '@id': '?slot', '@item': 'Milk' } } }
      }),
      clones[1].transact({
        '@delete': { '@id': 'shopping', '@list': { 1: { '@id': '?slot', '@item': 'Milk' } } },
        '@insert': { '@id': 'shopping', '@list': { 0: { '@id': '?slot', '@item': 'Milk' } } }
      }),
      clones[0].updated('Milk')
    ]);
    // 'Milk' is not duplicated in the final list, and both intents are preserved
    expect(await clones[0].transact({ '@describe': 'shopping' })).toEqual([{
      '@id': 'shopping',
      '@type': 'http://m-ld.org/RdfLseq',
      '@list': ['Milk', 'Bread', 'Spam']
    }]);
  });

  afterEach(async () => {
    await Promise.all(clones.map(clone => clone.destroy()));
  });
});

