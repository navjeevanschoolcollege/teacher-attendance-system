/** @type {import('tailwindcss').Config} */
export default {
  content: [
    "./index.html",
    "./src/**/*.{js,jsx}",
  ],
  theme: {
    extend: {
      colors: {
        primary: {
          50: '#eff6ff',
          100: '#dbeafe',
          200: '#bfdbfe',
          300: '#93c5fd',
          400: '#60a5fa',
          500: '#3b82f6',
          600: '#2563eb',
          700: '#1d4ed8',
          800: '#1e40af',
          900: '#1e3a8a',
        },
        present: '#22c55e',
        late: '#f59e0b',
        absent: '#ef4444',
        halfday: '#f97316',
        onleave: '#3b82f6',
        holiday: '#8b5cf6',
      },
    },
  },
  plugins: [],
};
