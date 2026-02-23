import type { Config } from 'tailwindcss';

const config: Config = {
  content: [
    './src/pages/**/*.{js,ts,jsx,tsx,mdx}',
    './src/components/**/*.{js,ts,jsx,tsx,mdx}',
    './src/app/**/*.{js,ts,jsx,tsx,mdx}',
  ],
  theme: {
    extend: {
      colors: {
        background: 'rgb(var(--color-background) / <alpha-value>)',
        card: 'rgb(var(--color-card) / <alpha-value>)',
        elevated: 'rgb(var(--color-elevated) / <alpha-value>)',
        border: 'rgb(var(--color-border) / <alpha-value>)',
        'border-hover': 'rgb(var(--color-border-hover) / <alpha-value>)',
        primary: 'rgb(var(--color-primary) / <alpha-value>)',
        secondary: 'rgb(var(--color-secondary) / <alpha-value>)',
        muted: 'rgb(var(--color-muted) / <alpha-value>)',
        teal: 'rgb(var(--color-teal) / <alpha-value>)',
        amber: 'rgb(var(--color-amber) / <alpha-value>)',
        danger: 'rgb(var(--color-danger) / <alpha-value>)',
        blue: 'rgb(var(--color-blue) / <alpha-value>)',
        purple: 'rgb(var(--color-purple) / <alpha-value>)',
        emerald: 'rgb(var(--color-emerald) / <alpha-value>)',
        pink: 'rgb(var(--color-pink) / <alpha-value>)',
        green: 'rgb(var(--color-green) / <alpha-value>)',
      },
      fontFamily: {
        sans: ['Satoshi', 'system-ui', 'sans-serif'],
      },
      fontSize: {
        'display': ['2rem', { lineHeight: '1.2' }],
        'title': ['1.5rem', { lineHeight: '1.3' }],
        'body': ['0.9375rem', { lineHeight: '1.5' }],
        'caption': ['0.8125rem', { lineHeight: '1.4' }],
        'micro': ['0.75rem', { lineHeight: '1.3' }],
      },
      spacing: {
        '4.5': '1.125rem',
        '5.5': '1.375rem',
        '7.5': '1.875rem',
        '18': '4.5rem',
      },
      boxShadow: {
        'glow-teal': '0 0 20px rgba(0, 212, 200, 0.15)',
        'glow-amber': '0 0 20px rgba(245, 158, 11, 0.15)',
      },
    },
  },
  plugins: [],
};
export default config;
