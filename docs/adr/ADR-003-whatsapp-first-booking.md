# ADR-003 — WhatsApp-first booking, online wizard as progressive enhancement

**Status:** Accepted · **Date:** 2026-10-24

## Context
Tunisian barbershops live on WhatsApp; customers already have it, the owner
already answers messages. Phase 1 must launch in days with zero backend.

## Decision
Ship Phase 1 as a trilingual page whose booking form opens WhatsApp with a
prefilled, language-correct message. Phase 2 adds the guaranteed-slot wizard
on the same page; the WhatsApp channel stays as an alternative (and fallback
when the backend is unreachable).

## Consequences
- The shop can operate from day one with no infrastructure.
- Confirmation ambiguity (WhatsApp requests are unconfirmed until answered) is
  accepted in Phase 1 and solved by the wizard in Phase 2.
- Message templates live in translations — single source of truth for both
  channels (booking request, and post-confirmation message).
