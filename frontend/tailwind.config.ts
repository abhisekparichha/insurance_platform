import type { Config } from 'tailwindcss';

const config: Config = {
  content: ['index.html', './src/**/*.{ts,tsx}'],
  theme: {
    extend: {
      colors: {
        brand: {
          DEFAULT: '#1d4ed8',
          dark: '#1e40af',
          light: '#60a5fa',
        },
        paper: {
          DEFAULT: 'var(--bg-page)',
          surface: 'var(--bg-surface)',
          raised: 'var(--bg-surface-raised)',
        },
        navy: {
          900: 'var(--bg-navy)',
          800: 'var(--bg-navy-soft)',
        },
        ink: {
          900: 'var(--text-base)',
          600: 'var(--text-muted)',
          400: 'var(--text-faint)',
          on: 'var(--text-on-navy)',
          onmuted: 'var(--text-on-navy-muted)',
        },
        gold: {
          DEFAULT: 'var(--accent)',
          soft: 'var(--accent-soft)',
          dark: 'var(--accent-text)',
        },
        border: {
          paper: 'var(--border)',
          strong: 'var(--border-strong)',
        },
      },
      fontFamily: {
        serif: ['var(--font-display)', 'Georgia', 'serif'],
        data: ['var(--font-mono)', '"Fira Code"', 'monospace'],
      },
      boxShadow: {
        card: '0 10px 40px -20px rgba(15, 23, 42, 0.4)',
        'card-gold': '0 8px 32px -12px rgba(196, 154, 34, 0.3)',
        'card-navy': '0 8px 32px -12px rgba(12, 35, 64, 0.25)',
      },
      keyframes: {
        'meter-fill': {
          from: { width: '0%' },
          to: { width: 'var(--meter-width)' },
        },
        'slide-up': {
          from: { transform: 'translateY(100%)', opacity: '0' },
          to: { transform: 'translateY(0)', opacity: '1' },
        },
      },
      animation: {
        'meter-fill': 'meter-fill 0.8s ease-out forwards',
        'slide-up': 'slide-up 0.3s ease-out',
      },
    },
  },
  plugins: [],
};

export default config;
