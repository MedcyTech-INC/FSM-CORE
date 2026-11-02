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
          50: '#f5f3ff',
          100: '#ede9fe',
          200: '#ddd6fe',
          300: '#c4b5fd',
          400: '#a78bfa',
          500: '#8b5cf6',
          600: '#6B52B6',
          700: '#5B42A4',
          800: '#4c358a',
          900: '#3b296a',
          950: '#231842',
        },
        medcy: {
          purple: '#6B52B6',
          'purple-dark': '#5B42A4',
          'purple-light': '#F5F3FF',
          navy: '#0F172A',
        },
      },
      boxShadow: {
        'subtle': '0 1px 2px 0 rgba(0, 0, 0, 0.03)',
        'card': '0 1px 3px 0 rgba(0, 0, 0, 0.04), 0 1px 2px -1px rgba(0, 0, 0, 0.04)',
        'card-hover': '0 12px 28px -6px rgba(15, 23, 42, 0.08), 0 4px 10px -4px rgba(15, 23, 42, 0.03)',
        'glow-brand': '0 8px 24px -4px rgba(107, 82, 182, 0.25)',
        'glow-rose': '0 8px 24px -4px rgba(244, 63, 94, 0.25)',
        'glow-amber': '0 8px 24px -4px rgba(245, 158, 11, 0.25)',
        'drawer': '-10px 0 40px rgba(15, 23, 42, 0.12)',
      },
    },
  },
  plugins: [],
};
