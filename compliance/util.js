exports.compareById = (e1, e2) => e1['@id'] < e2['@id'] ? -1 : e1['@id'] > e2['@id'] ? 1 : 0;
/**
 * Uses central limit theorem to generate an approximation to a gaussian distributed random [0, 1)
 * https://en.wikipedia.org/wiki/Central_limit_theorem
 */
exports.gaussRandom = () => Array.from(new Array(6), Math.random).reduce((sum, n) => sum + n) / 6;
/**
 * Random integer [0, upper)
 */
exports.randomInt = upper => Math.floor(Math.random() * upper);
