
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
      // Hardcoded Neon DB URL as requested for immediate connection
      'process.env.DATABASE_URL': JSON.stringify("postgresql://neondb_owner:npg_8gtkumX3BAex@ep-raspy-salad-aiz5pncb-pooler.c-4.us-east-1.aws.neon.tech/neondb?sslmode=require"),
      
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
