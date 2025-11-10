import { useColorScheme as rnUseColorScheme } from 'react-native';

let Constants: any;
try {
	// expo-constants may not be available in all environments (web/node test), so guard.
	// eslint-disable-next-line @typescript-eslint/no-var-requires
	Constants = require('expo-constants');
} catch (e) {
	Constants = undefined;
}

/**
 * Custom useColorScheme hook that respects `app.json` -> `expo.userInterfaceStyle` when present.
 * Falls back to React Native's useColorScheme otherwise.
 */
export function useColorScheme(): 'light' | 'dark' | null {
	const forced = Constants?.expoConfig?.userInterfaceStyle ?? Constants?.manifest?.userInterfaceStyle;
	if (forced === 'light') return 'light';
	if (forced === 'dark') return 'dark';
		const val = rnUseColorScheme();
		if (val === 'light' || val === 'dark') return val;
		return null;
}
