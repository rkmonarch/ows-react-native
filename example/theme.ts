/**
 * Design system tokens — light theme
 * Inspired by modern fintech / Stripe dashboard aesthetics
 */
export const C = {
  // Backgrounds
  bg: '#F8F9FC',
  surface: '#FFFFFF',
  surfaceAlt: '#F1F4F9',

  // Brand
  primary: '#6C47FF',       // Deep violet
  primaryLight: '#EDE9FF',
  primaryDark: '#5035CC',

  // Accents
  success: '#12B76A',
  successLight: '#DCFCE7',
  warning: '#F79009',
  warningLight: '#FEF3C7',
  danger: '#F04438',
  dangerLight: '#FEE4E2',

  // Text
  textPrimary: '#0F172A',
  textSecondary: '#475569',
  textMuted: '#94A3B8',
  textInverse: '#FFFFFF',

  // Borders
  border: '#E2E8F0',
  borderStrong: '#CBD5E1',

  // Shadows (use with elevation)
  shadow: 'rgba(15, 23, 42, 0.08)',
} as const;

export const S = {
  // Border radius
  radiusSm: 8,
  radiusMd: 12,
  radiusLg: 16,
  radiusXl: 20,
  radiusFull: 999,

  // Spacing
  xs: 4,
  sm: 8,
  md: 16,
  lg: 24,
  xl: 32,

  // Typography
  caption: 11,
  small: 13,
  body: 15,
  subtitle: 17,
  title: 22,
  display: 28,
} as const;
