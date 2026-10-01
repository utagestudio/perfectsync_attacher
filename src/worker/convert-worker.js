import { convert } from '../core/convert.js';
self.onmessage = async (event) => {
  try {
    self.postMessage({ type: 'progress', message: '表情データを準備しています', value: 2 });
    const response = await fetch('/templates/hinzka-female.glb');
    if (!response.ok) throw new Error('表情データを取得できません。再試行してください。');
    const template = await response.arrayBuffer();
    const result = convert(event.data.buffer, template, (message, value) =>
      self.postMessage({ type: 'progress', message, value }),
    );
    self.postMessage({ type: 'done', ...result }, [result.buffer]);
  } catch (error) {
    self.postMessage({ type: 'error', message: error.message });
  }
};
