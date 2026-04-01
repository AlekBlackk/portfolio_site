const test = require('node:test');
const assert = require('node:assert/strict');

function createClassList(initial = []) {
  const classes = new Set(initial);

  return {
    add(name) {
      classes.add(name);
    },
    remove(name) {
      classes.delete(name);
    },
    contains(name) {
      return classes.has(name);
    }
  };
}

test('pins floating panels to their current top-left coordinates', () => {
  const { pinFloatingPanelPosition } = require('../script.js');
  const panelBody = { style: {} };
  const panel = {
    style: {
      top: '',
      left: '',
      right: '0px',
      bottom: '0px'
    },
    classList: createClassList(),
    offsetParent: {
      getBoundingClientRect() {
        return {
          top: 120,
          left: 80
        };
      }
    },
    getBoundingClientRect() {
      return {
        top: 360,
        left: 250
      };
    },
    querySelector(selector) {
      return selector === '.panel-body' ? panelBody : null;
    }
  };

  pinFloatingPanelPosition(panel);

  assert.equal(panel.style.top, '240px');
  assert.equal(panel.style.left, '170px');
  assert.equal(panel.style.right, 'auto');
  assert.equal(panel.style.bottom, 'auto');
});
