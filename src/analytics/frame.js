// This document is disposable: no Google code runs in the application's document.
import { measuredPage } from './consent.js';
const containerId = __GTM_ID__;
let initialized = false;
window.addEventListener('message', (event) => {
  if (
    initialized ||
    parent === window ||
    event.source !== parent ||
    event.origin !== location.origin ||
    event.data?.type !== 'psa:analytics-page' ||
    !containerId
  )
    return;
  initialized = true;
  const pageLocation = measuredPage(location.origin, event.data.pathname);
  const remainingSeconds = Math.max(
    1,
    Math.min(90 * 86400, Math.floor((event.data.expiresAt - Date.now()) / 1000)),
  );
  window.dataLayer = [];
  function gtag() {
    window.dataLayer.push(arguments);
  }
  gtag('consent', 'default', {
    analytics_storage: 'granted',
    ad_storage: 'denied',
    ad_user_data: 'denied',
    ad_personalization: 'denied',
  });
  gtag('set', {
    send_page_view: false,
    page_location: pageLocation,
    page_referrer: '',
    page_title: 'Perfect Sync Attacher',
    cookie_domain: location.hostname,
    cookie_path: '/',
    cookie_expires: remainingSeconds,
    cookie_update: false,
    allow_google_signals: false,
    allow_ad_personalization_signals: false,
  });
  window.dataLayer.push({ 'gtm.start': Date.now(), event: 'gtm.js' });
  window.dataLayer.push({
    event: 'psa_page_view',
    page_location: pageLocation,
    page_title: 'Perfect Sync Attacher',
    page_referrer: '',
  });
  const script = document.createElement('script');
  script.async = true;
  script.src = `https://www.googletagmanager.com/gtm.js?id=${encodeURIComponent(containerId)}`;
  document.head.append(script);
});
