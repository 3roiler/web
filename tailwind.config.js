/** @type {import('tailwindcss').Config} */
export default {
  content: [
    './index.html',
    './impressum.html',
    './datenschutz.html',
    './src/**/*.{js,jsx,ts,tsx}',
    './public/includes/**/*.html'
  ],
  theme: {
    extend: {
      fontFamily: {
        sans: ['Space Grotesk', 'system-ui', '-apple-system', 'BlinkMacSystemFont', 'Segoe UI', 'sans-serif'],
      },
      colors: {
        brand: {
          DEFAULT: '#14b8a6',
          light: '#22d3ee',
          dark: '#0f766e',
        },
      },
    },
  },
  plugins: [],
};
