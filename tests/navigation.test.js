const test = require('node:test');
const assert = require('node:assert/strict');

test('returns projects while the viewport focus is inside the projects section', () => {
  const { getActiveSectionId } = require('../script.js');

  const activeId = getActiveSectionId({
    sections: [
      { id: 'hero', top: 80 },
      { id: 'projects', top: 760 },
      { id: 'contacts', top: 1600 }
    ],
    scrollY: 700,
    viewportHeight: 800,
    stickyOffset: 80,
    documentHeight: 1900
  });

  assert.equal(activeId, 'projects');
});

test('computes the minimal bottom spacer for the final section', () => {
  const { getScrollSpacerHeight } = require('../script.js');

  assert.equal(
    getScrollSpacerHeight({
      lastSectionTop: 1238,
      lastSectionHeight: 167,
      documentHeight: 1433
    }),
    52
  );
});

test('returns contacts when the viewport focus reaches the final section', () => {
  const { getActiveSectionId } = require('../script.js');

  const activeId = getActiveSectionId({
    sections: [
      { id: 'hero', top: 80 },
      { id: 'projects', top: 760 },
      { id: 'contacts', top: 1600 }
    ],
    scrollY: 1160,
    viewportHeight: 800,
    stickyOffset: 80,
    documentHeight: 1960
  });

  assert.equal(activeId, 'contacts');
});

test('keeps projects active after scrolling to its computed viewport anchor', () => {
  const {
    getActiveSectionId,
    getSectionViewportTop,
    getScrollTargetY
  } = require('../script.js');
  const viewportHeight = 850;
  const stickyOffset = 71;
  const projectsTop = 500;
  const contactsTop = 800;
  const documentHeight = 1000;
  const scrollY = getScrollTargetY({
    targetTop: projectsTop,
    currentScrollY: 0,
    stickyOffset,
    preferredViewportTop: getSectionViewportTop({
      viewportHeight,
      stickyOffset,
      isLastSection: false,
      sectionHeight: 300,
      sectionTop: projectsTop,
      documentHeight
    })
  });
  const activeId = getActiveSectionId({
    sections: [
      { id: 'hero', top: 71 },
      { id: 'projects', top: projectsTop },
      { id: 'contacts', top: contactsTop }
    ],
    scrollY,
    viewportHeight,
    stickyOffset,
    documentHeight
  });

  assert.equal(activeId, 'projects');
});

test('subtracts sticky header height from the scroll target', () => {
  const { getScrollTargetY } = require('../script.js');

  assert.equal(
    getScrollTargetY({
      targetTop: 1200,
      currentScrollY: 300,
      stickyOffset: 90
    }),
    1410
  );
});

test('keeps projects above the bottom clamp on tall viewports', () => {
  const { getScrollTargetY, getSectionViewportTop } = require('../script.js');
  const viewportHeight = 1244;
  const stickyOffset = 71;
  const documentHeight = 1446;
  const maxScroll = documentHeight - viewportHeight;
  const scrollTarget = getScrollTargetY({
    targetTop: 615,
    currentScrollY: 0,
    stickyOffset,
    preferredViewportTop: getSectionViewportTop({
      viewportHeight,
      stickyOffset,
      isLastSection: false,
      sectionHeight: 585,
      sectionTop: 615,
      documentHeight
    })
  });

  assert.ok(scrollTarget < maxScroll);
});

test('computes a lower viewport anchor for regular sections when the viewport is tighter', () => {
  const { getSectionViewportTop } = require('../script.js');

  assert.equal(
    getSectionViewportTop({
      viewportHeight: 1000,
      stickyOffset: 71,
      isLastSection: false,
      sectionHeight: 565
    }),
    250
  );
});

test('maps a minimap click position to a centered document scroll target', () => {
  const { getMinimapScrollTarget } = require('../script.js');

  assert.equal(
    getMinimapScrollTarget({
      clientY: 600,
      minimapTop: 100,
      minimapHeight: 1000,
      documentHeight: 2500,
      viewportHeight: 1200
    }),
    650
  );
});
