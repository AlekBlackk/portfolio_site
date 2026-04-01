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

    const availableViewport = Math.max(viewportHeight - stickyOffset, 0);
    const maxScroll = Math.max(documentHeight - viewportHeight, 0);
    const scrollProgress = maxScroll > 0 ? scrollY / maxScroll : 0;

    // Dynamic focus line: shifts from 30% to 75% of viewport as we scroll
    // This allows sections near the bottom of the page to be activated 
    // even if they don't reach the middle of the screen.
    const focusRatio = 0.3 + (scrollProgress * 0.45);
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

  if (typeof module !== 'undefined' && module.exports) {
    module.exports = {
      getActiveSectionId,
      getSectionViewportTop,
      getScrollSpacerHeight,
      getScrollTargetY,
      pinFloatingPanelPosition
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

  // Ambient Spotlight & Glow Trail
  const spotlight = document.querySelector('[data-spotlight]');
  const glow = document.querySelector('[data-glow]');
  const cursorDot = document.querySelector('[data-cursor-dot]');
  const cursorRing = document.querySelector('[data-cursor-ring]');

  if (spotlight && glow && window.matchMedia('(hover: hover) and (pointer: fine)').matches) {
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

    const interactiveElements = document.querySelectorAll('a, button, .tab, .window-btn, .card');
    interactiveElements.forEach(el => {
      el.addEventListener('mouseenter', () => {
        if (cursorRing) cursorRing.classList.add('cursor-hover');
        if (cursorDot) cursorDot.classList.add('cursor-hover');
      });
      el.addEventListener('mouseleave', () => {
        if (cursorRing) cursorRing.classList.remove('cursor-hover');
        if (cursorDot) cursorDot.classList.remove('cursor-hover');
      });
    });

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

      requestAnimationFrame(animateEffects);
    };

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

      minimapCanvas.width = mapWidth;
      minimapCanvas.height = mapHeight;
      minimapCanvas.style.width = `${mapWidth}px`;
      minimapCanvas.style.height = `${mapHeight}px`;

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

    const updateSlider = () => {
      if (window.innerWidth <= 768) return;

      const docHeight = document.documentElement.scrollHeight;
      const mapHeight = minimap.offsetHeight;
      const viewportHeight = window.innerHeight;

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

    let isDraggingMinimap = false;

    const scrollPageToMinimapY = (y) => {
      const rect = minimap.getBoundingClientRect();
      const relativeY = y - rect.top;
      const percentage = Math.max(0, Math.min(1, relativeY / rect.height));
      const targetScroll = percentage * document.documentElement.scrollHeight - (window.innerHeight / 2);
      window.scrollTo({ top: targetScroll, behavior: isDraggingMinimap ? 'auto' : 'smooth' });
    };

    minimap.addEventListener('mousedown', (e) => {
      isDraggingMinimap = true;
      scrollPageToMinimapY(e.clientY);
    });

    window.addEventListener('mousemove', (e) => {
      if (isDraggingMinimap) {
        e.preventDefault(); // Prevent text selection
        scrollPageToMinimapY(e.clientY);
      }
    });

    window.addEventListener('mouseup', () => {
      isDraggingMinimap = false;
    });
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
    // --- Dynamic Metrics Update ---
    const cpuVal = document.querySelector('.panel-stats .metric-group:nth-child(1) .metric-val');
    const cpuBar = document.querySelector('.panel-stats .metric-group:nth-child(1) .metric-fill');
    const memVal = document.querySelector('.panel-stats .metric-group:nth-child(2) .metric-val');
    const memBar = document.querySelector('.panel-stats .metric-group:nth-child(2) .metric-fill');

    if (cpuVal && memVal) {
      setInterval(() => {
        const cpu = 30 + Math.floor(Math.random() * 25);
        const mem = (2.4 + Math.random() * 0.8).toFixed(1);

        cpuVal.textContent = `${cpu}%`;
        cpuBar.style.width = `${cpu}%`;
        memVal.textContent = `${mem}/8 GB`;
        memBar.style.width = `${(mem / 8) * 100}%`;
      }, 3000);
    }
  });
})();
