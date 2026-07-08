import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

// https://vitejs.dev/config/
export default defineConfig({
  plugins: [react()],
  optimizeDeps: {
    exclude: ['lucide-react'],
  },
  server: {
    proxy: {
      '/api': {
        target: 'http://localhost:3001',
        changeOrigin: true,
        secure: false,
      },
      '/neon-auth': {
        target: 'https://ep-polished-wind-aog2h8wx.neonauth.c-2.ap-southeast-1.aws.neon.tech/neondb/auth',
        changeOrigin: true,
        secure: true,
        rewrite: (path) => path.replace(/^\/neon-auth/, ''),
        configure: (proxy) => {
          proxy.on('proxyReq', (proxyReq) => {
            // Keep original origin, but some APIs block custom origins.
            // changeOrigin: true will set the Host header of request to target.
            // If the target server verifies Origin, we might need to delete or rewrite it:
            proxyReq.setHeader('origin', 'https://ep-polished-wind-aog2h8wx.neonauth.c-2.ap-southeast-1.aws.neon.tech');
          });
        }
      },
    },
  },
});
