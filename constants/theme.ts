/**
 * Below are the colors that are used in the app. The colors are defined in the light and dark mode.
 * There are many other ways to style your app. For example, [Nativewind](https://www.nativewind.dev/), [Tamagui](https://tamagui.dev/), [unistyles](https://reactnativeunistyles.vercel.app), etc.
 */

import { Platform } from 'react-native';

// Climbing-inspired color palette
const tintColorLight = '#799FCB'; // Calm slate blue
const tintColorDark = '#A3BFDE';

export const Colors = {
  light: {
    text: '#1E293B',
    background: '#FAFAF9',
    tint: tintColorLight,
    icon: '#64748B',
    tabIconDefault: '#94A3B8',
    tabIconSelected: tintColorLight,
    // Extended climbing palette
    primary: '#799FCB',
    primaryDark: '#5A7FB0',
    secondary: '#2D4A5E',
    accent: '#34D399',
    surface: '#FFFFFF',
    surfaceAlt: '#F1F5F9',
    border: '#E2E8F0',
    textSecondary: '#64748B',
    success: '#22C55E',
    warning: '#F59E0B',
    error: '#EF4444',
  },
  dark: {
    text: '#F1F5F9',
    background: '#0F172A',
    tint: tintColorDark,
    icon: '#94A3B8',
    tabIconDefault: '#64748B',
    tabIconSelected: tintColorDark,
    // Extended climbing palette
    primary: '#A3BFDE',
    primaryDark: '#799FCB',
    secondary: '#5EADD4',
    accent: '#34D399',
    surface: '#1E293B',
    surfaceAlt: '#334155',
    border: '#334155',
    textSecondary: '#94A3B8',
    success: '#22C55E',
    warning: '#F59E0B',
    error: '#EF4444',
  },
};

export const Fonts = Platform.select({
  ios: {
    /** iOS `UIFontDescriptorSystemDesignDefault` */
    sans: 'system-ui',
    /** iOS `UIFontDescriptorSystemDesignSerif` */
    serif: 'ui-serif',
    /** iOS `UIFontDescriptorSystemDesignRounded` */
    rounded: 'ui-rounded',
    /** iOS `UIFontDescriptorSystemDesignMonospaced` */
    mono: 'ui-monospace',
  },
  default: {
    sans: 'normal',
    serif: 'serif',
    rounded: 'normal',
    mono: 'monospace',
  },
  web: {
    sans: "system-ui, -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif",
    serif: "Georgia, 'Times New Roman', serif",
    rounded: "'SF Pro Rounded', 'Hiragino Maru Gothic ProN', Meiryo, 'MS PGothic', sans-serif",
    mono: "SFMono-Regular, Menlo, Monaco, Consolas, 'Liberation Mono', 'Courier New', monospace",
  },
});
