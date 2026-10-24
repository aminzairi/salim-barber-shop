# ADR-004 — i18n via JSON dictionaries + runtime engine, naive shop-local times

**Status:** Accepted · **Date:** 2026-10-24

## Context
Three languages (one RTL), an owner who must edit wording, and dates/times
that mean "at the shop" regardless of the visitor's timezone.

## Decision
1. **i18n:** all strings in `js/translations/{en,fr,ar}.json`; a ~120-line
   engine handles detection (saved → browser → FR default), persistence,
   `{placeholder}` interpolation, `lang`/`dir` switching and an
   `sb:langchange` observer event that modules re-render on. RTL via CSS
   logical properties — no duplicated stylesheets.
2. **Time:** business logic uses naive `YYYY-MM-DD`/`HH:MM` strings in
   **Africa/Tunis** only; `shopNow()` computes "now" in the shop zone from any
   visitor clock; DB stores `timestamptz` converted server-side; `.ics` uses
   `TZID=Africa/Tunis`.

## Consequences
- Parity between dictionaries is machine-checked (unit test + check script) —
  a missing Arabic string fails CI.
- No ICU library needed; plural forms handled by per-language phrasing that
  works for 0..n (e.g., "personne(s)").
- DST changes in Tunisia would require no code change: `Intl` and Postgres
  both resolve the named zone.
