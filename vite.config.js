import { defineConfig } from 'vite';
import { readFileSync } from 'node:fs';
export default defineConfig({
  plugins: [
    {
      name: 'project-license',
      configureServer(server) {
        server.middlewares.use((req, res, next) => {
          const files = {
            '/LICENSE.txt': ['./LICENSE'],
            '/VITE-LICENSE.txt': ['./node_modules/vite/LICENSE.md'],
            '/THIRD-PARTY-LICENSES.txt': [
              './node_modules/@pixiv/three-vrm/LICENSE',
              './node_modules/three/LICENSE',
            ],
          };
          const paths = files[req.url?.split('?')[0]];
          if (!paths) return next();
          res.setHeader('Content-Type', 'text/plain; charset=utf-8');
          res.end(
            paths.map((path) => readFileSync(new URL(path, import.meta.url), 'utf8')).join('\n\n'),
          );
        });
      },
      generateBundle() {
        this.emitFile({
          type: 'asset',
          fileName: 'VITE-LICENSE.txt',
          source: readFileSync(new URL('./node_modules/vite/LICENSE.md', import.meta.url), 'utf8'),
        });
        this.emitFile({
          type: 'asset',
          fileName: 'LICENSE.txt',
          source: readFileSync(new URL('./LICENSE', import.meta.url), 'utf8'),
        });
      },
    },
  ],
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
    fs: {
      deny: [
        '.env',
        '.env.*',
        '*.pem',
        '*.crt',
        '*.key',
        '*.p12',
        '*.pfx',
        '**/_local/**',
        '**/.git/**',
      ],
    },
  },
  preview: { host: '127.0.0.1' },
  build: { target: 'es2022', license: { fileName: 'THIRD-PARTY-LICENSES.txt' } },
});
