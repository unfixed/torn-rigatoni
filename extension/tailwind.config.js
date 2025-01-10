/** @type {import('tailwindcss').Config} */
module.exports = {
  content: [
    "./pages/**/*.{html,js}"
  ],
  safelist: [
    ...[...Array(110).keys()].flatMap(i => [`order-[${i}]`, `-order-[${999-i}]`])
  ],
  theme: {
    extend: {},
  },
  plugins: [],
}

