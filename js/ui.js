/* =============================================================================
 * UI HELPERS — toast, escaping, element shorthand. No framework.
 * ========================================================================== */

export const $ = (sel, root = document) => root.querySelector(sel);
export const $$ = (sel, root = document) => [...root.querySelectorAll(sel)];

/** Escape untrusted text before injecting into HTML (XSS defence, OWASP A03). */
export function escapeHtml(s) {
  return String(s ?? '').replace(/[&<>"']/g, (c) => ({
    '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;',
  })[c]);
}

let toastTimer;
export function toast(message) {
  const el = $('#toast');
  if (!el) return;
  el.textContent = message;
  el.hidden = false;
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => { el.hidden = true; }, 3500);
}

/** Show an inline field error (a11y: aria-invalid + focus). */
export function fieldError(inputEl, messageEl, message) {
  if (inputEl) inputEl.setAttribute('aria-invalid', 'true');
  if (messageEl) { messageEl.textContent = message; messageEl.hidden = false; }
}
export function clearFieldError(inputEl, messageEl) {
  if (inputEl) inputEl.removeAttribute('aria-invalid');
  if (messageEl) { messageEl.textContent = ''; messageEl.hidden = true; }
}
