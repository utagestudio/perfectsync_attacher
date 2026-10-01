import { defineConfig } from 'vite';
export default defineConfig({
  server: {
    host: '127.0.0.1',
    fs: { deny: ['.env', '.env.*', '*.pem', '*.crt', '**/_local/**', '**/.git/**'] },
  },
  build: { target: 'es2022' },
});
