/** @type {import('tailwindcss').Config} */
import { createRequire } from 'module'
const require = createRequire(import.meta.url)
const defaultColors = require('tailwindcss/colors')

export default {
  content: ['./index.html', './src/**/*.{js,jsx}'],
  theme: {
    colors: {
      ...defaultColors,
      gray: {
        ...defaultColors.gray,
        900: '#132741',
        800: '#1e3a5a',
      },
      indigo: {
        50:  '#effeff',
        100: '#d0faff',
        200: '#a5f4ff',
        300: '#6af9ff',
        400: '#22e0f0',
        500: '#00c4d8',
        600: '#0099b0',
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
