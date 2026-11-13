import type { Config } from 'tailwindcss';
import plugin from 'tailwindcss/plugin';

/**
 * MedMap design tokens. This file is the single source for colour, type, spacing, radius
 * and shadow. Components use the semantic names (bg-surface, text-muted,
 * text-severity-serious); raw hex values appear only here. See docs/DESIGN.md.
 */

type Palette = Record<string, string>;

const light: Palette = {
  surface: '#F3F6F5',
  'surface-raised': '#FFFFFF',
  'surface-sunken': '#E6ECEA',
  text: '#14262B',
  'text-muted': '#465A5F',
  border: '#C3CFCC',
  'border-strong': '#6F8380',
  primary: '#0E5A63',
  'primary-hover': '#0A464D',
  'primary-soft': '#DCECEC',
  'on-primary': '#FFFFFF',
  accent: '#E3A02B',
  'accent-soft': '#FBEFD2',
  'accent-ink': '#4F3600',
  focus: '#0B57D0',
  danger: '#A62B0B',
  'danger-soft': '#FCE9E2',
  'severity-serious': '#A62B0B',
  'severity-serious-soft': '#FCE9E2',
  'severity-moderate': '#735000',
  'severity-moderate-soft': '#FBF0D3',
  'severity-minor': '#1D5A9E',
  'severity-minor-soft': '#E4EEFA',
  unchecked: '#465A5F',
  'unchecked-soft': '#E6ECEA',
  demo: '#3B2A6B',
  'on-demo': '#FFFFFF',
};

const dark: Palette = {
  surface: '#0F1B1E',
  'surface-raised': '#17272B',
  'surface-sunken': '#0A1416',
  text: '#E6EFED',
  'text-muted': '#A6B8B5',
  border: '#2C4045',
  'border-strong': '#6B8786',
  primary: '#5CC4CB',
  'primary-hover': '#7AD3D9',
  'primary-soft': '#143438',
  'on-primary': '#062426',
  accent: '#E9B24C',
  'accent-soft': '#33270A',
  'accent-ink': '#F6DFA8',
  focus: '#8AB4FF',
  danger: '#FF9B7A',
  'danger-soft': '#3A1A10',
  'severity-serious': '#FF9B7A',
  'severity-serious-soft': '#3A1A10',
  'severity-moderate': '#F1C35B',
  'severity-moderate-soft': '#33270A',
  'severity-minor': '#8DBBF2',
  'severity-minor-soft': '#10243C',
  unchecked: '#A6B8B5',
  'unchecked-soft': '#17272B',
  demo: '#CDBDFF',
  'on-demo': '#1B1140',
};

const highContrast: Palette = {
  ...light,
  surface: '#FFFFFF',
  'surface-sunken': '#FFFFFF',
  text: '#000000',
  'text-muted': '#1A1A1A',
  border: '#000000',
  'border-strong': '#000000',
  primary: '#00363C',
  'primary-hover': '#000000',
  focus: '#0000C8',
  danger: '#7A1500',
  'severity-serious': '#7A1500',
  'severity-moderate': '#4A3300',
  'severity-minor': '#0B3A75',
  unchecked: '#000000',
  demo: '#000000',
};

function variables(palette: Palette): Record<string, string> {
  return Object.fromEntries(
    Object.entries(palette).map(([name, value]) => [`--mm-${name}`, value]),
  );
}

const colors = Object.fromEntries(Object.keys(light).map((name) => [name, `var(--mm-${name})`]));

const config: Config = {
  content: ['./index.html', './src/**/*.{ts,tsx}'],
  theme: {
    screens: { sm: '480px', md: '768px', lg: '1024px', xl: '1440px' },
    colors: { transparent: 'transparent', current: 'currentColor', ...colors },
    fontFamily: {
      sans: [
        '"Atkinson Hyperlegible Next Variable"',
        'system-ui',
        'Segoe UI',
        'Arial',
        'sans-serif',
      ],
    },
    fontSize: {
      xs: ['0.8125rem', { lineHeight: '1.25rem' }],
      sm: ['0.9375rem', { lineHeight: '1.4rem' }],
      base: ['1.0625rem', { lineHeight: '1.6rem' }],
      lg: ['1.25rem', { lineHeight: '1.75rem' }],
      xl: ['1.5rem', { lineHeight: '2rem' }],
      '2xl': ['1.875rem', { lineHeight: '2.3rem', letterSpacing: '-0.01em' }],
      '3xl': ['2.375rem', { lineHeight: '2.7rem', letterSpacing: '-0.02em' }],
      '4xl': ['3rem', { lineHeight: '3.2rem', letterSpacing: '-0.025em' }],
      '5xl': ['3.75rem', { lineHeight: '3.85rem', letterSpacing: '-0.03em' }],
    },
    borderRadius: { none: '0', sm: '4px', md: '8px', lg: '14px', full: '9999px' },
    boxShadow: {
      none: 'none',
      raised: '0 1px 2px rgb(14 60 66 / 0.08), 0 2px 8px rgb(14 60 66 / 0.06)',
      overlay: '0 8px 30px rgb(10 40 45 / 0.22)',
    },
    extend: {
      spacing: { touch: '2.75rem' },
      maxWidth: { prose: '68ch', page: '72rem' },
      minHeight: { touch: '2.75rem' },
      minWidth: { touch: '2.75rem' },
    },
  },
  plugins: [
    plugin((api) => {
      api.addBase({
        ':root': variables(light),
        ':root[data-theme="dark"]': variables(dark),
        ':root[data-theme="contrast"]': variables(highContrast),
        '@media (prefers-color-scheme: dark)': { ':root:not([data-theme])': variables(dark) },
        '@media (prefers-contrast: more)': {
          ':root:not([data-theme])': variables(highContrast),
        },
      });
    }),
  ],
};

export default config;
