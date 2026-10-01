import { translate } from '../i18n/index.js';
import { applyExtendedWeights } from './extended-weights.js';
import { AppError } from '../i18n/messages.js';
import * as THREE from 'three';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';
import { VRMLoaderPlugin, VRMUtils } from '@pixiv/three-vrm';
export async function createPreview(buffer, container, sliders, reset, isCurrent = () => true) {
  const manager = new THREE.LoadingManager();
  manager.setURLModifier((url) => {
    if (!url.startsWith('blob:')) throw new AppError('error.previewExternal');
    return url;
  });
  const loader = new GLTFLoader(manager);
  loader.register((parser) => new VRMLoaderPlugin(parser));
  const gltf = await loader.parseAsync(buffer, '');
  const vrm = gltf.userData.vrm;
  if (!vrm) throw new AppError('error.previewVrm');
  if (!isCurrent()) {
    VRMUtils.deepDispose(vrm.scene);
    return () => {};
  }
  VRMUtils.rotateVRM0(vrm);
  let renderer;
  try {
    renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true });
  } catch (error) {
    VRMUtils.deepDispose(vrm.scene);
    throw error;
  }
  renderer.setPixelRatio(Math.min(devicePixelRatio, 2));
  renderer.outputColorSpace = THREE.SRGBColorSpace;
  const scene = new THREE.Scene();
  scene.add(vrm.scene);
  scene.add(new THREE.HemisphereLight(0xffffff, 0xb0bdb1, 2.3));
  const light = new THREE.DirectionalLight(0xffffff, 2);
  light.position.set(1, 2, 3);
  scene.add(light);
  const camera = new THREE.PerspectiveCamera(28, 1, 0.01, 100);
  vrm.update(0);
  vrm.scene.updateMatrixWorld(true);
  const faceBounds = new THREE.Box3();
  for (const bind of vrm.expressionManager.getExpression('JawOpen').binds)
    for (const mesh of bind.primitives ?? []) {
      mesh.skeleton?.update();
      faceBounds.union(new THREE.Box3().setFromObject(mesh, true));
    }
  const center = faceBounds.getCenter(new THREE.Vector3()),
    size = faceBounds.getSize(new THREE.Vector3());
  const distance =
    (Math.max(size.y, size.x) * 1.25) / (2 * Math.tan(THREE.MathUtils.degToRad(camera.fov / 2)));
  camera.position.set(center.x, center.y, center.z + Math.max(distance, 0.3));
  const controls = new OrbitControls(camera, renderer.domElement);
  controls.target.copy(center);
  controls.enableDamping = true;
  controls.minDistance = 0.15;
  controls.maxDistance = 5;
  controls.update();
  container.append(renderer.domElement);
  const observer = new ResizeObserver(() => {
    const w = container.clientWidth,
      h = container.clientHeight;
    if (!w || !h) return;
    renderer.setSize(w, h);
    camera.aspect = w / h;
    camera.updateProjectionMatrix();
  });
  observer.observe(container);
  const names = Object.keys(vrm.expressionManager.expressionMap).filter((n) =>
    /^(Brow|Cheek|Eye|Jaw|Mouth|Nose|Tongue)/.test(n),
  );
  if (names.length !== 52) {
    controls.dispose();
    renderer.dispose();
    VRMUtils.deepDispose(vrm.scene);
    observer.disconnect();
    throw new AppError('error.previewCount', { count: names.length });
  }
  const note = document.createElement('p');
  note.className = 'extended-note';
  note.dataset.i18n = 'preview.extendedHint';
  note.textContent = translate(document.documentElement.lang, 'preview.extendedHint');
  sliders.append(note);
  const inputs = [];
  for (const name of names) {
    const row = document.createElement('div');
    row.className = 'slider-row';
    const caption = document.createElement('span');
    caption.textContent = name;
    caption.id = `expression-${name}`;
    const value = document.createElement('output');
    value.textContent = '0%';
    const input = document.createElement('input');
    input.type = 'range';
    input.min = 0;
    input.max = 1;
    input.step = 0.01;
    input.value = 0;
    input.setAttribute('aria-label', name);
    const toggle = document.createElement('button');
    toggle.type = 'button';
    toggle.className = 'extended-toggle';
    toggle.setAttribute('aria-pressed', 'false');
    toggle.setAttribute('aria-labelledby', `expression-${name} extended-${name}`);
    const toggleText = document.createElement('span');
    toggleText.id = `extended-${name}`;
    toggleText.dataset.i18n = 'preview.extended';
    toggleText.textContent = translate(document.documentElement.lang, 'preview.extended');
    toggle.dataset.i18nTitle = 'preview.extendedHint';
    toggle.title = translate(document.documentElement.lang, 'preview.extendedHint');
    toggle.append(toggleText);
    const update = () => {
      vrm.expressionManager.setValue(name, Number(input.value));
      value.textContent = `${Math.round(input.value * 100)}%`;
      input.style.setProperty(
        '--range-fill',
        `${((Number(input.value) - Number(input.min)) / (Number(input.max) - Number(input.min))) * 100}%`,
      );
    };
    input.addEventListener('input', update);
    toggle.addEventListener('click', () => {
      const enabled = toggle.getAttribute('aria-pressed') !== 'true';
      toggle.setAttribute('aria-pressed', String(enabled));
      const current = Number(input.value);
      input.min = enabled ? -1 : 0;
      input.max = enabled ? 2 : 1;
      input.value = Math.max(Number(input.min), Math.min(Number(input.max), current));
      update();
    });
    row.append(caption, value, input, toggle);
    sliders.append(row);
    inputs.push({ input, value, name, row, toggle });
  }
  const resetValues = () => {
    for (const { input, value, name, toggle } of inputs) {
      toggle.setAttribute('aria-pressed', 'false');
      input.min = 0;
      input.max = 1;
      input.value = 0;
      input.style.setProperty('--range-fill', '0%');
      value.textContent = '0%';
      vrm.expressionManager.setValue(name, 0);
    }
  };
  reset.addEventListener('click', resetValues);
  renderer.setAnimationLoop(() => {
    if (!container.clientWidth || !container.clientHeight) return;
    controls.update();
    vrm.update(0);
    applyExtendedWeights(
      vrm.expressionManager,
      inputs.map(({ name, input }) => ({ name, weight: Number(input.value) })),
    );
    renderer.render(scene, camera);
  });
  return () => {
    renderer.setAnimationLoop(null);
    observer.disconnect();
    reset.removeEventListener('click', resetValues);
    for (const { row } of inputs) row.remove();
    note.remove();
    controls.dispose();
    VRMUtils.deepDispose(vrm.scene);
    renderer.dispose();
    renderer.domElement.remove();
  };
}
