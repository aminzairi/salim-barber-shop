/* =============================================================================
 * TRANSLATION REGISTRY — keeps JSON importable both in the browser (bundled as
 * ES modules) and in Node unit tests (fetch-free JSON re-export).
 * ========================================================================== */
import en from './en.json' with { type: 'json' };
import fr from './fr.json' with { type: 'json' };
import ar from './ar.json' with { type: 'json' };

export default { en, fr, ar };
