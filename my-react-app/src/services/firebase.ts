import { initializeApp, getApps, getApp } from "firebase/app";
import { getAuth } from "firebase/auth";
import { getStorage } from "firebase/storage";
import { getFirestore, initializeFirestore, persistentLocalCache } from "firebase/firestore";

// 🚀 Best Practice: Keep all these in your .env file
const firebaseConfig = {
  apiKey: import.meta.env.VITE_FIREBASE_API_KEY,
  authDomain: import.meta.env.VITE_FIREBASE_AUTH_DOMAIN,
  projectId: import.meta.env.VITE_FIREBASE_PROJECT_ID,
  storageBucket: import.meta.env.VITE_FIREBASE_STORAGE_BUCKET,
  messagingSenderId: import.meta.env.VITE_FIREBASE_MESSAGING_SENDER_ID,
  appId: import.meta.env.VITE_FIREBASE_APP_ID,
  measurementId: import.meta.env.VITE_FIREBASE_MEASUREMENT_ID
};

// 🛡️ Fail-safe: Alert the developer immediately if the API key is missing
if (!firebaseConfig.apiKey) {
  console.error("🔥 Firebase Error: VITE_FIREBASE_API_KEY is undefined. Check your .env file!");
}

// 🏗️ Step 1: Initialize the Engine
// This check is great for React's Fast Refresh
const app = getApps().length > 0 ? getApp() : initializeApp(firebaseConfig);
// 🏗️ Step 2: Export Services
export const auth = getAuth(app);
export const db = initializeFirestore(app, {
  localCache: persistentLocalCache()
});
export const storage = getStorage(app);

export default app;