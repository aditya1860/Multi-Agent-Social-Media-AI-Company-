/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{js,ts,jsx,tsx}'],
  theme: {
    extend: {
      fontFamily: {
        sans: ['Inter', 'system-ui', 'sans-serif'],
      },
      colors: {
        bg: {
          gradientStart: '#6FE0D0',
          gradientEnd: '#FFD9C2',
        },
        primary: {
          DEFAULT: '#1F9E93',
          50: '#E8FAF8',
          100: '#C5F1EC',
          500: '#1F9E93',
          600: '#187E74',
          700: '#115E57',
        },
        accent: {
          DEFAULT: '#FF6F59',
          500: '#FF6F59',
          600: '#E85B46',
        },
        success: '#6FA97D',
        warning: '#E3A857',
        danger: '#E24E4E',
      },
      borderRadius: {
        '2xl': '1rem',
        '3xl': '1.25rem',
        '4xl': '1.75rem',
      },
      boxShadow: {
        card: '0 8px 24px rgba(15, 60, 55, 0.12), 0 2px 6px rgba(15, 60, 55, 0.08)',
        'card-hover': '0 12px 32px rgba(15, 60, 55, 0.18), 0 4px 8px rgba(15, 60, 55, 0.10)',
        clay: 'inset 2px 2px 4px rgba(255,255,255,0.5), inset -2px -2px 6px rgba(0,0,0,0.15), 0 6px 12px rgba(0,0,0,0.15)',
      },
    },
  },
  plugins: [],
};
