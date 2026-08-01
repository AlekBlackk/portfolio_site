(() => {
  'use strict';

  // --- Visibility Controller ---
  // Each animation registers pause/resume handlers here.
  // All loops stop when the tab is hidden and resume when it becomes visible again.
  const onPause = [];
  const onResume = [];

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

    const availableViewport = Math.max(viewportHeight - stickyOffset, 0);
    const maxScroll = Math.max(documentHeight - viewportHeight, 0);
    const scrollProgress = maxScroll > 0 ? scrollY / maxScroll : 0;

    // Keep the focus line at least at the regular section anchor so a tab
    // click can't scroll a section into view and still leave the previous tab active.
    const focusRatio = 0.5 + (scrollProgress * 0.25);
    const focusY = scrollY + stickyOffset + (availableViewport * focusRatio);

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

  function pinFloatingPanelPosition(panel) {
    if (!panel || typeof panel.getBoundingClientRect !== 'function') {
      return false;
    }

    if (panel.dataset?.panelPinned === 'true') {
      return true;
    }

    const container = panel.offsetParent;

    if (!container || typeof container.getBoundingClientRect !== 'function') {
      return false;
    }

    const panelRect = panel.getBoundingClientRect();
    const containerRect = container.getBoundingClientRect();
    const top = Math.round(panelRect.top - containerRect.top);
    const left = Math.round(panelRect.left - containerRect.left);

    if (!Number.isFinite(top) || !Number.isFinite(left)) {
      return false;
    }

    panel.style.top = `${top}px`;
    panel.style.left = `${left}px`;
    panel.style.right = 'auto';
    panel.style.bottom = 'auto';

    if (panel.dataset) {
      panel.dataset.panelPinned = 'true';
    }

    return true;
  }

  function getMinimapScrollTarget({
    clientY,
    minimapTop,
    minimapHeight,
    documentHeight,
    viewportHeight
  }) {
    if (
      !Number.isFinite(clientY) ||
      !Number.isFinite(minimapTop) ||
      !Number.isFinite(minimapHeight) ||
      minimapHeight <= 0 ||
      !Number.isFinite(documentHeight) ||
      !Number.isFinite(viewportHeight)
    ) {
      return 0;
    }

    const relativeY = clientY - minimapTop;
    const percentage = Math.max(0, Math.min(1, relativeY / minimapHeight));
    const centeredScrollTarget =
      (percentage * documentHeight) - (viewportHeight / 2);

    return Math.max(Math.round(centeredScrollTarget), 0);
  }

  function getPanelControlDescriptors(panelId) {
    const safePanelId = String(panelId || 'panel')
      .trim()
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/^-|-$/g, '') || 'panel';

    return [
      {
        action: 'hide',
        label: `Hide ${safePanelId} panel`,
        testId: `${safePanelId}-hide`
      },
      {
        action: 'minimize',
        label: `Minimize ${safePanelId} panel`,
        testId: `${safePanelId}-minimize`
      },
      {
        action: 'reset',
        label: `Reset ${safePanelId} panel position`,
        testId: `${safePanelId}-reset`
      }
    ];
  }

  function fuzzyMatch(query, text) {
    const q = query.toLowerCase();
    const t = text.toLowerCase();

    if (q.length === 0) {
      return { score: 0, matches: [] };
    }

    const matches = [];
    let qi = 0;
    let score = 0;
    let prevMatchIndex = -1;

    for (let ti = 0; ti < t.length && qi < q.length; ti++) {
      if (t[ti] !== q[qi]) continue;

      matches.push(ti);

      let charScore = 1;
      if (prevMatchIndex !== -1 && prevMatchIndex === ti - 1) {
        charScore += 3; // contiguous run bonus
      }
      if (ti === 0 || /[\s\-_/]/.test(t[ti - 1])) {
        charScore += 2; // start-of-word bonus
      }

      score += charScore;
      prevMatchIndex = ti;
      qi++;
    }

    if (qi < q.length) {
      return null; // not every query character matched, in order
    }

    return { score, matches };
  }

  function filterCommands(query, commands) {
    if (!query) {
      return commands.map(command => ({ command, score: 0, matches: [] }));
    }

    return commands
      .map(command => {
        const result = fuzzyMatch(query, command.label);
        return result ? { command, score: result.score, matches: result.matches } : null;
      })
      .filter(Boolean)
      .sort((a, b) => b.score - a.score);
  }

  if (typeof module !== 'undefined' && module.exports) {
    module.exports = {
      fuzzyMatch,
      filterCommands,
      getActiveSectionId,
      getMinimapScrollTarget,
      getPanelControlDescriptors,
      getSectionViewportTop,
      getScrollSpacerHeight,
      getScrollTargetY,
      pinFloatingPanelPosition
    };
  }

  if (typeof document === 'undefined') {
    return;
  }

  document.addEventListener('visibilitychange', () => {
    const handlers = document.hidden ? onPause : onResume;
    handlers.forEach(fn => fn());
  });

  // Typing Effect
  const roles = [
    'AI Product Builder',
    'Vibe Coder',
    'Специалист по AI-инструментам',
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

  if (typingEl) type();

  // Tab Navigation
  const tabs = Array.from(document.querySelectorAll('.tab'));
  const sections = Array.from(document.querySelectorAll('section[id]'));
  const titleBarEl = document.querySelector('.title-bar');
  const tabBarEl = document.querySelector('.tab-bar');
  let isTabScrolling = false;
  let scrollTimeout = null;

  // Status bar "Ln/Col" mimics an editor cursor position: Ln tracks scroll
  // progress through the page, Col tracks which section is active.
  const statusPositionEl = document.querySelector('[data-testid="status-ln-col"]');
  const sectionOrder = tabs.map(tab => tab.dataset.target);
  let currentSectionId = sections[0]?.id || null;

  function renderStatusPosition(progress) {
    if (!statusPositionEl) return;

    let currentProgress = progress;
    if (typeof currentProgress !== 'number') {
      const scrollable = document.documentElement.scrollHeight - window.innerHeight;
      currentProgress = scrollable > 0
        ? Math.min(Math.max(window.scrollY / scrollable, 0), 1)
        : 0;
    }

    const line = Math.round(currentProgress * 99) + 1;
    const col = Math.max(sectionOrder.indexOf(currentSectionId), 0) + 1;
    statusPositionEl.textContent = `Ln ${line}, Col ${col}`;
  }

  function setActiveTab(activeId) {
    tabs.forEach(tab => {
      const isActive = tab.dataset.target === activeId;
      tab.classList.toggle('active', isActive);
      if (isActive) {
        tab.setAttribute('aria-current', 'page');
      } else {
        tab.removeAttribute('aria-current');
      }
    });
    currentSectionId = activeId;
    renderStatusPosition();
  }

  function getStickyOffset() {
    return [titleBarEl, tabBarEl].reduce((total, element) => {
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

    if (titleBarEl) {
      const titleBarHeight = titleBarEl.getBoundingClientRect().height;
      document.documentElement.style.setProperty('--title-bar-height', `${titleBarHeight}px`);
    }
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

  function goToSection(targetId) {
    const target = document.getElementById(targetId);
    if (!target) return;

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

  tabs.forEach(tab => {
    tab.addEventListener('click', () => {
      goToSection(tab.dataset.target);
    });
  });

  let scrollRafId = null;

  function handleScroll() {
    if (isTabScrolling) {
      clearTimeout(scrollTimeout);
      scrollTimeout = setTimeout(() => {
        isTabScrolling = false;
        syncActiveTabFromScroll();
      }, 150);
      return;
    }

    // Coalesce rapid native scroll events (can fire faster than paint) so the
    // section-metrics layout reads run at most once per animation frame.
    if (scrollRafId) return;
    scrollRafId = requestAnimationFrame(() => {
      scrollRafId = null;
      syncActiveTabFromScroll();
    });
  }

  window.addEventListener('scroll', handleScroll, { passive: true });
  window.addEventListener('resize', () => {
    syncLayoutMetrics();
    syncActiveTabFromScroll();
  });
  syncLayoutMetrics();
  syncActiveTabFromScroll();

  // --- Scroll Progress Bar ---
  // Visible on all breakpoints, unlike the minimap which hides under 768px.
  const scrollProgressBar = document.querySelector('.scroll-progress__bar');
  if (scrollProgressBar) {
    let progressRafId = null;

    const updateScrollProgress = () => {
      progressRafId = null;
      const scrollable = document.documentElement.scrollHeight - window.innerHeight;
      const progress = scrollable > 0
        ? Math.min(Math.max(window.scrollY / scrollable, 0), 1)
        : 0;
      scrollProgressBar.style.transform = `scaleX(${progress})`;
      renderStatusPosition(progress);
    };

    const requestProgressUpdate = () => {
      if (progressRafId) return;
      progressRafId = requestAnimationFrame(updateScrollProgress);
    };

    window.addEventListener('scroll', requestProgressUpdate, { passive: true });
    window.addEventListener('resize', requestProgressUpdate);
    updateScrollProgress();
  }

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

  // --- 3D Holographic Tilt Effect for Cards ---
  cards.forEach(card => {
    // Dynamically inject the shine element
    const shine = document.createElement('div');
    shine.className = 'card__shine';
    card.appendChild(shine);

    card.addEventListener('mousemove', e => {
      if (!card.classList.contains('revealed') && !card.classList.contains('visible')) return;

      const rect = card.getBoundingClientRect();
      const x = e.clientX - rect.left;
      const y = e.clientY - rect.top;

      const centerX = rect.width / 2;
      const centerY = rect.height / 2;

      // Calculate rotation based on cursor distance from center
      const rotateX = ((y - centerY) / centerY) * -8; // Max 8 degrees
      const rotateY = ((x - centerX) / centerX) * 8;

      card.style.transform = `perspective(1000px) rotateX(${rotateX}deg) rotateY(${rotateY}deg) scale(1.02)`;

      // Update CSS variables for the shine gradient position
      card.style.setProperty('--mouse-x', `${(x / rect.width) * 100}%`);
      card.style.setProperty('--mouse-y', `${(y / rect.height) * 100}%`);
    });

    card.addEventListener('mouseleave', () => {
      card.style.transform = 'perspective(1000px) rotateX(0) rotateY(0) scale(1)';
    });
  });

  // Ambient Spotlight & Glow Trail
  const spotlight = document.querySelector('[data-spotlight]');
  const glow = document.querySelector('[data-glow]');
  const cursorDot = document.querySelector('[data-cursor-dot]');
  const cursorRing = document.querySelector('[data-cursor-ring]');

  if (spotlight && glow && window.matchMedia('(hover: hover) and (pointer: fine)').matches) {
    // Gate the CSS `cursor: none` rule behind this class so the native
    // cursor stays visible if this script never runs (no silent invisible cursor).
    document.documentElement.classList.add('has-custom-cursor');

    let mouseX = window.innerWidth / 2;
    let mouseY = window.innerHeight / 2;
    let glowX = mouseX;
    let glowY = mouseY;
    let isMouseActive = false;
    let activityTimeout = null;

    window.addEventListener('mousemove', (e) => {
      mouseX = e.clientX;
      mouseY = e.clientY;

      if (!isMouseActive) {
        isMouseActive = true;
        spotlight.classList.add('is-active');
        glow.classList.add('is-active');
        if (cursorDot) cursorDot.classList.add('is-active');
        if (cursorRing) cursorRing.classList.add('is-active');
      }

      clearTimeout(activityTimeout);
      activityTimeout = setTimeout(() => {
        isMouseActive = false;
        spotlight.classList.remove('is-active');
        glow.classList.remove('is-active');
        if (cursorDot) cursorDot.classList.remove('is-active');
        if (cursorRing) cursorRing.classList.remove('is-active');
      }, 3000);
    });

    document.addEventListener('mouseleave', () => {
      isMouseActive = false;
      spotlight.classList.remove('is-active');
      glow.classList.remove('is-active');
      if (cursorDot) cursorDot.classList.remove('is-active');
      if (cursorRing) cursorRing.classList.remove('is-active');
    });

    // Readable text blocks get a thin caret instead of the round ring,
    // so it's clear the content is text to read/select, not something to click.
    const textElements = document.querySelectorAll('.code-file__body, .hero__code, .terminal-body, .panel-body');
    textElements.forEach(el => {
      el.addEventListener('mouseenter', () => {
        if (cursorRing) cursorRing.classList.add('cursor-text');
        if (cursorDot) cursorDot.classList.add('cursor-text');
      });
      el.addEventListener('mouseleave', () => {
        if (cursorRing) cursorRing.classList.remove('cursor-text');
        if (cursorDot) cursorDot.classList.remove('cursor-text');
      });
    });

    const interactiveElements = document.querySelectorAll('a, button, .tab, .window-btn, .card');
    interactiveElements.forEach(el => {
      el.addEventListener('mouseenter', () => {
        if (cursorRing) { cursorRing.classList.add('cursor-hover'); cursorRing.classList.remove('cursor-text'); }
        if (cursorDot) { cursorDot.classList.add('cursor-hover'); cursorDot.classList.remove('cursor-text'); }
      });
      el.addEventListener('mouseleave', () => {
        if (cursorRing) cursorRing.classList.remove('cursor-hover');
        if (cursorDot) cursorDot.classList.remove('cursor-hover');
      });
    });

    let effectsRafId = null;

    const animateEffects = () => {
      // Glow trail lerp
      glowX += (mouseX - glowX) * 0.12;
      glowY += (mouseY - glowY) * 0.12;

      // Calculate velocity/drag for micro-deformation
      const dx = mouseX - glowX;
      const dy = mouseY - glowY;

      if (Math.abs(dx) > 0.1 || Math.abs(dy) > 0.1) {
        glow.style.transform = `translate(${glowX}px, ${glowY}px) translate(-50%, -50%)`;
        if (cursorRing) cursorRing.style.transform = `translate(${glowX}px, ${glowY}px) translate(-50%, -50%)`;
      }
      if (cursorDot) cursorDot.style.transform = `translate(${mouseX}px, ${mouseY}px) translate(-50%, -50%)`;

      // Micro-deformation: shift the spotlight grid elastically based on mouse movement speed
      const stretchX = dx * 0.15;
      const stretchY = dy * 0.15;
      spotlight.style.transform = `translate(${stretchX}px, ${stretchY}px)`;

      // Offset the mask so the spotlight stays centered on the exact cursor position 
      // despite the element itself shifting
      const maskX = mouseX - stretchX;
      const maskY = mouseY - stretchY;

      const mask = `radial-gradient(circle 350px at ${maskX}px ${maskY}px, black 0%, transparent 80%)`;
      spotlight.style.webkitMaskImage = mask;
      spotlight.style.maskImage = mask;

      effectsRafId = requestAnimationFrame(animateEffects);
    };

    onPause.push(() => cancelAnimationFrame(effectsRafId));
    onResume.push(() => { animateEffects(); });

    animateEffects();
  }

  // --- Minimap Implementation ---
  const minimap = document.getElementById('minimap');
  const minimapCanvas = document.getElementById('minimap-canvas');
  const minimapSlider = document.getElementById('minimap-slider');

  if (minimap && minimapCanvas && minimapSlider) {
    const ctx = minimapCanvas.getContext('2d', { alpha: true });

    const drawMinimap = () => {
      if (window.innerWidth <= 768) return;

      const docHeight = document.documentElement.scrollHeight;
      const mapHeight = minimap.offsetHeight;
      const mapWidth = minimap.offsetWidth;
      const dpr = window.devicePixelRatio || 1;

      minimapCanvas.width = mapWidth * dpr;
      minimapCanvas.height = mapHeight * dpr;
      minimapCanvas.style.width = `${mapWidth}px`;
      minimapCanvas.style.height = `${mapHeight}px`;
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);

      const scale = mapHeight / docHeight;

      ctx.clearRect(0, 0, mapWidth, mapHeight);

      const elements = document.querySelectorAll('section, .card, .floating-panel');

      elements.forEach(el => {
        const rect = el.getBoundingClientRect();
        const top = window.scrollY + rect.top;
        const mappedTop = top * scale;
        const mappedHeight = Math.max(rect.height * scale, 1);

        let baseColor = 'rgba(226, 232, 240, 0.2)';
        if (el.classList.contains('card')) baseColor = 'rgba(168, 85, 247, 0.4)';
        else if (el.id === 'hero') baseColor = 'rgba(52, 211, 153, 0.4)';
        else if (el.id === 'about') baseColor = 'rgba(244, 114, 182, 0.4)';
        else if (el.id === 'projects') baseColor = 'rgba(96, 165, 250, 0.4)';
        else if (el.classList.contains('floating-panel')) baseColor = 'rgba(234, 179, 8, 0.4)';

        const lineHeight = 2;
        const lineSpacing = 2;
        const padding = 3;
        const maxLineWidth = mapWidth - padding * 2;

        // Simple predictable random based on element position to prevent flickering
        let seed = Math.floor(top);
        const random = () => {
          let x = Math.sin(seed++) * 10000;
          return x - Math.floor(x);
        };

        for (let y = mappedTop + 2; y < mappedTop + mappedHeight - 2; y += (lineHeight + lineSpacing)) {
          if (random() > 0.85) continue; // skip some lines for realism (blank lines)

          const indent = Math.floor(random() * 4) * 4;
          const lineWidth = Math.max(6, random() * (maxLineWidth - indent));

          ctx.fillStyle = baseColor;
          // Sprinkle keywords and strings
          const r = random();
          if (r > 0.8) ctx.fillStyle = 'rgba(168, 85, 247, 0.6)'; // keyword
          else if (r > 0.6) ctx.fillStyle = 'rgba(52, 211, 153, 0.6)'; // string

          ctx.fillRect(padding + indent, y, lineWidth, lineHeight);
        }
      });
    };

    let isDraggingMinimap = false;
    // Layout metrics stay constant for the whole drag, so they are read once on
    // pointerdown. Re-reading them per frame forced a reflow immediately after
    // each scroll write.
    let dragMetrics = null;

    const readMinimapMetrics = () => {
      const rect = minimap.getBoundingClientRect();

      return {
        minimapTop: rect.top,
        minimapHeight: rect.height,
        documentHeight: document.documentElement.scrollHeight,
        viewportHeight: window.innerHeight
      };
    };

    const updateSlider = () => {
      if (window.innerWidth <= 768) return;

      const docHeight = dragMetrics ? dragMetrics.documentHeight : document.documentElement.scrollHeight;
      const mapHeight = dragMetrics ? dragMetrics.minimapHeight : minimap.offsetHeight;
      const viewportHeight = dragMetrics ? dragMetrics.viewportHeight : window.innerHeight;

      const scrollY = window.scrollY;
      const scale = mapHeight / docHeight;

      const sliderTop = scrollY * scale;
      const sliderHeight = viewportHeight * scale;

      minimapSlider.style.transform = `translateY(${sliderTop}px)`;
      minimapSlider.style.height = `${Math.max(sliderHeight, 10)}px`;
    };

    window.addEventListener('resize', () => {
      requestAnimationFrame(() => {
        drawMinimap();
        updateSlider();
      });
    });

    window.addEventListener('scroll', updateSlider, { passive: true });

    // Initial render with a slight delay to ensure fonts/layout are ready
    setTimeout(() => {
      drawMinimap();
      updateSlider();
    }, 200);

    // Behavior is explicit at each call site, not inferred from isDraggingMinimap:
    // a bare click (down, no move, up) should animate smoothly to its target,
    // while continuous drag tracking must jump instantly on every frame — an
    // animated scroll can never keep pace with a moving pointer, so it would
    // permanently lag behind. Since isDraggingMinimap was already true by the
    // time the initial pointerdown call ran, plain clicks used to get the same
    // instant jump as dragging, which read as an abrupt, jarring cut.
    const scrollPageToMinimapY = (y, behavior) => {
      const targetScroll = getMinimapScrollTarget({
        clientY: y,
        ...(dragMetrics ?? readMinimapMetrics())
      });

      window.scrollTo({ top: targetScroll, behavior });
    };

    // Coalesce drag input to one scrollTo per animation frame — pointermove
    // fires far more often than the page can actually repaint, and an
    // uncapped scrollTo per event was forcing a layout on every single one.
    let pendingMinimapY = null;
    let minimapDragRafId = null;

    const flushMinimapDrag = () => {
      minimapDragRafId = null;
      if (pendingMinimapY !== null) {
        scrollPageToMinimapY(pendingMinimapY, 'instant');
        pendingMinimapY = null;
      }
    };

    const requestMinimapScroll = (y) => {
      pendingMinimapY = y;
      if (minimapDragRafId) return;
      minimapDragRafId = requestAnimationFrame(flushMinimapDrag);
    };

    // A "click" and the start of a "drag" are the same pointerdown event —
    // the only difference is whether the pointer actually moves afterward.
    // Real pointers never sit perfectly still between down and up (a few
    // px of hand tremor is normal), so reacting to any pointermove at all
    // made the smooth click-scroll get cut off by an instant jump at random,
    // depending on whether that particular click happened to jitter.
    // Requiring a small movement threshold before switching to instant
    // per-frame tracking lets genuine clicks always finish their smooth
    // animation, while real drags still track the cursor exactly.
    const DRAG_THRESHOLD_PX = 4;
    let dragStartY = null;
    let hasExceededDragThreshold = false;

    const endMinimapInteraction = () => {
      isDraggingMinimap = false;
      dragMetrics = null;
      dragStartY = null;
      hasExceededDragThreshold = false;
      pendingMinimapY = null;
      if (minimapDragRafId) {
        cancelAnimationFrame(minimapDragRafId);
        minimapDragRafId = null;
      }
    };

    const handleMinimapMove = (clientY) => {
      if (!hasExceededDragThreshold) {
        if (Math.abs(clientY - dragStartY) < DRAG_THRESHOLD_PX) {
          return;
        }
        hasExceededDragThreshold = true;
      }
      requestMinimapScroll(clientY);
    };

    if (window.PointerEvent) {
      minimap.addEventListener('pointerdown', (e) => {
        if (typeof e.button === 'number' && e.button !== 0) {
          return;
        }

        isDraggingMinimap = true;
        dragMetrics = readMinimapMetrics();
        dragStartY = e.clientY;
        hasExceededDragThreshold = false;
        minimap.setPointerCapture?.(e.pointerId);
        scrollPageToMinimapY(e.clientY, 'smooth');
      });

      minimap.addEventListener('pointermove', (e) => {
        if (!isDraggingMinimap) {
          return;
        }

        e.preventDefault();
        handleMinimapMove(e.clientY);
      });

      minimap.addEventListener('pointerup', endMinimapInteraction);
      minimap.addEventListener('pointercancel', endMinimapInteraction);
      window.addEventListener('pointerup', endMinimapInteraction);
    } else {
      minimap.addEventListener('mousedown', (e) => {
        isDraggingMinimap = true;
        dragMetrics = readMinimapMetrics();
        dragStartY = e.clientY;
        hasExceededDragThreshold = false;
        scrollPageToMinimapY(e.clientY, 'smooth');
      });

      window.addEventListener('mousemove', (e) => {
        if (isDraggingMinimap) {
          e.preventDefault();
          handleMinimapMove(e.clientY);
        }
      });

      window.addEventListener('mouseup', endMinimapInteraction);
    }
  }

  // --- Floating Panels Interactivity ---
  const floatingPanels = document.querySelectorAll('.floating-panel');
  const restoreBtn = document.getElementById('restore-panels-btn');

  const updateRestoreBtn = () => {
    const anyHidden = Array.from(document.querySelectorAll('.floating-panel')).some(p => p.style.display === 'none');
    if (restoreBtn) {
      restoreBtn.style.display = anyHidden ? 'flex' : 'none';
      if (anyHidden) {
        restoreBtn.classList.add('status-bar__item--accent');
      } else {
        restoreBtn.classList.remove('status-bar__item--accent');
      }
    }
  };

  if (restoreBtn) {
    restoreBtn.addEventListener('click', () => {
      document.querySelectorAll('.floating-panel').forEach(p => {
        if (p.style.display === 'none') {
          p.style.display = '';
          p.style.opacity = '0';
          setTimeout(() => {
            p.style.opacity = '1';
            p.style.transform = 'translate3d(0, 0, 0)';
            updateRestoreBtn();
          }, 50);
        }
      });
    });
  }

  floatingPanels.forEach(panel => {
    pinFloatingPanelPosition(panel);
  });

  floatingPanels.forEach(panel => {
    let isDragging = false;
    let currentX;
    let currentY;
    let initialX;
    let initialY;
    let xOffset = 0;
    let yOffset = 0;

    const dragStart = (e) => {
      // Don't start drag if clicking on buttons or interactive content
      if (e.target.closest('.window-dots') || e.target.closest('.tech-box')) return;

      pinFloatingPanelPosition(panel);

      if (e.type === "touchstart") {
        initialX = e.touches[0].clientX - xOffset;
        initialY = e.touches[0].clientY - yOffset;
      } else {
        initialX = e.clientX - xOffset;
        initialY = e.clientY - yOffset;
      }

      if (e.target.closest('.panel-header') || e.target === panel) {
        isDragging = true;
        panel.style.transition = 'none'; // Disable transition during drag
      }
    };

    const dragEnd = () => {
      if (!isDragging) return;
      initialX = currentX;
      initialY = currentY;
      isDragging = false;
      panel.style.transition = ''; // Restore transition
    };

    const drag = (e) => {
      if (isDragging) {
        e.preventDefault();

        if (e.type === "touchmove") {
          currentX = e.touches[0].clientX - initialX;
          currentY = e.touches[0].clientY - initialY;
        } else {
          currentX = e.clientX - initialX;
          currentY = e.clientY - initialY;
        }

        xOffset = currentX;
        yOffset = currentY;

        setTranslate(currentX, currentY, panel);
      }
    };

    const setTranslate = (xPos, yPos, el) => {
      // Combine with the base floating animation by using a wrapper or just modifying the transform
      // Here we use a simpler approach: just update the translate
      el.style.transform = `translate3d(${xPos}px, ${yPos}px, 0)`;
    };

    panel.addEventListener("touchstart", dragStart, false);
    panel.addEventListener("touchend", dragEnd, false);
    panel.addEventListener("touchmove", drag, false);

    panel.addEventListener("mousedown", dragStart, false);
    window.addEventListener("mouseup", dragEnd, false);
    window.addEventListener("mousemove", drag, false);

    // Functional Buttons (Updated)
    const dots = panel.querySelectorAll('.window-dots span');
    const panelId = panel.dataset.panelId || 'panel';
    const controlDescriptors = getPanelControlDescriptors(panelId);

    dots.forEach((dot, index) => {
      const descriptor = controlDescriptors[index];

      if (!descriptor) {
        return;
      }

      dot.setAttribute('role', 'button');
      dot.setAttribute('tabindex', '0');
      dot.setAttribute('aria-label', descriptor.label);
      dot.setAttribute('title', descriptor.label);
      dot.dataset.testid = descriptor.testId;
      dot.addEventListener('keydown', (e) => {
        if (e.key === 'Enter' || e.key === ' ') {
          e.preventDefault();
          dot.click();
        }
      });
    });

    if (dots.length >= 3) {
      // Red: Close (Hide)
      dots[0].addEventListener('click', (e) => {
        e.stopPropagation();
        panel.style.transition = 'all 0.5s cubic-bezier(0.175, 0.885, 0.32, 1.275)';
        panel.style.opacity = '0';
        panel.style.transform = (panel.style.transform || '') + ' scale(0.5) translateY(50px)';
        setTimeout(() => {
          panel.style.display = 'none';
          updateRestoreBtn();
        }, 400);
      });

      // Yellow: Minimize (Simulated)
      dots[1].addEventListener('click', (e) => {
        e.stopPropagation();
        pinFloatingPanelPosition(panel);
        if (panel.classList.contains('minimized')) {
          panel.classList.remove('minimized');
          panel.style.height = '';
          panel.querySelector('.panel-body').style.display = '';
        } else {
          panel.classList.add('minimized');
          panel.style.height = '40px';
          panel.querySelector('.panel-body').style.display = 'none';
        }
      });

      // Green: Reset Position
      dots[2].addEventListener('click', (e) => {
        e.stopPropagation();
        pinFloatingPanelPosition(panel);
        xOffset = 0;
        yOffset = 0;
        initialX = 0;
        initialY = 0;
        currentX = 0;
        currentY = 0;
        panel.style.transition = 'all 0.5s cubic-bezier(0.2, 0.8, 0.2, 1)';
        panel.style.transform = 'translate3d(0, 0, 0)';
      });
    }
  });

  // --- Dynamic Metrics System ---
  function initLiveMetrics() {
    const statsPanel = document.querySelector('.panel-stats');
    if (!statsPanel) return;

    const cpuVal = statsPanel.querySelector('.metric-group:nth-child(1) .metric-val');
    const cpuBar = statsPanel.querySelector('.metric-group:nth-child(1) .metric-fill');
    const memVal = statsPanel.querySelector('.metric-group:nth-child(2) .metric-val');
    const memBar = statsPanel.querySelector('.metric-group:nth-child(2) .metric-fill');
    const netVal = statsPanel.querySelector('.metric-group:nth-child(3) .metric-val');
    const netBar = statsPanel.querySelector('.metric-group:nth-child(3) .metric-fill');
    const pingText = statsPanel.querySelector('.panel-ping');

    // Remove static animations from HTML style attributes to let JS take over
    [cpuBar, memBar, netBar].forEach(bar => {
      if (bar) bar.style.animation = 'none';
    });

    const ids = [];

    function start() {
      ids.push(setInterval(() => {
        if (cpuVal && cpuBar) {
          const val = 15 + Math.floor(Math.random() * 45);
          cpuVal.textContent = `${val}%`;
          cpuBar.style.width = `${val}%`;
        }
      }, 2000));

      ids.push(setInterval(() => {
        if (memVal && memBar) {
          const used = (1.8 + Math.random() * 1.2).toFixed(1);
          memVal.textContent = `${used}/8 GB`;
          memBar.style.width = `${(used / 8) * 100}%`;
        }
      }, 4000));

      ids.push(setInterval(() => {
        if (netVal && netBar) {
          const speed = (0.5 + Math.random() * 4).toFixed(1);
          netVal.textContent = `${speed} MB/s`;
          netBar.style.width = `${Math.min(speed * 20, 100)}%`;
        }
      }, 3000));

      ids.push(setInterval(() => {
        if (pingText) {
          const ping = 8 + Math.floor(Math.random() * 20);
          const dot = pingText.querySelector('.ping-dot');
          pingText.innerHTML = '';
          if (dot) pingText.appendChild(dot);
          pingText.appendChild(document.createTextNode(` ${ping}ms ping`));
        }
      }, 5000));
    }

    function stop() {
      ids.forEach(clearInterval);
      ids.length = 0;
    }

    start();
    return { start, stop };
  }

  const metrics = initLiveMetrics();
  if (metrics) {
    onPause.push(metrics.stop);
    onResume.push(metrics.start);
  }

  // --- Dynamic Terminal Build Animation ---
  function initTerminalBuild() {
    const term = document.querySelector('.panel-terminal .term-content');
    const panelTitle = document.querySelector('.panel-terminal .panel-title');
    if (!term) return;

    const projects = [
      {
        title: "wheels_parser/build.sh",
        path: "~/wheels_parser",
        cmd: "python -m build --wheel",
        lines: [
          { text: " collecting sources from src/wheels_parser", class: "t-dim" },
          { text: " compiling parser/telegram_watcher.py", class: "t-dim" },
          { text: "✓ 42 modules compiled.", class: "t-success" },
          { text: "dist/wheels_parser.whl 84.2 kB", class: "t-dim" },
          { text: "tests/ 18 passed [0 failed]", class: "t-dim" },
          { text: "ruff check 31 files [clean]", class: "t-dim" },
          { text: "✓ built in 1.42s", class: "t-success", style: "margin-top: 8px;" }
        ]
      },
      {
        title: "screen_recorder/build.sh",
        path: "~/screen_recorder",
        cmd: "npm run build",
        lines: [
          { text: " bundling src/screen_recorder with esbuild", class: "t-dim" },
          { text: " packaging electron app (win/mac/linux)", class: "t-dim" },
          { text: "✓ 128 modules bundled.", class: "t-success" },
          { text: "dist/screen_recorder-1.4.0.exe 42.6 MB", class: "t-dim" },
          { text: "tests/ 12 passed [0 failed]", class: "t-dim" },
          { text: "eslint check 24 files [clean]", class: "t-dim" },
          { text: "✓ built in 3.87s", class: "t-success", style: "margin-top: 8px;" }
        ]
      },
      {
        title: "file-manager/run.sh",
        path: "~/file-manager",
        cmd: "flask run --host 0.0.0.0",
        lines: [
          { text: " collecting sources from src/file_manager", class: "t-dim" },
          { text: " installing requirements.txt (Flask, Werkzeug)", class: "t-dim" },
          { text: "✓ app initialized.", class: "t-success" },
          { text: "routes registered 18", class: "t-dim" },
          { text: "tests/ 9 passed [0 failed]", class: "t-dim" },
          { text: "flake8 check 14 files [clean]", class: "t-dim" },
          { text: "✓ dev server ready in 0.64s", class: "t-success", style: "margin-top: 8px;" }
        ]
      },
      {
        title: "twitch_bot/run.sh",
        path: "~/twitch_bot",
        cmd: "python -m twitch_bot --reconnect",
        lines: [
          { text: " connecting to irc.chat.twitch.tv:6697 (TLS)", class: "t-dim" },
          { text: " authenticating as bot account", class: "t-dim" },
          { text: "✓ joined 6 channels.", class: "t-success" },
          { text: "heartbeat interval 30s", class: "t-dim" },
          { text: "tests/ 11 passed [0 failed]", class: "t-dim" },
          { text: "ruff check 9 files [clean]", class: "t-dim" },
          { text: "✓ bot online in 0.92s", class: "t-success", style: "margin-top: 8px;" }
        ]
      },
      {
        title: "tg_edit_bot/run.sh",
        path: "~/tg_edit_bot",
        cmd: "python -m tg_edit_bot",
        lines: [
          { text: " loading ComfyUI pipeline (upscale, rembg)", class: "t-dim" },
          { text: " connecting to Telegram Bot API", class: "t-dim" },
          { text: "✓ 3 workflows loaded.", class: "t-success" },
          { text: "queue/ 0 pending [ready]", class: "t-dim" },
          { text: "tests/ 14 passed [0 failed]", class: "t-dim" },
          { text: "ruff check 17 files [clean]", class: "t-dim" },
          { text: "✓ bot ready in 1.15s", class: "t-success", style: "margin-top: 8px;" }
        ]
      },
      {
        title: "portfolio_site/build.sh",
        path: "~/portfolio_site",
        cmd: "npm run build",
        lines: [
          { text: " minifying style.css & script.js", class: "t-dim" },
          { text: " optimizing assets/", class: "t-dim" },
          { text: "✓ build complete.", class: "t-success" },
          { text: "dist/ 6 files, 214 kB", class: "t-dim" },
          { text: "tests/ 7 passed [0 failed]", class: "t-dim" },
          { text: "eslint check 5 files [clean]", class: "t-dim" },
          { text: "✓ built in 0.81s", class: "t-success", style: "margin-top: 8px;" }
        ]
      },
      {
        title: "last_bastion/build.sh",
        path: "~/last_bastion",
        cmd: "dotnet build -c Release",
        lines: [
          { text: " restoring NuGet packages", class: "t-dim" },
          { text: " compiling Assembly-CSharp", class: "t-dim" },
          { text: "✓ build succeeded.", class: "t-success" },
          { text: "Build/LastBastion.exe 118 MB", class: "t-dim" },
          { text: "tests/ 21 passed [0 failed]", class: "t-dim" },
          { text: "warnings 0 [clean]", class: "t-dim" },
          { text: "✓ built in 4.23s", class: "t-success", style: "margin-top: 8px;" }
        ]
      },
      {
        title: "sportsbet/run.sh",
        path: "~/sportsbet",
        cmd: "python -m sportsbet.analyze",
        lines: [
          { text: " fetching odds from 4 bookmakers", class: "t-dim" },
          { text: " calculating value bets (xG model)", class: "t-dim" },
          { text: "✓ 217 matches analyzed.", class: "t-success" },
          { text: "signals/ 6 found [high confidence]", class: "t-dim" },
          { text: "tests/ 15 passed [0 failed]", class: "t-dim" },
          { text: "ruff check 22 files [clean]", class: "t-dim" },
          { text: "✓ analysis done in 2.04s", class: "t-success", style: "margin-top: 8px;" }
        ]
      }
    ];

    let projectIndex = 0;
    const firstLine = term.firstElementChild; // Prompt + command line
    const lastLine = term.lastElementChild; // Cursor line

    function applyProjectHeader(project) {
      if (panelTitle) panelTitle.textContent = project.title;
      firstLine.innerHTML = `<span class="t-prompt">${project.path} ➜</span> <span class="t-cmd">${project.cmd}</span>`;
      lastLine.innerHTML = `<span class="t-prompt">${project.path} ➜</span><span class="t-cursor"></span>`;
    }

    function runCycle() {
      const project = projects[projectIndex];
      applyProjectHeader(project);

      // Clear output lines
      while (term.children.length > 2) {
        term.removeChild(term.children[1]);
      }

      let i = 0;
      function addNextLine() {
        if (i < project.lines.length) {
          const lineData = project.lines[i];
          const div = document.createElement('div');
          div.className = `t-line ${lineData.class || ''}`;
          div.textContent = lineData.text;
          if (lineData.style) div.style.cssText = lineData.style;
          div.style.opacity = '0';
          div.style.transform = 'translateY(5px)';
          div.style.transition = 'all 0.3s ease';

          term.insertBefore(div, lastLine);

          // Trigger animation
          setTimeout(() => {
            div.style.opacity = '1';
            div.style.transform = 'translateY(0)';
          }, 50);

          i++;
          setTimeout(addNextLine, 300 + Math.random() * 800);
        } else {
          // Finished cycle, advance to next project, wait then restart
          projectIndex = (projectIndex + 1) % projects.length;
          setTimeout(runCycle, 15000);
        }
      }

      setTimeout(addNextLine, 1000);
    }

    runCycle();
  }

  initTerminalBuild();

  // --- Interactive Digital Background Implementation ---
  const canvas = document.getElementById('bg-canvas');
  if (canvas) {
    const ctx = canvas.getContext('2d');
    let particles = [];
    let mouse = { x: -1000, y: -1000, radius: 180 };

    window.addEventListener('mousemove', (e) => {
      mouse.x = e.clientX;
      mouse.y = e.clientY;
    });

    class Particle {
      constructor(x, y) {
        this.x = x;
        this.y = y;
        this.originX = x;
        this.originY = y;
        this.size = 1.2;
        this.vx = 0;
        this.vy = 0;
        this.friction = 0.92;
        this.ease = 0.08;
      }

      draw() {
        // Calculate dynamic brightness based on mouse distance
        const dx = mouse.x - this.x;
        const dy = mouse.y - this.y;
        const dist = Math.sqrt(dx * dx + dy * dy);
        // Minimum brightness is now 0.45 to make distant particles more visible
        const brightness = Math.max(0.45, 1 - dist / 500); 

        // Increased base opacity slightly for better visibility
        ctx.fillStyle = `rgba(168, 85, 247, ${0.35 * brightness})`; 
        ctx.beginPath();
        // Dot gets slightly larger near cursor
        const scale = 1 + (brightness * 0.4);
        ctx.arc(this.x, this.y, this.size * scale, 0, Math.PI * 2);
        ctx.fill();
        
        // Add a faint outer glow for dots very close to the mouse
        if (dist < 100) {
          ctx.shadowBlur = 10;
          ctx.shadowColor = 'rgba(168, 85, 247, 0.5)';
          ctx.fill();
          ctx.shadowBlur = 0;
        }
      }

      update() {
        const dx = mouse.x - this.x;
        const dy = mouse.y - this.y;
        const distance = Math.sqrt(dx * dx + dy * dy);
        
        if (distance < mouse.radius) {
          const angle = Math.atan2(dy, dx);
          const force = (mouse.radius - distance) / mouse.radius;
          // Apply repulsive force
          this.vx -= force * Math.cos(angle) * 1.8;
          this.vy -= force * Math.sin(angle) * 1.8;
        }

        this.vx *= this.friction;
        this.vy *= this.friction;
        this.x += this.vx + (this.originX - this.x) * this.ease;
        this.y += this.vy + (this.originY - this.y) * this.ease;
      }
    }

    function initParticles() {
      const dpr = window.devicePixelRatio || 1;
      canvas.width = window.innerWidth * dpr;
      canvas.height = window.innerHeight * dpr;
      canvas.style.width = `${window.innerWidth}px`;
      canvas.style.height = `${window.innerHeight}px`;
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      particles = [];
      const gap = 50; // Match VS Code grid feel
      for (let y = 0; y < window.innerHeight + gap; y += gap) {
        for (let x = 0; x < window.innerWidth + gap; x += gap) {
          particles.push(new Particle(x, y));
        }
      }
    }

    let bgRafId = null;

    function animateBackground() {
      ctx.clearRect(0, 0, window.innerWidth, window.innerHeight);

      for (let i = 0; i < particles.length; i++) {
        const p = particles[i];
        p.update();
        p.draw();

        // Connect nearby points to form a subtle constellation near mouse
        const dx = mouse.x - p.x;
        const dy = mouse.y - p.y;
        const dist = Math.sqrt(dx * dx + dy * dy);

        if (dist < 150) {
          ctx.strokeStyle = `rgba(168, 85, 247, ${0.2 * (1 - dist / 150)})`;
          ctx.lineWidth = 0.8;
          ctx.beginPath();
          ctx.moveTo(p.x, p.y);
          ctx.lineTo(mouse.x, mouse.y);
          ctx.stroke();
        }
      }
      bgRafId = requestAnimationFrame(animateBackground);
    }

    window.addEventListener('resize', () => {
      initParticles();
    });

    onPause.push(() => cancelAnimationFrame(bgRafId));
    onResume.push(() => { animateBackground(); });

    initParticles();
    animateBackground();
  }

  // --- 3D Sphere Interactive Visual ---
  const contactsCanvas = document.getElementById('contacts-canvas');
  if (contactsCanvas) {
    const ctx = contactsCanvas.getContext('2d');
    let points = [];
    let angleX = 0;
    let angleY = 0;
    let targetAngleX = 0;
    let targetAngleY = 0;
    const count = 160;
    const radius = 140;
    let cssWidth = 0;
    let cssHeight = 0;

    class Point3D {
      constructor(theta, phi) {
        this.theta = theta;
        this.phi = phi;
        this.x = radius * Math.sin(phi) * Math.cos(theta);
        this.y = radius * Math.sin(phi) * Math.sin(theta);
        this.z = radius * Math.cos(phi);
      }

      project(ax, ay) {
        // Rotate
        let x = this.x;
        let y = this.y;
        let z = this.z;

        // X Rotation
        let cosAX = Math.cos(ax);
        let sinAX = Math.sin(ax);
        let y1 = y * cosAX - z * sinAX;
        let z1 = y * sinAX + z * cosAX;

        // Y Rotation
        let cosAY = Math.cos(ay);
        let sinAY = Math.sin(ay);
        let x2 = x * cosAY + z1 * sinAY;
        let z2 = -x * sinAY + z1 * cosAY;

        // Perspective
        const perspective = 350;
        const scale = perspective / (perspective + z2);
        const px = x2 * scale + cssWidth / 2;
        const py = y1 * scale + cssHeight / 2;

        return { x: px, y: py, z: z2, scale };
      }
    }

    function initPoints() {
      points = [];
      for (let i = 0; i < count; i++) {
        const theta = Math.random() * Math.PI * 2;
        const phi = Math.acos((Math.random() * 2) - 1);
        points.push(new Point3D(theta, phi));
      }
    }

    function resizeCanvas() {
      const dpr = window.devicePixelRatio || 1;
      const rect = contactsCanvas.getBoundingClientRect();
      cssWidth = rect.width;
      cssHeight = rect.height;
      contactsCanvas.width = rect.width * dpr;
      contactsCanvas.height = rect.height * dpr;
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    }

    window.addEventListener('resize', resizeCanvas);
    resizeCanvas();
    initPoints();

    const targetVisual = document.querySelector('.contacts-visual');
    if (targetVisual) {
      const updateSphereTarget = (clientX, clientY) => {
        const rect = targetVisual.getBoundingClientRect();
        const centerX = rect.left + rect.width / 2;
        const centerY = rect.top + rect.height / 2;

        // Only react if somewhat near the contacts visual to save performance
        const dist = Math.hypot(clientX - centerX, clientY - centerY);
        if (dist < 600) {
          targetAngleY = (clientX - centerX) * 0.002;
          targetAngleX = (clientY - centerY) * 0.002;
        }
      };

      window.addEventListener('mousemove', (e) => {
        updateSphereTarget(e.clientX, e.clientY);
      });
      targetVisual.addEventListener('pointermove', (e) => {
        updateSphereTarget(e.clientX, e.clientY);
      });
      targetVisual.addEventListener('pointerdown', (e) => {
        updateSphereTarget(e.clientX, e.clientY);
      });
    }

    let sphereRafId = null;
    let sphereInViewport = false;
    let spherePageVisible = !document.hidden;

    function animateSphere() {
      ctx.clearRect(0, 0, cssWidth, cssHeight);

      angleX += (targetAngleX - angleX) * 0.05 + 0.002;
      angleY += (targetAngleY - angleY) * 0.05 + 0.002;

      const projected = points.map(p => p.project(angleX, angleY));

      // Sort by depth (painters algorithm)
      projected.sort((a, b) => b.z - a.z);

      // Draw lines between nearby points
      ctx.lineWidth = 0.6;
      for (let i = 0; i < projected.length; i++) {
        for (let j = i + 1; j < projected.length; j++) {
          const p1 = projected[i];
          const p2 = projected[j];
          const d = Math.hypot(p1.x - p2.x, p1.y - p2.y);

          if (d < 70) {
            const opacity = (1 - d / 70) * 0.28 * p1.scale;
            ctx.strokeStyle = `rgba(168, 85, 247, ${opacity})`;
            ctx.beginPath();
            ctx.moveTo(p1.x, p1.y);
            ctx.lineTo(p2.x, p2.y);
            ctx.stroke();
          }
        }
      }

      // Draw dots
      projected.forEach(p => {
        const size = 2.2 * p.scale;
        const opacityFront = (p.z + radius) / (2 * radius);
        const opacity = Math.max(0.18, opacityFront);

        ctx.fillStyle = `rgba(168, 85, 247, ${opacity * 0.65 + 0.35})`;
        ctx.beginPath();
        ctx.arc(p.x, p.y, size, 0, Math.PI * 2);
        ctx.fill();

        if (opacityFront > 0.8) {
          ctx.shadowBlur = 8;
          ctx.shadowColor = 'rgba(168, 85, 247, 0.4)';
          ctx.fill();
          ctx.shadowBlur = 0;
        }
      });

      sphereRafId = requestAnimationFrame(animateSphere);
    }

    function startSphere() {
      if (sphereInViewport && spherePageVisible && !sphereRafId) animateSphere();
    }

    function stopSphere() {
      if (sphereRafId) {
        cancelAnimationFrame(sphereRafId);
        sphereRafId = null;
      }
    }

    // The pairwise point-distance loop below is O(n^2); only run it while
    // the sphere is actually scrolled into view.
    const sphereObserver = new IntersectionObserver(entries => {
      sphereInViewport = entries[0].isIntersecting;
      if (sphereInViewport) startSphere(); else stopSphere();
    }, { threshold: 0.05 });
    sphereObserver.observe(contactsCanvas);

    onPause.push(() => { spherePageVisible = false; stopSphere(); });
    onResume.push(() => { spherePageVisible = true; startSphere(); });
  }

  // --- Command Palette ---
  let paletteOpenerEl = null;
  let paletteQuery = '';
  let paletteView = 'commands'; // 'commands' | 'shortcuts'
  let paletteSelectedIndex = 0;
  let paletteVisibleCommands = [];
  let paletteCopyFeedbackId = null;
  let paletteCopyFeedbackTimeout = null;

  const palette = document.getElementById('command-palette');
  const paletteBackdrop = palette ? palette.querySelector('[data-cp-backdrop]') : null;
  const paletteInput = document.getElementById('command-palette-input');
  const paletteList = document.getElementById('command-palette-list');
  const paletteResultCount = document.getElementById('command-palette-result-count');
  const paletteTrigger = document.getElementById('command-palette-trigger');

  function isPaletteOpen() {
    return !!palette && palette.style.display !== 'none';
  }

  function openPalette() {
    if (!palette || isPaletteOpen()) return;

    paletteOpenerEl = document.activeElement;
    paletteView = 'commands';
    paletteQuery = '';
    paletteSelectedIndex = 0;
    if (paletteInput) paletteInput.value = '';

    palette.style.display = 'flex';
    document.documentElement.style.overflow = 'hidden';

    renderPaletteList();

    if (paletteInput) paletteInput.focus();
  }

  function closePalette() {
    if (!palette || !isPaletteOpen()) return;

    palette.style.display = 'none';
    document.documentElement.style.overflow = '';

    clearTimeout(paletteCopyFeedbackTimeout);
    paletteCopyFeedbackId = null;

    if (paletteOpenerEl && typeof paletteOpenerEl.focus === 'function') {
      paletteOpenerEl.focus();
    }
    paletteOpenerEl = null;
  }

  document.addEventListener('keydown', (e) => {
    const key = e.key.toLowerCase();
    const mod = e.ctrlKey || e.metaKey;

    if (mod && key === 'k') {
      e.preventDefault();
      openPalette();
      return;
    }

    if (mod && e.shiftKey && key === 'p') {
      e.preventDefault();
      openPalette();
      return;
    }

    if (isPaletteOpen() && e.key === 'Escape') {
      e.preventDefault();
      closePalette();
    }
  });

  if (paletteTrigger) {
    paletteTrigger.addEventListener('click', () => openPalette());
  }

  if (paletteBackdrop) {
    paletteBackdrop.addEventListener('click', () => closePalette());
  }

  function getCommands() {
    const commands = [
      { id: 'nav-hero', category: 'Навигация', label: 'Перейти: Home', run: () => goToSection('hero') },
      { id: 'nav-about', category: 'Навигация', label: 'Перейти: About', run: () => goToSection('about') },
      { id: 'nav-projects', category: 'Навигация', label: 'Перейти: Projects', run: () => goToSection('projects') },
      { id: 'nav-contacts', category: 'Навигация', label: 'Перейти: Contacts', run: () => goToSection('contacts') },
      {
        id: 'link-github',
        category: 'Ссылки',
        label: 'Открыть GitHub',
        run: () => window.open('https://github.com/AlekBlackk/', '_blank', 'noopener,noreferrer')
      },
      {
        id: 'link-telegram',
        category: 'Ссылки',
        label: 'Открыть Telegram',
        run: () => window.open('https://t.me/sadmoreee', '_blank', 'noopener,noreferrer')
      },
      {
        id: 'action-copy-github',
        category: 'Действия',
        label: 'Скопировать GitHub-профиль',
        copyText: 'https://github.com/AlekBlackk/'
      },
      {
        id: 'action-copy-telegram',
        category: 'Действия',
        label: 'Скопировать Telegram',
        copyText: 'https://t.me/sadmoreee'
      },
      {
        id: 'action-top',
        category: 'Действия',
        label: 'Наверх страницы',
        run: () => window.scrollTo({ top: 0, behavior: 'smooth' })
      }
    ];

    const restoreBtn = document.getElementById('restore-panels-btn');
    if (restoreBtn && restoreBtn.style.display !== 'none') {
      commands.push({
        id: 'action-restore-panels',
        category: 'Действия',
        label: 'Восстановить скрытые окна',
        run: () => restoreBtn.click()
      });
    }

    commands.push({
      id: 'help-shortcuts',
      category: 'Справка',
      label: 'Показать горячие клавиши',
      keepOpen: true,
      run: () => {
        paletteView = 'shortcuts';
        paletteSelectedIndex = 0;
        renderPaletteList();
      }
    });

    return commands;
  }

  function escapeHtml(str) {
    return str
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;');
  }

  function highlightMatches(label, matches) {
    if (!matches || matches.length === 0) return escapeHtml(label);

    const matchSet = new Set(matches);
    let html = '';
    for (let i = 0; i < label.length; i++) {
      const char = escapeHtml(label[i]);
      html += matchSet.has(i) ? `<mark class="command-palette__match">${char}</mark>` : char;
    }
    return html;
  }

  function updateResultCount(count) {
    if (!paletteResultCount) return;
    paletteResultCount.textContent = count === 0
      ? 'Ничего не найдено'
      : `Найдено команд: ${count}`;
  }

  function updateSelectionHighlight() {
    if (!paletteList) return;

    const items = Array.from(paletteList.querySelectorAll('.command-palette__item'));
    items.forEach((item, i) => {
      const isSelected = i === paletteSelectedIndex;
      item.classList.toggle('command-palette__item--selected', isSelected);
      item.setAttribute('aria-selected', String(isSelected));
    });

    const selectedItem = items[paletteSelectedIndex];
    if (selectedItem && paletteInput) {
      paletteInput.setAttribute('aria-activedescendant', selectedItem.id);
      selectedItem.scrollIntoView({ block: 'nearest' });
    }
  }

  function renderPaletteList() {
    if (!paletteList) return;

    if (paletteView === 'shortcuts') {
      renderShortcutsView();
      return;
    }

    const matches = filterCommands(paletteQuery, getCommands());
    paletteVisibleCommands = matches;

    if (paletteSelectedIndex >= matches.length) {
      paletteSelectedIndex = Math.max(matches.length - 1, 0);
    }

    paletteList.innerHTML = '';

    if (matches.length === 0) {
      const empty = document.createElement('li');
      empty.className = 'command-palette__empty';
      empty.setAttribute('role', 'presentation');
      empty.textContent = `Ничего не найдено по «${paletteQuery}»`;
      paletteList.appendChild(empty);
      updateResultCount(0);
      if (paletteInput) paletteInput.removeAttribute('aria-activedescendant');
      return;
    }

    matches.forEach((match, index) => {
      const item = document.createElement('li');
      item.id = `command-palette-option-${match.command.id}`;
      item.className = 'command-palette__item';
      item.setAttribute('role', 'option');

      const label = document.createElement('span');
      label.className = 'command-palette__item-label';
      label.innerHTML = highlightMatches(match.command.label, match.matches);
      item.appendChild(label);

      if (paletteCopyFeedbackId === match.command.id) {
        const feedback = document.createElement('span');
        feedback.className = 'command-palette__item-feedback';
        feedback.textContent = '✓ Скопировано';
        item.appendChild(feedback);
      } else {
        const category = document.createElement('span');
        category.className = 'command-palette__item-category';
        category.textContent = match.command.category;
        item.appendChild(category);
      }

      item.addEventListener('mouseenter', () => {
        paletteSelectedIndex = index;
        updateSelectionHighlight();
      });

      item.addEventListener('mousedown', (e) => e.preventDefault());

      item.addEventListener('click', () => {
        executeCommand(match.command);
      });

      paletteList.appendChild(item);
    });

    updateResultCount(matches.length);
    updateSelectionHighlight();
  }

  if (paletteInput) {
    paletteInput.addEventListener('input', () => {
      paletteQuery = paletteInput.value;
      paletteSelectedIndex = 0;
      renderPaletteList();
    });
  }

  function executeCommand(command) {
    if (!command) return;

    if (command.copyText) {
      if (navigator.clipboard && navigator.clipboard.writeText) {
        navigator.clipboard.writeText(command.copyText)
          .then(() => showCopyFeedback(command.id))
          .catch(() => {});
      }
      return;
    }

    if (typeof command.run === 'function') {
      command.run();
    }

    if (!command.keepOpen) {
      closePalette();
    }
  }

  function showCopyFeedback(commandId) {
    paletteCopyFeedbackId = commandId;
    renderPaletteList();

    clearTimeout(paletteCopyFeedbackTimeout);
    paletteCopyFeedbackTimeout = setTimeout(() => {
      paletteCopyFeedbackId = null;
      if (isPaletteOpen()) renderPaletteList();
    }, 1200);
  }

  function renderShortcutsView() {
    if (!paletteList) return;

    paletteList.innerHTML = '';
    paletteSelectedIndex = 0;
    paletteVisibleCommands = [{
      command: {
        id: 'shortcuts-back',
        category: '',
        label: '← Назад к командам',
        keepOpen: true,
        run: () => {
          paletteView = 'commands';
          paletteQuery = '';
          paletteSelectedIndex = 0;
          if (paletteInput) paletteInput.value = '';
          renderPaletteList();
        }
      },
      matches: []
    }];

    const backItem = document.createElement('li');
    backItem.id = 'command-palette-option-shortcuts-back';
    backItem.className = 'command-palette__item command-palette__item--selected';
    backItem.setAttribute('role', 'option');
    backItem.setAttribute('aria-selected', 'true');
    backItem.textContent = '← Назад к командам';
    backItem.addEventListener('mousedown', (e) => e.preventDefault());
    backItem.addEventListener('click', () => executeCommand(paletteVisibleCommands[0].command));
    paletteList.appendChild(backItem);

    const rows = [
      ['Ctrl/Cmd + K', 'Открыть палитру'],
      ['Ctrl/Cmd + Shift + P', 'Открыть палитру'],
      ['↑ / ↓', 'Перемещение по списку'],
      ['Enter', 'Выполнить команду'],
      ['Esc', 'Закрыть палитру']
    ];

    rows.forEach(([keys, desc]) => {
      const row = document.createElement('li');
      row.className = 'command-palette__shortcut-row';
      row.setAttribute('role', 'presentation');

      const kbd = document.createElement('kbd');
      kbd.textContent = keys;
      row.appendChild(kbd);

      const span = document.createElement('span');
      span.textContent = desc;
      row.appendChild(span);

      paletteList.appendChild(row);
    });

    if (paletteInput) {
      paletteInput.setAttribute('aria-activedescendant', 'command-palette-option-shortcuts-back');
    }
    updateResultCount(1);
  }

  if (paletteInput) {
    paletteInput.addEventListener('keydown', (e) => {
      if (!isPaletteOpen()) return;

      if (e.key === 'Tab') {
        e.preventDefault();
        return;
      }

      const count = paletteVisibleCommands.length;

      if (e.key === 'ArrowDown') {
        e.preventDefault();
        if (count > 0) {
          paletteSelectedIndex = (paletteSelectedIndex + 1) % count;
          updateSelectionHighlight();
        }
      } else if (e.key === 'ArrowUp') {
        e.preventDefault();
        if (count > 0) {
          paletteSelectedIndex = (paletteSelectedIndex - 1 + count) % count;
          updateSelectionHighlight();
        }
      } else if (e.key === 'Home') {
        e.preventDefault();
        paletteSelectedIndex = 0;
        updateSelectionHighlight();
      } else if (e.key === 'End') {
        e.preventDefault();
        paletteSelectedIndex = Math.max(count - 1, 0);
        updateSelectionHighlight();
      } else if (e.key === 'Enter') {
        e.preventDefault();
        const match = paletteVisibleCommands[paletteSelectedIndex];
        if (match) executeCommand(match.command);
      }
    });
  }
})();
