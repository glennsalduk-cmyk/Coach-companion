// Palette reprise du prototype (Design Component) pour garder une continuité
// visuelle entre le mockup et la vraie app.
export const colors = {
  bg: '#F9F8FC',
  ink: '#211F2E',
  inkSoft: '#5C5A6B',
  inkFaint: '#8B899C',
  border: '#E7E5EE',
  card: '#FFFFFF',
  primary: '#6D5AE6',
  primarySoft: '#EDEAFB',
  coral: '#C24E32',
  coralSoft: '#FBE8E2',
  teal: '#1F7A63',
  tealSoft: '#E4F3EE',
  amber: '#A6721E',
  amberSoft: '#FAF0DE',
} as const;

export const spacing = {
  xs: 4,
  sm: 8,
  md: 12,
  lg: 16,
  xl: 24,
} as const;

export const radius = {
  sm: 10,
  md: 14,
  lg: 18,
  xl: 22,
  pill: 100,
} as const;
