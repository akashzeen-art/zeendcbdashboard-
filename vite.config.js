import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

export default defineConfig({
  plugins: [react()],
  server: {
    proxy: {
      '/vaspay': {
        target: 'https://wap.zeendcb.com',
        changeOrigin: true,
        secure: false,
        rewrite: (path) => path,
      },
      '/postbacks': {
        target: 'https://postback.v1mobi.com',
        changeOrigin: true,
        secure: false,
      },
      '/optimize': {
        target: 'https://postback.v1mobi.com',
        changeOrigin: true,
        secure: false,
      },
    },
  },
});
