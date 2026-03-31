# Navigation Bugfix Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Fix the active tab state and scrolling behavior for the top navigation in the portfolio page.

**Architecture:** Keep navigation logic in `script.js`, but extract pure helpers for active-section detection and scroll target calculation. Browser event handlers will use those helpers for click and scroll synchronization.

**Tech Stack:** Vanilla JS, Node built-in test runner, PowerShell smoke check

---

### Task 1: Add regression tests for navigation logic

**Files:**
- Add: `tests/navigation.test.js`
- Test: `script.js`

- [ ] **Step 1: Write the failing test**
- [ ] **Step 2: Run test to verify it fails**
- [ ] **Step 3: Write minimal implementation**
- [ ] **Step 4: Run test to verify it passes**

### Task 2: Apply the helper logic to browser navigation

**Files:**
- Modify: `script.js`
- Test: `tests/navigation.test.js`

- [ ] **Step 1: Add click navigation with sticky offset support**
- [ ] **Step 2: Add scroll-based active tab synchronization**
- [ ] **Step 3: Run navigation tests again**

### Task 3: Run final verification

**Files:**
- Test: `tests/navigation.test.js`
- Test: `tests/verify-card-hover-delay.ps1`

- [ ] **Step 1: Run regression tests**
- [ ] **Step 2: Run existing smoke check**
- [ ] **Step 3: Manually verify `home.tsx`, `projects.tsx`, and `contacts.tsx` behavior**
