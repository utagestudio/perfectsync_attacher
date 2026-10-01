import { CONSENT_KEY, readConsent, saveConsent, clearAnalyticsCookies } from './consent.js';

export function initializeConsent({ storage, text }) {
  const id = __GTM_ID__;
  const $ = (name) => document.getElementById(name);
  if (!id) return;
  let record = readConsent(storage, id);
  let persisted = true;
  let frame;
  let pageCounted = false;
  const stop = () => {
    // Deny new requests, including unload beacons, before destroying the tag document.
    if (frame?.contentDocument?.head) {
      const policy = frame.contentDocument.createElement('meta');
      policy.httpEquiv = 'Content-Security-Policy';
      policy.content =
        "default-src 'none'; connect-src 'none'; img-src 'none'; script-src 'none'; frame-src 'none'";
      frame.contentDocument.head.append(policy);
    }
    frame?.remove();
    frame = undefined;
    clearAnalyticsCookies(document, location.hostname);
  };
  const refreshLanguage = () => {
    $('consent-state').textContent = text(record ? `consent.${record.choice}` : 'consent.unknown');
    $('consent-session').hidden = persisted;
  };
  const show = () => {
    refreshLanguage();
    if (!$('consent-dialog').open) $('consent-dialog').show();
  };
  const apply = () => {
    if (record?.choice === 'accepted') {
      if (!frame) {
        const next = document.createElement('iframe');
        next.id = 'analytics-frame';
        next.hidden = true;
        next.setAttribute('aria-hidden', 'true');
        next.tabIndex = -1;
        next.title = 'Access analytics';
        next.addEventListener(
          'load',
          () => {
            if (frame === next && record?.choice === 'accepted') {
              next.contentWindow.postMessage(
                {
                  type: 'psa:analytics-page',
                  pathname: location.pathname,
                  expiresAt: record.expiresAt,
                  countPage: !pageCounted,
                },
                location.origin,
              );
              pageCounted = true;
            }
          },
          { once: true },
        );
        frame = next;
        next.src = '/analytics.html';
        document.body.append(next);
      }
    } else stop();
    refreshLanguage();
  };
  const choose = (choice) => {
    ({ record, persisted } = saveConsent(storage, id, choice));
    apply();
    $('consent-dialog').close();
    $('consent-settings').focus({ preventScroll: true });
  };
  $('consent-settings').hidden = false;
  $('consent-settings').addEventListener('click', show);
  $('consent-accept').addEventListener('click', () => choose('accepted'));
  $('consent-reject').addEventListener('click', () => choose('rejected'));
  $('consent-close').addEventListener('click', () => $('consent-dialog').close());
  const synchronize = () => {
    record = readConsent(storage, id);
    apply();
    if (!record) show();
  };
  window.addEventListener('storage', (event) => {
    if (event.key === CONSENT_KEY || event.key === null) synchronize();
  });
  document.addEventListener('visibilitychange', () => {
    if (document.visibilityState === 'visible' && record && record.expiresAt <= Date.now())
      synchronize();
  });
  setInterval(() => {
    if (record && record.expiresAt <= Date.now()) synchronize();
  }, 60000);
  apply();
  if (!record) show();
  return { refreshLanguage };
}
