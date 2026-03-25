/** @type {import('tailwindcss').Config} */
module.exports = {
  content: [
    './App.tsx',
    './screens/**/*.{ts,tsx}',
    './components/**/*.{ts,tsx}',
  ],
  presets: [require('nativewind/preset')],
  theme: {
    extend: {
      colors: {
        // Solana brand palette
        'sol-purple': '#9945FF',
        'sol-green': '#14F195',
        'sol-bg': '#0A0A1A',
        'sol-card': '#1A1A2E',
        'sol-border': '#252547',
        'sol-text': '#FFFFFF',
        'sol-muted': '#888',
      },
    },
  },
  plugins: [],
};
