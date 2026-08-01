const test = require('node:test');
const assert = require('node:assert/strict');

test('fuzzyMatch finds an in-order subsequence and reports its indices', () => {
  const { fuzzyMatch } = require('../script.js');

  const result = fuzzyMatch('git', 'Open GitHub');
  assert.ok(result);
  assert.deepEqual(result.matches, [5, 6, 7]);
});

test('fuzzyMatch returns null when characters are missing or out of order', () => {
  const { fuzzyMatch } = require('../script.js');

  assert.equal(fuzzyMatch('xyz', 'Open GitHub'), null);
  assert.equal(fuzzyMatch('tig', 'Open GitHub'), null);
});

test('fuzzyMatch is case-insensitive', () => {
  const { fuzzyMatch } = require('../script.js');

  const upper = fuzzyMatch('GIT', 'Open GitHub');
  const lower = fuzzyMatch('git', 'Open GitHub');
  assert.deepEqual(upper, lower);
});

test('fuzzyMatch scores a contiguous match higher than a scattered one', () => {
  const { fuzzyMatch } = require('../script.js');

  const contiguous = fuzzyMatch('git', 'Open GitHub');
  const scattered = fuzzyMatch('git', 'Go to Insights Tab');
  assert.ok(contiguous.score > scattered.score);
});

test('fuzzyMatch gives a start-of-word bonus', () => {
  const { fuzzyMatch } = require('../script.js');

  const startOfWord = fuzzyMatch('h', 'Open Home');
  const midWord = fuzzyMatch('h', 'Open Github');
  assert.ok(startOfWord.score > midWord.score);
});

test('filterCommands sorts matches by descending score', () => {
  const { filterCommands } = require('../script.js');

  const commands = [
    { id: 'a', label: 'Go to Insights Tab' },
    { id: 'b', label: 'Open GitHub' }
  ];

  const results = filterCommands('git', commands);

  assert.deepEqual(results.map(r => r.command.id), ['b', 'a']);
});

test('filterCommands drops non-matching commands', () => {
  const { filterCommands } = require('../script.js');

  const commands = [
    { id: 'a', label: 'Open GitHub' },
    { id: 'b', label: 'Open Telegram' }
  ];

  const results = filterCommands('xyz', commands);

  assert.deepEqual(results, []);
});

test('filterCommands returns the full list unchanged, in original order, for an empty query', () => {
  const { filterCommands } = require('../script.js');

  const commands = [
    { id: 'a', label: 'Open Telegram' },
    { id: 'b', label: 'Open GitHub' }
  ];

  const results = filterCommands('', commands);

  assert.deepEqual(results.map(r => r.command.id), ['a', 'b']);
  results.forEach(r => assert.deepEqual(r.matches, []));
});

test('filterCommands preserves original order for equal scores (stable sort)', () => {
  const { filterCommands } = require('../script.js');

  const commands = [
    { id: 'a', label: 'Aaa' },
    { id: 'b', label: 'Aab' },
    { id: 'c', label: 'Aac' }
  ];

  const results = filterCommands('aa', commands);

  assert.deepEqual(results.map(r => r.command.id), ['a', 'b', 'c']);
});
