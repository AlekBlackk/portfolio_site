const test = require('node:test');
const assert = require('node:assert/strict');

test('loads exported helpers in Node without a browser document', () => {
  assert.equal(typeof globalThis.document, 'undefined');

  const helpers = require('../script.js');

  assert.equal(typeof helpers.getActiveSectionId, 'function');
  assert.equal(typeof helpers.getScrollTargetY, 'function');
});
