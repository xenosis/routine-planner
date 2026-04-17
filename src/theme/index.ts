import {
  MD3DarkTheme,
  MD3LightTheme,
  type MD3Theme,
} from 'react-native-paper';

// 브랜드 컬러 팔레트 정의
const brandColors = {
  primary: '#6366F1',       // 인디고 - 메인 브랜드 컬러
  primaryLight: '#818CF8',  // 밝은 인디고 (다크모드용)
  secondary: '#10B981',     // 에메랄드 - 성공/완료 표시
  error: '#EF4444',         // 레드 - 에러/삭제
  warning: '#F59E0B',       // 앰버 - 경고
};

// 라이트 테마 커스텀 색상
const lightColors = {
  primary: brandColors.primary,
  onPrimary: '#FFFFFF',
  primaryContainer: '#E0E7FF',
  onPrimaryContainer: '#3730A3',

  secondary: brandColors.secondary,
  onSecondary: '#FFFFFF',
  secondaryContainer: '#D1FAE5',
  onSecondaryContainer: '#065F46',

  background: '#F8F8FF',
  onBackground: '#1A1A2E',

  surface: '#FFFFFF',
  onSurface: '#1A1A2E',
  surfaceVariant: '#F1F0FF',
  onSurfaceVariant: '#4B4B6E',

  error: brandColors.error,
  onError: '#FFFFFF',

  outline: '#C7C7D9',
  outlineVariant: '#E5E5F0',
};

// 다크 테마 커스텀 색상
const darkColors = {
  primary: brandColors.primaryLight,
  onPrimary: '#1E1B4B',
  primaryContainer: '#3730A3',
  onPrimaryContainer: '#C7D2FE',

  secondary: '#34D399',
  onSecondary: '#022C22',
  secondaryContainer: '#065F46',
  onSecondaryContainer: '#A7F3D0',

  background: '#0F0F1A',
  onBackground: '#E8E8F5',

  surface: '#1A1A2E',
  onSurface: '#E8E8F5',
  surfaceVariant: '#252540',
  onSurfaceVariant: '#B0B0CC',

  error: '#F87171',
  onError: '#7F1D1D',

  outline: '#4B4B6E',
  outlineVariant: '#2D2D4E',
};

// 라이트 테마 생성
export const lightTheme: MD3Theme = {
  ...MD3LightTheme,
  colors: {
    ...MD3LightTheme.colors,
    ...lightColors,
  },
};

// 다크 테마 생성
export const darkTheme: MD3Theme = {
  ...MD3DarkTheme,
  colors: {
    ...MD3DarkTheme.colors,
    ...darkColors,
  },
};

// 공통 디자인 토큰 (간격, 반경 등)
export const spacing = {
  xs: 4,
  sm: 8,
  md: 12,
  base: 16,
  lg: 20,
  xl: 24,
  xxl: 32,
  xxxl: 48,
} as const;

export const borderRadius = {
  sm: 8,
  md: 12,
  lg: 16,
  xl: 24,
  full: 9999,
} as const;
