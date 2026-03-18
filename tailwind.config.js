/** @type {import('tailwindcss').Config} */
export default {
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}",
  ],
  theme: {
    extend: {
      colors: {
        // تعريف ألوان الهوية الخاصة بك
        'nmat-bg': '#F7F8F9',    // الخلفية العاجية
        'nmat-text': '#429163',  // النص الأخضر
      },
    },
  },
  plugins: [],
}
