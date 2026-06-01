import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

export default defineConfig({
  plugins: [react()],
  server: {
    proxy: {
      '/vaspay': {
        target: 'https://wap.zeendcb.com',
        changeOrigin: true,
        secure: true,
      },
      '/postbacks': {
        target: 'https://postback.v1mobi.com',
        changeOrigin: true,
        secure: true,
      },
      '/optimize': {
        target: 'https://postback.v1mobi.com',
        changeOrigin: true,
        secure: true,
      },
    },
  },
});
