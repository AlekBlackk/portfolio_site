(() => {
  'use strict';

  const LAST_SECTION_BOTTOM_GAP = 80;
  const MAX_REGULAR_SECTION_TOP = 250;
  const MIN_SECTION_TOP_GAP = 24;

  function getScrollTargetY({
    targetTop,
    currentScrollY,
    stickyOffset,
    preferredViewportTop
  }) {
    const viewportTop = preferredViewportTop ?? stickyOffset ?? 0;

    return Math.max(targetTop + currentScrollY - viewportTop, 0);
  }

  function getScrollSpacerHeight({
    lastSectionTop,
    lastSectionHeight,
    documentHeight
  }) {
    const requiredDocumentHeight =
      lastSectionTop + lastSectionHeight + LAST_SECTION_BOTTOM_GAP;

    return Math.max(Math.ceil(requiredDocumentHeight - documentHeight), 0);
  }

  function getSectionActivationViewportTop({
    viewportHeight,
    stickyOffset
  }) {
    const availableViewport = Math.max(viewportHeight - stickyOffset, 0);

    return stickyOffset + (availableViewport * 0.5);
  }

  function getSectionViewportTop({
    viewportHeight,
    stickyOffset,
    isLastSection,
    sectionHeight,
    sectionTop,
    documentHeight
  }) {
    const minimumTop = stickyOffset + MIN_SECTION_TOP_GAP;

    if (isLastSection) {
      return Math.max(
        minimumTop,
        viewportHeight - sectionHeight - LAST_SECTION_BOTTOM_GAP
      );
    }

    const defaultTop = Math.max(
      minimumTop,
      Math.min(Math.round(viewportHeight * 0.25), MAX_REGULAR_SECTION_TOP)
    );

    if (typeof sectionTop !== 'number' || typeof documentHeight !== 'number') {
      return defaultTop;
    }

    const maxScroll = Math.max(documentHeight - viewportHeight, 0);
    const defaultTarget = Math.max(sectionTop - defaultTop, 0);

    if (defaultTarget <= maxScroll) {
      return defaultTop;
    }

    const activationTop = getSectionActivationViewportTop({
      viewportHeight,
      stickyOffset
    });
    const fittedTop = Math.max(
      minimumTop,
      viewportHeight - sectionHeight - LAST_SECTION_BOTTOM_GAP
    );
    const minimumSafeTop = Math.max(
      minimumTop,
      sectionTop - maxScroll + MIN_SECTION_TOP_GAP
    );

    return Math.min(
      Math.max(defaultTop, fittedTop, minimumSafeTop),
      activationTop
    );
  }

  function getActiveSectionId({
    sections,
    scrollY,
    viewportHeight,
    stickyOffset,
    documentHeight
  }) {
    if (!Array.isArray(sections) || sections.length === 0) {
      return null;
    }

    if (scrollY + viewportHeight >= documentHeight - 2) {
      return sections[sections.length - 1].id;
    }

    const focusY = scrollY + getSectionActivationViewportTop({
      viewportHeight,
      stickyOffset
    });
    let activeId = sections[0].id;

    for (const section of sections) {
      if (section.top <= focusY) {
        activeId = section.id;
        continue;
      }

      break;
    }

    return activeId;
  }

  if (typeof module !== 'undefined' && module.exports) {
    module.exports = {
      getActiveSectionId,
      getSectionViewportTop,
      getScrollSpacerHeight,
      getScrollTargetY
    };
  }

  if (typeof document === 'undefined') {
    return;
  }

  // Typing Effect
  const roles = [
    'Full-Stack Developer',
    'UI/UX Enthusiast',
    'Open Source Contributor',
    'Problem Solver'
  ];

  const typingEl = document.getElementById('typing-text');
  let roleIndex = 0;
  let charIndex = 0;
  let isDeleting = false;

  function type() {
    const current = roles[roleIndex];

    if (isDeleting) {
      charIndex--;
      typingEl.textContent = current.substring(0, charIndex);
    } else {
      charIndex++;
      typingEl.textContent = current.substring(0, charIndex);
    }

    let delay;

    if (!isDeleting && charIndex === current.length) {
      delay = 2000;
      isDeleting = true;
    } else if (isDeleting && charIndex === 0) {
      isDeleting = false;
      roleIndex = (roleIndex + 1) % roles.length;
      delay = 400;
    } else {
      delay = isDeleting ? 50 : 80;
    }

    setTimeout(type, delay);
  }

  type();

  // Tab Navigation
  const tabs = Array.from(document.querySelectorAll('.tab'));
  const sections = Array.from(document.querySelectorAll('section[id]'));
  let isTabScrolling = false;
  let scrollTimeout = null;

  function setActiveTab(activeId) {
    tabs.forEach(tab => {
      tab.classList.toggle('active', tab.dataset.target === activeId);
    });
  }

  function getStickyOffset() {
    const titleBar = document.querySelector('.title-bar');
    const tabBar = document.querySelector('.tab-bar');

    return [titleBar, tabBar].reduce((total, element) => {
      return total + (element ? element.getBoundingClientRect().height : 0);
    }, 0);
  }

  function getSectionMetrics() {
    return sections.map(section => ({
      id: section.id,
      top: window.scrollY + section.getBoundingClientRect().top
    }));
  }

  function syncLayoutMetrics() {
    const stickyOffset = getStickyOffset();
    const currentSpacer = parseFloat(
      getComputedStyle(document.documentElement).getPropertyValue('--scroll-spacer')
    ) || 0;
    const baseDocumentHeight = document.documentElement.scrollHeight - currentSpacer;
    const lastSection = sections[sections.length - 1];
    const lastSectionTop = lastSection
      ? window.scrollY + lastSection.getBoundingClientRect().top
      : 0;
    const lastSectionHeight = lastSection
      ? lastSection.getBoundingClientRect().height
      : 0;
    const spacerHeight = getScrollSpacerHeight({
      lastSectionTop,
      lastSectionHeight,
      documentHeight: baseDocumentHeight
    });

    document.documentElement.style.setProperty('--sticky-offset', `${stickyOffset}px`);
    document.documentElement.style.setProperty('--scroll-spacer', `${spacerHeight}px`);
  }

  function syncActiveTabFromScroll() {
    const activeId = getActiveSectionId({
      sections: getSectionMetrics(),
      scrollY: window.scrollY,
      viewportHeight: window.innerHeight,
      stickyOffset: getStickyOffset(),
      documentHeight: document.documentElement.scrollHeight
    });

    if (activeId) {
      setActiveTab(activeId);
    }
  }

  tabs.forEach(tab => {
    tab.addEventListener('click', () => {
      const targetId = tab.dataset.target;
      const target = document.getElementById(targetId);

      if (target) {
        syncLayoutMetrics();

        const stickyOffset = getStickyOffset();
        const lastSection = sections[sections.length - 1];
        const targetRect = target.getBoundingClientRect();
        const targetTop = window.scrollY + targetRect.top;
        const documentHeight = document.documentElement.scrollHeight;
        const preferredViewportTop = getSectionViewportTop({
          viewportHeight: window.innerHeight,
          stickyOffset,
          isLastSection: target === lastSection,
          sectionHeight: targetRect.height,
          sectionTop: targetTop,
          documentHeight
        });

        isTabScrolling = true;
        clearTimeout(scrollTimeout);
        scrollTimeout = setTimeout(() => {
          isTabScrolling = false;
        }, 800);

        setActiveTab(targetId);

        window.scrollTo({
          top: getScrollTargetY({
            targetTop: targetRect.top,
            currentScrollY: window.scrollY,
            stickyOffset,
            preferredViewportTop
          }),
          behavior: 'smooth'
        });
      }
    });
  });

  function handleScroll() {
    if (isTabScrolling) {
      clearTimeout(scrollTimeout);
      scrollTimeout = setTimeout(() => {
        isTabScrolling = false;
        syncActiveTabFromScroll();
      }, 150);
      return;
    }
    syncActiveTabFromScroll();
  }

  window.addEventListener('scroll', handleScroll, { passive: true });
  window.addEventListener('resize', () => {
    syncLayoutMetrics();
    syncActiveTabFromScroll();
  });
  syncLayoutMetrics();
  syncActiveTabFromScroll();

  // Card Scroll Reveal
  const cards = document.querySelectorAll('.card');

  const cardObserver = new IntersectionObserver(entries => {
    entries.forEach(entry => {
      if (entry.isIntersecting) {
        const card = entry.target;
        card.classList.add('visible');
        cardObserver.unobserve(card);

        // Clear the reveal animation so hover transitions stay responsive.
        card.addEventListener('animationend', () => {
          card.style.animation = 'none';
          card.classList.add('revealed');
        }, { once: true });
      }
    });
  }, {
    threshold: 0.15
  });

  cards.forEach(card => cardObserver.observe(card));
})();
