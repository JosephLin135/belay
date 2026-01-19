import { StyleSheet, Text, type TextProps } from 'react-native';

import { useThemeColor } from '@/hooks/use-theme-color';

export type ThemedTextProps = TextProps & {
  lightColor?: string;
  darkColor?: string;
  type?: 'default' | 'title' | 'defaultSemiBold' | 'subtitle' | 'link' | 'heading' | 'caption' | 'label';
};

export function ThemedText({
  style,
  lightColor,
  darkColor,
  type = 'default',
  ...rest
}: ThemedTextProps) {
  const color = useThemeColor({ light: lightColor, dark: darkColor }, 'text');

  return (
    <Text
      style={[
        { color },
        type === 'default' ? styles.default : undefined,
        type === 'title' ? styles.title : undefined,
        type === 'defaultSemiBold' ? styles.defaultSemiBold : undefined,
        type === 'subtitle' ? styles.subtitle : undefined,
        type === 'link' ? styles.link : undefined,
        type === 'heading' ? styles.heading : undefined,
        type === 'caption' ? styles.caption : undefined,
        type === 'label' ? styles.label : undefined,
        style,
      ]}
      {...rest}
    />
  );
}

const styles = StyleSheet.create({
  default: {
    fontSize: 16,
    lineHeight: 24,
  },
  defaultSemiBold: {
    fontSize: 16,
    lineHeight: 24,
    fontWeight: '600',
  },
  title: {
    fontSize: 32,
    fontWeight: '800',
    lineHeight: 38,
    letterSpacing: -0.5,
  },
  subtitle: {
    fontSize: 20,
    fontWeight: '700',
    lineHeight: 26,
  },
  heading: {
    fontSize: 24,
    fontWeight: '700',
    lineHeight: 30,
    letterSpacing: -0.3,
  },
  caption: {
    fontSize: 12,
    lineHeight: 16,
    color: '#64748B',
  },
  label: {
    fontSize: 14,
    fontWeight: '600',
    lineHeight: 18,
    letterSpacing: 0.2,
  },
  link: {
    lineHeight: 30,
    fontSize: 16,
    color: '#799FCB',
    fontWeight: '500',
  },
});
