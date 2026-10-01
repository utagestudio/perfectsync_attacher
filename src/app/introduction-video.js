export function initializeIntroductionVideo() {
  const trigger = document.getElementById('introduction-open');
  const dialog = document.getElementById('introduction-dialog');
  const video = document.getElementById('introduction-video');
  const fallback = document.getElementById('introduction-play-hint');
  trigger.addEventListener('click', () => {
    dialog.showModal();
    fallback.hidden = true;
    video.src = '/media/introduction.mp4';
    video.play().catch(() => {
      if (dialog.open) fallback.hidden = false;
    });
  });
  const stop = () => {
    video.pause();
    video.removeAttribute('src');
    video.load();
    fallback.hidden = true;
  };
  const close = () => {
    stop();
    dialog.close();
  };
  document.getElementById('introduction-close').addEventListener('click', close);
  dialog.addEventListener('cancel', stop);
  dialog.addEventListener('close', stop);
  dialog.addEventListener('click', (event) => {
    if (event.target !== dialog) return;
    const bounds = dialog.getBoundingClientRect();
    if (
      event.clientX < bounds.left ||
      event.clientX > bounds.right ||
      event.clientY < bounds.top ||
      event.clientY > bounds.bottom
    )
      close();
  });
  document.addEventListener('visibilitychange', () => {
    if (document.hidden) video.pause();
  });
  window.addEventListener('pagehide', () => video.pause());
}
