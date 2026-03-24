const fs = require('fs');
const path = require('path');

// Load .env during config resolution so values are available to Expo via expo-constants
try {
  require('dotenv').config();
} catch (e) {
  // dotenv might not be installed; we'll keep going and expect environment variables to be
  // provided by the shell or CI.
}

const appJson = require('./app.json');

module.exports = () => {
  const extra = {
    SUPABASE_PROJECT_URL: process.env.SUPABASE_PROJECT_URL || process.env.SUPABASE_PROJECT_URL || process.env.SUPABASE_PROJECT_URL,
    SUPABASE_PROJECT_ANON_KEY: process.env.SUPABASE_PROJECT_ANON_KEY || process.env.SUPABASE_PROJECT_ANON_KEY || process.env.SUPABASE_PROJECT_ANON_KEY,
    // Hold Detection API (FastAPI backend)
    HOLD_DETECTION_API_URL: process.env.HOLD_DETECTION_API_URL || process.env.EXPO_PUBLIC_HOLD_DETECTION_API_URL || 'http://localhost:8000',
  };

  // Debug: print whether the keys are present (do NOT print the actual keys).
  try {
    // eslint-disable-next-line no-console
    console.log('[app.config] SUPABASE_PROJECT_URL present:', !!extra.SUPABASE_PROJECT_URL);
    // eslint-disable-next-line no-console
    console.log('[app.config] SUPABASE_PROJECT_ANON_KEY present:', !!extra.SUPABASE_PROJECT_ANON_KEY);
    // eslint-disable-next-line no-console
    console.log('[app.config] HOLD_DETECTION_API_URL:', extra.HOLD_DETECTION_API_URL);
  } catch (e) {
    // ignore any logging issues
  }

  return {
    expo: {
      ...appJson.expo,
      extra,
    },
  };
};
