import { defineConfig } from 'vite';
export default defineConfig({
  optimizeDeps: {
    include: [
      'three',
      'three/addons/loaders/GLTFLoader.js',
      'three/addons/controls/OrbitControls.js',
      '@pixiv/three-vrm',
    ],
  },
  server: {
    host: '127.0.0.1',
    fs: { deny: ['.env', '.env.*', '*.pem', '*.crt', '**/_local/**', '**/.git/**'] },
  },
  build: { target: 'es2022' },
});
