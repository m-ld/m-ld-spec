const Clone = require('../clone');

/**
 * Basic network partitions (no chaos)
 */
describe('On partition', () => {
  let clone1, clone2, clone3;

  beforeEach(() => {
    clone1 = new Clone;
    clone2 = clone3 = undefined;
  });

  it('still accepts transactions', async () => {
    await clone1.start(true);
    await clone1.partition();
    await Promise.all([
      clone1.transact({ '@id': 'fred', name: 'Fred' }),
      clone1.updated('@id', 'fred')
    ]);
  });

  it('converges after partition', async () => {
    clone2 = new Clone;
    await clone1.start(true);
    await clone2.start();
    await Promise.all([
      clone1.transact({ '@id': 'fred', name: 'Fred' }),
      clone2.updated('@id', 'fred')
    ]);
    await clone1.partition(); // Effectively partitions clone2 as well

    await Promise.all([
      clone1.transact({ '@id': 'wilma', name: 'Wilma' }),
      clone2.transact({ '@id': 'bambam', name: 'Bam-Bam' })
    ]);
    await clone1.partition(false);
    await Promise.all([
      expectAsync(clone1.updated('@id', 'bambam')).toBeResolved(),
      expectAsync(clone2.updated('@id', 'wilma')).toBeResolved()
    ]);
  });

  it('converges after partition and close', async () => {
    clone2 = new Clone;
    await clone1.start(true);
    await clone2.start();
    await Promise.all([
      clone1.transact({ '@id': 'fred', name: 'Fred' }),
      clone2.updated('@id', 'fred')
    ]);
    await clone1.partition(); // Effectively partitions clone2 as well

    await Promise.all([
      clone1.transact({ '@id': 'wilma', name: 'Wilma' }),
      clone2.transact({ '@id': 'bambam', name: 'Bam-Bam' })
    ]);
    await Promise.all([
      clone1.stop(),
      clone2.stop()
    ]);
    await clone1.partition(false);
    await Promise.all([
      clone1.start(true),
      clone2.start(),
      expectAsync(clone1.updated('@id', 'bambam')).toBeResolved(),
      expectAsync(clone2.updated('@id', 'wilma')).toBeResolved()
    ]);
  });

  it('converges after partition from colony', async () => {
    clone2 = new Clone;
    clone3 = new Clone;
    await clone1.start(true);
    await clone2.start();
    await clone3.start();
    await Promise.all([
      clone1.transact({ '@id': 'fred', name: 'Fred' }),
      clone2.updated('@id', 'fred'),
      clone3.updated('@id', 'fred')
    ]);
    await clone1.partition();

    await Promise.all([
      clone1.transact({ '@id': 'wilma', name: 'Wilma' }), // Undelivered
      clone2.transact({ '@id': 'bambam', name: 'Bam-Bam' }),
      clone3.updated('@id', 'bambam')
    ]);
    await clone1.partition(false);
    await Promise.all([
      expectAsync(clone1.updated('@id', 'bambam')).toBeResolved(),
      expectAsync(clone2.updated('@id', 'wilma')).toBeResolved(),
      expectAsync(clone3.updated('@id', 'wilma')).toBeResolved()
    ]);
  });

  afterEach(async () => {
    await clone1.destroy();
    clone2 && await clone2.destroy();
    clone3 && await clone3.destroy();
  });
});
