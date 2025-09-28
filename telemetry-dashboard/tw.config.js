/** @type {import('tailwindcss').Config} */
module.exports = {
  darkMode: 'class',                         // <-- enable dark mode via a .dark class
  content: ["./src/**/*.{html,ts,scss}"],
  theme: {
    extend: {
      colors: {
        brand: {
          50:  '#eef2ff',
          100: '#e0e7ff',
          200: '#c7d2fe',
          300: '#a5b4fc',
          400: '#818cf8',
          500: '#6366f1',   // primary
          600: '#4f46e5',
          700: '#4338ca',
          800: '#3730a3',
          900: '#312e81'
        },
        accent: {
          400: '#fb7185',   // pink/coral accent
          500: '#f43f5e'
        }
      },
      boxShadow: {
        soft: '0 10px 25px -10px rgba(0,0,0,.25)'
      },
      keyframes: {
        pulseDot: { '0%,100%': { opacity: .6 }, '50%': { opacity: 1 } },
        shimmer: {
          '0%': { backgroundPosition: '0% 50%' },
          '100%': { backgroundPosition: '100% 50%' }
        }
      },
      animation: {
        pulseDot: 'pulseDot 1.8s ease-in-out infinite',
        shimmer: 'shimmer 8s ease infinite'
      }
    }
  },
  plugins: [],
};
