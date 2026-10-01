import './style.css';
import { version } from '../../package.json';
const $ = (id) => document.getElementById(id);
$('version').textContent = version;
function showScreen(name) {
  for (const id of ['waiting', 'result']) $(id).hidden = id !== name;
  for (const stage of document.querySelectorAll('[data-stage]')) {
    if (stage.dataset.stage === name) stage.setAttribute('aria-current', 'step');
    else stage.removeAttribute('aria-current');
  }
  if (name !== 'waiting') $(`${name}-title`).focus({ preventScroll: true });
}
let worker,
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
  if (!file.name.toLowerCase().endsWith('.vrm'))
    return error('拡張子が.vrmのファイルを選択してください。');
  if (file.size > 100 * 1024 * 1024) return error('100 MiB以下のファイルを選択してください。');
  $('filename').textContent = file.name;
  $('progress-area').hidden = false;
  $('drop').hidden = true;
  $('progress').value = 0;
  $('status').textContent = 'ファイルを読み込んでいます…';
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
        $('status').textContent = data.message;
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
        $('result-title').textContent = data.added
          ? `${data.added}表情を追加しました`
          : '変換済みのVRMです';
        $('result-detail').textContent =
          `VRM ${data.version} · ${(output.byteLength / 1024 / 1024).toFixed(1)} MiB · 元のファイルは保持されています`;
        $('warnings').textContent = data.warnings.join('\n');
        showScreen('result');
        $('status').textContent = '表情を確認し、VRMを保存できます。';
        $('result').querySelector('details').open = false;
        openPreview();
      }
    };
    worker.onerror = () => {
      if (ticket !== sequence) return;
      stopWorker();
      error('処理を継続できませんでした。ファイルを選び直してください。');
    };
    worker.postMessage({ buffer }, [buffer]);
  } catch (e) {
    if (ticket === sequence) {
      stopWorker();
      error(e.message);
    }
  }
}
function error(message) {
  showScreen('waiting');
  $('drop').hidden = false;
  $('status').className = 'error';
  $('status').textContent = message;
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
    error('1ファイルずつドロップしてください。');
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
  $('status').textContent = '変換をキャンセルしました。ファイルを選び直せます。';
});
async function openPreview() {
  if (!output || previewLoading || previewCleanup) return;
  previewLoading = true;
  const ticket = sequence;
  $('preview-retry').hidden = true;
  $('preview-status').textContent = 'プレビューを準備しています…';
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
    $('preview-status').textContent = 'スライダーで表情を調整。ドラッグで回転、ホイールで拡大。';
  } catch (e) {
    if (ticket === sequence) {
      $('preview-status').textContent =
        `プレビューを開けませんでした：${e.message}。VRMの保存は可能です。`;
      $('preview-retry').hidden = false;
    }
  } finally {
    if (ticket === sequence) previewLoading = false;
  }
}
$('preview-retry').addEventListener('click', openPreview);

$('new-file').addEventListener('click', () => {
  start();
  $('status').textContent = 'ファイルは外部へ送信されません。';
  $('file').focus({ preventScroll: true });
});
