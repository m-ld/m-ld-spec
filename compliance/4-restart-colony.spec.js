const Clone = require('./clone');

/**
 * Basic multi-clone snapshot & revup tests (no chaos)
 */
describe('Restart colony', () => {
  let genesis = new Clone, clone = new Clone

  beforeEach(async () => {
    await genesis.start();
  });

  it('new clone starts with snapshot', async () => {
    await genesis.transact({ '@id': 'fred', name: 'Fred' });
    await clone.start();

    const subjects = await clone.transact({ '@describe': 'fred' });
    expect(subjects).toEqual([{ '@id': 'fred', name: 'Fred' }]);
  });

  it('restarting clone revs-up', async () => {
    await clone.start();
    await Promise.all([
      genesis.transact({ '@id': 'fred', name: 'Fred' }),
      clone.updated()
    ]);

    await clone.stop();
    await genesis.transact({ '@id': 'wilma', name: 'Wilma' });

    await expectAsync(Promise.all([
      clone.start(),
      clone.updated('@insert', 'wilma')
    ])).toBeResolved();
  });

  it('converges after siloing', async () => {
    await clone.start();
    await Promise.all([
      genesis.transact({ '@id': 'fred', '@type': 'Flintstone' }),
      clone.updated()
    ]);
    await genesis.stop();
    // Clone transaction while siloed
    await clone.transact({ '@id': 'wilma', '@type': 'Flintstone' });
    await clone.stop();

    await genesis.start();
    // Genesis transaction while siloed
    await genesis.transact({ '@id': 'bambam', '@type': 'Flintstone' });

    await clone.start();

    await genesis.updated('@id', 'wilma');

    await expectAsync(genesis.transact({ '@describe': 'fred' }))
      .toBeResolvedTo([{ '@id': 'fred', '@type': 'Flintstone' }]);
    await expectAsync(genesis.transact({ '@describe': 'wilma' }))
      .toBeResolvedTo([{ '@id': 'wilma', '@type': 'Flintstone' }]);
    await expectAsync(genesis.transact({ '@describe': 'bambam' }))
      .toBeResolvedTo([{ '@id': 'bambam', '@type': 'Flintstone' }]);
    await expectAsync(clone.transact({ '@describe': 'fred' }))
      .toBeResolvedTo([{ '@id': 'fred', '@type': 'Flintstone' }]);
    await expectAsync(clone.transact({ '@describe': 'wilma' }))
      .toBeResolvedTo([{ '@id': 'wilma', '@type': 'Flintstone' }]);
    await expectAsync(clone.transact({ '@describe': 'bambam' }))
      .toBeResolvedTo([{ '@id': 'bambam', '@type': 'Flintstone' }]);
  });

  afterEach(async () => {
    await genesis.destroy();
    await clone.destroy();
  });
});

