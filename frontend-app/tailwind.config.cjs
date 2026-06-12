const defaultTheme = require('tailwindcss/defaultTheme');

/** @type {import('tailwindcss').Config} */
module.exports = {
  darkMode: ['class'],
  content: [
    './index.html',
    './App.{ts,tsx}',
    './components/**/*.{ts,tsx}',
    './hooks/**/*.{ts,tsx}',
    './lib/**/*.{ts,tsx}',
    './constants.{ts,tsx}',
    './index.{ts,tsx}'
  ],
  theme: {
    extend: {
      fontFamily: {
        sans: ['Inter', ...defaultTheme.fontFamily.sans],
        mono: ['JetBrains Mono', ...defaultTheme.fontFamily.mono]
      },
      borderRadius: {
        lg: 'var(--radius)',
        md: 'calc(var(--radius) - 2px)',
        sm: 'calc(var(--radius) - 4px)'
      },
      colors: {
        'coral-glow': {
          50: '#ffebe5',
          100: '#ffd7cc',
          200: '#ffaf99',
          300: '#ff8766',
          400: '#ff5f33',
          500: '#ff3700',
          600: '#cc2c00',
          700: '#992100',
          800: '#661600',
          900: '#330b00',
          950: '#240800'
        },
        'light-gold': {
          50: '#fbfaea',
          100: '#f7f5d4',
          200: '#efeaa9',
          300: '#e7e07e',
          400: '#ded554',
          500: '#d6cb29',
          600: '#aba221',
          700: '#817a18',
          800: '#565110',
          900: '#2b2908',
          950: '#1e1c06'
        },
        'moss-green': {
          50: '#edf8ed',
          100: '#daf1dc',
          200: '#b5e3b8',
          300: '#90d595',
          400: '#6bc771',
          500: '#46b94e',
          600: '#38943e',
          700: '#2a6f2f',
          800: '#1c4a1f',
          900: '#0e2510',
          950: '#0a1a0b'
        },
        turquoise: {
          50: '#e9fbfa',
          100: '#d4f7f5',
          200: '#a9efec',
          300: '#7ee7e2',
          400: '#53dfd8',
          500: '#28d7cf',
          600: '#20aca5',
          700: '#18817c',
          800: '#105653',
          900: '#082b29',
          950: '#061e1d'
        },
        'neon-ice': {
          50: '#e5fffe',
          100: '#ccfffd',
          200: '#99fffc',
          300: '#66fffa',
          400: '#33fff8',
          500: '#00fff7',
          600: '#00ccc5',
          700: '#009994',
          800: '#006663',
          900: '#003331',
          950: '#002423'
        },
        border: 'hsl(var(--border))',
        input: 'hsl(var(--input))',
        ring: 'hsl(var(--ring))',
        background: 'hsl(var(--background))',
        foreground: 'hsl(var(--foreground))',
        primary: {
          DEFAULT: 'hsl(var(--primary))',
          foreground: 'hsl(var(--primary-foreground))'
        },
        secondary: {
          DEFAULT: 'hsl(var(--secondary))',
          foreground: 'hsl(var(--secondary-foreground))'
        },
        muted: {
          DEFAULT: 'hsl(var(--muted))',
          foreground: 'hsl(var(--muted-foreground))'
        },
        accent: {
          DEFAULT: 'hsl(var(--accent))',
          foreground: 'hsl(var(--accent-foreground))'
        },
        destructive: {
          DEFAULT: 'hsl(var(--destructive))',
          foreground: 'hsl(var(--destructive-foreground))'
        },
        card: {
          DEFAULT: 'hsl(var(--card))',
          foreground: 'hsl(var(--card-foreground))'
        },
        popover: {
          DEFAULT: 'hsl(var(--popover))',
          foreground: 'hsl(var(--popover-foreground))'
        }
      }
    }
  },
  plugins: [
    require('tailwindcss-animate'),
    require('@tailwindcss/typography')
  ]
};
