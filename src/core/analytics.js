// Google Analytics 4 (stream "nc_breach"), loaded only after the player accepts the consent card
// on the main menu. The choice lives in its own localStorage key so WIPE SAVE does not touch it.
const ID = 'G-9SK0GL50JY';
const KEY = 'ncb_consent_v1';
const LOCAL = /^(localhost|127\.0\.0\.1|\[::1\])$/; // dev and test runs stay out of the data

let loaded = false;
let current = null; // 'granted' | 'denied' | null (not asked yet)

export function getConsent() {
  try { const v = window.localStorage.getItem(KEY); return v === 'granted' || v === 'denied' ? v : null; } catch (e) { return null; }
}

export function setConsent(v) {
  try { window.localStorage.setItem(KEY, v); } catch (e) { /* unavailable: the choice holds for this visit only */ }
  current = v;
  if (v === 'granted') load();
  else revoke();
}

function load() {
  if (typeof window === 'undefined' || LOCAL.test(location.hostname)) return;
  window['ga-disable-' + ID] = false;
  // Turned back on after being turned off in this page: gtag is already loaded, just re-grant.
  if (loaded) { window.gtag('consent', 'update', { analytics_storage: 'granted' }); return; }
  loaded = true;
  window.dataLayer = window.dataLayer || [];
  window.gtag = function () { window.dataLayer.push(arguments); };
  window.gtag('consent', 'default', { analytics_storage: 'granted', ad_storage: 'denied', ad_user_data: 'denied', ad_personalization: 'denied' });
  window.gtag('js', new Date());
  window.gtag('config', ID);
  const s = document.createElement('script'); s.async = true;
  s.src = 'https://www.googletagmanager.com/gtag/js?id=' + ID;
  document.head.appendChild(s);
}

function revoke() {
  if (typeof window === 'undefined') return;
  if (loaded && typeof window.gtag === 'function') window.gtag('consent', 'update', { analytics_storage: 'denied' });
  window['ga-disable-' + ID] = true;
  // Expire the _ga cookies on this host and its parent domains.
  const host = location.hostname.split('.');
  const domains = [''];
  for (let i = 0; i < host.length - 1; i++) domains.push('; domain=.' + host.slice(i).join('.'));
  for (const c of document.cookie.split(';')) {
    const name = c.split('=')[0].trim();
    if (name === '_ga' || name.startsWith('_ga_')) for (const d of domains) document.cookie = `${name}=; expires=Thu, 01 Jan 1970 00:00:00 GMT; path=/${d}`;
  }
}

export function initAnalytics() {
  current = getConsent();
  if (current === 'granted') load();
}

export function track(name, params = {}) {
  try { if (current === 'granted' && loaded && typeof window.gtag === 'function') window.gtag('event', name, params); } catch (e) { /* analytics must never break the game */ }
}
