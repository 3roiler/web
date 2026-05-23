import tailwindcss from '@tailwindcss/vite';
import react from '@vitejs/plugin-react';
import { defineConfig } from 'vite';

/** @type {import('vite').UserConfig} */
export default defineConfig({
  server: {
    host: true
  },
  build: {
    // Default 500 kB triggert auf BlogEdit (905 kB, lazy-loaded ausschließlich
    // für Blog-Autoren via React.lazy) und StlViewer (544 kB, lazy-loaded
    // ausschließlich für STL-Viewer). Beide Chunks sind ihren Preis wert,
    // werden aber nie auf der Public-Hauptseite gezogen. Limit auf 1 MB
    // hebt die Warning für die bekannten großen Lazy-Routes, lässt aber
    // den Initial-Bundle (~440 kB) weiterhin gewarnt werden, falls da
    // jemand aus Versehen `@uiw/react-md-editor` ohne lazy importiert.
    chunkSizeWarningLimit: 1024
  },
  plugins: [
    react(),
    tailwindcss()
  ]
});