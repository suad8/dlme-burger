/** @type {import('tailwindcss').Config} */
export default {
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}",
  ],
  theme: {
    extend: {
      colors: {
        'nmat-beige': '#F5F5DC', 
        'nmat-black': '#1a1a1a',
      },
    },
  },
  plugins: [],
}
