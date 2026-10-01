import { AppError, errorMessage } from '../i18n/messages.js';
import { convert } from '../core/convert.js';
self.onmessage = async (event) => {
  try {
    self.postMessage({ type: 'progress', message: { code: 'progress.preparing' }, value: 2 });
    const response = await fetch('/templates/hinzka-female.glb');
    if (!response.ok) throw new AppError('error.templateFetch');
    const template = await response.arrayBuffer();
    const result = convert(event.data.buffer, template, (message, value) =>
      self.postMessage({ type: 'progress', message, value }),
    );
    self.postMessage({ type: 'done', ...result }, [result.buffer]);
  } catch (error) {
    self.postMessage({ type: 'error', message: errorMessage(error) });
  }
};
