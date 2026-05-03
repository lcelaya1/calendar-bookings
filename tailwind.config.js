/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{js,jsx}'],
  theme: {
    extend: {
      fontFamily: {
        sans: ['Rubik', 'ui-sans-serif', 'system-ui', 'sans-serif'],
      },
      colors: {
        gray: {
          900: '#132741',
          800: '#1e3a5a',
        },
      },
    },
  },
  plugins: [],
}

