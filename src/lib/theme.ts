import { useColorScheme } from 'react-native';

const light = {
  bg: '#EEF2EF',
  surface: '#FFFFFF',
  surface2: '#F5F8F6',
  line: '#D9E2DD',
  fg: '#17262A',
  muted: '#5B6B68',
  accent: '#2F6F5E',
  accentFg: '#FFFFFF',
  accentSoft: '#DCEBE5',
  honey: '#C98A1B',
  honeySoft: '#FBEFD7',
  warn: '#B45309',
  warnSoft: '#FDEBD3',
  ok: '#2F7D4A',
  okSoft: '#DDF0E3',
  bad: '#B42318',
};

const dark: typeof light = {
  bg: '#101716',
  surface: '#18211F',
  surface2: '#1E2926',
  line: '#2C3A36',
  fg: '#E7EEEB',
  muted: '#9AAAA5',
  accent: '#6FC2A6',
  accentFg: '#0E1A17',
  accentSoft: '#21362F',
  honey: '#E8B44F',
  honeySoft: '#3A2F17',
  warn: '#F0A957',
  warnSoft: '#3A2A14',
  ok: '#7BCB95',
  okSoft: '#1C3324',
  bad: '#F2877C',
};

export type Palette = typeof light;

export function useTheme(): Palette {
  return useColorScheme() === 'dark' ? dark : light;
}

export const APP_VERSION = '0.1.0';
