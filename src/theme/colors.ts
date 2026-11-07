export const colors = {
  background: '#101114',
  surface: '#1B1D22',
  surfaceSecondary: '#252830',
  primary: '#B8F36B',
  /** Primária translúcida para destaques suaves (ex.: série concluída). */
  primarySoft: 'rgba(184, 243, 107, 0.10)',
  onPrimary: '#101114',
  textPrimary: '#FFFFFF',
  textSecondary: '#9297A1',
  border: '#30343C',
  error: '#FF6262',
  overlay: 'rgba(0, 0, 0, 0.65)',
  pressedOverlay: 'rgba(255, 255, 255, 0.04)',
} as const;

export type ColorToken = keyof typeof colors;
