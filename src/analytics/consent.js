export const CONSENT_KEY = 'perfectsync-attacher.analytics-consent';
export const CONSENT_DAYS = 90;
export const CONSENT_MS = CONSENT_DAYS * 24 * 60 * 60 * 1000;

export function readConsent(storage, containerId, now = Date.now()) {
  try {
    const record = JSON.parse(storage?.getItem(CONSENT_KEY) ?? 'null');
    if (
      record?.version !== 1 ||
      record.containerId !== containerId ||
      !['accepted', 'rejected'].includes(record.choice) ||
      !Number.isFinite(record.savedAt) ||
      record.savedAt > now ||
      record.expiresAt !== record.savedAt + CONSENT_MS ||
      record.expiresAt <= now
    )
      return undefined;
    return record;
  } catch {
    return undefined;
  }
}
export function saveConsent(storage, containerId, choice, now = Date.now()) {
  if (!['accepted', 'rejected'].includes(choice)) throw new Error('Invalid consent choice');
  const record = { version: 1, containerId, choice, savedAt: now, expiresAt: now + CONSENT_MS };
  let persisted = false;
  try {
    storage?.setItem(CONSENT_KEY, JSON.stringify(record));
    persisted = !!storage;
  } catch {
    /* Session-only consent. */
  }
  return { record, persisted };
}
export function clearAnalyticsCookies(doc, hostname) {
  for (const cookie of doc.cookie.split(';')) {
    const name = cookie.trim().split('=')[0];
    if (!/^(_ga(?:_[\w-]+)?|_gid|_gat(?:_[\w-]+)?)$/.test(name)) continue;
    const expired = `${name}=; Max-Age=0; path=/; SameSite=Lax`;
    doc.cookie = expired;
    doc.cookie = `${expired}; domain=${hostname}`;
    doc.cookie = `${expired}; domain=.${hostname}`;
  }
}
export function measuredPage(origin, pathname) {
  const supported = /^\/(ja|en|ko|zh-Hant|zh-Hans)(?:\/|\/index\.html)?$/;
  const language = pathname.match(supported)?.[1];
  return origin + (language ? `/${language}/` : '/');
}
