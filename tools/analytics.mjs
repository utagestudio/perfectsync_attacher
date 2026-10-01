import { readFileSync } from 'node:fs';
export function containerId(value) {
  if (!value?.trim()) return '';
  const id = value.trim();
  if (!/^GTM-[A-Z0-9]+$/.test(id))
    throw new Error('GTM_ID must be a Google Tag Manager container ID (GTM-...).');
  return id;
}
export function analyticsHeaders(id) {
  const baseline = readFileSync(new URL('../public/_headers', import.meta.url), 'utf8');
  if (!id) return baseline;
  return baseline
    .replace("script-src 'self'", "script-src 'self' https://www.googletagmanager.com")
    .replace(
      "img-src 'self' blob: data:",
      "img-src 'self' blob: data: https://www.googletagmanager.com https://*.google-analytics.com",
    )
    .replace(
      "connect-src 'self'",
      "connect-src 'self' https://www.googletagmanager.com https://*.google-analytics.com https://www.google.com",
    )
    .replace("frame-ancestors 'none'", "frame-ancestors 'self'; frame-src 'self'");
}
export function analyticsPlugin(id) {
  const csp = analyticsHeaders(id)
    .split('\n')
    .find((line) => line.includes('Content-Security-Policy:'))
    .split('Content-Security-Policy: ')[1];
  return {
    name: 'consented-analytics',
    configureServer(server) {
      server.middlewares.use((req, res, next) => {
        res.setHeader('Content-Security-Policy', csp);
        res.setHeader('Referrer-Policy', 'no-referrer');
        next();
      });
    },
    generateBundle() {
      this.emitFile({ type: 'asset', fileName: '_headers', source: analyticsHeaders(id) });
    },
  };
}
