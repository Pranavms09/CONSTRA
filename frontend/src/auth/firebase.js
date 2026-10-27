import { initializeApp, getApps } from "firebase/app";
import { getAuth, GoogleAuthProvider } from "firebase/auth";

const firebaseConfig = {
  apiKey: import.meta.env.VITE_FIREBASE_API_KEY,
  authDomain: import.meta.env.VITE_FIREBASE_AUTH_DOMAIN || "constra-b561b.firebaseapp.com",
  projectId: import.meta.env.VITE_FIREBASE_PROJECT_ID || "constra-b561b",
  storageBucket: import.meta.env.VITE_FIREBASE_STORAGE_BUCKET || "constra-b561b.firebasestorage.app",
  messagingSenderId: import.meta.env.VITE_FIREBASE_MESSAGING_SENDER_ID || "328961609707",
  appId: import.meta.env.VITE_FIREBASE_APP_ID || "1:328961609707:web:841fdcb96e2e544c8093ae",
};

const rawApiKey = firebaseConfig.apiKey;

export const isFirebaseConfigured = Boolean(
  rawApiKey &&
  typeof rawApiKey === "string" &&
  rawApiKey.trim() !== "" &&
  !rawApiKey.includes("your_firebase_api_key") &&
  rawApiKey !== "AIzaSy..."
);

let app = null;
let auth = null;
let googleProvider = null;

if (isFirebaseConfigured) {
  try {
    app = getApps().length > 0 ? getApps()[0] : initializeApp(firebaseConfig);
    auth = getAuth(app);
    googleProvider = new GoogleAuthProvider();
    googleProvider.setCustomParameters({ prompt: "select_account" });
  } catch (error) {
    console.warn("Failed to initialize Firebase Auth:", error);
    app = null;
    auth = null;
    googleProvider = null;
  }
} else {
  console.info("Firebase API key not set or invalid. Running frontend in Demo / Test mode.");
}

export { app, auth, googleProvider };
