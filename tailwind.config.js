/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{js,ts,jsx,tsx}'],
  theme: {
    extend: {
      colors: {
        primary: '#4131e0',
        green: '#00d76f',
        dark: '#191715',
        lightPurple: '#E6E7FF',
      },
    },
  },
  plugins: [],
};
