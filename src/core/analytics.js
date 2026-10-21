// Google Analytics 4 (stream "nc_breach"). The gtag loader and config live in index.html; this
// module only forwards gameplay events. No-op when gtag is absent (node sims, blocked, offline).
export function track(name, params = {}) {
  try { if (typeof window !== 'undefined' && typeof window.gtag === 'function') window.gtag('event', name, params); } catch (e) { /* analytics must never break the game */ }
}
