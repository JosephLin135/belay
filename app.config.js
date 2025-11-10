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
  };

  // Debug: print whether the keys are present (do NOT print the actual keys).
  try {
    // eslint-disable-next-line no-console
    console.log('[app.config] SUPABASE_PROJECT_URL present:', !!extra.SUPABASE_PROJECT_URL);
    // eslint-disable-next-line no-console
    console.log('[app.config] SUPABASE_PROJECT_ANON_KEY present:', !!extra.SUPABASE_PROJECT_ANON_KEY);
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
