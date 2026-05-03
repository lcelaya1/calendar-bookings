/** @type {import('tailwindcss').Config} */
import colors from 'tailwindcss/colors'

export default {
  content: ['./index.html', './src/**/*.{js,jsx}'],
  theme: {
    colors: {
      ...colors,
      gray: {
        ...colors.gray,
        900: '#132741',
        800: '#1e3a5a',
      },
      indigo: {
        50:  '#effeff',
        100: '#d0faff',
        200: '#a5f4ff',
        300: '#6af9ff',   // #6AFAFF — brand accent
        400: '#22e0f0',
        500: '#00c4d8',
        600: '#0099b0',   // primary buttons / active nav
        700: '#007a8e',
        800: '#005e6e',
        900: '#003e4a',
      },
    },
    extend: {
      fontFamily: {
        sans: ['Rubik', 'ui-sans-serif', 'system-ui', 'sans-serif'],
      },
    },
  },
  plugins: [],
}
