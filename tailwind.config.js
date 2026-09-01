/** @type {import('tailwindcss').Config} */
export default {
  darkMode: 'class',
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}",
  ],
  theme: {
    extend: {
      colors: {
        primary: {
          DEFAULT: '#10B981', // Vivid soft mint / emerald
          dark: '#059669',
          light: '#ECFDF5',
          accent: '#34D399',
          glow: '#6EE7B7',
        },
        mint: {
          50: '#F0FDF4',
          100: '#DCFCE7',
          200: '#BBF7D0',
          300: '#86EFAC',
          400: '#4ADE80',
          500: '#22C55E',
          600: '#16A34A',
          700: '#15803D',
          800: '#166534',
          900: '#14532D',
          950: '#052E16',
        },
        dark: {
          bg: '#080C0E',
          surface: '#0F171B',
          card: '#152126',
          elevated: '#1D2D34',
          border: '#243942',
        },
        excel: {
          DEFAULT: '#107C41',
          light: '#E6F4EA',
          dark: '#0C5E31',
        },
        pdf: {
          DEFAULT: '#E11D48',
          light: '#FFE4E6',
          dark: '#BE123C',
        },
        surface: {
          DEFAULT: '#F4FBF7',
          card: '#FFFFFF',
        }
      },
      fontFamily: {
        sans: ['Roboto', 'system-ui', 'sans-serif'],
        mono: ['"JetBrains Mono"', 'monospace'],
      }
    },
  },
  plugins: [],
}
