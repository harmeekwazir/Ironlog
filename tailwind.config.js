/** @type {import('tailwindcss').Config} */
export default {
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}",
  ],
  theme: {
    extend: {
      colors: {
        iron: {
          50: '#f5f5f5',
          100: '#e8e8e8',
          200: '#d0d0d0',
          300: '#a8a8a8',
          400: '#737373',
          500: '#4a4a4a',
          600: '#333333',
          700: '#222222',
          800: '#161616',
          900: '#0a0a0a',
          950: '#050505',
        },
        volt: {
          300: '#e8ff5a',
          400: '#d4f52a',
          500: '#bde31a',
          600: '#9cbf0f',
        },
        ember: {
          400: '#ff6b35',
          500: '#f54f1a',
        }
      },
      fontFamily: {
        display: ['system-ui', '-apple-system', 'sans-serif'],
        mono: ['JetBrains Mono', 'Fira Code', 'monospace'],
      },
      animation: {
        'pulse-volt': 'pulse-volt 2s ease-in-out infinite',
        'slide-up': 'slide-up 0.3s ease-out',
        'fade-in': 'fade-in 0.2s ease-out',
      },
      keyframes: {
        'pulse-volt': {
          '0%, 100%': { opacity: '1' },
          '50%': { opacity: '0.6' },
        },
        'slide-up': {
          from: { transform: 'translateY(20px)', opacity: '0' },
          to: { transform: 'translateY(0)', opacity: '1' },
        },
        'fade-in': {
          from: { opacity: '0' },
          to: { opacity: '1' },
        },
      },
    },
  },
  plugins: [],
}
