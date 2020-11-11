const Clone = require('../clone');

/**
 * Basic multi-clone snapshot & revup tests (no chaos)
 */
describe('Restart colony', () => {
  let clones;

  beforeEach(async () => {
    // Create two clones for free, with genesis started
    clones = [new Clone, new Clone];
    await clones[0].start();
  });

  it('new clone starts with snapshot', async () => {
    await clones[0].transact({ '@id': 'fred', name: 'Fred' });
    await clones[1].start();

    const subjects = await clones[1].transact({ '@describe': 'fred' });
    expect(subjects).toEqual([{ '@id': 'fred', name: 'Fred' }]);
  });

  it('restarting clone revs-up', async () => {
    await clones[1].start();
    await Promise.all([
      clones[0].transact({ '@id': 'fred', name: 'Fred' }),
      clones[1].updated()
    ]);

    await clones[1].stop();
    await clones[0].transact({ '@id': 'wilma', name: 'Wilma' });

    await expectAsync(Promise.all([
      clones[1].start(),
      clones[1].updated('@insert', 'wilma')
    ])).toBeResolved();
  });

  it('converges after siloing', async () => {
    const fred = { '@id': 'fred', '@type': 'Flintstone' };
    const wilma = { '@id': 'wilma', '@type': 'Flintstone' };
    const bambam = { '@id': 'bambam', '@type': 'Flintstone' };

    await clones[1].start();
    await Promise.all([
      clones[0].transact(fred),
      clones[1].updated()
    ]);
    await clones[0].stop();

    // Clone transaction while siloed
    await clones[1].transact(wilma);
    await clones[1].stop();

    // Clone[0] transaction while siloed
    await clones[0].start();
    await clones[0].transact(bambam);

    await clones[1].start();
    await Promise.all([
      clones[0].updated('@id', 'wilma'),
      clones[1].updated('@id', 'bambam')
    ]);

    await expectAsync(clones[0].transact({ '@describe': 'fred' })).toBeResolvedTo([fred]);
    await expectAsync(clones[0].transact({ '@describe': 'wilma' })).toBeResolvedTo([wilma]);
    await expectAsync(clones[0].transact({ '@describe': 'bambam' })).toBeResolvedTo([bambam]);
    await expectAsync(clones[1].transact({ '@describe': 'fred' })).toBeResolvedTo([fred]);
    await expectAsync(clones[1].transact({ '@describe': 'wilma' })).toBeResolvedTo([wilma]);
    await expectAsync(clones[1].transact({ '@describe': 'bambam' })).toBeResolvedTo([bambam]);
  });

  it('converges after fork', async () => {
    await clones[1].start();
    await Promise.all([
      clones[0].transact({ '@id': 'fred', name: 'Fred' }),
      clones[1].updated()
    ]);
    // Fork clone[0] again
    clones.push(new Clone);
    await clones[2].start();
    // Check that a message from the forked clock gets through
    await Promise.all([
      clones[2].transact({ '@id': 'barney', name: 'Barney' }),
      clones[1].updated('barney')
    ]);
    // Stop clone[2] (don't need it any more)
    await clones[2].stop();
    // Fork clone[0] again. Unfortunately, to fail with bad clock implementations
    // this test requires that this new clone forks its clock from clone[0],
    // which is not something we can control right here. So we may get a false
    // positive.
    clones.push(new Clone);
    await clones[3].start();
    // Check that a message from the forked clock gets through
    await Promise.all([
      clones[3].transact({ '@id': 'bambam', name: 'Bam-Bam' }),
      clones[1].updated('bambam')
    ]);
  });

  it('converges after false silo', async () => {
    clones.push(new Clone);
    await Promise.all([
      clones[1].start(),
      clones[2].start()
    ]);
    await Promise.all([
      clones[0].transact({ '@id': 'fred', name: 'Fred' }),
      clones[1].updated(),
      clones[2].updated()
    ]);
    await Promise.all([
      clones[1].stop(),
      clones[2].stop()
    ]);
    // Clone[0] transaction while clones stopped
    await clones[0].transact({ '@id': 'wilma', name: 'Wilma' });
    await clones[0].stop();
    // Clones transaction while clone[0] stopped
    await Promise.all([
      clones[1].start(),
      clones[2].start()
    ]);
    await Promise.all([
      clones[1].transact({ '@id': 'bambam', name: 'Bam-Bam' }),
      clones[1].updated('@id', 'bambam'),
      clones[2].updated('@id', 'bambam')
    ]);
    await Promise.all([
      clones[1].stop(),
      clones[2].stop()
    ]);
    // Re-start clone[0] as a silo (even though it's not up to date)
    await clones[0].start();
    // Check that everyone gets the new data
    await Promise.all([
      clones[1].start(),
      clones[0].updated('@id', 'bambam'),
      clones[1].updated('@id', 'wilma')
    ]);
    await Promise.all([
      clones[2].start(),
      clones[2].updated('@id', 'wilma')
    ]);
  });

  afterEach(async () => {
    for (clone of clones)
      await clone.destroy();
  });
});

