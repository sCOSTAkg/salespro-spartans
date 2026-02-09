import { defineConfig, loadEnv } from 'vite';
import react from '@vitejs/plugin-react';

export default defineConfig(({ mode }) => {
  // Load env variables
  const env = loadEnv(mode, '.', '');

  return {
    plugins: [react()],
    define: {
      // Map environment variables
      'process.env.API_KEY': JSON.stringify(env.API_KEY),
      // Use environment variable for database URL — never hardcode credentials!
      'process.env.DATABASE_URL': JSON.stringify(env.DATABASE_URL || ''),
      // Fallback object for other process.env calls
      'process.env': {}
    },
    build: {
      outDir: 'dist',
      sourcemap: false
    },
    server: {
      host: true
    }
  };
});
