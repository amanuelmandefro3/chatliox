/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{js,jsx,ts,tsx}'],
  theme: {
    extend: {
      fontFamily: {
        display: ['"Bricolage Grotesque"', 'system-ui', 'sans-serif'],
      },
      colors: {
        brand: {
          50:  '#f0f4ff',
          100: '#dde6ff',
          400: '#6f88fa',
          500: '#4f6ef7',
          600: '#3b55e8',
          700: '#2e44cc',
        },
      },
    },
  },
  plugins: [],
}
