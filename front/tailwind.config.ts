import type { Config } from 'tailwindcss';

const config: Config = {
  important: '#root',
  darkMode: 'class',
  content: [
    './index.html',
    './src/**/*.{js,ts,jsx,tsx}',
  ],
  theme: {
    extend: {
      colors: {
        // --- Crumi dashboard palette (existing, do not touch) ---
        crumi: {
          primary: '#1A1D1F',
          'primary-hover': '#111315',
          secondary: '#6366f1',
          accent: '#8B5CF6',
          'accent-hover': '#7C3AED',
          'bg-light': '#F3F5F7',
          'bg-dark': '#111315',
          'surface-light': '#FFFFFF',
          'surface-dark': '#1A1D1F',
          'surface-dark-hover': '#272B30',
          'text-primary': '#1A1D1F',
          'text-muted': '#6F767E',
          'text-dark-primary': '#FCFCFC',
          'text-dark-muted': '#9A9FA5',
          'border-light': '#EFEFEF',
          'border-dark': '#272B30',
          success: '#83BF6E',
          warning: '#FF6A55',
          danger: '#ef4444',
        },
        // --- Bolti landing design tokens ---
        // Patrón shadcn estándar: CSS vars con canales HSL bare y
        // `hsl(var(--x) / <alpha-value>)` para modificadores de opacidad.
        brand: 'hsl(var(--brand) / <alpha-value>)',
        'brand-foreground': 'hsl(var(--brand-foreground) / <alpha-value>)',
        ink: 'hsl(var(--ink) / <alpha-value>)',
        'ink-foreground': 'hsl(var(--ink-foreground) / <alpha-value>)',
        cream: 'hsl(var(--cream) / <alpha-value>)',
        mint: 'hsl(var(--mint) / <alpha-value>)',
        lilac: 'hsl(var(--lilac) / <alpha-value>)',
        peach: 'hsl(var(--peach) / <alpha-value>)',
        foreground: 'hsl(var(--foreground) / <alpha-value>)',
        background: 'hsl(var(--background) / <alpha-value>)',
        card: 'hsl(var(--card) / <alpha-value>)',
        'card-foreground': 'hsl(var(--card-foreground) / <alpha-value>)',
        muted: 'hsl(var(--muted) / <alpha-value>)',
        'muted-foreground': 'hsl(var(--muted-foreground) / <alpha-value>)',
        border: 'hsl(var(--border) / <alpha-value>)',
        success: {
          DEFAULT: 'hsl(var(--success) / <alpha-value>)',
          foreground: 'hsl(var(--success-foreground) / <alpha-value>)',
        },
      },
      fontFamily: {
        sans: ['Inter', '-apple-system', 'BlinkMacSystemFont', 'Segoe UI', 'Roboto', 'sans-serif'],
        display: ['Inter', '-apple-system', 'BlinkMacSystemFont', 'sans-serif'],
      },
      borderRadius: {
        'crumi': '12px',
        'crumi-lg': '24px',
        'crumi-xl': '32px',
      },
      spacing: {
        'sidebar': '80px',
        'header': '64px',
      },
      boxShadow: {
        'crumi': '0 0 0 0 transparent',
        'crumi-card': '0px 2px 8px rgba(0, 0, 0, 0.04), 0px 0px 1px rgba(0, 0, 0, 0.06)',
        'crumi-lg': '0px 8px 24px rgba(0, 0, 0, 0.06)',
        'crumi-xl': '0px 16px 48px rgba(0, 0, 0, 0.08)',
      },
      animation: {
        'pulse-slow': 'pulse 3s cubic-bezier(0.4, 0, 0.6, 1) infinite',
        'typing': 'typing 1.4s infinite',
        'slide-in': 'slideIn 0.25s ease-out',
      },
      keyframes: {
        typing: {
          '0%, 60%, 100%': { opacity: '0.3' },
          '30%': { opacity: '1' },
        },
        slideIn: {
          '0%': { transform: 'translateX(-100%)', opacity: '0' },
          '100%': { transform: 'translateX(0)', opacity: '1' },
        },
      },
    },
  },
  plugins: [],
};

export default config;
