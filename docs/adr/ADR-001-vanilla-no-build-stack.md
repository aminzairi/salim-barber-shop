# ADR-001 — Vanilla ES modules, no build step, no framework

**Status:** Accepted · **Date:** 2026-10-24

## Context
Mobile-first trilingual site, Lighthouse ≥ 90, FCP < 2 s, maintained by a team
of one, edited occasionally by a non-technical owner. React/Vue/Svelte or a
static site generator were candidates.

## Decision
Plain semantic HTML + modern CSS + vanilla ES modules served statically. No
bundler, no runtime dependencies, no npm packages shipped to the browser.

## Consequences
- **+** ~40 KB total JS; no hydration; trivially fast; any host serves it.
- **+** The owner can open one file and change a price safely.
- **+** Testable: pure modules run under `node --test` directly.
- **−** No component model — mitigated by small render functions per module
  and a strict one-module-one-concern layout.
- **−** Manual icon/versioning chores (scripts provided).

Rejected: React (bundle + build complexity unjustified for ~6 views);
static site generator (adds a toolchain the owner must learn; i18n achievable
simpler with JSON + a 120-line engine).
