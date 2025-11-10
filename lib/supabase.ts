// Note: react-native-url-polyfill may be required by some environments. If you see
// a runtime error about it missing, install it with:
//   npx expo install react-native-url-polyfill
// and uncomment the import below.
// import 'react-native-url-polyfill/auto'

let Constants: any;
try {
  // eslint-disable-next-line @typescript-eslint/no-var-requires
  Constants = require('expo-constants');
} catch (e) {
  Constants = undefined;
}

let AsyncStorage: any;
try {
  // eslint-disable-next-line @typescript-eslint/no-var-requires
  AsyncStorage = require('@react-native-async-storage/async-storage').default;
} catch (e) {
  AsyncStorage = undefined;
}

let createClient: any;
let processLock: any;
try {
  // eslint-disable-next-line @typescript-eslint/no-var-requires
  const supabase = require('@supabase/supabase-js');
  createClient = supabase.createClient;
  processLock = supabase.processLock;
} catch (e) {
  createClient = undefined;
  processLock = undefined;
}

// Prefer the project .env names we use in app.config.js, fall back to EXPO_PUBLIC_* names.
const SUPABASE_URL =
  process.env.SUPABASE_PROJECT_URL || process.env.EXPO_PUBLIC_SUPABASE_URL || Constants?.expoConfig?.extra?.SUPABASE_PROJECT_URL || '';

const SUPABASE_ANON_KEY =
  process.env.SUPABASE_PROJECT_ANON_KEY || process.env.EXPO_PUBLIC_SUPABASE_KEY || Constants?.expoConfig?.extra?.SUPABASE_PROJECT_ANON_KEY || '';

if (!SUPABASE_URL || !SUPABASE_ANON_KEY) {
  // eslint-disable-next-line no-console
  console.warn('Supabase keys are not set. Provide SUPABASE_PROJECT_URL and SUPABASE_PROJECT_ANON_KEY via .env or app.config.js extra.');
}

let supabaseClient: any = null;
if (createClient && SUPABASE_URL && SUPABASE_ANON_KEY) {
  const options: any = {};
  if (AsyncStorage) {
    options.auth = {
      storage: AsyncStorage,
      autoRefreshToken: true,
      persistSession: true,
      detectSessionInUrl: false,
      lock: processLock,
    };
  }
  supabaseClient = createClient(SUPABASE_URL, SUPABASE_ANON_KEY, options);
} else {
  const missingMsg = 'Supabase client not initialized - missing keys or libraries.';
  supabaseClient = {
    auth: {
      signUp: async () => ({ data: null, error: new Error(missingMsg) }),
      signInWithPassword: async () => ({ data: null, error: new Error(missingMsg) }),
      signInWithOtp: async () => ({ data: null, error: new Error(missingMsg) }),
      getSession: async () => ({ data: { session: null } }),
      onAuthStateChange: (_cb: any) => ({ data: { subscription: { unsubscribe: () => {} } } }),
    },
    from: () => ({ select: async () => ({ data: null, error: new Error(missingMsg) }) }),
  };
}

export const supabase = supabaseClient;

export default supabase;
        