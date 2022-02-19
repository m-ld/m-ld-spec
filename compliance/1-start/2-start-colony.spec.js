const Clone = require('../clone');

/**
 * Basic multi-clone startup tests (no transactions)
 */
describe('Colony', () => {
  let clones;

  it('clones start', async () => {
    clones = [new Clone, new Clone];
    await clones[0].start();
    await expectAsync(clones[1].start()).toBeResolved();
  });

  it('clone can restart', async () => {
    clones = [new Clone, new Clone];
    await clones[0].start(true);
    await clones[1].start();
    await clones[0].stop();
    await expectAsync(clones[0].start()).toBeResolved();
  });

  it('clone can restart alone', async () => {
    clones = [new Clone, new Clone];
    await clones[0].start(true);
    await clones[1].start();
    await clones[0].stop();
    await clones[1].stop();
    await expectAsync(clones[0].start()).toBeResolved();
  });

  it('start from non-genesis', async () => {
    clones = [new Clone, new Clone, new Clone];
    await clones[0].start(true);
    await clones[0].transact({ '@id': 'fred', name: 'Fred' });
    await clones[1].start(); // Receive snapshot from clones[0]
    await clones[0].transact({ '@id': 'wilma', name: 'Wilma' });
    await clones[1].updated('@insert', 'wilma');
    /*
    This captures an edge-case former bug in the JS engine. At this point
    clones[1] may drop the pre-fork journal entry 'fred', but when responding to
    clones[2]'s snapshot request, it was trying to fuse 'wilma' with it.
     */
    await clones[1].transact({ '@id': 'barney', name: 'Barney' });
    await clones[0].stop();
    await expectAsync(clones[2].start()).toBeResolved();
  });

  afterEach(() => Promise.all(clones.map(clone => clone.destroy())));
});

