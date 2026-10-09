import { initializeApp, getApps } from "firebase/app";
import { getAuth, GoogleAuthProvider } from "firebase/auth";

const rawApiKey = import.meta.env.VITE_FIREBASE_API_KEY;

export const isFirebaseConfigured = Boolean(
  rawApiKey &&
  typeof rawApiKey === "string" &&
  rawApiKey.trim() !== "" &&
  rawApiKey !== "AIzaSy..." &&
  rawApiKey !== "your-api-key"
);

const firebaseConfig = {
  apiKey: rawApiKey || "",
  authDomain: import.meta.env.VITE_FIREBASE_AUTH_DOMAIN || "",
  projectId: import.meta.env.VITE_FIREBASE_PROJECT_ID || "",
  storageBucket: import.meta.env.VITE_FIREBASE_STORAGE_BUCKET || "",
  messagingSenderId: import.meta.env.VITE_FIREBASE_MESSAGING_SENDER_ID || "",
  appId: import.meta.env.VITE_FIREBASE_APP_ID || "",
};

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

