import ja from './locales/ja.js';

export function formatMessage(catalog, code, params = {}) {
  const pattern = catalog[code] ?? catalog['error.unknown'];
  return pattern.replace(/\{(\w+)\}/g, (_, key) => String(params[key] ?? `{${key}}`));
}

// Keep a Japanese message for CLI users, while browser/Worker consumers use code + params.
export class AppError extends Error {
  constructor(code, params = {}) {
    super(formatMessage(ja, code, params));
    this.name = 'AppError';
    this.code = code;
    this.params = params;
  }
}

export function errorMessage(error, fallback = 'error.unknown') {
  return error instanceof AppError
    ? { code: error.code, params: error.params }
    : { code: fallback };
}
