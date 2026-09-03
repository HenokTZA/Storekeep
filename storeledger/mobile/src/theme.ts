/**
 * StoreLedger uses an explicit, contrast-checked palette.
 *
 * Do not replace these values with Android PlatformColor attributes. Expo Go
 * hosts the app inside another Android application and some Samsung/Android
 * combinations resolve those attributes inconsistently (for example, white
 * text and borders on a white surface). Keeping the palette app-owned makes
 * every screen deterministic on physical devices as well as the web preview.
 */
export const colors = {
  background: '#F5F7F4',
  surface: '#FFFFFF',
  surfaceRaised: '#FFFFFF',
  surfaceMuted: '#EEF3F0',
  text: '#14231E',
  textSoft: '#32483F',
  muted: '#53665E',
  border: '#D7E1DC',
  borderStrong: '#B9CAC2',
  primary: '#126B52',
  primaryButton: '#126B52',
  primaryDark: '#0B503D',
  primarySoft: '#E7F3EE',
  primaryBorder: '#9BCBB9',
  searchSurface: '#F0F4F2',
  danger: '#B7352C',
  dangerButton: '#B7352C',
  dangerSoft: '#FDECEA',
  dangerBorder: '#F2B9B4',
  warning: '#875000',
  warningSoft: '#FFF3D8',
  warningBorder: '#F2D28E',
  success: '#087650',
  successSoft: '#E6F5EF',
  neutral: '#61736B',
  onPrimary: '#FFFFFF',
  overlay: '#14231E',
} as const;

export const spacing = {
  xs: 4,
  sm: 8,
  mdSm: 12,
  md: 16,
  mdLg: 20,
  lg: 24,
  xl: 32,
};

export const radius = {
  sm: 10,
  md: 14,
  lg: 18,
  xl: 24,
  pill: 999,
} as const;

export const shadow = {
  card: {
    shadowColor: colors.overlay,
    shadowOffset: { width: 0, height: 3 },
    shadowOpacity: 0.055,
    shadowRadius: 10,
    elevation: 2,
  },
  floating: {
    shadowColor: colors.overlay,
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.14,
    shadowRadius: 18,
    elevation: 8,
  },
} as const;
