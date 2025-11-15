import tailwindcss from '@tailwindcss/vite';
import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

/** @type {import('vite').UserConfig} */
export default defineConfig({
  server: {
    host: true
  },
  plugins: [
    react(),
    tailwindcss()
  ]
});