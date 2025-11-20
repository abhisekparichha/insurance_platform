import type { Config } from 'tailwindcss';

const config: Config = {
  content: ['index.html', './src/**/*.{ts,tsx}'],
  theme: {
    extend: {
      colors: {
        brand: {
          DEFAULT: '#1d4ed8',
          dark: '#1e40af',
          light: '#60a5fa'
        }
      },
      boxShadow: {
        card: '0 10px 40px -20px rgba(15, 23, 42, 0.4)'
      }
    }
  },
  plugins: []
};

export default config;
