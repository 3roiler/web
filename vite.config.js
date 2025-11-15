import tailwindcss from '@tailwindcss/vite';
import react from '@vitejs/plugin-react';
import { defineConfig } from 'vite';

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