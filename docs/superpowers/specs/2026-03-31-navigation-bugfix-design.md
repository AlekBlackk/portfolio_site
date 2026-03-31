# Navigation Bugfix Design

## Goal

Fix the top navigation so that:
- the active tab switches correctly between `home.tsx`, `projects.tsx`, and `contacts.tsx`
- navigation to `contacts` no longer leaves `projects.tsx` highlighted
- the behavior stays correct for short final sections and different viewport heights

## Root Cause

- Click navigation uses `scrollIntoView()`, which does not explicitly account for the sticky bars.
- Active tab state is driven only by an `IntersectionObserver` with a narrow active zone.
- The final `contacts` section is short, so it may never enter that zone before the page reaches its scroll limit.

## Approved Approach

1. Mark the clicked tab active immediately.
2. Replace `scrollIntoView()` with `window.scrollTo()` using a computed offset for sticky bars.
3. Replace active-section detection with a scroll-based calculation using a viewport focus line and a bottom-of-page fallback.
4. Keep the calculation in small pure helper functions covered by tests.
