// Design tokens derived from docs/reference/ui-concept.png (green actions, deep-green hero,
// white rounded cards, auto yellow). Components read tokens from here, never raw values.

export const colors = {
  green50: '#ECF8F0',
  green100: '#D4F0DD',
  green500: '#23A55A',
  green600: '#1E9B4F', // primary actions ("Book Seat", "Go Online")
  green700: '#177C3F',
  green800: '#0F5A3A', // "You are Online" hero
  green900: '#0A3F29',

  autoYellow: '#F5C518',
  autoYellowSoft: '#FFF6D1',

  ink900: '#111827',
  ink700: '#374151',
  ink500: '#6B7280',
  ink400: '#9CA3AF',
  ink300: '#D1D5DB',
  border: '#E5E7EB',
  surface: '#FFFFFF',
  background: '#F5F7F6',

  dangerSoft: '#FDECEC', // "Go Offline" / "End Trip"
  danger: '#D93636',
  warningSoft: '#FFF4D6',
  warning: '#9A6700',
  infoSoft: '#E8F1FD',
  info: '#1D5FBF',

  white: '#FFFFFF',
  overlay: 'rgba(17, 24, 39, 0.45)',
} as const;

export const spacing = {
  xxs: 2,
  xs: 4,
  sm: 8,
  md: 12,
  lg: 16,
  xl: 24,
  xxl: 32,
  xxxl: 48,
} as const;

export const radius = {
  sm: 8,
  md: 12,
  lg: 16,
  xl: 24,
  pill: 999,
} as const;

export const typography = {
  display: { fontSize: 34, lineHeight: 40, fontWeight: '800' },
  title: { fontSize: 24, lineHeight: 30, fontWeight: '700' },
  heading: { fontSize: 18, lineHeight: 24, fontWeight: '700' },
  body: { fontSize: 16, lineHeight: 22, fontWeight: '400' },
  bodyStrong: { fontSize: 16, lineHeight: 22, fontWeight: '600' },
  small: { fontSize: 14, lineHeight: 20, fontWeight: '400' },
  caption: { fontSize: 12, lineHeight: 16, fontWeight: '500' },
} as const;

export type TypographyVariant = keyof typeof typography;

export const shadow = {
  card: {
    shadowColor: '#0B1F14',
    shadowOpacity: 0.06,
    shadowRadius: 8,
    shadowOffset: { width: 0, height: 2 },
    elevation: 2,
  },
} as const;

/** Minimum touch target (platform accessibility guidance: 44pt iOS / 48dp Android). */
export const MIN_TOUCH = 48;

export const theme = { colors, spacing, radius, typography, shadow } as const;
