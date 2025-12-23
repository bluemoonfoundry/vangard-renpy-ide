/** @type {import('tailwindcss').Config} */
export default {
  content: [
    "./index.html",
    "./{App,components,hooks}/**/*.{js,ts,jsx,tsx}",
  ],
  darkMode: 'class',
  theme: {
    extend: {},
  },
  plugins: [],
}
