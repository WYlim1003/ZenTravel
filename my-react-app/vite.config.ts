import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

// https://vite.dev/config/
export default defineConfig({
  plugins: [react()],
  server: {
    proxy: {
      '/ilmu-api': {
        target: 'https://api.ilmu.ai',
        changeOrigin: true,
        secure: false,
        rewrite: (path) => path.replace(/^\/ilmu-api/, ''),
        
        // 🚀 MAXIMUM PATIENCE SETTINGS
        timeout: 120000,      // Wait 120s for the target server to respond
        proxyTimeout: 120000, // Wait 120s for the proxy connection
        
        headers: {
          Connection: 'keep-alive',
        },

        configure: (proxy) => {
          proxy.on('error', (err) => {
            console.log('--- Vite Proxy Error ---', err);
          });
        },
      },
    },
  },
  build: {
    rollupOptions: {
      output: {
        manualChunks(id) {
          if (!id.includes('node_modules')) return;
          if (id.includes('firebase')) return 'vendor-firebase';
          if (id.includes('lucide-react')) return 'vendor-icons';
          if (id.includes('react')) return 'vendor-react';
          return 'vendor';
        },
      },
    },
  },
})