/** @type {import('tailwindcss').Config} */
export default {
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}",
  ],
  darkMode: 'class',
  theme: {
    extend: {
      fontFamily: {
        sans: ['"Plus Jakarta Sans"', 'Inter', '-apple-system', 'BlinkMacSystemFont', 'sans-serif'],
      },
      colors: {
        brand: {
          50: '#F0F9FF',
          100: '#E0F2FE',
          200: '#BAE6FD',
          300: '#7DD3FC',
          400: '#38BDF8',
          500: '#0EA5E9',
          600: '#0284C7',
          700: '#0369A1',
          800: '#075985',
          900: '#0C4A6E',
          950: '#082F49',
        },
        medcy: {
          ice: '#0284C7',
          'ice-dark': '#0369A1',
          'ice-light': '#F0F9FF',
          purple: '#0284C7',
          'purple-dark': '#0369A1',
          'purple-light': '#F0F9FF',
          navy: '#0F172A',
        },
      },
      boxShadow: {
        'subtle': '0 1px 2px 0 rgba(0, 0, 0, 0.03)',
        'card': '0 1px 3px 0 rgba(0, 0, 0, 0.04), 0 1px 2px -1px rgba(0, 0, 0, 0.04)',
        'card-hover': '0 12px 28px -6px rgba(15, 23, 42, 0.08), 0 4px 10px -4px rgba(15, 23, 42, 0.03)',
        'glow-brand': '0 8px 24px -4px rgba(2, 132, 199, 0.25)',
        'glow-rose': '0 8px 24px -4px rgba(244, 63, 94, 0.25)',
        'glow-amber': '0 8px 24px -4px rgba(245, 158, 11, 0.25)',
        'drawer': '-10px 0 40px rgba(15, 23, 42, 0.12)',
      },
    },
  },
  plugins: [],
};
