import type { Config } from 'tailwindcss'

const config: Config = {
  darkMode: ['class', '[data-theme="night"]'],
  content: ['./app/**/*.{ts,tsx}', './components/**/*.{ts,tsx}', './lib/**/*.{ts,tsx}'],
  theme: {
    extend: {
      colors: {
        canvas: 'rgb(var(--canvas) / <alpha-value>)',
        surface: 'rgb(var(--surface) / <alpha-value>)',
        'surface-2': 'rgb(var(--surface-2) / <alpha-value>)',
        ink: 'rgb(var(--ink) / <alpha-value>)',
        'ink-2': 'rgb(var(--ink-2) / <alpha-value>)',
        'ink-3': 'rgb(var(--ink-3) / <alpha-value>)',
        line: 'rgb(var(--line) / <alpha-value>)',
        'line-strong': 'rgb(var(--line-strong) / <alpha-value>)',
        accent: 'rgb(var(--accent) / <alpha-value>)',
        'accent-ink': 'rgb(var(--accent-ink) / <alpha-value>)',
        secondary: 'rgb(var(--secondary) / <alpha-value>)',
        'secondary-ink': 'rgb(var(--secondary-ink) / <alpha-value>)',
        terracotta: '#C8552F',
        saffron: '#E9A23B',
        sage: '#7A9E7E',
        plum: '#4A2C4F',
        cream: '#FAF4EA',
        espresso: '#2A1F1A',
        danger: 'rgb(var(--danger) / <alpha-value>)',
      },
      fontFamily: {
        display: ['var(--font-display)', 'Georgia', 'serif'],
        sans: ['var(--font-sans)', 'system-ui', 'sans-serif'],
      },
      borderRadius: {
        card: '20px',
        sheet: '28px',
        pill: '999px',
      },
      boxShadow: {
        card: '0 1px 2px rgb(42 31 26 / 0.04), 0 8px 24px -12px rgb(42 31 26 / 0.18)',
        float: '0 12px 40px -12px rgb(42 31 26 / 0.35)',
        glass: '0 1px 0 rgb(255 255 255 / 0.25) inset, 0 10px 30px -10px rgb(42 31 26 / 0.3)',
      },
      fontSize: {
        'fluid-xl': 'clamp(1.75rem, 1.2rem + 2.2vw, 2.75rem)',
        'fluid-2xl': 'clamp(2.25rem, 1.5rem + 3.5vw, 4rem)',
        'fluid-step': 'clamp(1.75rem, 1.25rem + 2vw, 2.5rem)',
      },
      transitionTimingFunction: {
        out: 'cubic-bezier(0.22, 1, 0.36, 1)',
      },
    },
  },
  plugins: [require('@tailwindcss/typography')],
}
export default config
