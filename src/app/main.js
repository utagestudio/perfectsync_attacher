import { initializeConsent } from '../analytics/ui.js';
import {
  initialLanguage,
  languageFromPath,
  isLanguage,
  saveLanguage,
  translate,
  translateDocument,
} from '../i18n/index.js';
import { errorMessage } from '../i18n/messages.js';
import './style.css';
import { MAX_INPUT_BYTES } from '../core/glb.js';
import { version } from '../../package.json';
const $ = (id) => document.getElementById(id);
$('version').textContent = version;
let storage;
try {
  storage = window.localStorage;
} catch {
  /* Persistence may be blocked. */
}
const preferredLanguage = () =>
  initialLanguage(navigator.languages ?? [navigator.language], storage);
let language = languageFromPath(location.pathname) ?? preferredLanguage();
const displayedMessages = new Map([
  ['status', { code: 'privacy' }],
  ['preview-status', { code: 'preview.loading' }],
]);
function text(message) {
  if (message.code === 'preview.failed') {
    return translate(language, message.code, { reason: translate(language, message.reason) });
  }
  return translate(language, message);
}
function display(id, code, params = {}) {
  const message = typeof code === 'string' ? { code, params } : code;
  displayedMessages.set(id, message);
  $(id).textContent = text(message);
}
function renderLanguage() {
  translateDocument(language);
  document.title = translate(language, 'seo.title');
  const meta = (property, value) =>
    document.querySelector(`meta[property="${property}"]`)?.setAttribute('content', value);
  meta('og:title', document.title);
  meta('og:description', translate(language, 'meta.description'));
  meta(
    'og:locale',
    { ja: 'ja_JP', en: 'en_US', ko: 'ko_KR', 'zh-Hant': 'zh_TW', 'zh-Hans': 'zh_CN' }[language],
  );
  const canonical = document.querySelector('link[rel="canonical"]');
  if (canonical) {
    const path = languageFromPath(location.pathname) ? `/${language}/` : '/';
    canonical.href = new URL(path, canonical.href).href;
    meta('og:url', canonical.href);
  }
  $('language').value = language;
  for (const [id, message] of displayedMessages) $(id).textContent = text(message);
  $('warnings').textContent = warnings.map(text).join('\n');
  consentUI?.refreshLanguage();
}
let warnings = [];
let consentUI;
renderLanguage();
consentUI = initializeConsent({ storage, text: (key) => translate(language, key) });
$('language').addEventListener('change', (event) => {
  if (!isLanguage(event.target.value)) return;
  language = event.target.value;
  saveLanguage(language, storage);
  history.pushState(null, '', `/${language}/` + location.search + location.hash);
  renderLanguage();
});
window.addEventListener('popstate', () => {
  language = languageFromPath(location.pathname) ?? preferredLanguage();
  renderLanguage();
});
function showScreen(name) {
  for (const id of ['waiting', 'result']) $(id).hidden = id !== name;
  for (const stage of document.querySelectorAll('[data-stage]')) {
    if (stage.dataset.stage === name) stage.setAttribute('aria-current', 'step');
    else stage.removeAttribute('aria-current');
  }
  if (name !== 'waiting') $(`${name}-title`).focus({ preventScroll: true });
}
let worker,
  workerTimeout,
  downloadUrl,
  output,
  previewCleanup,
  sequence = 0,
  previewLoading = false;
function clearPreview() {
  previewCleanup?.();
  previewCleanup = undefined;
  previewLoading = false;
  $('preview-retry').hidden = true;
  $('reset').disabled = true;
  $('sliders').replaceChildren();
  $('viewer').replaceChildren();
}
function stopWorker() {
  clearTimeout(workerTimeout);
  workerTimeout = undefined;
  worker?.terminate();
  worker = undefined;
  $('progress-area').hidden = true;
}
async function start(file) {
  sequence++;
  const ticket = sequence;
  stopWorker();
  clearPreview();
  output = undefined;
  if (downloadUrl) {
    URL.revokeObjectURL(downloadUrl);
    downloadUrl = undefined;
  }
  showScreen('waiting');
  $('drop').hidden = false;
  $('status').className = '';
  $('file').value = '';
  if (!file) return;
  if (!file.name.toLowerCase().endsWith('.vrm')) return error('error.extension');
  if (file.size > MAX_INPUT_BYTES) return error('error.inputSize');
  $('filename').textContent = file.name;
  $('progress-area').hidden = false;
  $('drop').hidden = true;
  $('progress').value = 0;
  display('status', 'progress.reading');
  try {
    const buffer = await file.arrayBuffer();
    if (ticket !== sequence) return;
    worker = new Worker(new URL('../worker/convert-worker.js', import.meta.url), {
      type: 'module',
    });
    worker.onmessage = (event) => {
      if (ticket !== sequence) return;
      const data = event.data;
      if (data.type === 'progress') {
        $('progress').value = data.value;
        display('status', data.message);
      }
      if (data.type === 'error') {
        stopWorker();
        error(data.message);
      }
      if (data.type === 'done') {
        stopWorker();
        output = data.buffer;
        downloadUrl = URL.createObjectURL(new Blob([output], { type: 'application/octet-stream' }));
        $('download').href = downloadUrl;
        $('download').download = file.name.replace(/\.vrm$/i, '_perfectsync.vrm');
        display('result-title', data.added ? 'result.added' : 'result.existing', {
          count: data.added,
        });
        display('result-detail', 'result.detail', {
          version: data.version,
          size: (output.byteLength / 1024 / 1024).toFixed(1),
        });
        warnings = data.warnings;
        $('warnings').textContent = warnings.map(text).join('\n');
        showScreen('result');
        display('status', 'result.ready');
        $('result').querySelector('details').open = false;
        openPreview();
      }
    };
    worker.onerror = () => {
      if (ticket !== sequence) return;
      stopWorker();
      error('error.unknown');
    };
    workerTimeout = setTimeout(() => {
      if (ticket !== sequence) return;
      stopWorker();
      error('error.timeout');
    }, 120000);
    worker.postMessage({ buffer }, [buffer]);
  } catch (e) {
    if (ticket === sequence) {
      stopWorker();
      error(errorMessage(e));
    }
  }
}
function error(message) {
  showScreen('waiting');
  $('drop').hidden = false;
  $('status').className = 'error';
  display('status', message);
}
$('file').addEventListener('change', (event) => start(event.target.files[0]));
for (const name of ['dragenter', 'dragover'])
  $('drop').addEventListener(name, (event) => {
    event.preventDefault();
    $('drop').classList.add('dragging');
  });
for (const name of ['dragleave', 'drop'])
  $('drop').addEventListener(name, (event) => {
    event.preventDefault();
    $('drop').classList.remove('dragging');
  });
$('drop').addEventListener('drop', (event) => {
  if (event.dataTransfer.files.length !== 1) {
    error('error.dropCount');
    return;
  }
  start(event.dataTransfer.files[0]);
});
window.addEventListener('dragover', (e) => e.preventDefault());
window.addEventListener('drop', (e) => e.preventDefault());
$('cancel').addEventListener('click', () => {
  sequence++;
  stopWorker();
  $('drop').hidden = false;
  display('status', 'status.cancelled');
});
async function openPreview() {
  if (!output || previewLoading || previewCleanup) return;
  previewLoading = true;
  const ticket = sequence;
  $('preview-retry').hidden = true;
  display('preview-status', 'preview.loading');
  try {
    const { createPreview } = await import('../preview/viewer.js');
    if (ticket !== sequence) return;
    const cleanup = await createPreview(
      output,
      $('viewer'),
      $('sliders'),
      $('reset'),
      () => ticket === sequence,
    );
    if (ticket !== sequence) {
      cleanup();
      return;
    }
    previewCleanup = cleanup;
    $('reset').disabled = false;
    display('preview-status', 'preview.instructions');
  } catch (e) {
    if (ticket === sequence) {
      display('preview-status', {
        code: 'preview.failed',
        reason: errorMessage(e, 'error.previewUnknown'),
      });
      $('preview-retry').hidden = false;
    }
  } finally {
    if (ticket === sequence) previewLoading = false;
  }
}
$('preview-retry').addEventListener('click', openPreview);

$('new-file').addEventListener('click', () => {
  start();
  display('status', 'privacy');
  $('file').focus({ preventScroll: true });
});
