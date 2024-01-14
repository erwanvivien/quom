import { sveltekit } from '@sveltejs/kit/vite';
import { defineConfig } from 'vite';

export default defineConfig(({ mode }) => ({
  plugins: [sveltekit()],
  esbuild: {
    pure: mode === 'production' ? ['console.log', 'console.info'] : []
  }
}));
