import tailwindcss from '@tailwindcss/vite';
import {defineConfig } from 'vite';

/** @type {import('vite').UserConfig} */
export default defineConfig({
  server: {
    host: true
  },
  plugins: [
    tailwindcss()
  ]
});