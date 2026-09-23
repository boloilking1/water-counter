/** @type {import('tailwindcss').Config} */
export default {
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}",
  ],
  theme: {
    extend: {
      colors: {
        airbnb: {
          bg: '#F7F7F6',
          card: '#FFFFFF',
          dark: '#222222',
          muted: '#717171',
          accent: '#008489',
        },
      },
      borderRadius: {
        'airbnb': '1.75rem',
      },
      boxShadow: {
        'airbnb': '0 8px 30px rgba(0,0,0,0.06)',
      },
    },
  },
  plugins: [],
};