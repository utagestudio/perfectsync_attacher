import { readFileSync } from 'node:fs';
import { contactFormUrl } from '../config/contact.js';
import { catalogs, translate } from '../src/i18n/index.js';
const { version } = JSON.parse(readFileSync(new URL('../package.json', import.meta.url), 'utf8'));

export const languages = Object.keys(catalogs);
export const languagePath = (language) => `/${language}/`;
export const escapeHtml = (value) =>
  String(value).replace(
    /[&<>"']/g,
    (char) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[char],
  );

export function siteOrigin(value) {
  if (!value?.trim()) return undefined;
  let url;
  try {
    url = new URL(value.trim());
  } catch {
    throw new Error('SITE_URL must be an absolute HTTPS origin.');
  }
  if (
    url.protocol !== 'https:' ||
    url.username ||
    url.password ||
    url.pathname !== '/' ||
    url.search ||
    url.hash
  ) {
    throw new Error(
      'SITE_URL must be an HTTPS origin without credentials, a path, query or fragment.',
    );
  }
  return url.origin;
}

export function localizedHtml(html, language) {
  html = html.replace(/<a\b[^>]*\bid="contact-link"[^>]*>/g, (tag) =>
    tag.replace(/\bhref="[^"]*"/, `href="${escapeHtml(contactFormUrl(language, version))}"`),
  );
  html = html.replace(/<html\b[^>]*>/, `<html lang="${language}">`);
  html = html.replace(
    /(<([a-z][\w-]*)\b[^>]*\bdata-i18n="([^"]+)"[^>]*>)[^<]*(<\/\2\s*>)/gi,
    (_, open, tag, key, close) => open + escapeHtml(translate(language, key)) + close,
  );
  html = html.replace(/<[a-z][\w-]*\b[^>]*>/gi, (tag) => {
    for (const attribute of ['aria-label', 'title', 'content']) {
      const key = tag.match(new RegExp(`data-i18n-${attribute}="([^"]+)"`))?.[1];
      if (key)
        tag = tag.replace(
          new RegExp(`(?<![\\w-])${attribute}="[^"]*"`),
          `${attribute}="${escapeHtml(translate(language, key))}"`,
        );
    }
    return tag;
  });
  html = html.replace(
    /(<option\b[^>]*)( selected)?(>)/g,
    (_, open, selected, end) =>
      open.replace(/\sselected\b/g, '') +
      (open.includes(`value="${language}"`) ? ' selected' : '') +
      end,
  );
  return html;
}

export function seoHtml(
  html,
  language,
  origin,
  path = languagePath(language),
  indexable = !!origin,
) {
  html = localizedHtml(html, language);
  const title = translate(language, 'seo.title');
  html = html.replace(/<title>[^<]*<\/title>/, `<title>${escapeHtml(title)}</title>`);
  const description = translate(language, 'meta.description');
  const meta = (property, content) =>
    `<meta property="${property}" content="${escapeHtml(content)}" />`;
  const tags = [
    `<meta name="robots" content="${indexable ? 'index, follow' : 'noindex, nofollow'}" />`,
    meta('og:type', 'website'),
    meta('og:site_name', 'Perfect Sync Attacher'),
    meta('og:title', title),
    meta('og:description', description),
    meta(
      'og:locale',
      { ja: 'ja_JP', en: 'en_US', ko: 'ko_KR', 'zh-Hant': 'zh_TW', 'zh-Hans': 'zh_CN' }[language],
    ),
    '<meta name="twitter:card" content="summary_large_image" />',
  ];
  if (origin) {
    const url = origin + path;
    tags.push(
      `<link rel="canonical" href="${escapeHtml(url)}" />`,
      meta('og:url', url),
      meta('og:image', origin + '/og.png'),
      meta('og:image:width', '1200'),
      meta('og:image:height', '630'),
      meta('og:image:alt', 'Perfect Sync Attacher — 52 expressions for your VRM'),
    );
    for (const lang of languages)
      tags.push(
        `<link rel="alternate" hreflang="${lang}" href="${escapeHtml(origin + languagePath(lang))}" />`,
      );
    tags.push(`<link rel="alternate" hreflang="x-default" href="${escapeHtml(origin + '/')}" />`);
  }
  return html.replace('</head>', tags.join('\n') + '\n</head>');
}

export function sitemap(origin) {
  const urls = ['/', ...languages.map(languagePath)]
    .map((path) => `<url><loc>${escapeHtml(origin + path)}</loc></url>`)
    .join('\n');
  return `<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n${urls}\n</urlset>\n`;
}

export function seoPlugin(origin, indexable = !!origin) {
  return {
    name: 'localized-static-pages',
    transformIndexHtml: {
      order: 'post',
      handler(html, context) {
        if (context.filename?.endsWith('/analytics.html')) return html;
        if (context.server) {
          const requestPath = (context.originalUrl ?? context.path).split('?')[0];
          const language =
            languages.find(
              (lang) =>
                requestPath === languagePath(lang) ||
                requestPath === `${languagePath(lang)}index.html`,
            ) ?? 'ja';
          return seoHtml(
            html,
            language,
            origin,
            requestPath === '/' || requestPath === '/index.html' ? '/' : languagePath(language),
            false,
          );
        }
        return html;
      },
    },
    generateBundle: {
      order: 'post',
      handler(options, bundle) {
        const entry = bundle['index.html'];
        if (!entry || entry.type !== 'asset') throw new Error('Missing built index.html');
        const html = String(entry.source);
        entry.source = seoHtml(html, 'ja', origin, '/', indexable);
        for (const language of languages)
          this.emitFile({
            type: 'asset',
            fileName: `${language}/index.html`,
            source: seoHtml(html, language, origin, languagePath(language), indexable),
          });
        this.emitFile({
          type: 'asset',
          fileName: 'robots.txt',
          source: indexable
            ? `User-agent: *\nAllow: /\nSitemap: ${origin}/sitemap.xml\n`
            : 'User-agent: *\nDisallow: /\n',
        });
        if (origin && indexable)
          this.emitFile({ type: 'asset', fileName: 'sitemap.xml', source: sitemap(origin) });
        // A top-level 404 disables Cloudflare Pages' automatic SPA fallback.
        this.emitFile({
          type: 'asset',
          fileName: '404.html',
          source:
            '<!doctype html><html lang="en"><head><meta charset="utf-8"><meta name="robots" content="noindex"><title>404 — Perfect Sync Attacher</title></head><body><h1>Page not found</h1><a href="/">Perfect Sync Attacher</a></body></html>',
        });
      },
    },
  };
}
