/** @type {import('tailwindcss').Config} */
module.exports = {
  content: [
    "./src/**/*.{html,ts}",
  ],
  theme: {
    extend: {
      fontFamily: {
        sans: ['Inter', 'ui-sans-serif', 'system-ui', 'sans-serif'],
      },
      colors: {
        canvas: '#f2f3fc',
        surface: '#ffffff',
        brand: {
          50: '#eef2ff',
          100: '#e0e7ff',
          200: '#c7d2fe',
          300: '#a5b4fc',
          400: '#818cf8',
          500: '#6366f1',
          600: '#4f46e5',
          700: '#4338ca',
          800: '#3730a3',
          900: '#312e81',
          950: '#1e1b4b',
        },
        success: {
          DEFAULT: '#15803D',
          bg: '#F0FDF4',
          100: '#DCFCE7',
        },
        warning: {
          DEFAULT: '#D97706',
          text: '#B45309',
          bg: '#FFFBEB',
          100: '#FEF3C7',
        },
        danger: {
          DEFAULT: '#DC2626',
          text: '#B91C1C',
          bg: '#FEF2F2',
          100: '#FEE2E2',
        },
        info: {
          DEFAULT: '#2563EB',
          bg: '#EFF6FF',
          100: '#DBEAFE',
        },
      },
      borderRadius: {
        '2xl': '1rem',
        '3xl': '1.5rem',
      },
      boxShadow: {
        card: '0 1px 3px 0 rgba(79, 70, 229, 0.05), 0 1px 2px -1px rgba(79, 70, 229, 0.05)',
        brand: '0 8px 24px -8px rgba(79, 70, 229, 0.35)',
        raised: '0 4px 12px -2px rgba(79, 70, 229, 0.12)',
        pop: '0 12px 32px -4px rgba(79, 70, 229, 0.25)',
      },
      keyframes: {
        pulseRing: {
          '0%': { transform: 'scale(1)', opacity: '0.45' },
          '100%': { transform: 'scale(1.6)', opacity: '0' },
        },
      },
      animation: {
        'pulse-ring': 'pulseRing 2s cubic-bezier(0.23, 1, 0.32, 1) infinite',
      },
    },
  },
  plugins: [],
}
