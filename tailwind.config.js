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
        indigo: {
          50:  '#effeff',   // very light tint — hover backgrounds
          100: '#d0faff',   // light tint — badges, chips
          200: '#a5f4ff',   // soft — borders on hover
          300: '#6af9ff',   // #6AFAFF — the brand accent itself
          400: '#22e0f0',   // medium — focus rings, icons
          500: '#00c4d8',   // stronger — secondary buttons
          600: '#0099b0',   // dark enough for white text — primary buttons, active nav
          700: '#007a8e',   // darker — hover on buttons
          800: '#005e6e',   // very dark — rare use
          900: '#003e4a',   // deepest
        },
      },
    },
  },
  plugins: [],
}

