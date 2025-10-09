import { initializeApp, getApps, getApp } from 'firebase/app';
import { getFirestore } from 'firebase/firestore';

const requiredKeys = [
  'VITE_FIREBASE_API_KEY',
  'VITE_FIREBASE_AUTH_DOMAIN',
  'VITE_FIREBASE_PROJECT_ID',
  'VITE_FIREBASE_APP_ID',
];

const cache = {
  app: null,
  db: null,
  isConfigured: null,
};

function hasFirebaseConfig() {
  if (cache.isConfigured !== null) {
    return cache.isConfigured;
  }

  const missing = requiredKeys.filter((key) => {
    const value = import.meta.env[key];
    return typeof value === 'undefined' || value === '';
  });

  cache.isConfigured = missing.length === 0;

  if (!cache.isConfigured && import.meta.env.PROD) {
    console.warn(
      'Firebase configuration is missing. Provide all VITE_FIREBASE_* env variables to enable launch list capture.'
    );
  }

  return cache.isConfigured;
}

export function getFirestoreInstance() {
  if (cache.db) {
    return cache.db;
  }

  if (!hasFirebaseConfig()) {
    return null;
  }

  const config = {
    apiKey: import.meta.env.VITE_FIREBASE_API_KEY,
    authDomain: import.meta.env.VITE_FIREBASE_AUTH_DOMAIN,
    projectId: import.meta.env.VITE_FIREBASE_PROJECT_ID,
    storageBucket: import.meta.env.VITE_FIREBASE_STORAGE_BUCKET,
    messagingSenderId: import.meta.env.VITE_FIREBASE_MESSAGING_SENDER_ID,
    appId: import.meta.env.VITE_FIREBASE_APP_ID,
  };

  cache.app = getApps().length ? getApp() : initializeApp(config);
  cache.db = getFirestore(cache.app);
  return cache.db;
}
