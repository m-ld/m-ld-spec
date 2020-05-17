const Clone = require('../clone');

/**
 * Basic multi-clone snapshot & revup tests (no chaos)
 */
describe('Restart colony', () => {
  let genesis = new Clone, clone1 = new Clone

  beforeEach(async () => {
    await genesis.start();
  });

  it('new clone starts with snapshot', async () => {
    await genesis.transact({ '@id': 'fred', name: 'Fred' });
    await clone1.start();

    const subjects = await clone1.transact({ '@describe': 'fred' });
    expect(subjects).toEqual([{ '@id': 'fred', name: 'Fred' }]);
  });

  it('restarting clone revs-up', async () => {
    await clone1.start();
    await Promise.all([
      genesis.transact({ '@id': 'fred', name: 'Fred' }),
      clone1.updated()
    ]);

    await clone1.stop();
    await genesis.transact({ '@id': 'wilma', name: 'Wilma' });

    await expectAsync(Promise.all([
      clone1.start(),
      clone1.updated('@insert', 'wilma')
    ])).toBeResolved();
  });

  it('converges after siloing', async () => {
    const fred = { '@id': 'fred', '@type': 'Flintstone' };
    const wilma = { '@id': 'wilma', '@type': 'Flintstone' };
    const bambam = { '@id': 'bambam', '@type': 'Flintstone' };

    await clone1.start();
    await Promise.all([
      genesis.transact(fred),
      clone1.updated()
    ]);
    await genesis.stop();

    // Clone transaction while siloed
    await clone1.transact(wilma);
    await clone1.stop();

    // Genesis transaction while siloed
    await genesis.start();
    await genesis.transact(bambam);

    await clone1.start();
    await genesis.updated('@id', 'wilma');

    await expectAsync(genesis.transact({ '@describe': 'fred' })).toBeResolvedTo([fred]);
    await expectAsync(genesis.transact({ '@describe': 'wilma' })).toBeResolvedTo([wilma]);
    await expectAsync(genesis.transact({ '@describe': 'bambam' })).toBeResolvedTo([bambam]);
    await expectAsync(clone1.transact({ '@describe': 'fred' })).toBeResolvedTo([fred]);
    await expectAsync(clone1.transact({ '@describe': 'wilma' })).toBeResolvedTo([wilma]);
    await expectAsync(clone1.transact({ '@describe': 'bambam' })).toBeResolvedTo([bambam]);
  });

  it('converges after false silo', async () => {
    const clone2 = new Clone;
    await Promise.all([
      clone1.start(),
      clone2.start()
    ]);
    await Promise.all([
      genesis.transact({ '@id': 'fred', name: 'Fred' }),
      clone1.updated(),
      clone2.updated()
    ]);
    await Promise.all([
      clone1.stop(),
      clone2.stop()
    ]);
    // Genesis transaction while clones stopped
    await genesis.transact({ '@id': 'wilma', name: 'Wilma' });
    await genesis.stop();
    // Clones transaction while genesis stopped
    await Promise.all([
      clone1.start(),
      clone2.start()
    ]);
    await Promise.all([
      clone1.transact({ '@id': 'bambam', name: 'Bam-Bam' }),
      clone1.updated('@id', 'bambam'),
      clone2.updated('@id', 'bambam')
    ]);
    await Promise.all([
      clone1.stop(),
      clone2.stop()
    ]);
    // Re-start genesis as a silo (even though it's not up to date)
    await genesis.start();
    // Check that everyone gets the new data
    await Promise.all([
      clone1.start(),
      genesis.updated('@id', 'bambam'),
      clone1.updated('@id', 'wilma')
    ]);
    await Promise.all([
      clone2.start(),
      clone2.updated('@id', 'wilma')
    ]);
  });

  afterEach(async () => {
    await genesis.destroy();
    await clone1.destroy();
  });
});

